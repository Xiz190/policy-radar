import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ============ LLM 配置（与 role-analysis.ts 里的同一套读取，保持一致） ============
type LlmConfig = { apiKey: string; baseUrl: string; model: string; temperature: number; maxTokens: number };

function getLlmConfig(): LlmConfig | null {
  const env =
    (typeof process !== "undefined" && (process.env as Record<string, string | undefined>)) || {};
  const apiKey = (env.LLM_API_KEY || env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  const baseUrl = (env.LLM_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/$/, "");
  const model = (env.LLM_MODEL || "gpt-4o-mini").trim();
  const temperature = parseFloat(env.LLM_TEMPERATURE || "0.2");
  const maxTokens = parseInt(env.LLM_MAX_TOKENS || "800", 10);
  return { apiKey, baseUrl, model, temperature, maxTokens };
}

// ============ 输入类型：来自 `/api/chat/search` 返回的 items ============
type SearchItemHit = {
  sourceId: string;
  url: string;
  title: string;
  summary?: string | null;
  listPublishedAt?: string | null;
  departmentName?: string;
  channelName?: string;
  matchedQueryTerms?: string[];
  hitParagraphs?: Array<{ idx: number; snippet: string }>;
};

// ============ 多文档 RAG prompt ============
function buildLlmPrompt(
  question: string,
  items: SearchItemHit[],
  lang: "zh" | "en" = "zh",
): { system: string; user: string } {
  // 取 Top 5 个 items 作为上下文，每个 item 取 Top 3 段命中段落，控制总 token 量
  const selected = items.slice(0, 5);
  const blocks: string[] = [];
  for (let i = 0; i < selected.length; i++) {
    const it = selected[i];
    const paras = (it.hitParagraphs || []).slice(0, 3);
    const paraText = paras.length > 0
      ? paras.map((p) => `  · [段#${p.idx + 1}] ${p.snippet}`).join("\n")
      : `  · [摘要] ${(it.summary || "").slice(0, 240)}`;
    blocks.push(
      `【文档 ${i + 1}】《${it.title}》\n` +
        `来源：${it.departmentName || ""} · ${it.channelName || ""}${it.listPublishedAt ? ` · ${it.listPublishedAt.slice(0, 10)}` : ""}\n` +
        `原文链接：${it.url}\n` +
        `相关段落：\n${paraText}`,
    );
  }

  const langInstruction =
    lang === "en"
      ? "Please respond in English."
      : "回答用简洁中文，分要点（每点一行，以 - 开头），3-5 点为主，不超过 8 行。";

  const system = [
    lang === "en"
      ? "You are a public policy intelligence assistant. Help researchers and practitioners quickly find relevant policy information from indexed content."
      : "你是公共政策情报助手，帮助研究者和从业者快速从已入库的内容中找到有用的政策信息。",
    lang === "en"
      ? "Only answer based on the 「relevant content paragraphs」 below. Do not fabricate information not present in the documents."
      : "只根据下面「相关内容段落」中的信息回答用户问题；禁止编造内容中没有的信息。",
    lang === "en"
      ? "If the paragraphs contain no relevant information, clearly state: 「No directly relevant information found in the retrieved content」."
      : "如果内容段落没有相关信息，就坦率说明「在检索到的内容中未找到直接对应信息」。",
    langInstruction,
    lang === "en"
      ? "End each answer with at least one source citation in the format: Source: Doc 1 / Para #X"
      : "每条回答末尾以「来源：文档 1/段 #X」的形式给出至少 1 处来源（引用【文档 N】编号）。",
  ].join("\n");

  const user = [
    `用户问题：${question}`,
    "",
    "相关文档段落（用于回答）：",
    blocks.join("\n\n") || "（未检索到相关段落）",
  ].join("\n");

  return { system, user };
}

async function callLlm(question: string, items: SearchItemHit[], lang: "zh" | "en" = "zh"): Promise<string> {
  const cfg = getLlmConfig();
  if (!cfg) throw new Error("LLM 未配置（未设置 LLM_API_KEY）");

  const { system, user } = buildLlmPrompt(question, items, lang);

  const url = cfg.baseUrl.replace(/\/$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + cfg.apiKey,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error("LLM " + res.status + " " + errText.slice(0, 200));
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = (data?.choices?.[0]?.message?.content || "").trim();
  if (!raw) throw new Error("LLM 无内容返回");
  return raw;
}

// ============ 规则回落版：拼命中段落 + 文档标题作为"要点式"回答 ============
function ruleBasedAnswer(question: string, items: SearchItemHit[]): string {
  const top = items.slice(0, 3);
  if (top.length === 0) return "在情报库中未找到与该问题匹配的内容，建议尝试更具体的关键词（如工具名称、比赛名称、截止日期等）。";

  const lines: string[] = [];
  lines.push(`围绕「${question}」，在情报库中找到 ${top.length} 条相关内容：`);
  for (let i = 0; i < top.length; i++) {
    const it = top[i];
    lines.push("");
    lines.push(`**${i + 1}.《${it.title}》**`);
    const dept = [it.departmentName, it.channelName].filter(Boolean).join(" · ");
    if (dept) lines.push(`   · 来源：${dept}${it.listPublishedAt ? `（${it.listPublishedAt.slice(0, 10)}）` : ""}`);
    const paras = (it.hitParagraphs || []).slice(0, 2);
    if (paras.length > 0) {
      for (const p of paras) lines.push(`   · ${p.snippet}`);
    } else if (it.summary) {
      lines.push(`   · ${it.summary.slice(0, 200)}`);
    }
    if (it.url) lines.push(`   · 原文：${it.url}`);
  }
  lines.push("");
  lines.push("（此回答基于关键词与段落匹配的规则引擎；配置 LLM 后可生成更流畅的自然语言回答。）");
  return lines.join("\n");
}

// ============ API 入口 ============
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = (body.question || "").toString().trim();
    const items: SearchItemHit[] = Array.isArray(body.items) ? body.items : [];
    const lang: "zh" | "en" = body.lang === "en" ? "en" : "zh";

    if (!question || question.length < 2) {
      return NextResponse.json({ ok: false, message: "问题不能为空" }, { status: 400 });
    }

    const llmEnabled = getLlmConfig() !== null;
    let answer: string;
    let source: "llm" | "rule" = "rule";
    let error: string | undefined;

    if (llmEnabled && items.length > 0) {
      try {
        answer = await callLlm(question, items, lang);
        source = "llm";
      } catch (e) {
        answer = ruleBasedAnswer(question, items);
        console.warn("[chat/answer] LLM 调用失败，回落规则模式", e instanceof Error ? e.message : String(e));
        error = "AI 增强模式不可用，已切换为规则模式";
      }
    } else {
      answer = ruleBasedAnswer(question, items);
    }

    return NextResponse.json({
      ok: true,
      answer,
      source,
      llmEnabled,
      itemsTotal: items.length,
      error, // 仅在 LLM 失败、回落规则时带错误信息，便于前端提示
    });
  } catch (error) {
    console.error("chat/answer 错误：", error);
    return NextResponse.json(
      { ok: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
