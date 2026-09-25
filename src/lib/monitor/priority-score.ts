/**
 * 统一优先级评分系统
 *
 * 将关键词得分、信号加成、部委权重等多维度因素，归一化为 0-100 的统一优先级分数。
 *
 * ## 分数构成（满分 100 分）
 *
 * | 维度 | 满分 | 说明 |
 * |------|------|------|
 * | 关键词基础分 | 65 | 基于 keyword_score 归一化，占比最大，是优先级的核心依据 |
 * | 信号加成 | 20 | 资金、采购、试点、标准等强信号，命中越多加分越多（有封顶） |
 * | 部委权重 | 10 | 重点部委（国务院、工信部、财政部等）的政策天然权重更高 |
 * | 内容质量加成 | 5 | 有正文、有预估判断等质量信号 |
 *
 * ## 等级划分
 *
 * | 等级 | 分数范围 | 标签 | 说明 |
 * |------|---------|------|------|
 * | 核心 | ≥ 75 | 核心关注 | 高优先级，强烈建议优先阅读 |
 * | 重点 | 50-74 | 重点关注 | 较高优先级，建议重点关注 |
 * | 关注 | 25-49 | 值得关注 | 有一定相关性，值得留意 |
 * | 普通 | 0-24 | 普通监测 | 常规监测内容 |
 *
 * @module priority-score
 * @remarks 本文件不依赖数据库/服务端 API，可同时在 Server/Client/React Server Component 中使用。
 */

/**
 * 优先级评分的输入参数
 *
 * @property keywordScore - 关键词匹配得分（0-100，可超过但会被归一化）
 * @property hasFunding - 是否包含资金支持信号（如补贴、资助、拨款等）
 * @property hasProcurement - 是否包含采购信号（如招标、采购、中标等）
 * @property hasPilot - 是否包含试点信号（如试点、示范、试验区等）
 * @property hasStandards - 是否包含标准信号（如标准、规范、准则等）
 * @property departmentName - 发布单位/部委名称
 * @property hasForecast - 是否有 AI 预估判断
 * @property hasMeaningfulBody - 是否有有效正文内容
 * @property hasStrongTopic - （预留）是否有强主题信号
 * @property hasRiskSignal - （预留）是否有风险信号
 */
import {
  FileText, Flame, Pin, Star, type LucideIcon,
} from "lucide-react";

export type PriorityScoreInput = {
  /** 关键词匹配得分（0-100，可超过但会被归一化） */
  keywordScore: number;
  /** 是否包含资金支持信号（如补贴、资助、拨款等） */
  hasFunding?: boolean;
  /** 是否包含采购信号（如招标、采购、中标等） */
  hasProcurement?: boolean;
  /** 是否包含试点信号（如试点、示范、试验区等） */
  hasPilot?: boolean;
  /** 是否包含标准信号（如标准、规范、准则等） */
  hasStandards?: boolean;
  /** 发布单位/部委名称 */
  departmentName?: string;
  /** 是否有 AI 预估判断 */
  hasForecast?: boolean;
  /** 是否有有效正文内容 */
  hasMeaningfulBody?: boolean;
  /** （预留）是否有强主题信号 */
  hasStrongTopic?: boolean;
  /** （预留）是否有风险信号 */
  hasRiskSignal?: boolean;
};

/**
 * 优先级分数的明细构成
 *
 * 用于展示分数的各维度贡献，帮助用户理解"为什么这个政策是这个优先级"。
 *
 * @property keywordBase - 关键词基础分（满分 65）
 * @property signalBonus - 信号加成明细（满分 20）
 * @property signalBonus.funding - 资金信号加成
 * @property signalBonus.procurement - 采购信号加成
 * @property signalBonus.pilot - 试点信号加成
 * @property signalBonus.standards - 标准信号加成
 * @property signalBonus.total - 信号加成总计（不超过 20）
 * @property departmentBonus - 部委权重加成（0 或 10）
 * @property qualityBonus - 内容质量加成（满分 5）
 * @property total - 总分（关键词 + 信号 + 部委 + 质量）
 */
export type PriorityScoreBreakdown = {
  /** 关键词基础分（满分 65） */
  keywordBase: number;
  /** 信号加成明细 */
  signalBonus: {
    /** 资金信号加成 */
    funding: number;
    /** 采购信号加成 */
    procurement: number;
    /** 试点信号加成 */
    pilot: number;
    /** 标准信号加成 */
    standards: number;
    /** 信号加成总计（不超过 20） */
    total: number;
  };
  /** 部委权重加成（0 或 10） */
  departmentBonus: number;
  /** 内容质量加成（满分 5） */
  qualityBonus: number;
  /** 总分（关键词 + 信号 + 部委 + 质量） */
  total: number;
};

/**
 * 优先级等级枚举
 *
 * - `"普通"`：0-24 分，常规监测内容
 * - `"关注"`：25-49 分，有一定相关性，值得留意
 * - `"重点"`：50-74 分，较高优先级，建议重点关注
 * - `"核心"`：≥ 75 分，高优先级，强烈建议优先阅读
 */
export type PriorityLevel = "普通" | "关注" | "重点" | "核心";

/**
 * 优先级评分结果
 *
 * 包含最终分数、等级、展示用的元信息，以及分数明细。
 *
 * @property score - 最终优先级分数（0-100，保留一位小数）
 * @property level - 优先级等级（普通/关注/重点/核心）
 * @property levelLabel - 等级中文标签（如"核心关注"）
 * @property levelIcon - 等级图标
 * @property color - 文字颜色的 Tailwind class
 * @property bgColor - 背景颜色的 Tailwind class
 * @property borderColor - 边框颜色的 Tailwind class
 * @property breakdown - 分数明细构成
 */
export type PriorityScoreResult = {
  /** 最终优先级分数（0-100，保留一位小数） */
  score: number;
  /** 优先级等级（普通/关注/重点/核心） */
  level: PriorityLevel;
  /** 等级中文标签（如"核心关注"） */
  levelLabel: string;
  /** 等级图标 */
  levelIcon: LucideIcon;
  /** 文字颜色的 Tailwind class */
  color: string;
  /** 背景颜色的 Tailwind class */
  bgColor: string;
  /** 边框颜色的 Tailwind class */
  borderColor: string;
  /** 分数明细构成 */
  breakdown: PriorityScoreBreakdown;
};

// ========== 权重配置 ==========

/** 关键词得分的上限（原始分数），超过此值将被截断 */
const KEYWORD_SCORE_CAP = 100;

/** 关键词基础分的满分（65分，占总分的 65%） */
const KEYWORD_BASE_MAX = 65;

/**
 * 各信号类型的加成分值
 *
 * - 资金：10 分（如补贴、资助、拨款等）
 * - 采购：12 分（如招标、采购、中标等）
 * - 试点：7 分（如试点、示范、试验区等）
 * - 标准：6 分（如标准、规范、准则等）
 */
const SIGNAL_BONUS = {
  /** 资金支持信号加成（10分） */
  funding: 10,
  /** 采购招标信号加成（12分） */
  procurement: 12,
  /** 试点示范信号加成（7分） */
  pilot: 7,
  /** 标准规范信号加成（6分） */
  standards: 6,
};

/** 信号加成的总上限（20分），防止信号权重过高 */
const SIGNAL_MAX = 20;

/** 部委权重加成的满分（10分，重点部委直接加满分） */
const DEPT_BONUS_MAX = 10;

/**
 * 内容质量加成的分值
 *
 * - 预估判断（AI 分析）：3 分
 * - 有正文内容：2 分
 */
const QUALITY_BONUS = {
  /** AI 预估判断加成（3分） */
  forecast: 3,
  /** 有效正文内容加成（2分） */
  body: 2,
};

/** 质量加成的总上限（5分） */
const QUALITY_MAX = 5;

/** 优先级总分的满分（100分 = 65 + 20 + 10 + 5） */
const TOTAL_MAX = KEYWORD_BASE_MAX + SIGNAL_MAX + DEPT_BONUS_MAX + QUALITY_MAX;

/**
 * 重点部委列表（加权）
 *
 * 这些部委发布的政策通常更具影响力，给予额外权重加成。
 * 包含：国务院组成部门、京津冀地方政府等。
 */
const HIGH_WEIGHT_DEPARTMENTS = [
  "国务院",
  "国务院办公厅",
  "工业和信息化部",
  "财政部",
  "国家发展和改革委员会",
  "国家发展改革委",
  "科技部",
  "科学技术部",
  "国家互联网信息办公室",
  "中央网络安全和信息化委员会办公室",
  "国家市场监督管理总局",
  "中国人民银行",
  "商务部",
  "教育部",
  "人力资源和社会保障部",
  "公安部",
  "国家卫生健康委员会",
  "北京市人民政府",
  "天津市人民政府",
  "河北省人民政府",
];

/**
 * 等级阈值配置（按从高到低排列）
 *
 * - 核心：≥ 75 分
 * - 重点：≥ 50 分
 * - 关注：≥ 25 分
 * - 普通：≥ 0 分
 */
const LEVEL_THRESHOLDS: Array<{ level: PriorityLevel; min: number }> = [
  { level: "核心", min: 75 },
  { level: "重点", min: 50 },
  { level: "关注", min: 25 },
  { level: "普通", min: 0 },
];

/**
 * 优先级等级元信息
 *
 * 定义每个等级的展示标签、图标、颜色和描述，
 * 用于 UI 展示时保持风格一致。
 */
export const PRIORITY_LEVEL_META: Record<PriorityLevel, {
  /** 等级中文标签（如"核心关注"） */
  label: string;
  /** 等级图标 emoji */
  icon: LucideIcon;
  /** 文字颜色的 Tailwind class */
  color: string;
  /** 背景颜色的 Tailwind class */
  bgColor: string;
  /** 边框颜色的 Tailwind class */
  borderColor: string;
  /** 等级描述说明 */
  description: string;
}> = {
  "核心": {
    label: "核心关注",
    icon: Flame,
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    description: "高优先级，强烈建议优先阅读",
  },
  "重点": {
    label: "重点关注",
    icon: Star,
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    description: "较高优先级，建议重点关注",
  },
  "关注": {
    label: "值得关注",
    icon: Pin,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    description: "有一定相关性，值得留意",
  },
  "普通": {
    label: "普通监测",
    icon: FileText,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    description: "常规监测内容",
  },
};

// ========== 核心计算函数 ==========

/**
 * 将原始关键词得分归一化到关键词基础分（0-65 分）
 *
 * @param rawScore - 原始关键词得分（任意非负数，超过 100 会被截断）
 * @returns 归一化后的关键词基础分（0-65，保留一位小数）
 *
 * @example
 * ```ts
 * normalizeKeywordScore(0);   // 0
 * normalizeKeywordScore(50);  // 32.5（满分 65 的一半）
 * normalizeKeywordScore(100); // 65（满分）
 * normalizeKeywordScore(200); // 65（超过 100 截断）
 * ```
 *
 * @remarks
 * - 关键词得分是优先级评分的核心依据，占总分的 65%
 * - 原始得分超过 100 时会被截断，避免关键词权重过高
 * - 负数和非数字输入会被处理为 0
 */
export function normalizeKeywordScore(rawScore: number): number {
  const score = Math.max(0, Number(rawScore) || 0);
  if (score === 0) {
    return 0;
  }
  const ratio = Math.min(1, score / KEYWORD_SCORE_CAP);
  const result = Math.round(ratio * KEYWORD_BASE_MAX * 10) / 10;
  return result;
}

/**
 * 计算信号加成（资金、采购、试点、标准）
 *
 * 命中的信号越多，加成越高，但有封顶（20 分），防止信号权重过高。
 *
 * @param input - 优先级评分输入，包含各信号标志
 * @returns 信号加成明细，包含各项得分和总计
 *
 * @example
 * ```ts
 * // 无信号
 * calculateSignalBonus({ keywordScore: 0 });
 * // { funding: 0, procurement: 0, pilot: 0, standards: 0, total: 0 }
 *
 * // 资金 + 采购（10+12=22，封顶到 20）
 * calculateSignalBonus({ keywordScore: 0, hasFunding: true, hasProcurement: true });
 * // { funding: 10, procurement: 12, pilot: 0, standards: 0, total: 20 }
 * ```
 *
 * @remarks
 * - 各信号分值：资金 10、采购 12、试点 7、标准 6
 * - 总加成封顶 20 分，避免信号成为决定性因素
 * - 信号是"锦上添花"，不能替代关键词的核心地位
 */
export function calculateSignalBonus(input: PriorityScoreInput): {
  funding: number;
  procurement: number;
  pilot: number;
  standards: number;
  total: number;
} {
  const funding = input.hasFunding ? SIGNAL_BONUS.funding : 0;
  const procurement = input.hasProcurement ? SIGNAL_BONUS.procurement : 0;
  const pilot = input.hasPilot ? SIGNAL_BONUS.pilot : 0;
  const standards = input.hasStandards ? SIGNAL_BONUS.standards : 0;
  const uncappedTotal = funding + procurement + pilot + standards;
  const total = Math.min(SIGNAL_MAX, uncappedTotal);
  
  const hitSignals = [];
  if (funding > 0) hitSignals.push(`资金(${SIGNAL_BONUS.funding})`);
  if (procurement > 0) hitSignals.push(`采购(${SIGNAL_BONUS.procurement})`);
  if (pilot > 0) hitSignals.push(`试点(${SIGNAL_BONUS.pilot})`);
  if (standards > 0) hitSignals.push(`标准(${SIGNAL_BONUS.standards})`);
  
  
  return { funding, procurement, pilot, standards, total };
}

/**
 * 计算部委权重加成
 *
 * 重点部委（国务院、工信部、财政部等）发布的政策通常更具影响力，给予 10 分加成。
 *
 * @param departmentName - 发布单位/部委名称
 * @returns 部委权重加成（0 或 10）
 *
 * @example
 * ```ts
 * calculateDepartmentBonus("工业和信息化部"); // 10（重点部委）
 * calculateDepartmentBonus("某省某某局");     // 0（普通部委）
 * calculateDepartmentBonus("");               // 0（空）
 * ```
 *
 * @remarks
 * - 采用模糊匹配，包含关系即可命中（如"工信部办公厅"匹配"工业和信息化部"）
 * - 重点部委包括：国务院组成部门、京津冀地方政府等
 * - 这是一个二值判断（是/否），没有梯度
 */
export function calculateDepartmentBonus(departmentName?: string): number {
  if (!departmentName) {
    return 0;
  }
  const name = departmentName.trim();
  for (const dept of HIGH_WEIGHT_DEPARTMENTS) {
    if (name.includes(dept) || dept.includes(name)) {
      return DEPT_BONUS_MAX;
    }
  }
  return 0;
}

/**
 * 计算内容质量加成
 *
 * 有预估判断和有效正文的内容质量更高，给予额外加成。
 *
 * @param input - 优先级评分输入，包含质量信号
 * @returns 质量加成（0-5 分）
 *
 * @example
 * ```ts
 * calculateQualityBonus({ keywordScore: 0 }); // 0
 * calculateQualityBonus({ keywordScore: 0, hasForecast: true }); // 3
 * calculateQualityBonus({ keywordScore: 0, hasForecast: true, hasMeaningfulBody: true }); // 5
 * ```
 *
 * @remarks
 * - 预估判断（AI 分析）：3 分
 * - 有正文内容：2 分
 * - 满分 5 分
 */
export function calculateQualityBonus(input: PriorityScoreInput): number {
  let bonus = 0;
  if (input.hasForecast) bonus += QUALITY_BONUS.forecast;
  if (input.hasMeaningfulBody) bonus += QUALITY_BONUS.body;
  const result = Math.min(QUALITY_MAX, bonus);
  
  const qualityFactors = [];
  if (input.hasForecast) qualityFactors.push(`预估判断(${QUALITY_BONUS.forecast})`);
  if (input.hasMeaningfulBody) qualityFactors.push(`有正文(${QUALITY_BONUS.body})`);
  
  
  return result;
}

/**
 * 将分数转换为优先级等级
 *
 * @param score - 优先级分数（0-100）
 * @returns 优先级等级（普通/关注/重点/核心）
 *
 * @example
 * ```ts
 * scoreToLevel(10);  // "普通"
 * scoreToLevel(30);  // "关注"
 * scoreToLevel(60);  // "重点"
 * scoreToLevel(80);  // "核心"
 * scoreToLevel(75);  // "核心"（边界值）
 * ```
 *
 * @remarks
 * 等级阈值：
 * - 核心：≥ 75 分
 * - 重点：50-74 分
 * - 关注：25-49 分
 * - 普通：0-24 分
 */
export function scoreToLevel(score: number): PriorityLevel {
  for (const { level, min } of LEVEL_THRESHOLDS) {
    if (score >= min) return level;
  }
  return "普通";
}

const LOG_PREFIX = "[PriorityScore]";

/**
 * 计算政策优先级评分主函数
 *
 * 将关键词得分、信号加成、部委权重、内容质量等多维度因素，
 * 综合计算出 0-100 的统一优先级分数。
 *
 * @param input - 优先级评分输入参数
 * @param input.keywordScore - 关键词匹配得分（0-100）
 * @param input.hasFunding - 是否包含资金支持信号
 * @param input.hasProcurement - 是否包含采购信号
 * @param input.hasPilot - 是否包含试点信号
 * @param input.hasStandards - 是否包含标准信号
 * @param input.departmentName - 发布单位/部委名称
 * @param input.hasForecast - 是否有 AI 预估判断
 * @param input.hasMeaningfulBody - 是否有有效正文内容
 * @returns 优先级评分结果，包含分数、等级、展示元信息和分数明细
 *
 * @example
 * ```ts
 * // 典型核心关注政策
 * const result = calculatePriorityScore({
 *   keywordScore: 90,
 *   hasFunding: true,
 *   hasProcurement: true,
 *   departmentName: "工业和信息化部",
 *   hasForecast: true,
 * });
 *
 * console.log(result.score);      // 95.5
 * console.log(result.level);      // "核心"
 * console.log(result.levelLabel); // "核心关注"
 * console.log(result.levelIcon);   // Flame
 * console.log(result.breakdown); // 各维度明细
 * ```
 *
 * @example
 * ```ts
 * // 普通政策
 * const result = calculatePriorityScore({
 *   keywordScore: 20,
 *   departmentName: "某普通单位",
 * });
 *
 * console.log(result.score); // 13
 * console.log(result.level); // "普通"
 * ```
 *
 * @remarks
 * ## 算法设计原则
 * 1. **关键词为主**：关键词占 65%，是优先级的核心依据
 * 2. **信号锦上添花**：信号加成封顶 20 分，不能替代关键词
 * 3. **部委加权**：重点部委额外加 10 分
 * 4. **质量加分**：内容质量最多加 5 分
 *
 * ## 等级阈值
 * - 核心：≥ 75 分
 * - 重点：50-74 分
 * - 关注：25-49 分
 * - 普通：0-24 分
 *
 * ## 边界安全
 * - 普通政策（关键词 0-20 分）即使拉满所有加成，也不会跳到核心级
 * - 详见单元测试覆盖了各种边界场景
 *
 * @see {@link PriorityScoreInput} 输入参数详情
 * @see {@link PriorityScoreResult} 返回结果详情
 * @see {@link PriorityScoreBreakdown} 分数明细详情
 */
export function calculatePriorityScore(input: PriorityScoreInput): PriorityScoreResult {
  const keywordBase = normalizeKeywordScore(input.keywordScore);
  const signalBonus = calculateSignalBonus(input);
  const departmentBonus = calculateDepartmentBonus(input.departmentName);
  const qualityBonus = calculateQualityBonus(input);

  const total = Math.round(
    Math.min(
      TOTAL_MAX,
      keywordBase + signalBonus.total + departmentBonus + qualityBonus
    ) * 10
  ) / 10;

  const level = scoreToLevel(total);
  const meta = PRIORITY_LEVEL_META[level];

  return {
    score: total,
    level,
    levelLabel: meta.label,
    levelIcon: meta.icon,
    color: meta.color,
    bgColor: meta.bgColor,
    borderColor: meta.borderColor,
    breakdown: {
      keywordBase,
      signalBonus,
      departmentBonus,
      qualityBonus,
      total,
    },
  };
}

// ========== 展示辅助函数 ==========

/**
 * 格式化优先级分数为整数字符串
 *
 * @param score - 优先级分数（可以带小数）
 * @returns 四舍五入后的整数字符串
 *
 * @example
 * ```ts
 * formatPriorityScore(85.6); // "86"
 * formatPriorityScore(60);   // "60"
 * formatPriorityScore(0);    // "0"
 * ```
 */
export function formatPriorityScore(score: number): string {
  return Math.round(score).toString();
}

/**
 * 获取优先级等级的元信息（标签、图标、颜色等）
 *
 * @param level - 优先级等级
 * @returns 等级元信息对象，包含 label、icon、color、bgColor、borderColor、description
 *
 * @example
 * ```ts
 * const meta = getPriorityLevelMeta("核心");
 * console.log(meta.label);       // "核心关注"
 * console.log(meta.icon);        // Flame
 * console.log(meta.description); // "高优先级，强烈建议优先阅读"
 * ```
 */
export function getPriorityLevelMeta(level: PriorityLevel) {
  return PRIORITY_LEVEL_META[level];
}

/**
 * 判断是否为高优先级（重点及以上）
 *
 * @param score - 优先级分数
 * @returns 是否为高优先级（≥ 50 分）
 *
 * @example
 * ```ts
 * isHighPriority(50); // true
 * isHighPriority(90); // true
 * isHighPriority(49); // false
 * isHighPriority(0);  // false
 * ```
 */
export function isHighPriority(score: number): boolean {
  return score >= 50;
}

/**
 * 判断是否为核心优先级
 *
 * @param score - 优先级分数
 * @returns 是否为核心优先级（≥ 75 分）
 *
 * @example
 * ```ts
 * isCorePriority(75); // true
 * isCorePriority(95); // true
 * isCorePriority(74); // false
 * isCorePriority(60); // false
 * ```
 */
export function isCorePriority(score: number): boolean {
  return score >= 75;
}
