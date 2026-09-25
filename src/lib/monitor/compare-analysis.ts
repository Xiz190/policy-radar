import { getCategoryStyle } from "./content-meta";

const DEBUG = process.env.CONTENT_META_DEBUG === "1";

function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log("[CompareAnalysis]", ...args);
  }
}

// ============================================================================
// 类型定义
// ============================================================================

export type CompareItemBasic = {
  sourceId: string;
  url: string;
  title: string;
  departmentName: string;
  channelName: string;
  listPublishedAt: string;
  firstSeenAt: string;
  importanceLevel: string;
  keywordScore: number;
  summary: string | null;
  paragraphs: string[];
  categories: Array<{ category: string; score: number }>;
  matchedKeywords: Array<{ keyword: string; category: string }>;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  deadlineDate: string | null;
  hasFunding: boolean;
  hasPilot: boolean;
  hasProcurement: boolean;
  documentStatus: string | null;
};

export type FieldDiffType = "same" | "different" | "only-left" | "only-right";

export type FieldDiffResult = {
  key: string;
  label: string;
  type: FieldDiffType;
  values: (string | number | boolean | null)[];
  displayValues: string[];
};

export type TextDiffSegment = {
  text: string;
  type: "same" | "added" | "removed" | "modified";
};

export type ImpactDimension =
  | "funding"
  | "pilot"
  | "procurement"
  | "standard"
  | "risk"
  | "timeline"
  | "scope";

export type ImpactComparisonItem = {
  policyIndex: number;
  title: string;
  dimensions: Record<ImpactDimension, {
    level: "high" | "medium" | "low" | "none";
    description: string;
    evidence: string[];
  }>;
  overallLevel: "high" | "medium" | "low";
  overallScore: number;
};

export type TimelineEvent = {
  date: string;
  event: string;
  type: "deadline" | "effective" | "milestone" | "review" | "publication";
  policyIndex: number;
  policyTitle: string;
};

export type TimelineComparisonResult = {
  events: TimelineEvent[];
  timeSpan: {
    earliest: string;
    latest: string;
    totalDays: number;
  };
  policyTimeframes: Array<{
    policyIndex: number;
    policyTitle: string;
    startDate: string;
    endDate: string | null;
  }>;
};

export type EvolutionStage = {
  policyIndex: number;
  policyTitle: string;
  publishedAt: string;
  versionLabel: string;
  relationToPrev: "initial" | "revision" | "upgrade" | "expansion" | "new";
  keyChanges: string[];
  highlightMetrics: Record<string, number>;
};

export type EvolutionTrendPoint = {
  date: string;
  policyIndex: number;
  policyTitle: string;
  metrics: Record<string, number>;
};

export type EvolutionTrendResult = {
  stages: EvolutionStage[];
  trendMetrics: {
    name: string;
    label: string;
    dataPoints: EvolutionTrendPoint[];
  }[];
  overallTrend: string;
  majorMilestones: string[];
};

export type CompareReportData = {
  generatedAt: string;
  itemCount: number;
  items: Array<{ title: string; department: string; publishedAt: string }>;
  fieldDiffs: FieldDiffResult[];
  impactComparison: ImpactComparisonItem[];
  timeline: TimelineComparisonResult;
  categoryOverlap: {
    common: string[];
    uniquePerPolicy: string[][];
  };
  keywordOverlap: {
    common: string[];
    uniquePerPolicy: string[][];
  };
};

// ============================================================================
// 字段对比配置
// ============================================================================

const COMPARE_FIELD_CONFIG: Array<{
  key: string;
  label: string;
  type: "text" | "date" | "number" | "boolean" | "badge";
  getValue: (item: CompareItemBasic) => string | number | boolean | null;
  formatValue: (value: string | number | boolean | null) => string;
}> = [
  {
    key: "departmentName",
    label: "发布单位",
    type: "text",
    getValue: (item) => item.departmentName,
    formatValue: (v) => (v ? String(v) : "—"),
  },
  {
    key: "channelName",
    label: "栏目分类",
    type: "text",
    getValue: (item) => item.channelName,
    formatValue: (v) => (v ? String(v) : "—"),
  },
  {
    key: "listPublishedAt",
    label: "发布日期",
    type: "date",
    getValue: (item) => item.listPublishedAt,
    formatValue: (v) => (v ? String(v).slice(0, 10) : "—"),
  },
  {
    key: "importanceLevel",
    label: "重要程度",
    type: "badge",
    getValue: (item) => item.importanceLevel,
    formatValue: (v) => (v ? String(v) : "—"),
  },
  {
    key: "keywordScore",
    label: "关键词得分",
    type: "number",
    getValue: (item) => item.keywordScore,
    formatValue: (v) => (v !== null && v !== undefined ? String(v) : "—"),
  },
  {
    key: "documentStatus",
    label: "文件类型",
    type: "text",
    getValue: (item) => item.documentStatus,
    formatValue: (v) => (v ? String(v) : "—"),
  },
  {
    key: "effectiveFrom",
    label: "生效日期",
    type: "date",
    getValue: (item) => item.effectiveFrom,
    formatValue: (v) => (v ? String(v).slice(0, 10) : "—"),
  },
  {
    key: "effectiveTo",
    label: "失效日期",
    type: "date",
    getValue: (item) => item.effectiveTo,
    formatValue: (v) => (v ? String(v).slice(0, 10) : "—"),
  },
  {
    key: "deadlineDate",
    label: "截止日期",
    type: "date",
    getValue: (item) => item.deadlineDate,
    formatValue: (v) => (v ? String(v).slice(0, 10) : "—"),
  },
  {
    key: "hasFunding",
    label: "资金支持",
    type: "boolean",
    getValue: (item) => item.hasFunding,
    formatValue: (v) => (v === true ? "是" : v === false ? "否" : "—"),
  },
  {
    key: "hasPilot",
    label: "试点示范",
    type: "boolean",
    getValue: (item) => item.hasPilot,
    formatValue: (v) => (v === true ? "是" : v === false ? "否" : "—"),
  },
  {
    key: "hasProcurement",
    label: "采购招标",
    type: "boolean",
    getValue: (item) => item.hasProcurement,
    formatValue: (v) => (v === true ? "是" : v === false ? "否" : "—"),
  },
];

// ============================================================================
// 1. 字段级差异检测
// ============================================================================

export function analyzeFieldDifferences(items: CompareItemBasic[]): FieldDiffResult[] {
  debugLog(`[analyzeFieldDifferences] 开始分析 ${items.length} 条内容的字段差异`);

  const results: FieldDiffResult[] = [];

  for (const field of COMPARE_FIELD_CONFIG) {
    const values = items.map((item) => field.getValue(item));
    const displayValues = values.map((v) => field.formatValue(v));

    const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== "");
    const uniqueValues = new Set(nonNullValues.map((v) => String(v)));

    let type: FieldDiffType = "same";
    if (uniqueValues.size <= 1) {
      type = "same";
    } else if (values.some((v) => v === null || v === undefined || v === "")) {
      type = "different";
    } else {
      type = "different";
    }

    results.push({
      key: field.key,
      label: field.label,
      type,
      values,
      displayValues,
    });
  }

  const diffCount = results.filter((r) => r.type === "different").length;
  debugLog(`[analyzeFieldDifferences] 分析完成: 共 ${results.length} 个字段, 差异字段 ${diffCount} 个`);

  return results;
}

// ============================================================================
// 2. 文本级差异检测（基于字符的 LCS 算法，适配中文）
// ============================================================================

export function computeTextDiff(textA: string, textB: string): TextDiffSegment[] {
  debugLog(`[computeTextDiff] 计算文本差异, A长度=${textA.length}, B长度=${textB.length}`);

  if (!textA && !textB) {
    return [];
  }
  if (!textA) {
    return [{ text: textB, type: "added" }];
  }
  if (!textB) {
    return [{ text: textA, type: "removed" }];
  }

  const MAX_CHARS = 5_000;
  const charsA = textA.slice(0, MAX_CHARS).split("");
  const charsB = textB.slice(0, MAX_CHARS).split("");
  const m = charsA.length;
  const n = charsB.length;

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (charsA[i - 1] === charsB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const operations: Array<{ char: string; type: "same" | "added" | "removed" }> = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && charsA[i - 1] === charsB[j - 1]) {
      operations.unshift({ char: charsA[i - 1], type: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      operations.unshift({ char: charsB[j - 1], type: "added" });
      j--;
    } else if (i > 0) {
      operations.unshift({ char: charsA[i - 1], type: "removed" });
      i--;
    }
  }

  const mergedOps: Array<{ text: string; type: "same" | "added" | "removed" }> = [];
  let currentType: "same" | "added" | "removed" | null = null;
  let currentText = "";

  for (const op of operations) {
    if (op.type !== currentType) {
      if (currentType !== null && currentText) {
        mergedOps.push({ text: currentText, type: currentType });
      }
      currentType = op.type;
      currentText = op.char;
    } else {
      currentText += op.char;
    }
  }
  if (currentType !== null && currentText) {
    mergedOps.push({ text: currentText, type: currentType });
  }

  const sameCount = mergedOps.filter((s) => s.type === "same").length;
  const diffCount = mergedOps.filter((s) => s.type !== "same").length;
  debugLog(`[computeTextDiff] 差异计算完成: 共 ${mergedOps.length} 段, 相同=${sameCount}, 差异=${diffCount}`);

  return mergedOps;
}

// ============================================================================
// 3. 分类与关键词重叠分析
// ============================================================================

export function analyzeCategoryOverlap(
  items: CompareItemBasic[]
): {
  common: string[];
  uniquePerPolicy: string[][];
  allCategories: string[];
} {
  debugLog(`[analyzeCategoryOverlap] 分析分类重叠, 内容数=${items.length}`);

  const categorySets = items.map((item) =>
    new Set((item.categories || []).map((c) => c.category))
  );

  let common = new Set(categorySets[0] || []);
  for (let i = 1; i < categorySets.length; i++) {
    common = new Set([...common].filter((x) => categorySets[i].has(x)));
  }

  const uniquePerPolicy = categorySets.map((set, idx) => {
    const unique = [...set].filter((cat) => {
      for (let i = 0; i < categorySets.length; i++) {
        if (i === idx) continue;
        if (categorySets[i].has(cat)) return false;
      }
      return true;
    });
    return unique;
  });

  const allCategories = [...new Set(categorySets.flatMap((s) => [...s]))];

  debugLog(`[analyzeCategoryOverlap] 共同分类=${common.size}个, 独有分类数=${uniquePerPolicy.map((u) => u.length).join(", ")}`);

  return {
    common: [...common],
    uniquePerPolicy,
    allCategories,
  };
}

export function analyzeKeywordOverlap(
  items: CompareItemBasic[]
): {
  common: string[];
  uniquePerPolicy: string[][];
  allKeywords: string[];
} {
  debugLog(`[analyzeKeywordOverlap] 分析关键词重叠, 内容数=${items.length}`);

  const keywordSets = items.map((item) =>
    new Set((item.matchedKeywords || []).map((k) => k.keyword))
  );

  let common = new Set(keywordSets[0] || []);
  for (let i = 1; i < keywordSets.length; i++) {
    common = new Set([...common].filter((x) => keywordSets[i].has(x)));
  }

  const uniquePerPolicy = keywordSets.map((set, idx) => {
    const unique = [...set].filter((kw) => {
      for (let i = 0; i < keywordSets.length; i++) {
        if (i === idx) continue;
        if (keywordSets[i].has(kw)) return false;
      }
      return true;
    });
    return unique;
  });

  const allKeywords = [...new Set(keywordSets.flatMap((s) => [...s]))];

  debugLog(`[analyzeKeywordOverlap] 共同关键词=${common.size}个, 独有关键词数=${uniquePerPolicy.map((u) => u.length).join(", ")}`);

  return {
    common: [...common],
    uniquePerPolicy,
    allKeywords,
  };
}

// ============================================================================
// 4. 结构化影响对比表
// ============================================================================

const IMPACT_KEYWORDS: Record<ImpactDimension, { positive: RegExp; negative: RegExp | null; weight: number }> = {
  funding: {
    positive: /(资金|预算|补贴|经费|拨款|专项资金|奖励|补助|财政支持|金融支持|贷款|贴息)/g,
    negative: null,
    weight: 2,
  },
  pilot: {
    positive: /(试点|示范|示范工程|示范区|试验|探索|先行先试)/g,
    negative: null,
    weight: 1.5,
  },
  procurement: {
    positive: /(采购|招标|公开招标|询价|竞争性谈判|集中采购)/g,
    negative: null,
    weight: 1.5,
  },
  standard: {
    positive: /(标准|规范|技术标准|行业标准|国标|标准化)/g,
    negative: null,
    weight: 1,
  },
  risk: {
    positive: /(风险|监管|合规|审查|审批|备案|准入|处罚|问责)/g,
    negative: /(放宽|简化|取消|豁免|减少)/g,
    weight: 1,
  },
  timeline: {
    positive: /(\d{1,2}\s*月|年内|近期|一季度|二季度|三季度|四季度|上半年|下半年|\d{4}\s*年|截止|期限|倒计时)/g,
    negative: null,
    weight: 1,
  },
  scope: {
    positive: /(全国|全面|全域|全行业|跨区域|多部门|协同|统筹)/g,
    negative: /(局部|部分|试点地区|特定|仅限|仅适用于)/g,
    weight: 1,
  },
};

const IMPACT_DIMENSION_LABELS: Record<ImpactDimension, string> = {
  funding: "资金支持",
  pilot: "试点示范",
  procurement: "采购招标",
  standard: "标准规范",
  risk: "监管风险",
  timeline: "时间紧迫度",
  scope: "覆盖范围",
};

export function getImpactDimensionLabel(dim: ImpactDimension): string {
  return IMPACT_DIMENSION_LABELS[dim] || dim;
}

function extractEvidence(text: string, pattern: RegExp, maxCount: number = 3): string[] {
  const sentences = text.split(/[。！？!?]/).filter((s) => s.trim().length > 0);
  const evidence: string[] = [];
  const searchPattern = new RegExp(pattern.source, pattern.flags.replace("g", ""));

  for (const sentence of sentences) {
    if (searchPattern.test(sentence)) {
      evidence.push(sentence.trim().slice(0, 80));
      if (evidence.length >= maxCount) break;
    }
  }

  return evidence;
}

function evaluateDimension(
  text: string,
  dimension: ImpactDimension
): { level: "high" | "medium" | "low" | "none"; description: string; evidence: string[] } {
  const config = IMPACT_KEYWORDS[dimension];
  const positiveMatches = text.match(config.positive) || [];
  const negativeMatches = config.negative ? text.match(config.negative) || [] : [];

  const positiveCount = positiveMatches.length;
  const negativeCount = negativeMatches.length;
  const weightedScore = (positiveCount - negativeCount * 0.5) * config.weight;

  let level: "high" | "medium" | "low" | "none" = "none";
  let description = "";

  if (weightedScore >= 5) {
    level = "high";
    description = `强相关，涉及 ${positiveCount} 处提及`;
  } else if (weightedScore >= 2.5) {
    level = "medium";
    description = `中度相关，涉及 ${positiveCount} 处提及`;
  } else if (weightedScore > 0) {
    level = "low";
    description = `轻度相关，涉及 ${positiveCount} 处提及`;
  } else {
    level = "none";
    description = "未明确提及";
  }

  if (negativeCount > 0 && level !== "none") {
    description += `（含 ${negativeCount} 处限制性表述）`;
  }

  const evidence = extractEvidence(text, config.positive, 3);

  return { level, description, evidence };
}

export function analyzeImpactComparison(items: CompareItemBasic[]): ImpactComparisonItem[] {
  debugLog(`[analyzeImpactComparison] 分析影响对比, 内容数=${items.length}`);

  const dimensions: ImpactDimension[] = ["funding", "pilot", "procurement", "standard", "risk", "timeline", "scope"];

  const results = items.map((item, idx) => {
    const fullText = ((item.summary || "") + "\n" + (item.paragraphs || []).join("\n")).toLowerCase();
    
    const dimResults = {} as Record<ImpactDimension, {
      level: "high" | "medium" | "low" | "none";
      description: string;
      evidence: string[];
    }>;

    let totalScore = 0;
    const levelScore: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };

    for (const dim of dimensions) {
      const result = evaluateDimension(fullText, dim);
      dimResults[dim] = result;
      totalScore += levelScore[result.level];
    }

    let overallLevel: "high" | "medium" | "low" = "low";
    if (totalScore >= 12) {
      overallLevel = "high";
    } else if (totalScore >= 7) {
      overallLevel = "medium";
    }

    debugLog(`[analyzeImpactComparison] 内容${idx + 1}: 总分=${totalScore}, 等级=${overallLevel}`);

    return {
      policyIndex: idx,
      title: item.title,
      dimensions: dimResults,
      overallLevel,
      overallScore: totalScore,
    };
  });

  return results;
}

// ============================================================================
// 5. 时间线对比
// ============================================================================

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

const TIMELINE_PATTERNS: Array<{ pattern: RegExp; type: TimelineEvent["type"]; extractor: (match: RegExpMatchArray, text: string) => { date: string; event: string } | null }> = [
  {
    pattern: /(\d{4}年\d{1,2}月\d{1,2}日)[^，。；]*(前|之前|截止|到期)/g,
    type: "deadline",
    extractor: (match) => {
      const dateStr = match[1].replace(/年|月/g, "-").replace(/日/, "");
      return { date: dateStr, event: match[0].slice(0, 60) };
    },
  },
  {
    pattern: /自(\d{4}年\d{1,2}月\d{1,2}日)[^，。；]*(起|开始|施行|实施|生效)/g,
    type: "effective",
    extractor: (match) => {
      const dateStr = match[1].replace(/年|月/g, "-").replace(/日/, "");
      return { date: dateStr, event: match[0].slice(0, 60) };
    },
  },
  {
    pattern: /(\d{4}年\d{1,2}月)[^，。；]*(完成|启动|开始|结束|验收|评估)/g,
    type: "milestone",
    extractor: (match) => {
      const dateStr = match[1].replace(/年/g, "-").replace(/月/, "");
      return { date: dateStr + "-01", event: match[0].slice(0, 60) };
    },
  },
];

export function analyzeTimelineComparison(items: CompareItemBasic[]): TimelineComparisonResult {
  debugLog(`[analyzeTimelineComparison] 分析时间线对比, 内容数=${items.length}`);

  const events: TimelineEvent[] = [];

  items.forEach((item, idx) => {
    if (item.listPublishedAt) {
      events.push({
        date: item.listPublishedAt.slice(0, 10),
        event: `${item.departmentName}发布《${item.title.slice(0, 30)}》`,
        type: "publication",
        policyIndex: idx,
        policyTitle: item.title,
      });
    }

    if (item.effectiveFrom) {
      events.push({
        date: item.effectiveFrom.slice(0, 10),
        event: "正式生效",
        type: "effective",
        policyIndex: idx,
        policyTitle: item.title,
      });
    }

    if (item.effectiveTo) {
      events.push({
        date: item.effectiveTo.slice(0, 10),
        event: "有效期届满",
        type: "deadline",
        policyIndex: idx,
        policyTitle: item.title,
      });
    }

    if (item.deadlineDate) {
      events.push({
        date: item.deadlineDate.slice(0, 10),
        event: "申报/提交截止",
        type: "deadline",
        policyIndex: idx,
        policyTitle: item.title,
      });
    }

    const fullText = (item.summary || "") + "\n" + (item.paragraphs || []).join("\n");
    for (const { pattern, type, extractor } of TIMELINE_PATTERNS) {
      const matches = fullText.matchAll(pattern);
      let count = 0;
      for (const match of matches) {
        if (count >= 3) break;
        const extracted = extractor(match, fullText);
        if (extracted) {
          events.push({
            date: extracted.date,
            event: extracted.event,
            type,
            policyIndex: idx,
            policyTitle: item.title,
          });
          count++;
        }
      }
    }
  });

  events.sort((a, b) => a.date.localeCompare(b.date));

  const validDates = events
    .map((e) => parseDate(e.date))
    .filter((d): d is Date => d !== null);

  let earliest = "";
  let latest = "";
  let totalDays = 0;

  if (validDates.length >= 2) {
    earliest = validDates[0].toISOString().slice(0, 10);
    latest = validDates[validDates.length - 1].toISOString().slice(0, 10);
    totalDays = daysBetween(validDates[0], validDates[validDates.length - 1]);
  }

  const policyTimeframes = items.map((item, idx) => {
    const dates = [
      parseDate(item.effectiveFrom),
      parseDate(item.listPublishedAt),
    ].filter((d): d is Date => d !== null);
    
    const endDates = [
      parseDate(item.effectiveTo),
      parseDate(item.deadlineDate),
    ].filter((d): d is Date => d !== null);

    return {
      policyIndex: idx,
      policyTitle: item.title,
      startDate: dates.length > 0 ? dates[0].toISOString().slice(0, 10) : item.listPublishedAt?.slice(0, 10) || "",
      endDate: endDates.length > 0 ? endDates[endDates.length - 1].toISOString().slice(0, 10) : null,
    };
  });

  debugLog(`[analyzeTimelineComparison] 时间线分析完成: 事件数=${events.length}, 跨度=${totalDays}天`);

  return {
    events,
    timeSpan: { earliest, latest, totalDays },
    policyTimeframes,
  };
}

// ============================================================================
// 5.5 政策演变趋势分析
// ============================================================================

const VERSION_LABEL_PATTERNS = [
  { pattern: /(第[一二三四五六七八九十]+版|第\d+版)/, type: "revision" as const },
  { pattern: /(修订版|修正版|更新版|升级版)/, type: "revision" as const },
  { pattern: /(行动计划|实施方案|若干措施)/, type: "upgrade" as const },
  { pattern: /(指导意见|通知|公告)/, type: "initial" as const },
];

function detectVersionRelation(titleA: string, titleB: string): EvolutionStage["relationToPrev"] {
  const lowerA = titleA.toLowerCase();
  const lowerB = titleB.toLowerCase();

  if (lowerB.includes("修订") || lowerB.includes("修正") || lowerB.includes("更新")) {
    return "revision";
  }
  if (lowerB.includes("升级") || lowerB.includes("加强") || lowerB.includes("深入")) {
    return "upgrade";
  }
  if (lowerB.includes("扩大") || lowerB.includes("扩展") || lowerB.includes("新增")) {
    return "expansion";
  }

  const hasNewKeyword = /(新|新增|新一批|新一轮)/.test(lowerB);
  if (hasNewKeyword && !/(指导意见|通知)/.test(lowerB)) {
    return "new";
  }

  return "revision";
}

function extractKeyChanges(itemA: CompareItemBasic, itemB: CompareItemBasic): string[] {
  const changes: string[] = [];
  const textA = ((itemA.summary || "") + " " + (itemA.paragraphs || []).join(" "));
  const textB = ((itemB.summary || "") + " " + (itemB.paragraphs || []).join(" "));

  const fundingPattern = /(专项资金|资金规模|预算|补贴|拨款)/g;
  const fundingA = textA.match(fundingPattern)?.length || 0;
  const fundingB = textB.match(fundingPattern)?.length || 0;
  if (fundingB > fundingA) {
    changes.push("资金支持力度加大");
  } else if (fundingB < fundingA) {
    changes.push("资金支持力度调整");
  }

  const pilotPattern = /(试点|示范|示范区|试验区)/g;
  const pilotA = textA.match(pilotPattern)?.length || 0;
  const pilotB = textB.match(pilotPattern)?.length || 0;
  if (pilotB > pilotA) {
    changes.push("试点示范范围扩大");
  }

  const riskPattern = /(监管|风险|合规|审查|处罚)/g;
  const riskA = textA.match(riskPattern)?.length || 0;
  const riskB = textB.match(riskPattern)?.length || 0;
  if (riskB > riskA) {
    changes.push("监管要求加强");
  }

  const standardPattern = /(标准|规范|国标|行业标准)/g;
  const standardA = textA.match(standardPattern)?.length || 0;
  const standardB = textB.match(standardPattern)?.length || 0;
  if (standardB > standardA) {
    changes.push("标准体系完善");
  }

  const categoriesA = new Set((itemA.categories || []).map((c) => c.category));
  const categoriesB = new Set((itemB.categories || []).map((c) => c.category));
  const newCategories = [...categoriesB].filter((c) => !categoriesA.has(c));
  if (newCategories.length > 0) {
    changes.push(`新增关注领域: ${newCategories.slice(0, 2).join("、")}`);
  }

  const keywordsA = new Set((itemA.matchedKeywords || []).map((k) => k.keyword));
  const keywordsB = new Set((itemB.matchedKeywords || []).map((k) => k.keyword));
  const newKeywords = [...keywordsB].filter((k) => !keywordsA.has(k));
  if (newKeywords.length > 0) {
    changes.push(`新增关键词: ${newKeywords.slice(0, 3).join("、")}`);
  }

  if (changes.length === 0) {
    changes.push("内容延续性较强，主要为细节优化");
  }

  return changes;
}

function computeEvolutionMetrics(item: CompareItemBasic): Record<string, number> {
  const text = ((item.summary || "") + " " + (item.paragraphs || []).join(" "));

  const fundingMatches = text.match(/(专项资金|资金规模|预算|补贴|拨款|财政支持)/g) || [];
  const pilotMatches = text.match(/(试点|示范|示范区|试验区|先行先试)/g) || [];
  const riskMatches = text.match(/(监管|风险|合规|审查|处罚|问责)/g) || [];
  const standardMatches = text.match(/(标准|规范|国标|行业标准|标准化)/g) || [];
  const procurementMatches = text.match(/(采购|招标|政府采购|公开招标)/g) || [];
  const scopeMatches = text.match(/(全国|全面|全域|全行业|跨区域|多部门)/g) || [];

  return {
    funding: Math.min(10, fundingMatches.length * 2),
    pilot: Math.min(10, pilotMatches.length * 1.5),
    risk: Math.min(10, riskMatches.length),
    standard: Math.min(10, standardMatches.length),
    procurement: Math.min(10, procurementMatches.length),
    scope: Math.min(10, scopeMatches.length * 1.5),
    overall: Math.min(10, Math.round(
      (fundingMatches.length * 2 + pilotMatches.length * 1.5 + riskMatches.length +
        standardMatches.length + procurementMatches.length + scopeMatches.length * 1.5) / 6 * 2
    )),
  };
}

export function analyzeEvolutionTrend(items: CompareItemBasic[]): EvolutionTrendResult {
  debugLog(`[analyzeEvolutionTrend] 分析内容演变趋势, 内容数=${items.length}`);

  const sortedItems = items
    .map((item, idx) => ({ item, originalIndex: idx }))
    .sort((a, b) => {
      const dateA = a.item.listPublishedAt || "";
      const dateB = b.item.listPublishedAt || "";
      return dateA.localeCompare(dateB);
    });

  const stages: EvolutionStage[] = sortedItems.map(({ item, originalIndex }, idx) => {
    const metrics = computeEvolutionMetrics(item);
    let relationToPrev: EvolutionStage["relationToPrev"] = "initial";
    let keyChanges: string[] = [];

    if (idx === 0) {
      relationToPrev = "initial";
      keyChanges = ["首次发布，确立总体框架和方向"];
    } else {
      const prevItem = sortedItems[idx - 1].item;
      relationToPrev = detectVersionRelation(prevItem.title, item.title);
      keyChanges = extractKeyChanges(prevItem, item);
    }

    const versionLabels = ["初创版", "修订版", "升级版", "深化版", "完善版"];
    const versionLabel = idx < versionLabels.length ? versionLabels[idx] : `第${idx + 1}版`;

    return {
      policyIndex: originalIndex,
      policyTitle: item.title,
      publishedAt: item.listPublishedAt?.slice(0, 10) || "",
      versionLabel,
      relationToPrev,
      keyChanges,
      highlightMetrics: metrics,
    };
  });

  const metricDefs = [
    { name: "funding", label: "资金支持强度" },
    { name: "pilot", label: "试点示范力度" },
    { name: "risk", label: "监管严格程度" },
    { name: "standard", label: "标准完善程度" },
    { name: "overall", label: "综合影响强度" },
  ];

  const trendMetrics = metricDefs.map(({ name, label }) => ({
    name,
    label,
    dataPoints: stages.map((stage) => ({
      date: stage.publishedAt,
      policyIndex: stage.policyIndex,
      policyTitle: stage.policyTitle,
      metrics: { [name]: stage.highlightMetrics[name] || 0 },
    })),
  }));

  let overallTrend = "";
  if (stages.length >= 2) {
    const firstMetrics = stages[0].highlightMetrics;
    const lastMetrics = stages[stages.length - 1].highlightMetrics;
    const overallChange = (lastMetrics.overall || 0) - (firstMetrics.overall || 0);
    const fundingChange = (lastMetrics.funding || 0) - (firstMetrics.funding || 0);
    const riskChange = (lastMetrics.risk || 0) - (firstMetrics.risk || 0);

    if (overallChange > 0) {
      overallTrend = "内容力度持续加强";
      if (fundingChange > 0) overallTrend += "，支持力度不断加大";
      if (riskChange > 0) overallTrend += "，监管体系逐步完善";
    } else if (overallChange < 0) {
      overallTrend = "内容力度有所调整";
    } else {
      overallTrend = "整体保持稳定，侧重细节优化";
    }
  } else {
    overallTrend = "单条内容，暂无演变趋势对比";
  }

  const majorMilestones = stages
    .map((stage, idx) => `${stage.publishedAt} ${stage.versionLabel}发布`)
    .filter(Boolean);

  debugLog(`[analyzeEvolutionTrend] 演变分析完成: 阶段数=${stages.length}, 趋势指标=${trendMetrics.length}`);

  return {
    stages,
    trendMetrics,
    overallTrend,
    majorMilestones,
  };
}

// ============================================================================
// 6. 对比报告导出（Markdown）
// ============================================================================

export function generateMarkdownReport(
  items: CompareItemBasic[],
  fieldDiffs: FieldDiffResult[],
  impactComparison: ImpactComparisonItem[],
  timeline: TimelineComparisonResult,
  categoryOverlap: { common: string[]; uniquePerPolicy: string[][] },
  keywordOverlap: { common: string[]; uniquePerPolicy: string[][] }
): string {
  debugLog(`[generateMarkdownReport] 生成 Markdown 对比报告, 内容数=${items.length}`);

  const now = new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  let md = `# 政策对比分析报告\n\n`;
  md += `> 生成时间：${now}\n`;
  md += `> 对比政策数量：${items.length} 条\n\n`;

  md += `## 一、对比政策概览\n\n`;
  md += `| 序号 | 政策标题 | 发布单位 | 发布日期 |\n`;
  md += `|------|----------|----------|----------|\n`;
  items.forEach((item, idx) => {
    md += `| ${idx + 1} | ${item.title} | ${item.departmentName} | ${item.listPublishedAt?.slice(0, 10) || "—"} |\n`;
  });
  md += `\n`;

  md += `## 二、核心字段差异对比\n\n`;
  const diffFields = fieldDiffs.filter((f) => f.type === "different");
  const sameFields = fieldDiffs.filter((f) => f.type === "same");
  
  md += `### 2.1 差异字段（${diffFields.length} 项）\n\n`;
  if (diffFields.length > 0) {
    md += `| 对比项 | ${items.map((_, i) => `政策 ${i + 1}`).join(" | ")} |\n`;
    md += `|--------|${items.map(() => "----------").join("|")}|\n`;
    diffFields.forEach((field) => {
      md += `| ${field.label} | ${field.displayValues.join(" | ")} |\n`;
    });
    md += `\n`;
  } else {
    md += `所有字段均相同。\n\n`;
  }

  md += `### 2.2 相同字段（${sameFields.length} 项）\n\n`;
  if (sameFields.length > 0) {
    sameFields.forEach((field) => {
      md += `- **${field.label}**：${field.displayValues[0]}\n`;
    });
    md += `\n`;
  }

  md += `## 三、影响维度对比\n\n`;
  const dims: ImpactDimension[] = ["funding", "pilot", "procurement", "standard", "risk", "timeline", "scope"];
  
  md += `| 影响维度 | ${items.map((_, i) => `政策 ${i + 1}`).join(" | ")} |\n`;
  md += `|----------|${items.map(() => "----------").join("|")}|\n`;
  
  for (const dim of dims) {
    const dimLabel = getImpactDimensionLabel(dim);
    const levels = impactComparison.map((imp) => {
      const level = imp.dimensions[dim]?.level || "none";
      const levelLabels: Record<string, string> = {
        high: "高",
        medium: "中",
        low: "低",
        none: "无",
      };
      return levelLabels[level] || level;
    });
    md += `| ${dimLabel} | ${levels.join(" | ")} |\n`;
  }
  
  md += `\n### 综合影响评估\n\n`;
  impactComparison.forEach((imp, idx) => {
    const levelLabels: Record<string, string> = { high: "高影响", medium: "中影响", low: "低影响" };
    md += `**政策 ${idx + 1}**：${levelLabels[imp.overallLevel]}（综合得分 ${imp.overallScore}）\n\n`;
  });

  md += `## 四、时间线对比\n\n`;
  if (timeline.events.length > 0) {
    md += `### 关键时间节点\n\n`;
    for (const event of timeline.events) {
      const typeLabels: Record<string, string> = {
        deadline: "截止",
        effective: "生效",
        milestone: "里程碑",
        review: "评估",
        publication: "发布",
      };
      md += `- **${event.date}** ${typeLabels[event.type] || event.type}：${event.event}（政策 ${event.policyIndex + 1}）\n`;
    }
    md += `\n`;
    
    if (timeline.timeSpan.totalDays > 0) {
      md += `> 时间跨度：从 ${timeline.timeSpan.earliest} 到 ${timeline.timeSpan.latest}，共 ${timeline.timeSpan.totalDays} 天\n\n`;
    }
  }

  md += `## 五、分类与关键词对比\n\n`;
  md += `### 5.1 分类对比\n\n`;
  md += `- **共同分类**（${categoryOverlap.common.length} 个）：${categoryOverlap.common.join("、") || "无"}\n\n`;
  items.forEach((_, idx) => {
    md += `- **政策 ${idx + 1} 独有分类**（${categoryOverlap.uniquePerPolicy[idx].length} 个）：${categoryOverlap.uniquePerPolicy[idx].join("、") || "无"}\n`;
  });
  md += `\n`;

  md += `### 5.2 关键词对比\n\n`;
  md += `- **共同关键词**（${keywordOverlap.common.length} 个）：${keywordOverlap.common.join("、") || "无"}\n\n`;
  items.forEach((_, idx) => {
    md += `- **政策 ${idx + 1} 独有关键词**（${keywordOverlap.uniquePerPolicy[idx].length} 个）：${keywordOverlap.uniquePerPolicy[idx].join("、") || "无"}\n`;
  });
  md += `\n`;

  md += `---\n\n`;
  md += `*本报告由文化遗产动态系统自动生成，仅供参考。具体政策内容请以官方发布为准。*\n`;

  debugLog(`[generateMarkdownReport] 报告生成完成, 长度=${md.length} 字符`);

  return md;
}

// ============================================================================
// 7. 统一对比分析入口
// ============================================================================

export function runFullComparison(items: CompareItemBasic[]): {
  fieldDiffs: FieldDiffResult[];
  impactComparison: ImpactComparisonItem[];
  timeline: TimelineComparisonResult;
  evolutionTrend: EvolutionTrendResult;
  categoryOverlap: {
    common: string[];
    uniquePerPolicy: string[][];
    allCategories: string[];
  };
  keywordOverlap: {
    common: string[];
    uniquePerPolicy: string[][];
    allKeywords: string[];
  };
  markdownReport: string;
  summaryStats: {
    totalFields: number;
    diffFields: number;
    sameFields: number;
    totalEvents: number;
    commonCategories: number;
    commonKeywords: number;
    evolutionStages: number;
  };
} {
  debugLog(`[runFullComparison] 执行完整对比分析, 政策数=${items.length}`);

  const fieldDiffs = analyzeFieldDifferences(items);
  const impactComparison = analyzeImpactComparison(items);
  const timeline = analyzeTimelineComparison(items);
  const evolutionTrend = analyzeEvolutionTrend(items);
  const categoryOverlap = analyzeCategoryOverlap(items);
  const keywordOverlap = analyzeKeywordOverlap(items);
  const markdownReport = generateMarkdownReport(
    items,
    fieldDiffs,
    impactComparison,
    timeline,
    categoryOverlap,
    keywordOverlap
  );

  const diffFields = fieldDiffs.filter((f) => f.type === "different").length;
  const sameFields = fieldDiffs.filter((f) => f.type === "same").length;

  const summaryStats = {
    totalFields: fieldDiffs.length,
    diffFields,
    sameFields,
    totalEvents: timeline.events.length,
    commonCategories: categoryOverlap.common.length,
    commonKeywords: keywordOverlap.common.length,
    evolutionStages: evolutionTrend.stages.length,
  };

  debugLog(`[runFullComparison] 完整对比完成: 差异字段=${diffFields}, 相同字段=${sameFields}, 事件数=${timeline.events.length}`);

  return {
    fieldDiffs,
    impactComparison,
    timeline,
    evolutionTrend,
    categoryOverlap,
    keywordOverlap,
    markdownReport,
    summaryStats,
  };
}

export type RuleConclusion = {
  id: string;
  type: "summary" | "difference" | "similarity" | "trend";
  title: string;
  content: string;
  evidence: string[];
  weight: number;
};

export type RuleSummary = {
  overallSentence: string;
  differenceSentence: string;
  suggestionSentence: string;
};

export const COMPARE_IMPACT_DIMENSIONS: ImpactDimension[] = [
  "funding",
  "pilot",
  "procurement",
  "standard",
  "risk",
  "timeline",
  "scope",
];

export function generateRuleConclusions(items: CompareItemBasic[], analysis: ReturnType<typeof runFullComparison>): RuleConclusion[] {
  const conclusions: RuleConclusion[] = [];
  const { fieldDiffs, impactComparison, categoryOverlap, keywordOverlap, evolutionTrend, summaryStats } = analysis;

  const policyTitles = items.map((i) => i.title);
  const departmentNames = [...new Set(items.map((i) => i.departmentName))];

  const impactLevels = impactComparison.map((ic) => ic.overallLevel);
  const highImpactCount = impactLevels.filter((l) => l === "high").length;
  const hasFunding = items.some((i) => i.hasFunding);
  const hasPilot = items.some((i) => i.hasPilot);
  const hasProcurement = items.some((i) => i.hasProcurement);

  const differences = fieldDiffs.filter((f) => f.type === "different");
  const similarities = fieldDiffs.filter((f) => f.type === "same");

  conclusions.push({
    id: "summary",
    type: "summary",
    title: "总体判断",
    content: generateSummaryContent(items, impactComparison, evolutionTrend),
    evidence: [
      `${items.length} 份政策`,
      `${departmentNames.length} 个发布单位`,
      `${summaryStats.diffFields} 个差异字段`,
      `${highImpactCount} 份高影响政策`,
    ],
    weight: 10,
  });

  if (differences.length > 0) {
    const topDiff = findMostImportantDifference(differences, items);
    if (topDiff) {
      conclusions.push({
        id: "diff-1",
        type: "difference",
        title: "关键差异",
        content: topDiff.content,
        evidence: topDiff.evidence,
        weight: 8,
      });
    }

    if (differences.length > 1) {
      const secondDiff = findSecondImportantDifference(differences, items, topDiff?.key);
      if (secondDiff) {
        conclusions.push({
          id: "diff-2",
          type: "difference",
          title: "次要差异",
          content: secondDiff.content,
          evidence: secondDiff.evidence,
          weight: 6,
        });
      }
    }
  }

  if (similarities.length > 0 && (categoryOverlap.common.length > 0 || keywordOverlap.common.length > 0)) {
    conclusions.push({
      id: "similarity",
      type: "similarity",
      title: "核心共同点",
      content: generateSimilarityContent(items, categoryOverlap, keywordOverlap),
      evidence: [
        `${categoryOverlap.common.length} 个共同分类`,
        `${keywordOverlap.common.length} 个共同关键词`,
      ],
      weight: 7,
    });
  }

  if (evolutionTrend.stages.length > 1) {
    conclusions.push({
      id: "trend",
      type: "trend",
      title: "演变趋势",
      content: generateTrendContent(evolutionTrend),
      evidence: [
        `${evolutionTrend.stages.length} 个版本阶段`,
        evolutionTrend.overallTrend || "",
      ],
      weight: 5,
    });
  }

  if (hasFunding || hasPilot || hasProcurement) {
    const impactContent = generateImpactHighlight(impactComparison);
    if (impactContent) {
      conclusions.push({
        id: "impact",
        type: "difference",
        title: "影响评估",
        content: impactContent,
        evidence: impactComparison.map((ic) => `${ic.title}: ${ic.overallLevel}`),
        weight: 7,
      });
    }
  }

  return conclusions
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}

export function generateRuleSummary(
  items: CompareItemBasic[],
  analysis: ReturnType<typeof runFullComparison>
): RuleSummary {
  const { impactComparison, fieldDiffs, evolutionTrend, categoryOverlap, keywordOverlap, summaryStats } = analysis;

  const overallSentence = buildOverallSentence(items, evolutionTrend, impactComparison, summaryStats);
  const differenceSentence = buildDifferenceSentence(items, impactComparison, fieldDiffs);
  const suggestionSentence = buildSuggestionSentence(items, impactComparison, categoryOverlap, keywordOverlap);

  return {
    overallSentence,
    differenceSentence,
    suggestionSentence,
  };
}

function buildOverallSentence(
  items: CompareItemBasic[],
  evolutionTrend: EvolutionTrendResult,
  impactComparison: ImpactComparisonItem[],
  summaryStats: { diffFields: number; sameFields: number; totalFields: number }
): string {
  const policyCount = items.length;
  const deptSet = new Set(items.map((i) => i.departmentName));
  const deptCount = deptSet.size;
  const highImpactCount = impactComparison.filter((ic) => ic.overallLevel === "high").length;

  const parts: string[] = [];

  if (evolutionTrend.stages.length > 1) {
    const direction = evolutionTrend.overallTrend || "持续演进";
    parts.push(`这是同一政策的 ${evolutionTrend.stages.length} 个版本，整体呈现${direction}的趋势`);
  } else if (deptCount === 1) {
    const deptName = items[0].departmentName;
    parts.push(`${deptName}发布的 ${policyCount} 份政策`);
  } else {
    parts.push(`来自 ${deptCount} 个不同部门的 ${policyCount} 份政策`);
  }

  if (summaryStats.sameFields > 0 && summaryStats.diffFields > 0) {
    const diffRatio = Math.round((summaryStats.diffFields / summaryStats.totalFields) * 100);
    if (diffRatio > 60) {
      parts.push("差异较为明显");
    } else if (diffRatio > 30) {
      parts.push("有一定差异但核心方向一致");
    } else {
      parts.push("整体方向高度一致");
    }
  }

  if (highImpactCount === policyCount) {
    parts.push("均为高影响政策");
  } else if (highImpactCount > 0) {
    parts.push(`其中 ${highImpactCount} 份影响较大`);
  }

  return parts.join("，") + "。";
}

function buildDifferenceSentence(
  items: CompareItemBasic[],
  impactComparison: ImpactComparisonItem[],
  fieldDiffs: FieldDiffResult[]
): string {
  const sortedByImpact = [...impactComparison].sort(
    (a, b) => b.overallScore - a.overallScore
  );
  const topItem = sortedByImpact[0];
  const bottomItem = sortedByImpact[sortedByImpact.length - 1];
  const hasImpactGap = topItem.overallScore - bottomItem.overallScore > 0.15;

  const parts: string[] = [];

  const fundingDiff = fieldDiffs.find((f) => f.key === "hasFunding" && f.type === "different");
  const pilotDiff = fieldDiffs.find((f) => f.key === "hasPilot" && f.type === "different");
  const procDiff = fieldDiffs.find((f) => f.key === "hasProcurement" && f.type === "different");
  const importanceDiff = fieldDiffs.find((f) => f.key === "importanceLevel" && f.type === "different");

  if (items.length === 2 && hasImpactGap) {
    const strongerTitle = topItem.title.length > 20 ? topItem.title.slice(0, 20) + "..." : topItem.title;
    const weakerTitle = bottomItem.title.length > 20 ? bottomItem.title.slice(0, 20) + "..." : bottomItem.title;

    const strongerDims: string[] = [];
    (Object.keys(topItem.dimensions) as ImpactDimension[]).forEach((dim) => {
      const topLevel = topItem.dimensions[dim].level;
      const bottomLevel = bottomItem.dimensions[dim].level;
      const levelRank: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
      if (levelRank[topLevel] > levelRank[bottomLevel]) {
        strongerDims.push(getImpactDimensionLabel(dim));
      }
    });

    if (strongerDims.length > 0) {
      parts.push(
        `「${strongerTitle}」在${strongerDims.slice(0, 3).join("、")}等方面力度更强`
      );
    } else {
      parts.push(`「${strongerTitle}」的综合影响高于「${weakerTitle}」`);
    }
  }

  if (fundingDiff) {
    const hasCount = fundingDiff.values.filter((v) => v === true).length;
    parts.push(`${hasCount} 份涉及资金支持`);
  }
  if (pilotDiff) {
    const hasCount = pilotDiff.values.filter((v) => v === true).length;
    parts.push(`${hasCount} 份包含试点示范`);
  }
  if (procDiff) {
    const hasCount = procDiff.values.filter((v) => v === true).length;
    parts.push(`${hasCount} 份涉及采购招标`);
  }

  if (importanceDiff) {
    parts.push("优先级等级存在差异");
  }

  if (parts.length === 0) {
    const diffCount = fieldDiffs.filter((f) => f.type === "different").length;
    if (diffCount > 0) {
      parts.push(`主要在 ${diffCount} 个方面存在差异`);
    } else {
      parts.push("两份政策在核心要素上基本一致");
    }
  }

  return parts.join("，") + "。";
}

function buildSuggestionSentence(
  items: CompareItemBasic[],
  impactComparison: ImpactComparisonItem[],
  categoryOverlap: { common: string[]; uniquePerPolicy: string[][]; allCategories: string[] },
  keywordOverlap: { common: string[]; uniquePerPolicy: string[][]; allKeywords: string[] }
): string {
  const sortedByImpact = [...impactComparison].sort(
    (a, b) => b.overallScore - a.overallScore
  );
  const topItem = sortedByImpact[0];

  const highDims = (Object.keys(topItem.dimensions) as ImpactDimension[])
    .filter((dim) => topItem.dimensions[dim].level === "high")
    .map((dim) => getImpactDimensionLabel(dim));

  const parts: string[] = [];

  if (highDims.length > 0) {
    parts.push(`关注${highDims.slice(0, 3).join("、")}的团队`);
  } else if (categoryOverlap.common.length > 0) {
    const commonCats = categoryOverlap.common
      .slice(0, 2)
      .map((c) => {
        const meta = getCategoryMeta(c);
        return meta?.displayLabel || c;
      });
    parts.push(`关注${commonCats.join("、")}领域的团队`);
  } else {
    parts.push("相关业务团队");
  }

  const topTitle = topItem.title.length > 18 ? topItem.title.slice(0, 18) + "..." : topItem.title;
  if (items.length > 1) {
    parts.push(`建议重点跟进「${topTitle}」`);
  } else {
    parts.push("建议持续关注后续进展");
  }

  if (keywordOverlap.common.length > 0 && keywordOverlap.common.length <= 3) {
    parts.push(`核心关键词：${keywordOverlap.common.join("、")}`);
  }

  return parts.join("，") + "。";
}

function generateSummaryContent(items: CompareItemBasic[], impactComparison: ImpactComparisonItem[], evolutionTrend: EvolutionTrendResult): string {
  const policyCount = items.length;
  const deptCount = [...new Set(items.map((i) => i.departmentName))].length;
  const highImpactCount = impactComparison.filter((ic) => ic.overallLevel === "high").length;

  const parts: string[] = [];

  if (evolutionTrend.stages.length > 1) {
    parts.push(`${evolutionTrend.stages.length} 个版本的演进`);
    if (evolutionTrend.overallTrend) {
      parts.push(evolutionTrend.overallTrend);
    }
  } else {
    parts.push(`${policyCount} 份政策的对比`);
  }

  if (deptCount === 1) {
    parts.push(`来自同一发布单位`);
  } else {
    parts.push(`来自 ${deptCount} 个不同发布单位`);
  }

  if (highImpactCount === policyCount) {
    parts.push("均为高影响政策");
  } else if (highImpactCount > 0) {
    parts.push(`${highImpactCount} 份为高影响`);
  }

  return parts.join("，") + "。";
}

function findMostImportantDifference(differences: FieldDiffResult[], items: CompareItemBasic[]) {
  const importantKeys = new Set([
    "hasFunding",
    "hasPilot",
    "hasProcurement",
    "importanceLevel",
    "effectiveFrom",
    "effectiveTo",
    "deadlineDate",
    "documentStatus",
  ]);

  const importantDiff = differences.find((d) => importantKeys.has(d.key));
  if (importantDiff) {
    return {
      key: importantDiff.key,
      content: generateDiffContent(importantDiff, items),
      evidence: [importantDiff.label],
    };
  }

  if (differences.length > 0) {
    const firstDiff = differences[0];
    return {
      key: firstDiff.key,
      content: generateDiffContent(firstDiff, items),
      evidence: [firstDiff.label],
    };
  }

  return null;
}

function findSecondImportantDifference(differences: FieldDiffResult[], items: CompareItemBasic[], excludeKey?: string) {
  const importantKeys = new Set([
    "hasFunding",
    "hasPilot",
    "hasProcurement",
    "importanceLevel",
    "effectiveFrom",
    "effectiveTo",
    "deadlineDate",
    "documentStatus",
  ]);

  const secondDiff = differences.find((d) => d.key !== excludeKey && importantKeys.has(d.key));
  if (secondDiff) {
    return {
      key: secondDiff.key,
      content: generateDiffContent(secondDiff, items),
      evidence: [secondDiff.label],
    };
  }

  const otherDiff = differences.find((d) => d.key !== excludeKey);
  if (otherDiff) {
    return {
      key: otherDiff.key,
      content: generateDiffContent(otherDiff, items),
      evidence: [otherDiff.label],
    };
  }

  return null;
}

function generateDiffContent(diff: FieldDiffResult, items: CompareItemBasic[]): string {
  const key = diff.key;
  const values = diff.displayValues;

  if (key === "hasFunding") {
    const hasCount = values.filter((v) => v === "是" || v === "true").length;
    const hasItems = items.filter((_, i) => values[i] === "是" || values[i] === "true");
    if (hasCount === items.length) {
      return "所有政策都涉及资金支持。";
    } else if (hasCount === 0) {
      return "所有政策都未涉及资金支持。";
    } else {
      const hasTitles = hasItems.map((i) => i.title).slice(0, 2);
      return `${hasCount} 份政策涉及资金支持（${hasTitles.join("、")}），其余政策未涉及。`;
    }
  }

  if (key === "hasPilot") {
    const hasCount = values.filter((v) => v === "是" || v === "true").length;
    if (hasCount === items.length) {
      return "所有政策都包含试点示范内容。";
    } else if (hasCount === 0) {
      return "所有政策都未涉及试点示范。";
    } else {
      return `${hasCount} 份政策包含试点示范内容，其余政策未涉及。`;
    }
  }

  if (key === "hasProcurement") {
    const hasCount = values.filter((v) => v === "是" || v === "true").length;
    if (hasCount === items.length) {
      return "所有政策都涉及采购招标内容。";
    } else if (hasCount === 0) {
      return "所有政策都未涉及采购招标。";
    } else {
      return `${hasCount} 份政策涉及采购招标内容，其余政策未涉及。`;
    }
  }

  if (key === "importanceLevel") {
    const levelCounts: Record<string, number> = {};
    for (const v of values) {
      levelCounts[v] = (levelCounts[v] || 0) + 1;
    }
    const levelDesc = Object.entries(levelCounts)
      .map(([level, count]) => `${count} 份为${level}`)
      .join("，");
    return `政策重要性存在差异：${levelDesc}。`;
  }

  if (key === "effectiveFrom") {
    const sortedDates = [...values].filter(Boolean).sort();
    if (sortedDates.length > 1 && sortedDates[0] !== sortedDates[sortedDates.length - 1]) {
      return `政策生效时间不同：最早 ${sortedDates[0]}，最晚 ${sortedDates[sortedDates.length - 1]}。`;
    }
  }

  if (values.length === 2) {
    return `${diff.label}不同：${values[0]} vs ${values[1]}。`;
  }

  return `${diff.label}存在差异。`;
}

function generateSimilarityContent(items: CompareItemBasic[], categoryOverlap: { common: string[] }, keywordOverlap: { common: string[] }): string {
  const parts: string[] = [];

  if (categoryOverlap.common.length > 0) {
    const commonCats = categoryOverlap.common.slice(0, 3).map((c) => {
      const meta = getCategoryMeta(c);
      return meta?.displayLabel || c;
    });
    parts.push(`共同涉及${commonCats.join("、")}`);
  }

  if (keywordOverlap.common.length > 0) {
    const commonKws = keywordOverlap.common.slice(0, 3);
    parts.push(`共同关键词${commonKws.join("、")}`);
  }

  if (items.length > 1) {
    const deptSet = new Set(items.map((i) => i.departmentName));
    if (deptSet.size === 1) {
      parts.push("来自同一发布单位");
    }
  }

  return parts.join("，") + "。";
}

function generateTrendContent(evolutionTrend: EvolutionTrendResult): string {
  const stages = evolutionTrend.stages;
  if (stages.length < 2) return "";

  const firstStage = stages[0];
  const lastStage = stages[stages.length - 1];

  const relationDesc: Record<string, string> = {
    initial: "初创版",
    revision: "修订版",
    upgrade: "升级版",
    expansion: "扩展版",
    new: "全新版",
  };

  const parts: string[] = [];

  if (evolutionTrend.overallTrend) {
    parts.push(evolutionTrend.overallTrend);
  }

  if (firstStage.versionLabel && lastStage.versionLabel) {
    parts.push(`${firstStage.versionLabel} → ${lastStage.versionLabel}`);
  }

  const relations = stages
    .slice(1)
    .map((s) => relationDesc[s.relationToPrev] || s.relationToPrev);
  if (relations.length > 0) {
    parts.push(`经历${relations.join("、")}阶段`);
  }

  return parts.join("，") + "。";
}

function generateImpactHighlight(impactComparison: ImpactComparisonItem[]): string {
  const highImpactItems = impactComparison.filter((ic) => ic.overallLevel === "high");
  const mediumImpactItems = impactComparison.filter((ic) => ic.overallLevel === "medium");

  if (highImpactItems.length === 0 && mediumImpactItems.length === 0) {
    return "所有政策影响等级均较低。";
  }

  const parts: string[] = [];

  if (highImpactItems.length > 0) {
    const highTitles = highImpactItems.map((ic) => ic.title).slice(0, 2);
    parts.push(`${highImpactItems.length} 份高影响政策（${highTitles.join("、")}）`);
  }

  if (mediumImpactItems.length > 0) {
    parts.push(`${mediumImpactItems.length} 份中影响政策`);
  }

  return parts.join("，") + "。";
}

function getCategoryMeta(category: string) {
  return getCategoryStyle(category);
}
