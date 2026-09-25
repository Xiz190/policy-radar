import { NextResponse } from "next/server";
import {
  ensureMonitorSchema,
  getItemDetailBySourceAndUrl,
} from "@/lib/monitor/db";
import { getContentAnalyzer } from "@/lib/ai/content-analyzer";
import { isDbAvailable } from "@/lib/db";

export const dynamic = "force-dynamic";

export const MAX_COMPARE_ITEMS = 5;

export function parseItemsParam(itemsStr: string): Array<{ sourceId: string; url: string }> {
  const result: Array<{ sourceId: string; url: string }> = [];
  const parts = itemsStr.split("|");
  for (const part of parts) {
    if (!part) continue;
    const idx = part.indexOf("::");
    if (idx > 0) {
      const sourceId = part.slice(0, idx);
      const url = part.slice(idx + 2);
      if (sourceId && url) {
        result.push({ sourceId, url });
      }
    }
  }
  const finalResult = result.slice(0, MAX_COMPARE_ITEMS);
  console.log(
    `[Compare API][parseItemsParam] 解析参数: 原始片段=${parts.length}, 有效条目=${result.length}, 截断后=${finalResult.length} (上限=${MAX_COMPARE_ITEMS})`
  );
  return finalResult;
}

// GET 批量获取多条政策详情（用于结构化对比）
export async function GET(request: Request) {
  console.log(`[Compare API][GET] 收到对比请求`);
  await ensureMonitorSchema();

  if (!isDbAvailable()) {
    return NextResponse.json(
      { error: "演示模式下不支持多条目对比，请连接数据库后使用" },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const itemsStr = url.searchParams.get("items") ?? "";
  const items = parseItemsParam(itemsStr);

  if (items.length < 2) {
    console.warn(`[Compare API][GET] 参数校验失败: 需要至少2条内容，实际=${items.length}`);
    return NextResponse.json(
      { error: "至少需要 2 条内容才能对比" },
      { status: 400 }
    );
  }

  console.log(`[Compare API][GET] 开始查询 ${items.length} 条内容详情...`);
  const details = await Promise.all(
    items.map((item) => getItemDetailBySourceAndUrl(item.sourceId, item.url))
  );

  const validDetails = details.filter(Boolean);
  const missingCount = details.length - validDetails.length;
  console.log(
    `[Compare API][GET] 查询完成: 请求=${details.length}条, 成功=${validDetails.length}条, 缺失=${missingCount}条`
  );
  if (missingCount > 0) {
    console.warn(`[Compare API][GET] 有 ${missingCount} 条内容未找到，已过滤`);
  }

  return NextResponse.json({
    ok: true,
    items: validDetails,
  });
}

// POST AI 对比分析
export async function POST(request: Request) {
  console.log(`[Compare API][POST] 收到 AI 对比请求`);
  try {
    const body = await request.json();
    const items = body.items as Array<{
      title: string;
      content: string;
      summary?: string;
      department?: string;
      publishedAt?: string;
    }>;

    console.log(`[Compare API][POST] 请求参数: 内容数量=${items?.length ?? 0}`);

    if (!items || items.length < 2) {
      console.warn(`[Compare API][POST] 参数校验失败: 需要至少2条内容，实际=${items?.length ?? 0}`);
      return NextResponse.json(
        { ok: false, error: "至少需要 2 条内容才能对比" },
        { status: 400 }
      );
    }

    if (items.length > MAX_COMPARE_ITEMS) {
      console.warn(`[Compare API][POST] 参数校验失败: 超过最大对比数，实际=${items.length}, 上限=${MAX_COMPARE_ITEMS}`);
      return NextResponse.json(
        { ok: false, error: `最多支持 ${MAX_COMPARE_ITEMS} 条内容同时对比` },
        { status: 400 }
      );
    }

    const analyzer = getContentAnalyzer();

    const systemPrompt = `你是一位专业的政策分析专家，擅长对比分析多份政策文件的异同点和关联关系。

## 你的任务
对比分析用户提供的 ${items.length} 份政策文件，从多个维度进行系统性对比。

## 分析维度
请从以下维度进行对比分析：

1. **核心主题对比**
   - 各政策的核心主题和政策方向
   - 主题相关性和差异点

2. **发布背景与目标对比**
   - 各政策的出台背景
   - 政策目标的异同

3. **重点措施对比**
   - 各政策提出的核心措施
   - 措施力度和覆盖范围的差异

4. **时间节点对比**
   - 各政策的发布时间、实施时间、截止日期
   - 时间节奏的差异

5. **适用范围对比**
   - 适用行业、地区、主体的差异
   - 覆盖广度的对比

6. **资金与支持力度对比**
   - 是否有明确资金支持
   - 支持方式和力度差异

7. **相互关系分析**
   - 政策之间是否存在衔接、补充、替代关系
   - 是否存在层级关系（上位法/下位法）
   - 组合起来可能产生的叠加效应

8. **影响评估对比**
   - 各政策的预期影响范围和强度
   - 综合影响评估

## 输出要求
1. 分析必须基于提供的文件内容，不得臆测
2. 对比要客观、准确，突出异同点
3. 输出格式为 JSON，包含以下字段：
   - overallSummary: 总体对比结论（300字以内）
   - similarities: 共同点数组（每条 100字以内，5-8条）
   - differences: 差异点数组（每条 100字以内，5-8条）
   - relationships: 相互关系分析（200字以内）
   - impactComparison: 各政策影响强度评估数组（每项含 policyIndex、impactLevel: high/medium/low、impactAreas: string[]）
   - keyFindings: 关键发现和建议（200字以内）

请直接输出 JSON，不要附加任何 markdown 代码块或解释文字。`;

    const itemsText = items
      .map((item, idx) => {
        const contentPreview = (
          item.summary && item.summary.trim().length > 0
            ? item.summary
            : item.content || ""
        ).slice(0, 600);
        return `【政策 ${idx + 1}】
标题：${item.title || "（无标题）"}
发布单位：${item.department || "未知"}
发布时间：${item.publishedAt || "未知"}
正文（节选）：
${contentPreview}`;
      })
      .join("\n\n");

    const userPrompt = `请对比分析以下 ${items.length} 份政策文件：

${itemsText}

请按照要求的 JSON 格式输出对比分析结果。`;

    let resultText = "";
    let source: "doubao" | "llm" | "rule" = "rule";

    // 尝试调用 AI
    try {
      // 先检查是否有豆包客户端
      const doubaoClient = (analyzer as unknown as { client?: { chatCompletion?: (...args: unknown[]) => unknown } }).client;
      if (doubaoClient && typeof doubaoClient.chatCompletion === "function") {
        console.log(`[Compare API][POST] 尝试调用豆包 AI...`);
        const response = await doubaoClient.chatCompletion(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          "Ernie-4.0"
        );
        resultText = typeof response === "string" ? response : JSON.stringify(response);
        source = "doubao";
        console.log(`[Compare API][POST] 豆包 AI 调用成功，结果长度=${resultText.length}`);
      } else {
        console.log(`[Compare API][POST] 豆包客户端不可用，尝试 LLM HTTP 接口...`);
        // 尝试用 LLM HTTP 接口（复用 policy-analyzer 的配置逻辑）
        const env = (typeof process !== "undefined" && (process.env as Record<string, string | undefined>)) || {};
        const apiKey = (env.LLM_API_KEY || env.OPENAI_API_KEY || "").trim();
        if (apiKey) {
          const baseUrl = (env.LLM_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/$/, "");
          const model = (env.LLM_MODEL || "gpt-4o-mini").trim();
          const temperature = parseFloat(env.LLM_TEMPERATURE || "0.2");
          const maxTokens = parseInt(env.LLM_MAX_TOKENS || "1500", 10);
          console.log(`[Compare API][POST] LLM 配置: baseUrl=${baseUrl}, model=${model}, temperature=${temperature}`);
          
          const res = await fetch(baseUrl.replace(/\/$/, "") + "/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + apiKey,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              temperature,
              max_tokens: maxTokens,
            }),
            signal: AbortSignal.timeout(60000),
          });
          if (res.ok) {
            const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
            const content = (data?.choices?.[0]?.message?.content || "").trim();
            if (content) {
              resultText = content;
              source = "llm";
              console.log(`[Compare API][POST] LLM 调用成功，结果长度=${resultText.length}`);
            } else {
              console.warn(`[Compare API][POST] LLM 返回内容为空`);
            }
          } else {
            console.warn(`[Compare API][POST] LLM 调用失败: status=${res.status}`);
          }
        } else {
          console.warn(`[Compare API][POST] 未配置 LLM API Key，跳过 LLM 调用`);
        }
      }
    } catch (error) {
      console.warn("[Compare API][POST] AI 对比分析失败，回退到规则版：", error);
    }

    // 如果 AI 调用失败，生成规则版对比结果
    if (!resultText || source === "rule") {
      console.log(`[Compare API][POST] AI 不可用，使用规则版对比分析`);
      resultText = JSON.stringify(generateRuleBasedComparison(items));
      source = "rule";
    }

    // 解析 JSON
    let comparisonResult: Record<string, unknown>;
    try {
      const text = resultText.trim();
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        comparisonResult = JSON.parse(text.slice(first, last + 1));
      } else {
        comparisonResult = JSON.parse(text);
      }
      console.log(`[Compare API][POST] JSON 解析成功，来源=${source}`);
    } catch (parseError) {
      console.warn("[Compare API][POST] JSON 解析失败，回退到规则版：", parseError);
      comparisonResult = generateRuleBasedComparison(items);
      source = "rule";
    }

    console.log(`[Compare API][POST] 对比分析完成: 来源=${source}, 政策数=${items.length}`);

    return NextResponse.json({
      ok: true,
      result: comparisonResult,
      source,
    });
  } catch (error) {
    console.error("对比分析 API 错误:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message || "未知错误" },
      { status: 500 }
    );
  }
}

export type RuleBasedComparisonResult = {
  overallSummary: string;
  similarities: string[];
  differences: string[];
  relationships: string;
  impactComparison: Array<{
    policyIndex: number;
    impactLevel: "high" | "medium" | "low";
    impactAreas: string[];
  }>;
  keyFindings: string;
};

export function generateRuleBasedComparison(
  items: Array<{
    title: string;
    content: string;
    summary?: string;
    department?: string;
    publishedAt?: string;
  }>
): RuleBasedComparisonResult {
  console.log(`[Compare API][RuleCompare] 开始规则版对比分析: 政策数量=${items.length}`);

  const similarities: string[] = [];
  const differences: string[] = [];
  const impactComparison: Array<{
    policyIndex: number;
    impactLevel: "high" | "medium" | "low";
    impactAreas: string[];
  }> = [];

  // 提取各政策的关键词特征
  const itemFeatures = items.map((item, idx) => {
    const text = ((item.summary || "") + " " + (item.content || "")).toLowerCase();
    const features = {
      index: idx,
      title: item.title,
      department: item.department,
      publishedAt: item.publishedAt,
      hasFunding: /资金|预算|补贴|经费|拨款|专项资金|奖励/.test(text),
      hasPilot: /试点|示范|示范工程|示范区|试验|探索/.test(text),
      hasStandard: /标准|规范|技术标准|行业标准|国标/.test(text),
      hasProcurement: /采购|招标|公开招标|询价|竞争性谈判/.test(text),
      hasTimeline: /(\d{1,2}\s*月|年内|近期|一季度|二季度|三季度|四季度|上半年|下半年|\d{4}\s*年)/.test(
        item.summary || item.content || ""
      ),
      textLength: text.length,
    };
    const sigs = [
      features.hasFunding && "资金",
      features.hasPilot && "试点",
      features.hasStandard && "标准",
      features.hasProcurement && "采购",
      features.hasTimeline && "时间节点",
    ].filter(Boolean);
    console.log(
      `[Compare API][RuleCompare] 特征提取[${idx + 1}]: 标题=${item.title.slice(0, 30)}..., 信号=[${sigs.join(", ")}], 文本长度=${features.textLength}`
    );
    return features;
  });

  // 分析共同点
  const allHaveFunding = itemFeatures.every((f) => f.hasFunding);
  const allHavePilot = itemFeatures.every((f) => f.hasPilot);
  const allHaveTimeline = itemFeatures.every((f) => f.hasTimeline);

  console.log(
    `[Compare API][RuleCompare] 共同点筛选: 全部有资金=${allHaveFunding}, 全部有试点=${allHavePilot}, 全部有时间节点=${allHaveTimeline}`
  );

  if (items.length >= 2) {
    similarities.push(
      `共 ${items.length} 份政策文件，均为政府部门发布的正式政策文件。`
    );
  }
  if (allHaveFunding) {
    similarities.push("均涉及资金支持相关内容，可能包含补贴、专项资金等支持措施。");
  }
  if (allHavePilot) {
    similarities.push("均提到试点/示范相关内容，可能通过试点方式推进政策落地。");
  }
  if (allHaveTimeline) {
    similarities.push("均包含时间节点信息，有明确的推进节奏安排。");
  }
  if (similarities.length < 3) {
    similarities.push("政策方向存在一定关联，建议结合具体领域进行深入分析。");
  }

  console.log(`[Compare API][RuleCompare] 共同点筛选结果: ${similarities.length} 条 (上限8条)`);

  // 分析差异点
  const depts = [...new Set(itemFeatures.map((f) => f.department).filter(Boolean))];
  if (depts.length > 1) {
    differences.push(
      `发布单位不同，分别由 ${depts.slice(0, 3).join("、")} 等 ${depts.length} 个部门发布。`
    );
  }

  const fundingCount = itemFeatures.filter((f) => f.hasFunding).length;
  if (fundingCount > 0 && fundingCount < items.length) {
    differences.push(
      `资金支持力度不同，${fundingCount} 份政策明确提及资金安排，其余未明确提及。`
    );
  }

  const pilotCount = itemFeatures.filter((f) => f.hasPilot).length;
  if (pilotCount > 0 && pilotCount < items.length) {
    differences.push(
      `推进方式有差异，${pilotCount} 份政策包含试点/示范内容，其余偏向全面推行。`
    );
  }

  const dates = itemFeatures
    .map((f) => f.publishedAt)
    .filter(Boolean)
    .sort();
  if (dates.length >= 2 && dates[0] !== dates[dates.length - 1]) {
    differences.push(
      `发布时间跨度较大，最早 ${dates[0]}，最晚 ${dates[dates.length - 1]}。`
    );
  }

  if (differences.length < 3) {
    differences.push("政策侧重点各有不同，建议结合正文内容进行详细对比。");
  }

  console.log(
    `[Compare API][RuleCompare] 差异点筛选结果: ${differences.length} 条 (上限8条), 发布单位数=${depts.length}, 有资金=${fundingCount}/${items.length}, 有试点=${pilotCount}/${items.length}`
  );

  // 影响评估（简单基于文本长度和关键词数量）
  for (const f of itemFeatures) {
    let score = 0;
    if (f.hasFunding) score += 2;
    if (f.hasPilot) score += 1;
    if (f.hasStandard) score += 1;
    if (f.hasProcurement) score += 1;
    if (f.hasTimeline) score += 1;

    const impactLevel: "high" | "medium" | "low" =
      score >= 4 ? "high" : score >= 2 ? "medium" : "low";
    const impactAreas: string[] = [];
    if (f.hasFunding) impactAreas.push("资金支持");
    if (f.hasPilot) impactAreas.push("试点示范");
    if (f.hasStandard) impactAreas.push("标准规范");
    if (f.hasProcurement) impactAreas.push("采购招标");

    console.log(
      `[Compare API][RuleCompare] 影响评估[${f.index + 1}]: 得分=${score}, 等级=${impactLevel}, 影响领域=[${impactAreas.join(", ")}]`
    );

    impactComparison.push({
      policyIndex: f.index,
      impactLevel,
      impactAreas,
    });
  }

  // 仅用于日志：按影响等级排序展示（不修改原始顺序）
  const levelOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortedForLog = [...impactComparison].sort(
    (a, b) => levelOrder[a.impactLevel] - levelOrder[b.impactLevel]
  );
  console.log(
    `[Compare API][RuleCompare] 影响等级分布: 原始顺序=[${impactComparison.map((i) => i.impactLevel).join(", ")}], 按等级排序=[${sortedForLog.map((i) => i.impactLevel).join(", ")}]`
  );

  const overallSummary =
    `本次对比分析了 ${items.length} 份政策文件。这些政策在${
      similarities.length > 0 ? similarities[0].slice(0, 50) : "政策方向上存在关联"
    }等方面存在共性，同时在发布单位、支持力度、推进方式等方面有所差异。建议结合具体业务场景进行深入解读。`;

  const relationships =
    items.length >= 2
      ? `${items.length} 份政策可能存在一定的关联关系，可能是同一政策体系的不同组成部分，或在不同层面、不同领域推进相似方向的工作。具体关联关系需要结合政策全文和官方解读进一步确认。`
      : "";

  const keyFindings =
    "以上分析基于关键词规则自动生成，仅供参考。建议结合政策原文和行业背景进行深入研判，必要时咨询专业政策研究人员。";

  const result = {
    overallSummary,
    similarities: similarities.slice(0, 8),
    differences: differences.slice(0, 8),
    relationships,
    impactComparison,
    keyFindings,
  };

  console.log(
    `[Compare API][RuleCompare] 规则版对比完成: 共同点=${result.similarities.length}条, 差异点=${result.differences.length}条, 影响评估=${result.impactComparison.length}项`
  );

  return result;
}
