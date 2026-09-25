import { NextResponse } from "next/server";
import { getPgPool, requireAdminToken } from "@/lib/db";

export const dynamic = "force-dynamic";

// ========= 中文分词（简易版）：英文/数字 token + 中文 2-gram + 中文 3-gram =========
// 不依赖任何外部词库；足够做 TF-IDF 粗粒度相似度。
function tokenizeChinese(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const out: string[] = [];
  // 英文/数字/连字符 token
  const asciiTokens = lower.match(/[a-z0-9][a-z0-9\-]{1,}/g) || [];
  for (const t of asciiTokens) out.push(t);
  // 中文 2-gram + 3-gram
  const chineseSeg = lower.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const seg of chineseSeg) {
    if (seg.length === 1) {
      out.push(seg);
      continue;
    }
    for (let i = 0; i <= seg.length - 2; i++) out.push(seg.slice(i, i + 2));
    for (let i = 0; i <= seg.length - 3; i++) out.push(seg.slice(i, i + 3));
  }
  return out;
}

// 停用词（2 字常见无义词，降低权重但不硬删）
const STOP_BIGRAMS = new Set<string>([
  "的是", "这一", "这个", "这些", "那个", "那些", "我们", "你们", "他们",
  "可以", "进行", "需要", "以及", "或者", "没有", "一个", "一种", "其中",
  "对于", "关于", "为了", "通过", "根据", "按照", "有关", "相关", "进一步",
]);

function buildQueryTermFreq(query: string): Record<string, number> {
  const freq: Record<string, number> = {};
  const tokens = tokenizeChinese(query);
  for (const t of tokens) {
    if (STOP_BIGRAMS.has(t)) continue;
    freq[t] = (freq[t] || 0) + 1;
  }
  // 额外保留：问题中的"完整中文短语"（用标点/空格切）
  const phrases = query
    .split(/[\s，。！？、；：,.;:!?()（）《》"'"]+/)
    .filter((s) => s.length >= 2 && s.length <= 20);
  for (const p of phrases) {
    const pl = p.toLowerCase();
    freq[pl] = Math.max(freq[pl] || 0, 3); // 整段短语命中权重更高
  }
  return freq;
}

// 对一段文本计算与 query 的 TF 重叠分（越接近问题词越多，分数越高）
function scoreText(queryFreq: Record<string, number>, text: string, alreadyBoost: number): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const [term, weight] of Object.entries(queryFreq)) {
    if (lower.includes(term)) score += weight;
  }
  // 归一化：避免长文本虚高
  const lengthNorm = 1 + Math.log2(1 + lower.length);
  return (score + alreadyBoost) / lengthNorm;
}

type SearchHit = {
  sourceId: string;
  url: string;
  title: string;
  summary: string | null;
  listPublishedAt: string | null;
  firstSeenAt: string | null;
  departmentName: string;
  channelName: string;
  keywordScore: number;
  importanceLevel: string;
  forecastHigh: string | null;
  forecastMidHigh: string | null;
  forecastMid: string | null;
  forecastLow: string | null;
  paragraphs: string[];
  matchedCategories: Array<{ category: string; score: number; topKeywords?: string[] }>;
  // 下面是检索时打分出来的
  itemScore: number;
  // 命中段落（带原始段落索引，用于后续 RAG）
  hitParagraphs: Array<{ idx: number; text: string; score: number }>;
  matchedQueryTerms: string[];
};

export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const query = (body.query || "").toString().trim();
    const topItems = Math.max(1, Math.min(40, parseInt(body.topItems || "8", 10)));
    const topParasPerItem = Math.max(1, Math.min(8, parseInt(body.topParasPerItem || "3", 10)));

    if (!query || query.length < 2) {
      return NextResponse.json({
        ok: true,
        items: [],
        message: "请输入更具体的关键词（至少 2 字以上）",
      });
    }

    const pool = getPgPool();

    // —— 1. 先做一个"粗筛" SQL：title / summary / department / channel 里有任意一个查询词片段即候选
    //    避免全表扫 content_json；粗筛用 LIKE 取 200 条，再在内存里做细粒度打分
    const queryFreq = buildQueryTermFreq(query);
    const terms = Object.keys(queryFreq);
    if (terms.length === 0) {
      return NextResponse.json({ ok: true, items: [], message: "查询过于宽泛，请换更具体的关键词" });
    }

    // 取 2-4 个代表性的"较长中文词"做 SQL LIKE 粗筛，尽可能缩小候选集
    const representativeTerms = terms
      .filter((t) => /[\u4e00-\u9fa5]/.test(t) && t.length >= 2)
      .slice(0, 3);
    const likeTerms = representativeTerms.length > 0 ? representativeTerms : terms.slice(0, 3);

    const sqlOrParts = likeTerms.map(
      (_, i) =>
        `(LOWER(mi.title) LIKE $${i + 1} OR LOWER(COALESCE(mi.summary,'')) LIKE $${i + 1} OR LOWER(COALESCE(mi.department_name,'')) LIKE $${i + 1} OR LOWER(COALESCE(mi.channel_name,'')) LIKE $${i + 1})`,
    );
    const whereClause =
      sqlOrParts.length > 0
        ? `WHERE (${sqlOrParts.join(" OR ")})`
        : "";

    const sqlParams = likeTerms.map((t) => `%${t}%`);

    const rows = await pool
      .query(
        `
        SELECT
          mi.source_id,
          mi.url,
          mi.title,
          mi.summary,
          mi.list_published_at,
          mi.first_seen_at,
          mi.department_name,
          mi.channel_name,
          mi.keyword_score,
          mi.importance_level,
          mi.matched_categories,
          mi.content_json,
          mi.forecast_high,
          mi.forecast_mid_high,
          mi.forecast_mid,
          mi.forecast_low
        FROM monitor_items mi
        ${whereClause}
        ORDER BY COALESCE(mi.list_published_at, mi.first_seen_at) DESC
        LIMIT 200
        `,
        sqlParams,
      )
      .catch((e) => {
        console.error("chat/search 粗筛 SQL 失败：", e);
        return { rows: [] } as { rows: Array<Record<string, unknown>> };
      });

    // —— 2. 内存里做 TF 打分 + 段落级检索
    const hits: SearchHit[] = [];
    for (const row of rows.rows) {
      const paragraphs: string[] = Array.isArray(row.content_json)
        ? (row.content_json as unknown[]).filter((x): x is string => typeof x === "string")
        : [];

      // title + summary 的基础分：包含 title 里的整段短语，权重加倍
      const titleBoost = (row.title && query.toLowerCase().includes(row.title.toLowerCase())) ? 8 : 0;
      const titleScore = scoreText(queryFreq, row.title || "", 0);
      const summaryScore = scoreText(queryFreq, row.summary || "", 0);

      // 段落打分：每个段落单独算分，取 Top-K
      const paraScored = paragraphs
        .map((p, idx) => ({ idx, text: p, score: scoreText(queryFreq, p, 0) }))
        .filter((s) => s.text.trim().length >= 8 && s.score > 0)
        .sort((a, b) => b.score - a.score);
      const topParas = paraScored.slice(0, topParasPerItem);

      // 文档综合分 = title 分 + summary 分 + 最佳段落分 + 命中段落数量加分
      const bestParaScore = topParas[0]?.score || 0;
      const itemScore =
        titleScore * 2.0 + summaryScore * 1.0 + bestParaScore * 1.5 + topParas.length * 0.3 + titleBoost;

      // 过滤：至少得在 title/summary/段落中有"有效命中"
      if (itemScore <= 0.1) continue;

      // 记录命中了哪些查询词（用于前端高亮/提示）
      const lowerJoined = `${row.title || ""} ${row.summary || ""} ${topParas
        .map((p) => p.text)
        .join(" ")}`.toLowerCase();
      const matched: string[] = [];
      for (const t of terms) if (lowerJoined.includes(t)) matched.push(t);

      let categories: Array<{ category: string; score: number; topKeywords?: string[] }> = [];
      if (row.matched_categories) {
        try {
          const parsed = JSON.parse(String(row.matched_categories));
          if (Array.isArray(parsed)) categories = parsed;
        } catch {
          // ignore
        }
      }

      hits.push({
        sourceId: row.source_id,
        url: row.url,
        title: row.title,
        summary: row.summary,
        listPublishedAt: row.list_published_at,
        firstSeenAt: row.first_seen_at,
        departmentName: row.department_name || "未分类来源",
        channelName: row.channel_name || row.source_id,
        keywordScore: row.keyword_score || 0,
        importanceLevel: row.importance_level || "普通内容",
        forecastHigh: row.forecast_high,
        forecastMidHigh: row.forecast_mid_high,
        forecastMid: row.forecast_mid,
        forecastLow: row.forecast_low,
        paragraphs,
        matchedCategories: categories,
        itemScore,
        hitParagraphs: topParas,
        matchedQueryTerms: matched,
      });
    }

    // —— 3. 排序：综合分为主；同分以时间倒序
    hits.sort((a, b) => {
      if (Math.abs(b.itemScore - a.itemScore) > 0.0001) return b.itemScore - a.itemScore;
      const at = a.listPublishedAt || a.firstSeenAt || "0";
      const bt = b.listPublishedAt || b.firstSeenAt || "0";
      return bt.localeCompare(at);
    });

    const top = hits.slice(0, topItems);

    // —— 4. 组装前端数据（把 paragraphs 去掉换成 hitParagraphs，减小 payload）
    const items = top.map((h) => ({
      sourceId: h.sourceId,
      url: h.url,
      title: h.title,
      summary: h.summary,
      listPublishedAt: h.listPublishedAt,
      departmentName: h.departmentName,
      channelName: h.channelName,
      keywordScore: h.keywordScore,
      importanceLevel: h.importanceLevel,
      forecastHigh: h.forecastHigh,
      forecastMidHigh: h.forecastMidHigh,
      forecastMid: h.forecastMid,
      forecastLow: h.forecastLow,
      matchedCategories: h.matchedCategories.slice(0, 3),
      matchedQueryTerms: Array.from(new Set(h.matchedQueryTerms)).slice(0, 8),
      // 用于下一步 RAG 的"正文池"
      hitParagraphs: h.hitParagraphs.map((p) => ({
        idx: p.idx,
        snippet: p.text.length > 260 ? p.text.slice(0, 260) + "……" : p.text,
      })),
    }));

    return NextResponse.json({
      ok: true,
      items,
      total: hits.length,
      query,
    });
  } catch (error) {
    console.error("chat/search 升级版错误：", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
