import { getPgPool } from "@/lib/db";
import { normalizeItemUrl } from "../utils";

export async function scanAndApplyKeywords(sourceId: string, url: string): Promise<string[] | null> {
  const pool = getPgPool();
  const targetUrl = normalizeItemUrl(url);
  const item = await pool.query<{ source_id: string; url: string; title: string; content_json: string; capture_note: string; department_name: string }>(
    `select i.source_id, i.url, i.title, i.content_json, i.capture_note, s.department_name
     from monitor_items i
     join monitor_sources s on s.id = i.source_id
     where i.source_id = $1 and i.url = $2`,
    [sourceId, targetUrl],
  );
  if (item.rows.length === 0) return null;
  const row = item.rows[0];

  const keywords = await pool.query<{ keyword: string; weight: number; category: string; match_mode: string }>(
    `select keyword, weight, category, match_mode from monitor_keywords
     where department_name = '__global__' or department_name = $1
     order by weight desc`,
    [row.department_name],
  );
  if (keywords.rows.length === 0) return null;

  const paragraphs: string[] = [];
  paragraphs.push(row.title ?? "");
  if (row.content_json) {
    try {
      const parsed = JSON.parse(row.content_json);
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          if (typeof p === "string" && p.trim().length >= 4) paragraphs.push(p);
        }
      }
    } catch {}
  }
  if (row.capture_note) paragraphs.push(row.capture_note);

  const isEnglishPhrase = (s: string) => /^[A-Za-z0-9][A-Za-z0-9\-]*$/.test(s);
  const effectiveMatchMode = (mm: string) => {
    if (mm === "contains") return "phrase";
    return mm || "phrase";
  };

  const perParagraphHits: Array<Array<{ category: string; keyword: string; weight: number; matchMode: string; inTitle: boolean }>> = [];
  const matchedByCategory = new Map<string, { keywords: string[]; score: number }>();

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const lower = para.toLowerCase();
    const isTitleParagraph = i === 0 && para === (row.title ?? "");
    const paraHits: Array<{ category: string; keyword: string; weight: number; matchMode: string; inTitle: boolean }> = [];
    const seenThisPara = new Set<string>();

    for (const kw of keywords.rows) {
      const key = `${kw.category}|${kw.keyword}`;
      if (seenThisPara.has(key)) continue;

      let hit = false;
      const phrase = kw.keyword.toLowerCase();
      const mode = effectiveMatchMode(kw.match_mode);

      if (mode === "regex") {
        try {
          const re = new RegExp(kw.keyword, "i");
          hit = re.test(para);
        } catch {
          hit = false;
        }
      } else if (mode === "exact") {
        hit = para.trim() === kw.keyword.trim();
      } else if (kw.match_mode === "word_boundary_en") {
        const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}($|[^a-z0-9])`, "i");
        hit = re.test(lower);
      } else {
        if (isEnglishPhrase(phrase) && phrase.length <= 6) {
          const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}($|[^a-z0-9])`, "i");
          hit = re.test(lower);
        } else {
          hit = lower.includes(phrase);
        }
      }

      if (hit) {
        seenThisPara.add(key);
        const isStructure = kw.category.startsWith("结构·");
        const effectiveWeight = isStructure && !isTitleParagraph ? kw.weight * 0.3 : kw.weight;
        paraHits.push({
          category: kw.category,
          keyword: kw.keyword,
          weight: effectiveWeight,
          matchMode: mode,
          inTitle: isTitleParagraph,
        });
      }
    }

    perParagraphHits.push(paraHits);
  }

  let totalScore = 0;
  const uniqueHitKeywords = new Set<string>();
  const strongSignalCategories = new Set<string>();
  const signalCategoryStrength: Record<string, number> = {};
  const STRONG_TOPIC_CATEGORIES = new Set([
    "AI/智能体/大模型",
    "数据要素/高质量数据集",
    "算力/算力网/算电协同",
    "产业合作/京津冀协同",
    "政务服务/平台经济/数字经济",
    "法规/征求意见",
  ]);
  const SIGNAL_CATEGORIES = new Set([
    "A·强执行信号",
    "B·强支持信号",
    "C·风险信号",
    "D·探索信号",
    "通用启动/落地",
  ]);
  const STRUCTURE_CATEGORIES = new Set([
    "结构·正式发文",
    "结构·征求意见",
    "结构·推进实施",
    "结构·规范调整",
    "结构·名单目录",
    "结构·认定申报",
    "结构·试点示范",
  ]);
  let distinctStrongTopicKeywords = 0;
  let totalStructureScore = 0;
  const structureCategoryStrength: Record<string, number> = {};
  let titleStructureHit = false;

  for (let i = 0; i < perParagraphHits.length; i++) {
    const hits = perParagraphHits[i];
    if (hits.length === 0) continue;
    const isTitle = i === 0 && paragraphs[i] === (row.title ?? "");
    let density = 1;
    if (hits.length >= 4) density = 2;
    else if (hits.length >= 2) density = 1.5;
    const titleBoost = isTitle ? 2 : 1;

    for (const h of hits) {
      const raw = h.weight * density * titleBoost;
      const isStructureHit = STRUCTURE_CATEGORIES.has(h.category);
      const isSignalHit = SIGNAL_CATEGORIES.has(h.category);
      const signalInBody = isSignalHit && !isTitle;
      let contribute = raw;
      if (isStructureHit) contribute = 0;
      else if (signalInBody) contribute = h.weight * density * 1 * 0.3;

      if (contribute > 0) {
        totalScore += contribute;
        uniqueHitKeywords.add(h.keyword);
      }

      if (STRONG_TOPIC_CATEGORIES.has(h.category)) {
        strongSignalCategories.add(h.category);
      }
      if (SIGNAL_CATEGORIES.has(h.category)) {
        signalCategoryStrength[h.category] = (signalCategoryStrength[h.category] || 0) + raw;
      }
      if (isStructureHit) {
        totalStructureScore += raw;
        structureCategoryStrength[h.category] = (structureCategoryStrength[h.category] || 0) + raw;
        if (h.inTitle) titleStructureHit = true;
      }

      if (!matchedByCategory.has(h.category)) {
        matchedByCategory.set(h.category, { keywords: [], score: 0 });
      }
      const bucket = matchedByCategory.get(h.category)!;
      bucket.keywords.push(h.keyword);
      bucket.score += raw;
    }
  }

  totalScore = Math.round(totalScore);

  for (const bucket of matchedByCategory.values()) {
    bucket.keywords = Array.from(new Set(bucket.keywords));
  }

  if (uniqueHitKeywords.size === 0) {
    await pool.query(
      `update monitor_items
       set keyword_score = 0, matched_keywords = null, matched_categories = null,
           signal_hits = null, importance_level = '普通内容', is_starred = false
       where source_id = $1 and url = $2`,
      [sourceId, targetUrl],
    );
    try {
      await scanAndApplyGenres(sourceId, url);
    } catch {}
    return null;
  }

  const bodyParagraphCount = (() => {
    try {
      const parsed = JSON.parse(row.content_json || "[]");
      return Array.isArray(parsed) ? parsed.filter((p: unknown) => typeof p === "string" && p.trim().length >= 12).length : 0;
    } catch {
      return 0;
    }
  })();
  const hasMeaningfulBody = bodyParagraphCount >= 2;

  {
    const seen = new Set<string>();
    for (const cat of strongSignalCategories) {
      const bucket = matchedByCategory.get(cat);
      if (!bucket) continue;
      for (const kw of bucket.keywords) seen.add(kw);
    }
    distinctStrongTopicKeywords = seen.size;
  }

  const totalSignalStrength = Object.values(signalCategoryStrength).reduce((s, v) => s + v, 0);
  const riskSignalStrength = signalCategoryStrength["C·风险信号"] || 0;
  const hasStrongTopic = strongSignalCategories.size >= 1;
  const hasRisk = riskSignalStrength >= 4;
  const hasTitleStructure = titleStructureHit && totalStructureScore >= 4;

  const thresholdDiscount =
    (hasTitleStructure ? 20 : 0) + (hasStrongTopic ? 5 : 0) + (hasRisk ? 10 : 0);
  const coreThreshold = Math.max(60, 90 - thresholdDiscount);
  const highlightThreshold = Math.max(40, 50 - thresholdDiscount);
  const midThreshold = Math.max(15, 20 - thresholdDiscount);

  // 正文太短通常只给到「重点内容」防标题党；但分数远超核心线（标题多重强信号叠加）
  // 属实打实的重磅，即便正文短也放行到「核心关注」。
  const clearlyMajor = totalScore >= coreThreshold + 10;
  let level: "普通内容" | "中等重点" | "重点内容" | "核心关注" = "普通内容";
  if ((hasMeaningfulBody || clearlyMajor) && totalScore >= coreThreshold) level = "核心关注";
  else if (totalScore >= highlightThreshold) level = "重点内容";
  else if (totalScore >= midThreshold) level = "中等重点";

  const categorySummary: Array<{ category: string; score: number; topKeywords: string[] }> = [];
  for (const [cat, bucket] of matchedByCategory.entries()) {
    if (bucket.score <= 0) continue;
    categorySummary.push({ category: cat, score: Math.round(bucket.score), topKeywords: bucket.keywords.slice(0, 5) });
  }
  categorySummary.sort((a, b) => b.score - a.score);

  const signalBucket: Record<string, unknown> = {};
  for (const cat of ["A·强执行信号", "B·强支持信号", "C·风险信号", "D·探索信号", "通用启动/落地"]) {
    const bucket = matchedByCategory.get(cat);
    if (bucket && bucket.keywords.length > 0) {
      signalBucket[cat] = {
        keywords: bucket.keywords,
        strength: Math.round(signalCategoryStrength[cat] || 0),
      };
    }
  }
  const structureHits: Record<string, { keywords: string[]; strength: number }> = {};
  for (const cat of [
    "结构·正式发文",
    "结构·征求意见",
    "结构·推进实施",
    "结构·规范调整",
    "结构·名单目录",
    "结构·认定申报",
    "结构·试点示范",
  ]) {
    const bucket = matchedByCategory.get(cat);
    if (bucket && bucket.keywords.length > 0) {
      structureHits[cat] = {
        keywords: bucket.keywords,
        strength: Math.round(structureCategoryStrength[cat] || 0),
      };
    }
  }
  if (Object.keys(structureHits).length > 0) signalBucket["结构词"] = structureHits;

  signalBucket["_meta"] = {
    totalScore,
    totalSignalStrength: Math.round(totalSignalStrength),
    strongTopicCategories: Array.from(strongSignalCategories),
    distinctStrongTopicKeywords,
    bodyParagraphCount,
    totalStructureScore: Math.round(totalStructureScore),
    titleStructureHit,
    riskHit: hasRisk,
    hasStrongTopic,
    hasTitleStructure,
    thresholdDiscount,
    thresholds: {
      core: coreThreshold,
      highlight: highlightThreshold,
      mid: midThreshold,
    },
    level,
  };

  const matchedKeywordsStr = Array.from(uniqueHitKeywords);
  const topHitsForNote = categorySummary.slice(0, 3).map(c => `${categoryLabel(c.category)}(${c.score}): ${c.topKeywords.join("、")}`).join(" | ");
  const notePrefix = `【${level}｜得分 ${totalScore}｜${topHitsForNote || "命中关键词"}】`;

  const existingNoteRaw = row.capture_note ?? "";
  const noteWithoutOldPrefix = existingNoteRaw.replace(/^【[^】]*得分\s*\d+[^】]*】\s*/, "");
  const newNote = noteWithoutOldPrefix.trim()
    ? `${notePrefix}\n${noteWithoutOldPrefix.trim()}`
    : notePrefix;

  const isStarred = level === "核心关注" || level === "重点内容";

  const fundingBucket = matchedByCategory.get("B·强支持信号");
  const fundingKeywords = fundingBucket?.keywords ?? [];
  const hasFunding = fundingKeywords.some(kw =>
    /补贴|补助|专项资金|资金|基金|贷款|以旧换新|算力券|数据券|券|奖补|资助|财政/.test(kw)
  );

  const execBucket = matchedByCategory.get("A·强执行信号");
  const execKeywords = execBucket?.keywords ?? [];
  const hasProcurement = execKeywords.some(kw =>
    /采购|招标|目录|竞价|遴选|竞争性谈判|询价|单一来源/.test(kw)
  ) || fundingKeywords.some(kw => /政府采购/.test(kw));

  const hasPilot = [...execKeywords, ...fundingKeywords].some(kw =>
    /试点|示范|白名单|标杆|可复制/.test(kw)
  );

  const hasStandards = execKeywords.some(kw =>
    /标准|规范|统一|接口|技术|评测|办法|细则|规则|制度/.test(kw)
  );

  let docStatus = "正式文件";
  const titleLower = (row.title ?? "").toLowerCase();
  if (/征求意见|征求意见稿|公开征求意见/.test(titleLower)) {
    docStatus = "征求意见";
  } else if (/会议|部署|讲话|纪要|答记者问/.test(titleLower)) {
    docStatus = "会议口径";
  } else if (/调研|调研反馈|调研报告|调查研究/.test(titleLower)) {
    docStatus = "调研反馈";
  } else if (/实施细则|细则|办法|规定|制度/.test(row.title ?? "")) {
    docStatus = "实施细则";
  } else if (/通知|公告|通告|通报/.test(row.title ?? "")) {
    docStatus = "通知";
  }

  await pool.query(
    `update monitor_items
     set keyword_score = $3,
         matched_keywords = $4::jsonb,
         matched_categories = $5::jsonb,
         signal_hits = $6::jsonb,
         importance_level = $7,
         is_starred = $8,
         capture_note = $9,
         document_status = $10,
         has_funding = $11,
         has_procurement = $12,
         has_pilot = $13,
         has_standards = $14,
         forecast_updated_at = now()
     where source_id = $1 and url = $2`,
    [
      sourceId,
      targetUrl,
      totalScore,
      JSON.stringify(matchedKeywordsStr),
      JSON.stringify(categorySummary),
      JSON.stringify(signalBucket),
      level,
      isStarred,
      newNote,
      docStatus,
      hasFunding,
      hasProcurement,
      hasPilot,
      hasStandards,
    ],
  );

  try {
    await scanAndApplyGenres(sourceId, url);
  } catch {}

  return matchedKeywordsStr;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const GENRE_KEYWORDS: Record<string, string[]> = {
  公告: ["公告"],
  公报: ["公报"],
  决议决定: ["决议", "决定"],
  函: ["函复", "函"],
  意见: ["意见"],
  批复: ["批复"],
  报告: ["报告"],
  通告: ["通告"],
  通报: ["通报"],
  通知: ["通知"],
  部令: ["部令", "令第", "国务院令", "第.*令"],
};

function scanAndApplyGenresHits(text: string): string[] {
  const lower = (text ?? "").toLowerCase();
  const hits = new Set<string>();
  for (const [genre, words] of Object.entries(GENRE_KEYWORDS)) {
    for (const w of words) {
      if (lower.includes(w.toLowerCase())) {
        hits.add(genre);
        break;
      }
    }
  }
  if (hits.size === 0) hits.add("其他");
  return Array.from(hits);
}

export async function scanAndApplyGenres(sourceId: string, url: string) {
  const pool = getPgPool();
  const item = await pool.query<{ title: string; content_json: string; capture_note: string }>(
    `select i.title, i.content_json, i.capture_note
     from monitor_items i
     where i.source_id = $1 and i.url = $2`,
    [sourceId, url],
  );
  if (item.rows.length === 0) return;
  const row = item.rows[0];

  let hay = row.title ?? "";
  if (row.content_json) {
    try {
      const parsed = JSON.parse(row.content_json);
      if (Array.isArray(parsed)) hay += "\n" + parsed.slice(0, 3).join("\n");
    } catch {}
  }
  if (row.capture_note) hay += "\n" + row.capture_note;

  const genres = scanAndApplyGenresHits(hay);
  await pool.query(
    `update monitor_items set matched_genres = $1::jsonb where source_id = $2 and url = $3`,
    [JSON.stringify(genres), sourceId, url],
  );
}

export async function rescanAllGenres(limit: number = 5000): Promise<{ total: number; updated: number }> {
  const pool = getPgPool();
  const rows = await pool.query<{ source_id: string; url: string; title: string; content_json: string; capture_note: string }>(
    `select i.source_id, i.url, i.title, i.content_json, i.capture_note
     from monitor_items i
     order by i.first_seen_at desc
     limit $1`,
    [limit],
  );

  let updated = 0;
  for (const row of rows.rows) {
    let hay = row.title ?? "";
    if (row.content_json) {
      try {
        const parsed = JSON.parse(row.content_json);
        if (Array.isArray(parsed)) hay += "\n" + parsed.slice(0, 3).join("\n");
      } catch {}
    }
    if (row.capture_note) hay += "\n" + row.capture_note;

    const genres = scanAndApplyGenresHits(hay);
    await pool.query(
      `update monitor_items set matched_genres = $1::jsonb where source_id = $2 and url = $3`,
      [JSON.stringify(genres), row.source_id, row.url],
    );
    updated += 1;
  }
  return { total: rows.rows.length, updated };
}

export async function rescanKeywordsOnItems(
  pool: ReturnType<typeof getPgPool>,
  limit: number = 1000,
): Promise<{ total: number; scanned: number; avgScore: number; topCategories: Array<{ category: string; count: number }> }> {
  const rows = await pool.query<{ source_id: string; url: string }>(
    `select i.source_id, i.url
     from monitor_items i
     order by i.first_seen_at desc
     limit $1`,
    [limit],
  );

  const categoryCount = new Map<string, number>();
  let scanned = 0;
  let totalScore = 0;
  for (const row of rows.rows) {
    try {
      await scanAndApplyKeywords(row.source_id, row.url);
      scanned += 1;
      const after = await pool.query<{
        keyword_score: string;
        matched_categories: string | null;
      }>(
        `select coalesce(keyword_score,0)::text as keyword_score, matched_categories::text as matched_categories
         from monitor_items where source_id = $1 and url = $2`,
        [row.source_id, row.url],
      );
      if (after.rows.length > 0) {
        totalScore += Number(after.rows[0].keyword_score) || 0;
        if (after.rows[0].matched_categories) {
          try {
            const parsed = JSON.parse(after.rows[0].matched_categories || "[]");
            if (Array.isArray(parsed)) {
              for (const p of parsed) {
                const cat = typeof p === "string" ? p : p?.category || "";
                if (cat) categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
              }
            }
          } catch {}
        }
      }
    } catch {
      // ignore
    }
  }

  const topCategories = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, count]) => ({ category, count }));

  return {
    total: rows.rows.length,
    scanned,
    avgScore: scanned > 0 ? Math.round((totalScore / scanned) * 10) / 10 : 0,
    topCategories,
  };
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    signal_exec: "A·强执行信号",
    signal_support: "B·强支持信号",
    signal_risk: "C·风险信号",
    signal_explore: "D·探索信号",
    signal_launch: "通用启动/落地",
    topic_ai: "AI/智能体/大模型",
    topic_computing: "算力/算力网/算电协同",
    topic_data: "数据要素/高质量数据集",
    topic_industry: "产业合作/京津冀协同",
    topic_gov: "政务服务/平台经济/数字经济",
    topic_regulation: "法规/征求意见",
    region_general: "京津冀/北京/区域",
    negative: "噪音词汇",
    signal_pre: "D·探索信号",
    signal_start: "A·强执行信号",
    signal_opportunity: "B·强支持信号",
    regulations: "法规/征求意见",
    innovation: "产业合作/京津冀协同",
    "byte-related": "AI/智能体/大模型",
    ai: "AI/智能体/大模型",
    data: "数据要素/高质量数据集",
    platform: "政务服务/平台经济/数字经济",
    security: "C·风险信号",
    industry: "产业合作/京津冀协同",
    gov_service: "政务服务/平台经济/数字经济",
    region_bjj: "京津冀/北京/区域",
    byte_related: "AI/智能体/大模型",
    general: "其他",
    "topic-ai": "AI/智能体/大模型",
    "topic-data": "数据要素/高质量数据集",
    "topic-gov": "政务服务/平台经济/数字经济",
    "topic-industry": "产业合作/京津冀协同",
    "topic-regulation": "法规/征求意见",
    "region-bjj": "京津冀/北京/区域",
    "signal-risk": "C·风险信号",
    "signal-exec": "A·强执行信号",
    "signal-support": "B·强支持信号",
    "signal-explore": "D·探索信号",
    "signal-launch": "通用启动/落地",
  };
  return map[cat] ?? cat;
}

export async function getRecentKeywordHits(daysAgo: number = 14, limitPerKeyword: number = 3) {
  const pool = getPgPool();
  const since = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();
  const allKeywords = await pool.query<{ id: string; department_name: string; keyword: string }>(
    `select id, department_name, keyword from monitor_keywords`,
  );
  if (allKeywords.rows.length === 0) return [];

  const rows = await pool.query<{ source_id: string; url: string; title: string; list_published_at: unknown; department_name: string; content_json: string; capture_note: string }>(
    `select i.source_id, i.url, i.title, i.list_published_at, s.department_name, i.content_json, i.capture_note
     from monitor_items i
     join monitor_sources s on s.id = i.source_id
     where i.first_seen_at >= $1::timestamptz
     order by i.first_seen_at desc
     limit 500`,
    [since],
  );

  type HitRow = { title: string; url: string; listPublishedAt: string; sourceId: string };
  const bucket = new Map<string, { hits: HitRow[]; keyword: string; departmentName: string }>();
  for (const row of rows.rows) {
    let hay = row.title ?? "";
    if (row.content_json) {
      try {
        const arr = JSON.parse(row.content_json);
        if (Array.isArray(arr)) hay += "\n" + arr.join("\n");
      } catch {}
    }
    if (row.capture_note) hay += "\n" + row.capture_note;
    const lower = hay.toLowerCase();
    for (const kw of allKeywords.rows) {
      if (kw.department_name !== row.department_name) continue;
      if (!kw.keyword || !lower.includes(kw.keyword.toLowerCase())) continue;
      const key = `${kw.department_name}::${kw.keyword}`;
      const entry = bucket.get(key) ?? { hits: [], keyword: kw.keyword, departmentName: kw.department_name };
      if (entry.hits.length < limitPerKeyword)
        entry.hits.push({
          title: row.title,
          url: row.url,
          listPublishedAt: row.list_published_at instanceof Date ? row.list_published_at.toISOString().slice(0, 10) : String(row.list_published_at).slice(0, 10),
          sourceId: row.source_id,
        });
      bucket.set(key, entry);
    }
  }
  return Array.from(bucket.values())
    .map((e) => ({ keyword: e.keyword, departmentName: e.departmentName, hitCount: e.hits.length, items: e.hits }))
    .sort((a, b) => b.hitCount - a.hitCount);
}