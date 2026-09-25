import { getDoubaoClient, DoubaoChatMessage } from "./doubao";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ContentAnalyzer");

export interface ContentAnalysisResult {
  forecastHigh: string | null;
  forecastMidHigh: string | null;
  forecastMid: string | null;
  forecastLow: string | null;
  reasoning: string | null;
  confidence: number;
  keySignals: string[];
  /** 结果来源：doubao=豆包 SDK、llm=LLM_* 环境变量 HTTP、rule=关键词规则降级 */
  source: "doubao" | "llm" | "rule";
  /** 失败时的说明（前端可选择性展示） */
  errorHint?: string;
}

export interface AnalysisInput {
  title: string;
  content: string;
  summary?: string | null;
  matchedSignals?: string[];
}

/** 基于分类名 → 对应的"高确定性"推断模板 */
const HIGH_CERTAINTY_RULES: Record<string, string> = {
  "A·强执行信号": "文件已明确给出执行要求与时间节点，相关部门需在近期启动落实，建议关注配套细则与责任分工。",
  "B·强支持信号": "政策已释放明确支持信号，资金、试点或配套措施有较大概率在近期落地，建议评估申报资格与窗口。",
  "C·风险信号": "内容涉及监管、合规、安全审查或风险预警，建议关注后续整改要求与合规窗口。",
  "D·探索信号": "属于试点、探索或前沿研究信号，建议关注对中长期技术与产业布局的潜在影响。",
  "通用启动/落地": "涉及重大项目启动或政策落地，建议关注实施节点与配套细则。",
  "AI/智能体/大模型": "涉及人工智能、大模型或智能体，可能带来备案、标准或应用场景层面的调整，建议关注落地范围。",
  "算力/算力网/算电协同": "涉及算力基础设施或算力网络，后续可能有专项资金、枢纽节点或调度机制跟进。",
  "数据要素/高质量数据集": "涉及数据要素或高质量数据集，建议关注确权、流通、专项资金与合规要求。",
  "产业合作/京津冀协同": "涉及产业合作或区域协同，可能带来园区、项目或合作机会，建议关注申报窗口。",
  "政务服务/平台经济/数字经济": "涉及数字政府、平台经济或数字经济，建议评估对业务模式与合规的具体影响。",
  "法规/征求意见": "涉及法规或征求意见，建议评估潜在合规义务与反馈窗口。",
};

// ============ LLM（OpenAI 兼容）调用：与 src/app/api/chat/answer 共用 LLM_* 环境变量 ============
type LlmConfig = { apiKey: string; baseUrl: string; model: string; temperature: number; maxTokens: number };

function getLlmConfig(): LlmConfig | null {
  // 同时兼容 node process.env 与 Next.js 的环境变量读取
  const env = (typeof process !== "undefined" && (process.env as Record<string, string | undefined>)) || {};
  const apiKey = (env.LLM_API_KEY || env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  const baseUrl = (env.LLM_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/$/, "");
  const model = (env.LLM_MODEL || "gpt-4o-mini").trim();
  const temperature = parseFloat(env.LLM_TEMPERATURE || "0.2");
  const maxTokens = parseInt(env.LLM_MAX_TOKENS || "800", 10);
  return { apiKey, baseUrl, model, temperature, maxTokens };
}

async function callLlm(system: string, user: string): Promise<string> {
  const cfg = getLlmConfig();
  if (!cfg) throw new Error("LLM 未配置（缺少 LLM_API_KEY）");
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


export class ContentAnalyzer {
  private client: ReturnType<typeof getDoubaoClient>;

  constructor() {
    this.client = getDoubaoClient();
  }

  /** 是否走 AI 分析（true）还是关键词规则降级（false） */
  hasAI(): boolean {
    return !!this.client || !!getLlmConfig();
  }

  private buildSystemPrompt(): DoubaoChatMessage {
    return {
      role: "system",
      content: `你是一位专注于人工智能与数字经济政策的情报分析助手。你从工信部、网信办、发改委、科技部、国家数据局等主管部门的政策文件、通知公告、规划与行业研究中，提取对 AI／数字经济领域从业者与研究者最有价值的政策信号，并进行前瞻性预判。

## 你的任务
基于提供的内容，从政策研究者视角分析：这条信息释放了什么执行、支持、监管或趋势信号？对 AI／数字经济领域（如人工智能、算力、数据要素、数字经济、平台经济）有什么具体影响？接下来最可能出台什么配套动作？

## 分析框架
请按照以下四个确定性级别进行分析：

### 高确定性（forecastHigh）
- 文件中明确给出的执行要求、落实时间节点、申报截止日期
- 已经生效的政策调整，可立即据此判断行动窗口

### 中高确定性（forecastMidHigh）
- 根据文件可合理推断的下一步动作（如：发布规划后大概率跟进实施方案）
- 已公示的试点/申报后续环节（评审、公示、名单发布时间）

### 中确定性（forecastMid）
- 对数字经济格局或某一细分领域（人工智能/算力/数据要素）的中期影响
- 需要持续观察的支持或监管信号

### 低确定性（forecastLow）
- 行业长期趋势与结构性方向
- 政策取向的潜在演变
- 需要更多信息才能判断的事项

## 输出要求
1. 分析必须基于提供的内容，不要凭空编造
2. 每个级别都要有明确依据，用政策研究者能直接理解的语言
3. 输出格式必须为 JSON，包含以下字段：
   - forecastHigh: 高确定性预测（100字以内）
   - forecastMidHigh: 中高确定性预测（100字以内）
   - forecastMid: 中确定性预测（100字以内）
   - forecastLow: 低确定性预测（100字以内）
   - reasoning: 推理依据（200字以内）
   - confidence: 整体置信度分数（0-100）
   - keySignals: 识别到的关键信号关键词数组

请直接输出 JSON，不要附加任何 markdown 代码块或解释文字。`,
    };
  }

  private buildUserPrompt(input: AnalysisInput): string {
    const contentText =
      (input.summary && input.summary.trim().length > 0 ? input.summary : input.content || "").slice(0, 800);
    const signalsText = (input.matchedSignals && input.matchedSignals.length > 0)
      ? input.matchedSignals.slice(0, 10).join("、")
      : "无";
    return `请分析以下内容并进行预判：

【标题】
${input.title || "（无标题）"}

【识别到的信号分类】
${signalsText}

【正文（节选）】
${contentText}

请按照要求的 JSON 格式输出分析结果。`;
  }

  async analyze(input: AnalysisInput): Promise<ContentAnalysisResult> {
    // 1) 优先走豆包 SDK；2) 其次走 OpenAI 兼容的 LLM_* 环境变量；3) 都不可用则走关键词规则降级。
    // 整体包裹一层超时：单条分析最多 45 秒，超过则回退到规则版
    let finished = false;
    let fallbackTimer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<ContentAnalysisResult>((resolve) => {
      const timeout = setTimeout(() => {
        if (!finished) {
          const base = this.getRuleBasedResult(input);
          resolve({ ...base, errorHint: "单条分析超时，已回退规则版" });
        }
      }, 45000);
      fallbackTimer = timeout;
    });

    const runAnalysis = async (): Promise<ContentAnalysisResult> => {
      try {
        if (this.client) {
          try {
            const messages: DoubaoChatMessage[] = [
              this.buildSystemPrompt(),
              { role: "user", content: this.buildUserPrompt(input) },
            ];
            const response = await this.client.chatCompletion(messages, "Ernie-4.0");
            const result = this.parseJsonResponse(response);
            return { ...result, source: "doubao" };
          } catch (error) {
            logger.warn("豆包 AI 分析失败，已回退至 LLM / 关键词规则", { error });
          }
        }

        if (getLlmConfig()) {
          try {
            const system = this.buildSystemPrompt().content;
            const user = this.buildUserPrompt(input);
            const response = await callLlm(system, user);
            const result = this.parseJsonResponse(response);
            return { ...result, source: "llm" };
          } catch (error) {
            logger.warn("LLM 调用失败，已回退关键词规则", { error });
          }
        }

        return { ...this.getRuleBasedResult(input), source: "rule" };
      } catch (err) {
        logger.warn("分析异常，已回退关键词规则", { err });
        return { ...this.getRuleBasedResult(input), source: "rule" };
      }
    };

    const result = await Promise.race([runAnalysis(), timeoutPromise]);
    finished = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    return result;
  }

  /** 从大模型返回文本里尽可能宽松地解析 JSON */
  private parseJsonResponse(raw: string): ContentAnalysisResult {
    if (!raw || typeof raw !== "string") {
      throw new Error("AI 返回为空");
    }
    let text = raw.trim();

    // 去掉 ```json ... ``` / ``` ... ``` 包裹
    const codeBlock = text.match(/```(?:json)?[\s\S]*?```/i);
    if (codeBlock) {
      text = codeBlock[0].replace(/```(?:json)?/gi, "").trim();
    }

    // 取第一个 { 到最后一个 } 之间的内容
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      text = text.slice(first, last + 1);
    }

    const parsed = JSON.parse(text);
    return this.normalizeResult(parsed);
  }

  private normalizeResult(raw: Record<string, unknown>): ContentAnalysisResult {
    return {
      forecastHigh: String(raw.forecastHigh || "").trim() || null,
      forecastMidHigh: String(raw.forecastMidHigh || "").trim() || null,
      forecastMid: String(raw.forecastMid || "").trim() || null,
      forecastLow: String(raw.forecastLow || "").trim() || null,
      reasoning: String(raw.reasoning || "").trim() || null,
      confidence: typeof raw.confidence === "number" ? raw.confidence : 60,
      keySignals: Array.isArray(raw.keySignals)
        ? (raw.keySignals as unknown[]).map((s) => String(s)).filter(Boolean)
        : [],
      source: (raw.source === "doubao" || raw.source === "llm" ? raw.source : "llm"),
    };
  }

  /** 纯关键词规则的降级结果 — 依据信号分类给一份可编辑的起始建议 */
  private getRuleBasedResult(input: AnalysisInput): ContentAnalysisResult {
    const signals = input.matchedSignals || [];
    const title = input.title || "";

    // 按分类匹配高确定性推断（取前 2 个命中分类）
    const matchedCategories = signals.filter((s) => HIGH_CERTAINTY_RULES[s]);
    const highLines = matchedCategories.slice(0, 2).map((s) => HIGH_CERTAINTY_RULES[s]);

    // 文本级关键词信号检测
    const fullText = ((input.summary || "") + " " + (input.content || "")).toLowerCase();
    const hasDeadline = /截止|申报截止|报送时限|时限|倒计时/.test(fullText) || signals.some((s) => /截止|时限/.test(s));
    const hasSupport = /资金|奖补|补贴|资助|试点|示范|扶持|专项|培育/.test(fullText) || signals.some((s) => /强支持|扶持|资金/.test(s));
    const hasRegulation = /监管|处罚|整改|规范|管理办法|标准|合规|禁止|查处/.test(fullText) || signals.some((s) => /版权|标准|风险|预警/.test(s));
    const hasExecution = /印发|出台|实施|施行|落实|部署|推进|通知/.test(fullText) || signals.some((s) => /强执行|落实/.test(s));
    const hasTimeline = /(\d{1,2}\s*月|年内|近期|\d{4}[\s年])/.test(input.summary || input.content || "");

    const forecastHigh = highLines.length > 0
      ? highLines.join("；")
      : "文件已发布，建议立即确认其中的执行要求、落实时间节点或申报截止对你关注的领域是否有直接影响。";

    const midHighParts: string[] = [];
    if (hasDeadline) midHighParts.push("申报/报送截止临近，若有意向应立即准备材料并确认提交渠道。");
    if (hasExecution) midHighParts.push("已进入执行阶段，建议关注后续配套实施细则与责任分工。");
    if (hasSupport) midHighParts.push("释放了资金/试点/扶持信号，建议评估申报资格与窗口。");
    const forecastMidHigh = midHighParts.length > 0 ? midHighParts.join("；") : "后续可能有配套通知或实施方案，建议订阅该来源以保持更新。";

    const midParts: string[] = [];
    if (hasRegulation) midParts.push("涉及监管/标准要求，建议提前评估合规影响，关注处罚或整改条款。");
    if (hasTimeline) midParts.push("内容提到了明确时间节点，建议加入日历提醒以防错过。");
    const forecastMid = midParts.length > 0 ? midParts.join("；") : "具体影响和时间节奏还需观察后续跟进信息。";

    const forecastLow =
      "如果该政策取向持续，长期可能影响 AI／数字经济领域的产业布局、扶持结构或监管框架，但当前尚无法判断具体时间与力度。";

    const reasoningParts: string[] = [];
    reasoningParts.push(`「${title.slice(0, 40)}」`);
    if (matchedCategories.length > 0) {
      reasoningParts.push(`识别到的信号分类：${matchedCategories.slice(0, 3).join("、")}。`);
    }
    const detected: string[] = [];
    if (hasDeadline) detected.push("申报截止");
    if (hasSupport) detected.push("资金/扶持");
    if (hasRegulation) detected.push("监管/合规");
    if (hasExecution) detected.push("执行落实");
    if (detected.length > 0) reasoningParts.push(`检测到信号：${detected.join("、")}。`);
    reasoningParts.push("以上为关键词规则自动生成，建议结合原文进一步判断。");
    const reasoning = reasoningParts.join(" ");

    const signalKeywords = matchedCategories.length > 0 ? matchedCategories : signals;

    return {
      forecastHigh,
      forecastMidHigh,
      forecastMid,
      forecastLow,
      reasoning,
      confidence: matchedCategories.length >= 2 ? 65 : matchedCategories.length >= 1 ? 55 : 40,
      keySignals: signalKeywords.slice(0, 8),
      source: "rule",
    };
  }

  async batchAnalyze(inputs: AnalysisInput[]): Promise<ContentAnalysisResult[]> {
    const results: ContentAnalysisResult[] = new Array(inputs.length);
    const concurrency = 3; // 最多并发 3 条分析
    let cursor = 0;
    // 箭头函数，捕获 this （避免 TS this 隐式 any）
    const worker = async (): Promise<void> => {
      while (true) {
        const i = cursor++;
        if (i >= inputs.length) return;
        try {
          results[i] = await this.analyze(inputs[i]);
        } catch (err) {
          logger.warn("batchAnalyze 单条失败，已回退规则", { err });
          results[i] = { ...this.getRuleBasedResult(inputs[i]), source: "rule" };
        }
      }
    };
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(concurrency, inputs.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
    return results;
  }
}

let cachedAnalyzer: ContentAnalyzer | null = null;

export function getContentAnalyzer(): ContentAnalyzer {
  if (cachedAnalyzer) return cachedAnalyzer;
  cachedAnalyzer = new ContentAnalyzer();
  return cachedAnalyzer;
}