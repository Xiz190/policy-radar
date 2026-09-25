import { getDoubaoClient, DoubaoChatMessage } from "./doubao";
import { createLogger } from "@/lib/logger";

const logger = createLogger("PolicyAnalyzer");

export interface PolicyAnalysisResult {
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
  "A·强执行信号": "文件已明确给出执行要求与时间节点，相关部门需在近期启动落实。",
  "B·强支持信号": "政策口径已释放明确支持信号，资金、试点或配套措施有较大概率在 1-3 个月内落地。",
  "C·风险信号": "文件提及风险防范与监管要求，后续可能出台配套监管细则。",
  "D·探索信号": "官方已纳入探索/试点范畴，后续大概率会发布试点方案或征集案例。",
  "通用启动/落地": "政策已进入执行阶段，后续将有具体实施方案、申报通知、资金下达等动作。",
  "AI/智能体/大模型": "涉及人工智能 / 大模型方向，后续可能有算力调度、场景开放、标准规范等动作。",
  "算力/算电协同": "涉及算力基础设施方向，后续可能有算力调度、绿色算力补贴、价格机制等安排。",
  "数据要素/高质量数据集": "涉及数据要素方向，后续可能有公共数据开放、数据资产入表试点、数据交易规则等落地。",
  "产业合作/京津冀协同": "涉及产业协同方向，后续可能有区域合作项目、共建园区、产业基金等推进。",
  "政务服务/平台经济/数字经济": "涉及数字经济方向，后续可能有政务数据共享、平台监管规则、数字经济试点等动作。",
  "法规/征求意见": "文件处于意见征集/立法推进阶段，后续大概率有正式稿发布与实施日期。",
  "区域信号": "涉及区域发展，后续可能有区域试点、地方资金、重点项目清单等信息。",
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


export class PolicyAnalyzer {
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
      content: `你是一位专业的政策分析专家，擅长从政府文件和新闻中识别政策信号并进行前瞻性预测。

## 你的任务
基于提供的政策文件内容，分析并预测可能产生的后续政策动作和市场影响。

## 分析框架
请按照以下四个确定性级别进行分析：

### 高确定性（forecastHigh）
- 明确提到的时间节点和具体措施
- 文件中明确规定的下一步工作安排
- 已列入计划的具体行动

### 中高确定性（forecastMidHigh）
- 根据上下文可以合理推断的下一步行动
- 类似政策的常规推进节奏
- 从文件逻辑中可以推导的结果

### 中确定性（forecastMid）
- 可能的发展方向和潜在影响
- 需要观察后续信号的事项
- 有一定不确定性但值得关注的方向

### 低确定性（forecastLow）
- 长期趋势和可能性
- 需要更多信息才能判断的事项
- 可能性较低但需留意的方向

## 输出要求
1. 分析必须基于提供的文件内容
2. 每个级别都要有明确的依据
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
    return `请分析以下政策文件并进行预测：

【文件标题】
${input.title || "（无标题）"}

【识别到的信号分类】
${signalsText}

【文件正文（节选）】
${contentText}

请按照要求的 JSON 格式输出分析结果。`;
  }

  async analyze(input: AnalysisInput): Promise<PolicyAnalysisResult> {
    // 1) 优先走豆包 SDK；2) 其次走 OpenAI 兼容的 LLM_* 环境变量；3) 都不可用则走关键词规则降级。
    // 整体包裹一层超时：单条分析最多 45 秒，超过则回退到规则版
    let finished = false;
    let fallbackTimer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<PolicyAnalysisResult>((resolve) => {
      const timeout = setTimeout(() => {
        if (!finished) {
          const base = this.getRuleBasedResult(input);
          resolve({ ...base, errorHint: "单条分析超时，已回退规则版" });
        }
      }, 45000);
      fallbackTimer = timeout;
    });

    const runAnalysis = async (): Promise<PolicyAnalysisResult> => {
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
  private parseJsonResponse(raw: string): PolicyAnalysisResult {
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

  private normalizeResult(raw: Record<string, unknown>): PolicyAnalysisResult {
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
  private getRuleBasedResult(input: AnalysisInput): PolicyAnalysisResult {
    const signals = input.matchedSignals || [];
    const title = input.title || "";

    // 按分类匹配高确定性推断（取前 2 个命中分类）
    const matchedCategories = signals.filter((s) => HIGH_CERTAINTY_RULES[s]);
    const highLines = matchedCategories.slice(0, 2).map((s) => HIGH_CERTAINTY_RULES[s]);

    // 文本级关键词信号检测
    const fullText = ((input.summary || "") + " " + (input.content || "")).toLowerCase();
    const hasFunding = /资金|预算|补贴|经费|拨款|专项资金|补贴|奖励/.test(fullText) || signals.some((s) => /资金|补贴|经费/.test(s));
    const hasPilot = /试点|示范|示范工程|示范区|试验|探索/.test(fullText) || signals.some((s) => /试点|示范|探索/.test(s));
    const hasStandard = /标准|规范|技术标准|行业标准|国标|行业标准/.test(fullText) || signals.some((s) => /标准|规范/.test(s));
    const hasProcurement = /采购|招标|公开招标|询价|竞争性谈判/.test(fullText) || signals.some((s) => /采购|招标/.test(s));
    const hasTimeline = /(\d{1,2}\s*月|年内|近期|一季度|二季度|三季度|四季度|上半年|下半年|\d{4}\s*年)/.test(input.summary || input.content || "");

    const forecastHigh = highLines.length > 0
      ? highLines.join("；")
      : "文件已正式发布，后续大概率将有官方实施细则或工作安排。";

    const midHighParts: string[] = [];
    if (hasFunding) midHighParts.push("可能配套出台专项资金/补贴申报通知，建议关注部委官网与地方财政局公告。");
    if (hasPilot) midHighParts.push("后续可能发布试点/示范项目的申报指南或案例征集。");
    if (hasProcurement) midHighParts.push("近期可能发布相关采购/招标公告，需要持续关注。");
    const forecastMidHigh = midHighParts.length > 0 ? midHighParts.join("；") : "近期可能出台配套措施或工作部署，建议每月跟踪部委发布动态。";

    const midParts: string[] = [];
    if (hasStandard) midParts.push("后续可能有相关标准/规范的制定或修订工作，需观察行业协会或标准化组织的动态。");
    if (hasTimeline) midParts.push("正文提到了明确的时间节点，后续大概率在该时间点前后有落地动作。");
    const forecastMid = midParts.length > 0 ? midParts.join("；") : "具体影响范围和执行节奏还需进一步观察后续配套文件。";

    const forecastLow =
      "如果该项政策持续推进，长期可能催生行业标准、商业模式、区域布局等方面的结构性变化，但当前尚不足以判断具体落地时间与强度。";

    const reasoningParts: string[] = [];
    reasoningParts.push(`标题为"${title.slice(0, 40)}"的文件。`);
    if (matchedCategories.length > 0) {
      reasoningParts.push(`已识别到的信号分类：${matchedCategories.slice(0, 3).join("、")}。`);
    }
    const detected: string[] = [];
    if (hasFunding) detected.push("资金/补贴");
    if (hasPilot) detected.push("试点/示范");
    if (hasStandard) detected.push("标准/规范");
    if (hasProcurement) detected.push("采购/招标");
    if (detected.length > 0) reasoningParts.push(`检测到关键词信号：${detected.join("、")}。`);
    reasoningParts.push("以上为关键词规则自动生成的起点，建议结合个人判断进一步编辑。");
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

  async batchAnalyze(inputs: AnalysisInput[]): Promise<PolicyAnalysisResult[]> {
    const results: PolicyAnalysisResult[] = new Array(inputs.length);
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

let cachedAnalyzer: PolicyAnalyzer | null = null;

export function getPolicyAnalyzer(): PolicyAnalyzer {
  if (cachedAnalyzer) return cachedAnalyzer;
  cachedAnalyzer = new PolicyAnalyzer();
  return cachedAnalyzer;
}