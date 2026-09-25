// 角色关注点模板：每个角色关心的"关键词分类集合"与"信号优先级"
// 用于把命中关键词与角色关注点做交集，并生成优先级理由

export type RoleFocus = {
  id: string;
  name: string;
  description: string;
  // 核心关注分类（category → 权重倍率）
  categoryWeights: Record<string, number>;
  // 强信号词（命中即提升优先级）
  boostSignals: string[];
  // 风险信号词（命中即标红）
  riskSignals: string[];
  // 典型问题（Chat 模式用）
  typicalQuestions: string[];
};

export const ROLE_FOCUS_LIST: RoleFocus[] = [
  {
    id: "product_strategy",
    name: "产品策略分析师",
    description: "关注 AI / 大模型 / 智能体 / 数据要素 / 平台经济 的政策动向与落地机会",
    categoryWeights: {
      "AI/智能体/大模型": 5,
      "数据要素/高质量数据集": 4,
      "政务服务/平台经济/数字经济": 3,
      "产业合作/京津冀协同": 2,
      "B·强支持信号": 4,
      "A·强执行信号": 3,
      "通用启动/落地": 3,
      "D·探索信号": 2,
      "京津冀/北京/区域": 2,
    },
    boostSignals: ["人工智能", "大模型", "智能体", "数据要素", "数据流通", "平台经济", "产业生态", "试点", "示范应用", "标杆场景", "算力券"],
    riskSignals: ["算法备案", "模型备案", "数据出境", "监管", "从严", "风险评估", "内容审核", "分类分级治理", "安全评估"],
    typicalQuestions: [
      "这份文件对大模型/智能体落地有什么直接影响？",
      "有哪些明确的支持政策或补贴机会？",
      "其中提到的试点/示范项目与我们业务相关吗？",
      "政策中的时间节点和生效条件是什么？",
    ],
  },
  {
    id: "policy_researcher",
    name: "政策研究员",
    description: "关注法规文件 / 征求意见 / 监管信号，关注政策出台节奏与力度",
    categoryWeights: {
      "法规/征求意见": 5,
      "C·风险信号": 4,
      "D·探索信号": 4,
      "通用启动/落地": 4,
      "A·强执行信号": 3,
      "AI/智能体/大模型": 3,
      "政务服务/平台经济/数字经济": 2,
      "产业合作/京津冀协同": 2,
    },
    boostSignals: ["征求意见", "研究制定", "正在制定", "拟出台", "印发", "发布实施", "正式施行", "办法", "规定", "细则", "实施细则", "目录"],
    riskSignals: ["加强监管", "从严", "清理整顿", "安全评估", "风险评估", "整改", "问责", "处罚", "禁止", "备案", "审查", "应急征用"],
    typicalQuestions: [
      "这份文件的法律层级和约束力如何？",
      "其中提到的监管范围和处罚措施有哪些？",
      "与之前的政策相比有哪些变化？",
      "生效日期和过渡期如何安排？",
    ],
  },
  {
    id: "public_affairs",
    name: "政府事务 / 公共事务",
    description: "关注部委发文 / 申报通知 / 京津冀及重点区域的落地机会（京津冀产业合作视角）",
    categoryWeights: {
      "A·强执行信号": 5,
      "B·强支持信号": 5,
      "产业合作/京津冀协同": 5,
      "法规/征求意见": 4,
      "AI/智能体/大模型": 4,
      "京津冀/北京/区域": 5,
      "算力/算力网/算电协同": 4,
      "数据要素/高质量数据集": 4,
    },
    boostSignals: [
      "申报指南", "申报通知", "项目申报", "专项资金", "奖补资金", "资金支持",
      "重点支持", "中关村", "京津冀", "试点单位", "示范单位", "合作共建",
      "政府采购智能体", "标杆场景", "算力券", "数据券", "设备更新",
      "全国一体化算力网", "模数共振", "高质量数据集",
    ],
    riskSignals: ["应急征用", "从严监管", "清理整顿", "负面清单"],
    typicalQuestions: [
      "这份文件里提到的申报项目、资金支持具体有哪些？",
      "申报截止日期和条件是什么？",
      "与北京/京津冀相关的落地机会有哪些？",
      "我们公司/业务线是否符合申报条件？",
    ],
  },
  {
    id: "legal_compliance",
    name: "法务 / 合规",
    description: "关注网络安全 / 数据合规 / 内容治理 / 平台责任 / 智能体安全治理相关条款",
    categoryWeights: {
      "C·风险信号": 5,
      "法规/征求意见": 4,
      "政务服务/平台经济/数字经济": 4,
      "AI/智能体/大模型": 3,
      "数据要素/高质量数据集": 3,
    },
    boostSignals: [
      "个人信息保护", "数据安全", "网络安全", "内容安全",
      "算法推荐", "算法治理", "平台责任", "未成年人保护",
      "数据出境", "数据分类分级", "智能体安全治理", "模型技术治理", "分类分级治理",
    ],
    riskSignals: ["处罚", "问责", "整改", "从严", "禁止", "限制", "安全评估", "备案", "审查", "负面清单", "风险评估"],
    typicalQuestions: [
      "这份文件中哪些条款可能直接影响我们产品的合规流程？",
      "关于数据/算法/内容安全有什么新要求？",
      "有没有新增的处罚或问责条款？",
      "我们需要在什么时间前完成合规调整？",
    ],
  },
];

export type CategoryHit = { category: string; score: number; topKeywords?: string[] };
export type KeywordHit = { keyword: string; category: string; weight: number };

export type RoleAnalysisResult = {
  roleId: string;
  roleName: string;
  roleDescription: string;
  matchedCategories: CategoryHit[];
  matchedKeywords: KeywordHit[];
  boostKeywords: string[];
  riskKeywords: string[];
  priorityScore: number;
  priorityLevel: "核心关注" | "重点内容" | "中等重点" | "普通内容";
  priorityReasons: string[];
};

// 归一化：把关键词命中做"和角色关注点模板"的交集
export function computeRoleAnalysis(
  item: {
    keywordScore: number;
    importanceLevel: string;
    categories: CategoryHit[];
    matchedKeywords: KeywordHit[];
    title: string;
  },
  role: RoleFocus,
): RoleAnalysisResult {
  // 1. 分类交集：只保留该角色关注的分类，再乘以权重倍率
  const matchedCategories = (item.categories || [])
    .filter((c) => role.categoryWeights[c.category])
    .map((c) => ({
      ...c,
      score: c.score * (role.categoryWeights[c.category] || 1),
    }))
    .sort((a, b) => b.score - a.score);

  // 2. 关键词交集：命中的关键词里，属于角色关注分类的
  const matchedKeywords = (item.matchedKeywords || []).filter(
    (k) => role.categoryWeights[k.category] || role.boostSignals.includes(k.keyword) || role.riskSignals.includes(k.keyword),
  );

  const uniqueKeywords = Array.from(new Set(matchedKeywords.map((k) => k.keyword)));
  const boostKeywords = uniqueKeywords.filter((k) => role.boostSignals.includes(k));
  const riskKeywords = uniqueKeywords.filter((k) => role.riskSignals.includes(k));

  // 3. 优先级打分：基础分 + 信号加权
  // 说明：item.keywordScore（来自 DB，已包含结构/主题/信号的原始权重）作为主分；
  // 这里再结合角色关注的分类、boost/风险关键词做"加分"。
  // 注意不再对 item.importanceLevel 进行二次加成（之前会让低分项被推到"核心关注"）。
  let score = 0;
  score += matchedCategories.reduce((acc, c) => acc + c.score, 0);
  score += boostKeywords.length * 3;
  score += riskKeywords.length * 4;
  score += item.keywordScore * 0.5;

  // 角色视角的四档阈值（与 content-meta / db.ts 的分层体系保持一致）
  let priorityLevel: RoleAnalysisResult["priorityLevel"] = "普通内容";
  if ((riskKeywords.length >= 3 && matchedCategories.length >= 1) || score >= 45) priorityLevel = "核心关注";
  else if (score >= 25 || (boostKeywords.length >= 2 && matchedCategories.length >= 1) || (riskKeywords.length >= 1 && matchedCategories.length >= 1)) priorityLevel = "重点内容";
  else if (score >= 12 || boostKeywords.length >= 3 || matchedCategories.length >= 2) priorityLevel = "中等重点";

  // 4. 生成优先级理由（纯文本，便于在 UI 上逐条展示）
  const reasons: string[] = [];
  if (matchedCategories.length > 0) {
    const catLabels = matchedCategories
      .slice(0, 3)
      .map((c) => `${categoryLabelOf(c.category)}（${c.score.toFixed(1)}分）`)
      .join("、");
    reasons.push(`命中该角色核心关注分类：${catLabels}`);
  }
  if (boostKeywords.length > 0) {
    reasons.push(`出现机会/落地信号词：${boostKeywords.slice(0, 5).join("、")}`);
  }
  if (riskKeywords.length > 0) {
    reasons.push(`出现风险/监管信号词：${riskKeywords.slice(0, 5).join("、")}`);
  }
  if (reasons.length === 0) {
    reasons.push("该条目暂未命中该角色的核心关注点，可作为一般性信息浏览。");
  }

  return {
    roleId: role.id,
    roleName: role.name,
    roleDescription: role.description,
    matchedCategories,
    matchedKeywords,
    boostKeywords,
    riskKeywords,
    priorityScore: Math.round(score * 10) / 10,
    priorityLevel,
    priorityReasons: reasons,
  };
}

function categoryLabelOf(cat: string): string {
  // 现在 keywords 表里的 category 已经是中文标签（如"A·强执行信号"）
  // 此函数同时兼容所有旧英文分类 key（从最早期简单 key 到新体系都覆盖）
  const map: Record<string, string> = {
    // 新分类体系（英文 key → 中文）
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
    // 旧分类体系 1（征求意见稿阶段分类）
    signal_pre: "D·探索信号",
    signal_start: "A·强执行信号",
    signal_opportunity: "B·强支持信号",
    regulations: "法规/征求意见",
    innovation: "产业合作/京津冀协同",
    "byte-related": "AI/智能体/大模型",
    // 旧分类体系 2（最早期的简单英文 key）
    ai: "AI/智能体/大模型",
    data: "数据要素/高质量数据集",
    platform: "政务服务/平台经济/数字经济",
    security: "C·风险信号",
    industry: "产业合作/京津冀协同",
    gov_service: "政务服务/平台经济/数字经济",
    region_bjj: "京津冀/北京/区域",
    byte_related: "AI/智能体/大模型",
    general: "其他",
    // 其他可能的变体（下划线与短横线混用）
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

export function computeAllRoleAnalyses(item: {
  keywordScore: number;
  importanceLevel: string;
  categories: CategoryHit[];
  matchedKeywords: KeywordHit[];
  title: string;
}): RoleAnalysisResult[] {
  return ROLE_FOCUS_LIST.map((role) => computeRoleAnalysis(item, role)).sort(
    (a, b) => b.priorityScore - a.priorityScore,
  );
}

// ============== Chat / 问答逻辑（基于文档内容 + 关键词 + 角色视角）==============
// 不依赖任何外部大模型：基于规则与关键词相似度的"文档问答"实现
// 目标：在单机上即可跑通，便于后续再替换为真实 LLM

export type ChatContext = {
  title: string;
  paragraphs: string[];
  categories: CategoryHit[];
  matchedKeywords: KeywordHit[];
  role?: RoleFocus;
  // 可选：来自上一轮对话的摘要，用于多轮问答时"接着聊"
  contextSummary?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ index: number; snippet: string }>;
};

// ============== 可选：接入大模型（OpenAI 兼容协议，Chat Completions） ==============
// 只要在 .env.local 中设置以下 3 个变量，问答就会自动改用 LLM 生成（保留 citations 检索不变）：
//   LLM_API_KEY=sk-xxxx
//   LLM_BASE_URL=https://api.openai.com/v1   （或 Mira 网关：https://mira.byted.org/v1）
//   LLM_MODEL=gpt-4o-mini                    （或 mira-chat-v2 / doubao-pro-32k）
// 未设置时，会自动回落为纯规则实现（不需要外部依赖）。
// 也可按需再加 LLM_TEMPERATURE=0.2、LLM_MAX_TOKENS=500 等自定义。

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
};

function getLlmConfig(): LlmConfig | null {
  // 同时兼容 node process.env 与 Next.js 的环境变量读取
  const env = (typeof process !== "undefined" && (process.env as Record<string, string | undefined>)) || {};
  const apiKey = (env.LLM_API_KEY || env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  const baseUrl = (env.LLM_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/$/, "");
  const model = (env.LLM_MODEL || "gpt-4o-mini").trim();
  const temperature = parseFloat(env.LLM_TEMPERATURE || "0.2");
  const maxTokens = parseInt(env.LLM_MAX_TOKENS || "600", 10);
  return { apiKey, baseUrl, model, temperature, maxTokens };
}

// 用"检索 + 生成"两段式：先做本地检索拿 Top-K 段落，再让 LLM 根据这些段落回答。
// 好处：(1) LLM 回答可追溯来源；(2) 降低幻觉；(3) 省 token，无需喂整文
function buildLlmPrompt(
  context: ChatContext,
  question: string,
  relevant: Array<{ idx: number; text: string }>,
): { system: string; user: string } {
  const cats = context.categories.slice(0, 3).map((c) => categoryLabelOf(c.category)).join("、");
  const kws = Array.from(new Set(context.matchedKeywords.map((k) => k.keyword))).slice(0, 8).join("、");
  const roleHint = context.role
    ? `\n回答视角：以「${context.role.name}」的身份解读，重点关注${context.role.categoryWeights ? Object.keys(context.role.categoryWeights).slice(0, 2).join(" / ") : "政策落地"}相关内容。`
    : "";

  const passages = relevant.map((p) => {
    void 0;
    const snippet = p.text.length > 240 ? p.text.slice(0, 240) + "……" : p.text;
    return `[段落 #${p.idx + 1}] ${snippet}`;
  }).join("\n\n");

  const system = [
    "你是政策文档问答助手。",
    "只根据下面「文档段落」中的信息回答用户问题；禁止编造文档中没有的内容。",
    "如果文档段落没有相关信息，就坦率说明「当前文档未涉及此内容」。",
    "回答用简洁中文，分要点（每点一行，以 - 开头），不超过 6 行，尽量 3-5 点即可。",
  ].join("\n");

  const user = [
    `标题：${context.title}`,
    `主题分类：${cats || "（未命中）"}`,
    `关键词：${kws || "（未命中）"}`,
    roleHint,
    "",
    "文档段落（用于回答）：",
    passages || "（未检索到相关段落）",
    "",
    `用户问题：${question}`,
  ].join("\n");

  return { system, user };
}

async function llmAnswer(
  context: ChatContext,
  question: string,
  citations: Array<{ index: number; snippet: string }>,
): Promise<ChatMessage> {
  const cfg = getLlmConfig();
  if (!cfg) throw new Error("LLM 未配置");

  const relevant: Array<{ idx: number; text: string }> = citations.map((c) => ({ idx: c.index - 1, text: c.snippet }));
  const { system, user } = buildLlmPrompt(context, question, relevant);

  const url = cfg.baseUrl.replace(/\/$/, "") + "/chat/completions";

  let raw = "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.apiKey,
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
    raw = (data?.choices?.[0]?.message?.content || "").trim();
  } catch (e) {
    // LLM 失败就抛出给上层，由 chatAnswer 回落为规则版
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg);
  }

  if (!raw) {
    throw new Error("LLM 无内容返回");
  }

  // 在 LLM 回答末尾追加一段"来源段落索引"提示，配合前端 citation 卡片
  const header: string[] = [];
  header.push(raw);

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: "assistant",
    content: header.join("\n"),
    citations: citations.length > 0 ? citations.slice(0, 5) : undefined,
  };
}

// 判断当前是否启用了 LLM（供 API route 日志用）
export function isLlmEnabled(): boolean {
  return getLlmConfig() !== null;
}

// ============== 相似度 / 段落检索（规则引擎使用） ==============

// ——— 关键词 IDF：在越多段落出现的关键词权重越低；只出现一段的词权重最高 ———
function computeKeywordIdf(paragraphs: string[]): Record<string, number> {
  const N = Math.max(paragraphs.length, 1);
  const df: Record<string, number> = {};
  for (const p of paragraphs) {
    const seen = new Set<string>();
    // 中文 2-gram + 英文/数字 token，用于 IDF 计算
    const tokens = tokenizeChinese(p);
    for (const t of tokens) seen.add(t);
    for (const t of seen) df[t] = (df[t] || 0) + 1;
  }
  const idf: Record<string, number> = {};
  for (const t of Object.keys(df)) {
    idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1; // +1 平滑
  }
  return idf;
}

// ——— 辅助：基于"文档已命中关键词"构建 IDF 加权的加权词表 ———
function buildKeywordWeights(context: ChatContext): Record<string, number> {
  const idf = computeKeywordIdf(context.paragraphs);
  const weights: Record<string, number> = {};
  // 1) 把 matchedKeywords 里的关键词原文做权重
  const kws = Array.from(new Set(context.matchedKeywords.map((m) => m.keyword).filter(Boolean)));
  for (const kw of kws) {
    const tLower = kw.toLowerCase();
    // 短词（1-2 字）给一个保底值；长词如果 idf 很高则显著加权
    const kwIdf = idf[tLower] ?? Math.max(1.5, 3 - tLower.length * 0.5);
    weights[tLower] = Math.max(weights[tLower] || 0, kwIdf * 0.5);
  }
  // 2) 角色信号词：也加 IDF 加权，但权重略低于文档关键词
  if (context.role) {
    const roleSigs = Array.from(new Set([...context.role.boostSignals, ...context.role.riskSignals]));
    for (const kw of roleSigs) {
      const tLower = kw.toLowerCase();
      const base = idf[tLower] ?? 1.6;
      weights[tLower] = Math.max(weights[tLower] || 0, base * 0.35);
    }
  }
  return weights;
}

function tokenizeChinese(text: string): string[] {
  const t = text.toLowerCase();
  const tokens: string[] = [];
  const asciiParts = t.match(/[a-z0-9]+/g) || [];
  for (const p of asciiParts) if (p.length >= 2) tokens.push(p);
  const cjk = t.replace(/[^\u4e00-\u9fa5]/g, "");
  for (let i = 0; i < cjk.length - 1; i++) tokens.push(cjk.slice(i, i + 2));
  return tokens;
}

function similarity(a: string, b: string): number {
  const sa = new Set(tokenizeChinese(a));
  const sb = new Set(tokenizeChinese(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  const uni = sa.size + sb.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

// ——— 保底检索：按"关键词 + 信号词命中次数 + IDF 加权"取 Top-k 段落 ———
function pickFallbackParagraphs(context: ChatContext, k: number = 3) {
  const sig = ["印发", "发布", "出台", "实施", "支持", "鼓励", "试点", "示范", "资金", "奖补", "补贴", "申报", "通知", "公告", "监管", "管理", "办法", "规定", "意见", "方案"];
  const idf = computeKeywordIdf(context.paragraphs);
  const needles: string[] = Array.from(
    new Set([
      ...context.matchedKeywords.map((m) => m.keyword).filter(Boolean),
      ...(context.role ? [...context.role.boostSignals, ...context.role.riskSignals] : []),
      ...sig,
    ]),
  );

  const scored = context.paragraphs
    .map((p, idx) => {
      let score = 0;
      const tLower = p.toLowerCase();
      for (const n of needles) {
        if (tLower.includes(n.toLowerCase())) {
          score += idf[n.toLowerCase()] ?? 1.2;
        }
      }
      return { idx, text: p, score };
    })
    .filter((s) => s.text.trim().length >= 10);
  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return context.paragraphs
      .map((p, idx) => ({ idx, text: p, score: 0 }))
      .filter((s) => s.text.trim().length >= 6)
      .slice(0, k);
  }
  return scored.slice(0, k);
}

function pickRelevantParagraphs(context: ChatContext, question: string, k: number = 3) {
  // 若有上下文摘要，拼进问题用于检索；不影响用户看到的"问题"本身
  const qEffective = context.contextSummary
    ? `${context.contextSummary}\n${question}`
    : question;

  const scored = context.paragraphs
    .map((p, idx) => ({ idx, text: p, score: similarity(qEffective, p) }))
    .filter((s) => s.text.trim().length >= 6);

  // ——— IDF 加权：问题里出现的关键词/信号词不再"+0.25 固定"，而是"idf * 系数"
  const weights = buildKeywordWeights(context);
  const qLower = qEffective.toLowerCase();
  for (const s of scored) {
    let boost = 0;
    for (const term of Object.keys(weights)) {
      if (qLower.includes(term) && s.text.toLowerCase().includes(term)) {
        boost += weights[term];
      }
    }
    s.score += boost;
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, k);

  if (top.length === 0 || top[0].score < 0.03) {
    return pickFallbackParagraphs(context, k);
  }
  return top;
}

function detectQuestionIntent(question: string, context: ChatContext): string {
  const q = question.toLowerCase();
  void context;
  if (/时间|日期|截止|何时|什么时候|节点|生效|起始|有效期|期限|印发|发布|出台/.test(q)) return "time";
  if (/主体|谁|部门|部委|单位|机构|责任|主管|发文|发布机关|组织/.test(q)) return "subject";
  if (/金额|资金|补贴|奖补|多少钱|预算|经费|投入|资助|财政|金融|贷款/.test(q)) return "money";
  if (/条件|要求|资质|资格|标准|符合|门槛|具备|应满足/.test(q)) return "requirement";
  if (/流程|流程|步骤|如何|怎么|申报|办理|程序|手续|流程|方式|途径/.test(q)) return "process";
  if (/影响|风险|问题|不利|处罚|问责|整改|禁止|限制|负面|监管|合规/.test(q)) return "impact";
  if (/机会|支持|鼓励|试点|示范|好处|利好|受益|重点扶持|培育|发展|推广/.test(q)) return "opportunity";
  if (/总结|摘要|概述|大意|说什么|讲什么|主要内容|内容|介绍|讲|说|包含|什么意思/.test(q)) return "summary";
  return "general";
}

// 从正文段落里做"按句号分句 + 取含关键词的句子"——这是一个轻量摘要器
// 改进：句子过长截断；按与问题相关度/关键词命中数量排序；去重更严格
function extractKeySentences(
  context: ChatContext,
  questionOrMax?: string | number,
  explicitMax?: number,
): string[] {
  let question: string | undefined;
  let maxCount = 4;

  if (typeof questionOrMax === "number") {
    maxCount = questionOrMax;
  } else if (typeof questionOrMax === "string") {
    question = questionOrMax;
    if (typeof explicitMax === "number") maxCount = explicitMax;
  }

  const paras = context.paragraphs.filter((p) => p.trim().length >= 12);
  const kws = Array.from(new Set(context.matchedKeywords.map((k) => k.keyword)));
  const signals = [
    "重点", "主要", "明确", "提出", "要求", "支持", "鼓励", "推进", "加快", "加强",
    "完善", "建立", "规范", "促进", "推动", "引导", "组织", "实施", "印发", "发布", "出台",
    "原则", "目标", "任务", "措施", "监督", "保障", "依据", "根据", "适用", "范围",
  ];
  const needles = Array.from(new Set([...kws, ...signals]));
  const qLower = (question || "").toLowerCase();

  type Scored = { text: string; score: number; hits: string[] };
  const scored: Scored[] = [];

  for (const p of paras) {
    // 切句：中英文标点都支持；去掉非常短的和超长的
    const parts = p
      .split(/(?<=[。！？!?;；])\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 18 && s.length <= 120);

    for (const s of parts) {
      const lower = s.toLowerCase();
      const hits: string[] = [];
      for (const n of needles) if (lower.includes(n.toLowerCase())) hits.push(n);
      // 问题词命中再加权
      if (qLower) {
        for (const qw of qLower.split(/\s+/).filter((w) => w.length >= 2)) {
          if (lower.includes(qw)) hits.push("q:" + qw);
        }
      }
      if (hits.length === 0) continue;
      // 加分：信号词 + 关键词 + 问题词
      const uniqueHits = Array.from(new Set(hits));
      let score = uniqueHits.length;
      if (kws.some((kw) => lower.includes(kw.toLowerCase()))) score += 1.5;
      if (signals.some((sig) => lower.includes(sig))) score += 1;
      scored.push({ text: s, score, hits: uniqueHits });
    }
  }

  // 按得分降序；句子之间做"最长公共子串"去重，避免选到高度重复的句子
  scored.sort((a, b) => b.score - a.score);
  const chosen: string[] = [];
  for (const cand of scored) {
    // 与已选句子做 16 字以上重叠就跳过
    const tooSimilar = chosen.some((c) => overlapLength(c, cand.text) >= 16);
    if (tooSimilar) continue;
    // 以冒号结尾的句子通常是半截话，跳过
    if (/[：:]$/.test(cand.text)) continue;
    // 以"第X条"开头的、长度特别短的条目也跳过（避免只是一个编号）
    chosen.push(cand.text);
    if (chosen.length >= maxCount) break;
  }

  // 如果没有命中任何关键词/信号词：退回前几句（保证有内容），但标注"—（原文片段，未命中关键词）"
  if (chosen.length === 0) {
    for (const p of paras) {
      const parts = p
        .split(/(?<=[。！？!?;；])\s*/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 20 && s.length <= 120);
      for (const s of parts) {
        chosen.push(s);
        if (chosen.length >= maxCount) break;
      }
      if (chosen.length >= maxCount) break;
    }
  }

  // 统一截断为不超过 90 字，过长加省略号
  return chosen.slice(0, maxCount).map((s) => (s.length > 90 ? s.slice(0, 90) + "……" : s));
}

// 两个字符串的最长公共连续子串长度（用于去重），O(n*m) 但句子长度很短，OK
function overlapLength(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a.charCodeAt(i + k) === b.charCodeAt(j + k)) k++;
      if (k > best) best = k;
      if (best >= 16) return best; // 足够提前退出
    }
  }
  return best;
}

function summarize(context: ChatContext): string {
  const paras = context.paragraphs.filter((p) => p.trim().length >= 8);
  if (paras.length === 0) {
    return [
      `**《${context.title}》**`,
      "",
      `⚠️ 当前文档尚未提取到正文段落。`,
      "",
      `建议：请先在内容详情页点击「重新抓取正文」。如果文档源为图片/扫描件，需要先做 OCR。`,
    ].join("\n");
  }

  const cats = context.categories.slice(0, 3).map((c) => `**${categoryLabelOf(c.category)}**（${c.score.toFixed(1)}）`).join("、");
  const kws = Array.from(new Set(context.matchedKeywords.map((k) => k.keyword))).slice(0, 8).join("、");
  const first = paras.slice(0, 2).map((p) => p.trim()).join(" ");
  const keySentences = extractKeySentences(context, 5);

  const lines: string[] = [];
  lines.push(`**《${context.title}》**`);
  lines.push("");
  lines.push(`**一句话概述**`);
  lines.push("> " + (first.length > 280 ? first.slice(0, 280) + "……" : first));
  lines.push("");
  if (keySentences.length > 0) {
    lines.push(`**核心要点（基于关键词+信号词自动提取）**`);
    for (const s of keySentences) lines.push(`- ${s}`);
    lines.push("");
  }
  lines.push(`**主题分类**：${cats || "暂未命中强分类"}`);
  lines.push(`**关键词**：${kws || "暂未命中关键词"}`);
  lines.push(`**正文段落数**：${paras.length}`);
  return lines.join("\n");
}

// 意图 → 中文标题 + 检索 hint
const INTENT_META: Record<string, { title: string; hints: string[] }> = {
  time: { title: "时间 / 日期 / 截止", hints: ["自…起施行", "印发之日起", "截止日期", "申报截止", "有效期至"] },
  subject: { title: "发文 / 主管 / 责任主体", hints: ["发文机关", "主管部门", "责任主体", "牵头单位"] },
  money: { title: "资金 / 补贴 / 奖补 / 投入", hints: ["专项资金", "奖补", "补贴", "财政", "金额", "万元", "资助"] },
  requirement: { title: "条件 / 资质 / 标准", hints: ["应当具备", "申报条件", "资质要求", "符合条件"] },
  process: { title: "流程 / 步骤 / 申报方式", hints: ["申报流程", "办理程序", "提交材料", "办理步骤"] },
  impact: { title: "影响 / 风险 / 监管 / 处罚", hints: ["处罚", "问责", "整改", "风险", "禁止", "监管"] },
  opportunity: { title: "支持 / 鼓励 / 试点 / 示范", hints: ["重点支持", "鼓励发展", "试点示范", "奖补"] },
  summary: { title: "摘要 / 概述", hints: [] },
  general: { title: "综合检索", hints: [] },
};

// 为不同角色合成「视角建议」（不一定依赖大模型，但给用户一种"你站在这个角色会怎么想"的体验）
function buildRoleInsights(context: ChatContext): string[] {
  if (!context.role) return [];
  const role = context.role;
  const roleHit = context.categories.filter((c) => role.categoryWeights[c.category]);
  const boostHits = Array.from(
    new Set(context.matchedKeywords.filter((k) => role.boostSignals.includes(k.keyword)).map((k) => k.keyword)),
  ).slice(0, 5);
  const riskHits = Array.from(
    new Set(context.matchedKeywords.filter((k) => role.riskSignals.includes(k.keyword)).map((k) => k.keyword)),
  ).slice(0, 5);

  const insights: string[] = [];
  if (roleHit.length > 0) {
    insights.push(`**关注分类命中**：${roleHit.map((c) => categoryLabelOf(c.category)).join("、")}——这是「${role.name}」的常规关注点。`);
  }
  if (boostHits.length > 0) {
    insights.push(`**机会信号词命中**：${boostHits.join("、")}——可重点追踪后续落地政策、试点名单或申报窗口。`);
  }
  if (riskHits.length > 0) {
    insights.push(`**风险信号词命中**：${riskHits.join("、")}——建议提前评估合规/监管影响，关注处罚条款或整改要求。`);
  }
  if (insights.length === 0) {
    insights.push(`当前文档尚未命中「${role.name}」的核心关注分类/信号词，可将其作为一般信息源，或切换视角查看其他角色结论。`);
  }
  return insights;
}

function ruleBasedAnswer(context: ChatContext, question: string): ChatMessage {
  const intent = detectQuestionIntent(question, context);
  const paras = context.paragraphs.filter((p) => p.trim().length >= 8);
  const meta = INTENT_META[intent] || INTENT_META.general;

  // —— 摘要类问题：走 summarize() 的结构化版本 ——
  if (intent === "summary" || paras.length === 0) {
    const content: string[] = [summarize(context)];
    const roleLines = buildRoleInsights(context);
    if (roleLines.length > 0) {
      content.push("");
      content.push(`———`);
      content.push(`**以「${context.role?.name || "通用"}」视角补充**`);
      for (const r of roleLines) content.push(`- ${r}`);
    }
    const fallbackCites = paras.slice(0, 3).map((p, i) => ({
      index: i + 1,
      snippet: p.length > 180 ? p.slice(0, 180) + "……" : p,
    }));
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      role: "assistant",
      content: content.join("\n"),
      citations: fallbackCites.length > 0 ? fallbackCites : undefined,
    };
  }

  // —— 特定意图类问题：本地检索 Top-K 段落 + 结构化呈现 ——
  const relevant = pickRelevantParagraphs(context, question, 3);
  const citations = relevant.map((r) => ({
    index: r.idx + 1,
    snippet: r.text.length > 180 ? r.text.slice(0, 180) + "……" : r.text,
  }));

  const kws = Array.from(new Set(context.matchedKeywords.map((k) => k.keyword))).slice(0, 8);
  const cats = context.categories.slice(0, 3).map((c) => categoryLabelOf(c.category));

  const lines: string[] = [];
  lines.push(`**《${context.title}》—${meta.title}**`);
  lines.push("");
  lines.push(`**你的问题**：${question}`);
  lines.push("");
  lines.push(`**主题分类**：${cats.join("、") || "暂未命中"}`);
  lines.push(`**关键词**：${kws.join("、") || "暂未命中"}`);
  lines.push(`**正文段落数**：${paras.length}`);
  lines.push("");

  if (citations.length > 0) {
    lines.push(`**相关段落（点击下方引用卡片可跳转原文）**：`);
    for (let i = 0; i < citations.length; i++) {
      lines.push(`- 段落 #${citations[i].index}：${citations[i].snippet}`);
    }
    lines.push("");
  } else {
    lines.push(`**检索结论**：本页暂未定位到与「${question}」高度相关的段落（可能正文较短或关键词未覆盖）。`);
    lines.push("");
  }

  if (meta.hints.length > 0) {
    lines.push(`**可在原文中继续搜索的关键词**：${meta.hints.join(" / ")}`);
    lines.push("");
  }

  const roleLines = buildRoleInsights(context);
  if (roleLines.length > 0) {
    lines.push(`**以「${context.role?.name || "通用"}」视角补充**`);
    for (const r of roleLines) lines.push(`- ${r}`);
  }

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: "assistant",
    content: lines.join("\n"),
    citations: citations.length > 0 ? citations.slice(0, 3) : undefined,
  };
}

// 主入口：先尝试 LLM；未配置 / 失败 → 回落规则版
export async function chatAnswer(context: ChatContext, question: string): Promise<ChatMessage> {
  const cfg = getLlmConfig();
  if (cfg) {
    try {
      // 先做本地检索拿相关段落（无论走不走 LLM，这份 citations 都会返回给前端用于"引用卡片"）
      const relevant = pickRelevantParagraphs(context, question, 4);
      const citations = relevant.map((r) => ({
        index: r.idx + 1,
        snippet: r.text.length > 220 ? r.text.slice(0, 220) + "……" : r.text,
      }));
      return await llmAnswer(context, question, citations);
    } catch (e) {
      // 静默失败 → 走规则版
      const rule = ruleBasedAnswer(context, question);
      const hint = e instanceof Error ? e.message : String(e);
      rule.content =
        `*（大模型调用失败，已切换为本地规则回答；原因：${hint}）*\n\n` +
        rule.content;
      return rule;
    }
  }
  return ruleBasedAnswer(context, question);
}

// 同步版本（供旧代码直接调用；若配置了 LLM，会回落）
export function chatAnswerSync(context: ChatContext, question: string): ChatMessage {
  return ruleBasedAnswer(context, question);
}

// 生成一个"默认开场"
export function chatOpening(context: ChatContext): ChatMessage {
  const cats = Array.from(
    new Set(context.categories.map((c) => c.category)),
  )
    .slice(0, 3)
    .map((cat) => {
      const c = context.categories.find((x) => x.category === cat)!;
      return `**${categoryLabelOf(cat)}**（${c.score.toFixed(1)}）`;
    })
    .join("、");

  // 关键词去重：以出现次数降序，取前 8 个
  const kwCount: Record<string, number> = {};
  for (const k of context.matchedKeywords) kwCount[k.keyword] = (kwCount[k.keyword] || 0) + 1;
  const kws = Object.entries(kwCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w, n]) => (n > 1 ? `${w}（×${n}）` : w))
    .join("、");

  const paras = context.paragraphs.filter((p) => p.trim().length >= 8);

  const lines: string[] = [];
  lines.push(`**《${context.title}》**`);
  lines.push("");
  lines.push(`**主题分类**：${cats || "暂未命中"}`);
  lines.push(`**关键词命中**：${kws || "暂未命中关键词"}`);
  lines.push(`**正文段落数**：${paras.length}`);
  lines.push("");

  if (context.role) {
    lines.push(`**当前视角**：${context.role.name}（${context.role.description}）`);
    lines.push("");
  }

  lines.push(`你可以这样问我（点击下方引用可跳转原文）：`);
  lines.push(`- 这份文件主要讲了什么？（3 条要点）`);
  lines.push(`- 有哪些时间节点、生效日期或截止要求？`);
  lines.push(`- 提到了哪些支持政策 / 补贴 / 试点机会？`);
  lines.push(`- 有哪些监管或合规要求需要关注？`);
  if (context.role) {
    const extras = context.role.typicalQuestions.slice(0, 2);
    for (const q of extras) lines.push(`- ${q}`);
  }
  lines.push("");
  lines.push(`> 提示：本回答基于文档正文关键词与段落检索；配置大模型后会升级为"先检索再生成"模式。`);

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: "assistant",
    content: lines.join("\n"),
  };
}
