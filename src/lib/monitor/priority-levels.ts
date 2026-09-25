// 优先级分层体系（importance_level 的统一映射）
// 用于替代原先单一的 "重点内容" 标签，区分不同分值段的优先级。
//
// 本文件不依赖数据库 / 服务端 API，可同时在 Server/Client/React Server Component 中使用。

export type PriorityLevel =
  | "普通内容"
  | "中等重点"
  | "重点内容"
  | "核心关注";

export const PRIORITY_LEVELS: PriorityLevel[] = [
  "核心关注",
  "重点内容",
  "中等重点",
  "普通内容",
];

// —— 显示门槛 ——
// 只有 ≥ 重点内容 才在 UI 上展示「重点关注」一类的徽章 / 标签；
// 中等重点 / 普通内容不再打标，避免低得分条目被"重点"提示。
// 此外：即便是"核心关注" / "重点内容"，如果 keyword_score 过低（< 40），
// 也不显示徽章 —— 防止旧逻辑把 15/27/33 分的条目仍然打上"核心关注"徽章。
const HIGHLIGHTED_LEVELS: PriorityLevel[] = ["重点内容", "核心关注"];

// 显示徽章的最低得分（keyword_score，不含信号加成的原始值）
const MIN_SCORE_FOR_BADGE = 40;

export function isPriorityHighlighted(level: PriorityLevel): boolean {
  return HIGHLIGHTED_LEVELS.includes(level);
}

/**
 * 统一的"是否显示徽章"判定：null / 空字符串 / 未知等级都视为「不显示」；
 * keywordScore 可选：传入后会多一道"分数够高才显示"的检查（< 40 不显示）。
 */
export function shouldShowImportanceBadge(
  raw: string | null | undefined,
  keywordScore?: number | string | null,
): boolean {
  const lvl = normalizePriorityLevel(raw);
  if (!isPriorityHighlighted(lvl)) return false;
  const score = keywordScore == null ? null : Number(keywordScore);
  if (score != null && !Number.isNaN(score) && score < MIN_SCORE_FOR_BADGE) return false;
  return true;
}

export type PriorityLevelMeta = {
  level: PriorityLevel;
  /** 列表页/详情页标签显示文案 */
  label: string;
  /** 较短形式（用于紧凑布局） */
  shortLabel: string;
  /** Tailwind className（浅色背景 + 深色文字，可直接用于 badge） */
  className: string;
  /** 16 进制颜色（用于图表 / 小圆点） */
  color: string;
  /** 排序权重（越大越靠前） */
  rank: number;
  /** 最低得分值（闭区间） */
  minScore: number;
  /** 命中条件简述（用于 tooltip） */
  description: string;
};

export const PRIORITY_LEVEL_META: Record<PriorityLevel, PriorityLevelMeta> = {
  "普通内容": {
    level: "普通内容",
    label: "普通",
    shortLabel: "普通",
    className: "bg-slate-100 text-slate-500",
    color: "#94a3b8",
    rank: 0,
    minScore: 0,
    description: "未命中明显主题/结构/风险信号，作为普通监测内容。",
  },
  "中等重点": {
    level: "中等重点",
    label: "中等重点",
    shortLabel: "中等",
    // 工作台优先级阶梯：普通/中等=中性收敛；颜色只留给"重点/核心"两档，且统一走领域色 --brand
    className: "bg-slate-100 text-slate-600",
    color: "#64748b",
    rank: 1,
    minScore: 20,
    description: "命中部分关键词或政策标题结构，值得关注但非核心。",
  },
  "重点内容": {
    level: "重点内容",
    label: "重点内容",
    shortLabel: "重点",
    className: "bg-[var(--brand-tint)] text-[var(--brand)] font-medium",
    color: "#1f5e7e",
    rank: 2,
    minScore: 50,
    description: "较高的关键词/结构得分，或命中多类主题 + 风险信号，优先阅读。",
  },
  "核心关注": {
    level: "核心关注",
    label: "核心关注",
    shortLabel: "核心",
    className: "bg-[var(--brand)] text-white font-semibold",
    color: "#1f5e7e",
    rank: 3,
    minScore: 90,
    description: "高得分 + 风险/强执行/强主题信号叠加，属于最高优先级内容。",
  },
};

export const ALL_PRIORITY_LEVELS: PriorityLevelMeta[] =
  PRIORITY_LEVELS.map((l) => PRIORITY_LEVEL_META[l]);

/** 根据原始关键词得分与信号加成，计算分层标签。 */
export function scoreToPriorityLevel(score: number, signals?: {
  hasStrongTopic?: boolean;
  hasRiskSignal?: boolean;
  hasStructureTitle?: boolean;
  hasMeaningfulBody?: boolean;
}): PriorityLevel {
  // 1) 先计算「有效得分」——命中信号的内容，可以用额外加成，避免纯标题党被误判。
  let effectiveScore = Math.max(0, Math.round(Number(score) || 0));

  if (signals?.hasStructureTitle) effectiveScore += 8;
  if (signals?.hasStrongTopic) effectiveScore += 5;
  if (signals?.hasRiskSignal) effectiveScore += 10;

  // 2) 没有正文（只靠标题）时最多给到「中等重点」，避免虚高。
  const cappedByBody = signals?.hasMeaningfulBody === false;

  if (effectiveScore >= 90) return cappedByBody ? "重点内容" : "核心关注";
  if (effectiveScore >= 50) return cappedByBody ? "中等重点" : "重点内容";
  if (effectiveScore >= 20) return "中等重点";
  return "普通内容";
}

/** 判断该分层是否应被视为「重点」（用于 is_starred / 列表筛选兼容旧逻辑）。 */
// NOTE: 与 UI 展示是两个维度 —— UI 从「重点内容」起才显示徽章，但内部标记/统计仍包含中等重点。
export function isPriorityHighlightedInternal(level: PriorityLevel): boolean {
  return level !== "普通内容";
}

/**
 * 统一的"获取可显示徽章"helper —— 中等重点及以下返回 null；
 * keyword_score 过低（< 40）的"核心关注/重点内容"同样返回 null，防止虚标。
 */
export function getImportanceBadgeMeta(
  raw: string | null | undefined,
  keywordScore?: number | string | null,
): PriorityLevelMeta | null {
  if (!shouldShowImportanceBadge(raw, keywordScore)) return null;
  return PRIORITY_LEVEL_META[normalizePriorityLevel(raw)];
}

/** 兼容旧的 "加急推荐 / 重点内容 / 普通内容" 字符串，统一归并到新层级。 */
export function normalizePriorityLevel(raw: string | null | undefined): PriorityLevel {
  const s = (raw || "").trim();
  if (s === "加急推荐" || s === "核心关注") return "核心关注";
  if (s === "重点内容") return "重点内容";
  if (s === "中等重点") return "中等重点";
  return "普通内容";
}

/** 用于 UI badge / 标签渲染的 helper。 */
export function getPriorityMeta(raw: string | null | undefined): PriorityLevelMeta {
  const lvl = normalizePriorityLevel(raw);
  return PRIORITY_LEVEL_META[lvl];
}

/** 用于 SQL 排序的权重映射（越大越靠前）。 */
export const PRIORITY_LEVEL_RANK_SQL =
  `case when mi.importance_level in ('核心关注', '加急推荐') then 3
         when mi.importance_level = '重点内容' then 2
         when mi.importance_level = '中等重点' then 1
         else 0 end`;
