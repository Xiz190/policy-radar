// 关键词分类 → 显示标签与样式映射
// 此文件不带 "use client"，Server Component 与 Client Component 都可以直接 import
import { getImportanceBadgeMeta } from "./priority-levels";
import {
  Bot, ChartColumn, Circle, ClipboardList, Coins, Factory, Laptop, MapPin, Rocket, ScrollText, Target, Telescope, TriangleAlert, Zap, type LucideIcon,
} from "lucide-react";

export type CategoryStyle = {
  label: string;
  displayLabel: string;
  tooltip: string;
  description: string;
  value: string;
  icon: LucideIcon;
  chip: string; // 胶囊标签
  highlight: string; // 正文内高亮 mark
  bar: string; // 进度条 / 小条颜色
};

export type CategoryGroupType = "signal" | "topic" | "region" | "noise" | "unknown";

export const CATEGORY_GROUP_LABELS: Record<CategoryGroupType, string> = {
  signal: "政策信号",
  topic: "涉及领域",
  region: "区域相关",
  noise: "其他",
  unknown: "未分类",
};

// 关键词分类 → 显示标签与样式映射
// 分类体系与 db.ts 的 seedDefaultKeywordsIfEmpty / role-analysis.ts 的 ROLE_FOCUS_LIST 一致：
//   信号层（A/B/C/D + 落地）：signal_exec / signal_support / signal_risk / signal_explore / signal_launch
//   主题层（topic_*）：       topic_ai / topic_computing / topic_data / topic_industry / topic_gov / topic_regulation
//   区域 / 降噪：              region_general / negative

export const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  // —— A 类：强执行信号（最高优先级，紫色系）
  "A·强执行信号": {
    label: "A·强执行信号",
    displayLabel: "强执行要求",
    tooltip: "政策有明确的执行要求和时间节点，需要立即跟进落实",
    description: "这类政策通常包含强制性的执行要求、明确的时间表、量化目标或考核指标，对业务有直接约束力。",
    value: "意味着需要关注执行要求、准备相关材料、确保按时合规落地，避免错过时间节点。",
    icon: Target,
    chip: "bg-purple-50 text-purple-700 border border-purple-200",
    highlight: "bg-purple-100 text-purple-900 ring-1 ring-purple-200 rounded px-1 py-0.5",
    bar: "bg-purple-500",
  },
  // —— B 类：强支持信号（绿色系）
  "B·强支持信号": {
    label: "B·强支持信号",
    displayLabel: "资金与支持",
    tooltip: "政策包含资金补贴、税收优惠等实质性支持措施",
    description: "这类政策通常包含专项资金、补贴、税收减免、融资支持、政府采购等具体扶持措施。",
    value: "意味着有潜在的资金申请机会、政策红利可争取，或是业务拓展的利好信号。",
    icon: Coins,
    chip: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    highlight: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200 rounded px-1 py-0.5",
    bar: "bg-emerald-400",
  },
  // —— C 类：强约束 / 风险信号（红色系）
  "C·风险信号": {
    label: "C·风险信号",
    displayLabel: "监管风险",
    tooltip: "涉及监管要求或合规风险，需要重点关注和应对",
    description: "这类政策涉及监管新规、合规要求、安全审查、数据治理等约束性条款，可能带来业务合规风险。",
    value: "意味着需要评估合规影响、调整业务策略、提前做好风险防范和应对准备。",
    icon: TriangleAlert,
    chip: "bg-rose-50 text-rose-700 border border-rose-200",
    highlight: "bg-rose-100 text-rose-900 ring-1 ring-rose-200 rounded px-1 py-0.5",
    bar: "bg-rose-400",
  },
  // —— D 类：探索 / 观察信号（浅灰色系）
  "D·探索信号": {
    label: "D·探索信号",
    displayLabel: "趋势观察",
    tooltip: "代表政策发展方向和趋势，有前瞻参考价值",
    description: "这类政策多为征求意见稿、试点方案或方向性指引，代表政策未来的发展方向和探索重点。",
    value: "虽然当前不直接生效，但可以提前布局、了解趋势、为后续政策落地做准备。",
    icon: Telescope,
    chip: "bg-zinc-50 text-zinc-600 border border-zinc-200",
    highlight: "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200 rounded px-1 py-0.5",
    bar: "bg-zinc-400",
  },
  // —— 通用启动 / 落地信号（蓝色系）
  "通用启动/落地": {
    label: "通用启动/落地",
    displayLabel: "启动实施",
    tooltip: "政策已进入启动或落地实施阶段",
    description: "政策已经发布并开始实施，各项措施进入落地执行阶段。",
    value: "意味着政策正式生效，相关业务可以开始按照政策要求推进。",
    icon: Rocket,
    chip: "bg-sky-50 text-sky-700 border border-sky-200",
    highlight: "bg-sky-100 text-sky-900 ring-1 ring-sky-200 rounded px-1 py-0.5",
    bar: "bg-sky-400",
  },

  // —— 主题层
  "AI/智能体/大模型": {
    label: "AI/智能体/大模型",
    displayLabel: "人工智能",
    tooltip: "与 AI、大模型、智能体等技术领域直接相关",
    description: "涉及人工智能、大语言模型、智能体、生成式 AI 等前沿技术领域的政策内容。",
    value: "对于从事 AI 技术研发、应用落地的团队具有直接参考价值。",
    icon: Bot,
    chip: "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200",
    highlight: "bg-fuchsia-100 text-fuchsia-900 ring-1 ring-fuchsia-200 rounded px-1 py-0.5",
    bar: "bg-fuchsia-500",
  },
  "算力/算力网/算电协同": {
    label: "算力/算力网/算电协同",
    displayLabel: "算力基础设施",
    tooltip: "与算力网络、算力调度、算电协同等领域相关",
    description: "涉及算力基础设施建设、算力网络布局、算电协同发展等方面的政策内容。",
    value: "对于数据中心、云计算、算力服务相关业务具有直接指导意义。",
    icon: Zap,
    chip: "bg-teal-50 text-teal-700 border border-teal-200",
    highlight: "bg-teal-100 text-teal-900 ring-1 ring-teal-200 rounded px-1 py-0.5",
    bar: "bg-teal-500",
  },
  "数据要素/高质量数据集": {
    label: "数据要素/高质量数据集",
    displayLabel: "数据要素",
    tooltip: "与数据要素市场化、数据资源开发利用相关",
    description: "涉及数据要素市场建设、数据资源开发、数据共享开放、数据安全治理等方面的政策内容。",
    value: "对于数据业务、数据服务、数据安全相关团队具有重要参考价值。",
    icon: ChartColumn,
    chip: "bg-cyan-50 text-cyan-700 border border-cyan-200",
    highlight: "bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200 rounded px-1 py-0.5",
    bar: "bg-cyan-500",
  },
  "产业合作/京津冀协同": {
    label: "产业合作/京津冀协同",
    displayLabel: "产业与区域",
    tooltip: "与产业发展、区域协同、产业合作相关",
    description: "涉及产业发展规划、区域协同发展、产业合作园区、招商引资等方面的政策内容。",
    value: "对于产业合作、区域业务拓展、园区入驻等具有实际参考意义。",
    icon: Factory,
    chip: "bg-amber-50 text-amber-700 border border-amber-200",
    highlight: "bg-amber-100 text-amber-900 ring-1 ring-amber-200 rounded px-1 py-0.5",
    bar: "bg-amber-500",
  },
  "政务服务/平台经济/数字经济": {
    label: "政务服务/平台经济/数字经济",
    displayLabel: "数字经济",
    tooltip: "与数字经济、政务服务、平台经济相关",
    description: "涉及数字经济发展、政务数字化、平台经济规范、数字治理等方面的政策内容。",
    value: "对于数字业务、平台运营、政务合作等具有直接指导意义。",
    icon: Laptop,
    chip: "bg-blue-50 text-blue-700 border border-blue-200",
    highlight: "bg-blue-100 text-blue-900 ring-1 ring-blue-200 rounded px-1 py-0.5",
    bar: "bg-blue-500",
  },
  "法规/征求意见": {
    label: "法规/征求意见",
    displayLabel: "法规政策",
    tooltip: "涉及新法规制定或政策修订，提示规则变化",
    description: "涉及法律法规制定、修订、征求意见等方面的政策内容，预示着规则的变化。",
    value: "需要关注规则变化趋势，评估对业务的潜在影响，提前做好合规准备。",
    icon: ScrollText,
    chip: "bg-slate-100 text-slate-700 border border-slate-300",
    highlight: "bg-slate-200 text-slate-900 ring-1 ring-slate-300 rounded px-1 py-0.5",
    bar: "bg-slate-500",
  },

  // —— 区域通用（低权重，黄色系）
  "京津冀/北京/区域": {
    label: "京津冀/北京/区域",
    displayLabel: "区域政策",
    tooltip: "与京津冀或北京本地政策相关",
    description: "针对京津冀协同发展或北京本地的区域性政策内容。",
    value: "对于在北京或京津冀地区开展业务的团队具有重要参考价值。",
    icon: MapPin,
    chip: "bg-yellow-50 text-yellow-800 border border-yellow-200",
    highlight: "bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200 rounded px-1 py-0.5",
    bar: "bg-yellow-400",
  },
  // —— 噪音词汇（命中扣分）
  "噪音词汇": {
    label: "噪音词汇",
    displayLabel: "其他",
    tooltip: "通用词汇，不代表具体政策倾向",
    description: "这类词汇较为通用，不代表特定的政策信号或领域倾向。",
    value: "参考价值较低，主要用于排除非实质性内容。",
    icon: Circle,
    chip: "bg-zinc-50 text-zinc-600 border border-zinc-200",
    highlight: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 rounded px-1 py-0.5",
    bar: "bg-zinc-400",
  },
};

export function getCategoryStyle(category: string): CategoryStyle {
  // 支持旧英文 key 的向后兼容（如 database 中残留的旧数据，或旧关键词体系的分类名）
  // 从最老的简单 key（ai、industry 等）到新体系（topic_*、signal_*）都覆盖
  const legacyMap: Record<string, string> = {
    // —— 新分类体系（英文 key → 中文）——
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
    // —— 旧分类体系 1（征求意见稿阶段的分类）——
    signal_pre: "D·探索信号",
    signal_start: "A·强执行信号",
    signal_opportunity: "B·强支持信号",
    regulations: "法规/征求意见",
    innovation: "产业合作/京津冀协同",
    "byte-related": "AI/智能体/大模型",
    // —— 旧分类体系 2（最早期的简单英文 key）——
    ai: "AI/智能体/大模型",
    data: "数据要素/高质量数据集",
    platform: "政务服务/平台经济/数字经济",
    security: "C·风险信号",
    industry: "产业合作/京津冀协同",
    gov_service: "政务服务/平台经济/数字经济",
    region_bjj: "京津冀/北京/区域",
    byte_related: "AI/智能体/大模型",
    general: "其他",
    // —— 其他可能的变体——
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
  const normalized = legacyMap[category] ?? category;
  const base = CATEGORY_STYLE[normalized] ?? {
    label: normalized,
    displayLabel: normalized,
    tooltip: "",
    description: "",
    value: "",
    icon: ClipboardList,
    chip: "bg-slate-50 text-slate-700 border border-slate-200",
    highlight: "bg-slate-100 text-slate-900 ring-1 ring-slate-200 rounded px-1 py-0.5",
    bar: "bg-slate-400",
  };
  // 工作台秩序：分类=分类学(taxonomy)，统一收敛为近单色 chip，不用彩色制造噪点。
  // 颜色只留在有语义处（优先级徽章）与图表区分（.bar 不动）。
  return { ...base, chip: "bg-slate-100 text-slate-600" };
}

/**
 * @deprecated 请使用 categoryDisplayLabel() 获取用户可见的展示名，
 * 或直接使用 .label 获取内部标识名（仅用于逻辑判断）。
 */
export function categoryLabel(cat: string): string {
  return getCategoryStyle(cat).label;
}

export function categoryDisplayLabel(cat: string): string {
  return getCategoryStyle(cat).displayLabel;
}

export function categoryTooltip(cat: string): string {
  return getCategoryStyle(cat).tooltip;
}

export function getCategoryGroup(category: string): CategoryGroupType {
  const normalized = getCategoryStyle(category).label;
  if (SIGNAL_CATEGORIES.has(normalized)) return "signal";
  if (TOPIC_CATEGORIES.has(normalized)) return "topic";
  if (REGION_CATEGORIES.has(normalized)) return "region";
  if (NOISE_CATEGORIES.has(normalized)) return "noise";
  return "unknown";
}

export function categoryGroupLabel(category: string): string {
  const group = getCategoryGroup(category);
  return CATEGORY_GROUP_LABELS[group];
}

// —— 分类分层常量（信号层 / 主题层 / 其他）——
// 信号层分类：A/B/C/D 类信号 + 通用落地信号
export const SIGNAL_CATEGORIES = new Set([
  "A·强执行信号",
  "B·强支持信号",
  "C·风险信号",
  "D·探索信号",
  "通用启动/落地",
]);

// 主题层分类：具体的产业/领域分类
export const TOPIC_CATEGORIES = new Set([
  "AI/智能体/大模型",
  "算力/算力网/算电协同",
  "数据要素/高质量数据集",
  "产业合作/京津冀协同",
  "政务服务/平台经济/数字经济",
  "法规/征求意见",
]);

// 区域分类
export const REGION_CATEGORIES = new Set([
  "京津冀/北京/区域",
]);

// 噪音词汇（扣分用，不计入主题/信号展示）
export const NOISE_CATEGORIES = new Set([
  "噪音词汇",
]);

const LOG_PREFIX = "[ContentMeta]";

const DEBUG = false;

// 判断是否为信号层分类
export function isSignalCategory(category: string): boolean {
  return SIGNAL_CATEGORIES.has(category);
}

// 判断是否为主题层分类
export function isTopicCategory(category: string): boolean {
  return TOPIC_CATEGORIES.has(category);
}

// 从分类列表中过滤出主题层分类（用于同主题匹配、政策沿革标题等）
export function filterTopicCategories(
  categories: Array<{ category: string; score?: number }>,
): Array<{ category: string; score?: number }> {
  return categories.filter((c) => isTopicCategory(c.category));
}

// 从分类列表中取第一个主题层分类（用于政策沿革标题等场景）
export function getFirstTopicCategory(
  categories: Array<{ category: string; score?: number }>,
): string | null {
  const found = categories.find((c) => isTopicCategory(c.category));
  return found ? found.category : null;
}

// category → {label, hexColor}，供 dashboard / 词云等需要 16 进制颜色的场景使用
// 颜色与上方 CATEGORY_STYLE 的主色保持一致
const CATEGORY_COLOR_HEX: Record<string, string> = {
  "A·强执行信号": "#8b5cf6",
  "B·强支持信号": "#10b981",
  "C·风险信号": "#ef4444",
  "D·探索信号": "#71717a",
  "通用启动/落地": "#0ea5e9",
  "AI/智能体/大模型": "#d946ef",
  "算力/算力网/算电协同": "#14b8a6",
  "数据要素/高质量数据集": "#06b6d4",
  "产业合作/京津冀协同": "#f59e0b",
  "政务服务/平台经济/数字经济": "#3b82f6",
  "法规/征求意见": "#64748b",
  "京津冀/北京/区域": "#eab308",
  "噪音词汇": "#94a3b8",
};

export function categoryMeta(cat: string): { label: string; color: string } {
  const base = getCategoryStyle(cat);
  return { label: base.displayLabel, color: CATEGORY_COLOR_HEX[base.label] ?? "#64748b" };
}

// 重要性等级 → 标签与样式（统一从 priority-levels 获取元数据）
// 显示门槛：只有「重点内容」及以上且 keyword_score ≥ 40 才返回徽章，防止虚标。
export function getImportanceBadge(
  level: string | null | undefined,
  keywordScore?: number | string | null,
): { label: string; cls: string } | null {
  const meta = getImportanceBadgeMeta(level, keywordScore);
  if (!meta) return null;
  return { label: meta.label, cls: meta.className };
}

// 正文摘要：纯文本处理工具，不依赖 React
export function pickSmartSummary(
  paragraphs: string[],
  matches: Array<{ keyword: string; category: string }>,
): string[] {
  if (!paragraphs || paragraphs.length === 0) return [];
  const keywords = Array.from(new Set(matches.map((m) => m.keyword).filter(Boolean)));
  const signalWords = [
    "印发",
    "发布",
    "出台",
    "实施",
    "执行",
    "监管",
    "管理",
    "办法",
    "规定",
    "意见",
    "方案",
    "支持",
    "促进",
    "推动",
    "启动",
    "组织开展",
    "专项资金",
    "补贴",
    "鼓励",
    "试点",
    "通知",
    "公告",
    "决定",
    "部署",
    "加强",
    "规范",
    "防范",
    "风险",
  ];
  const tokens = Array.from(new Set([...keywords, ...signalWords]));

  const scored: Array<{ sentence: string; score: number }> = [];
  for (const p of paragraphs) {
    const sentences = p
      .split(/[。！？!?\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 12 && s.length <= 200);
    for (const s of sentences) {
      let score = 0;
      for (const t of tokens) if (s.includes(t)) score += 1;
      if (s.length < 20) score -= 1;
      if (s.length > 150) score -= 0.5;
      if (score > 0) scored.push({ sentence: s, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  if (top.length === 0) {
    return paragraphs.slice(0, 2).map((p) => {
      const idx = p.indexOf("。");
      return idx > 10 ? p.slice(0, idx + 1) : p;
    });
  }
  return top.map((t) => t.sentence);
}

// 从正文中提取包含关键词的句子（用于关键词命中详情的上下文展示）
export function extractKeywordContext(
  keyword: string,
  paragraphs: string[],
  maxSnippets: number = 2,
  snippetMaxLen: number = 60,
): string[] {
  if (!keyword || !paragraphs || paragraphs.length === 0) return [];
  const results: string[] = [];

  for (const para of paragraphs) {
    if (results.length >= maxSnippets) break;
    if (!para || para.length < keyword.length) continue;

    const idx = para.indexOf(keyword);
    if (idx === -1) continue;

    let sentence = para;
    const periodMatch = para.slice(idx).search(/[。！？；]/);
    if (periodMatch !== -1) {
      sentence = para.slice(0, idx + periodMatch + 1);
    }
    const beforePeriod = para.lastIndexOf("。", idx - 1);
    if (beforePeriod !== -1) {
      sentence = sentence.slice(beforePeriod + 1);
    }

    if (sentence.length > snippetMaxLen) {
      const leftPad = Math.floor((snippetMaxLen - keyword.length) / 2);
      const start = Math.max(0, idx - leftPad);
      const end = Math.min(sentence.length, start + snippetMaxLen);
      sentence = sentence.slice(start, end);
    }

    results.push(sentence.trim());
  }

  return results;
}

function getKeywordImportance(keyword: string, category: string): string {
  const style = getCategoryStyle(category);
  if (style.tooltip) return style.tooltip;
  return `命中「${keyword}」关键词，属于 ${style.displayLabel} 分类`;
}

// 从真实 item 数据构建关键词命中详情
export function buildKeywordBreakdown(
  categories: Array<{ category: string; score: number; topKeywords?: string[] }>,
  matchedKeywords: Array<{ keyword: string; category: string; weight: number }>,
  paragraphs: string[],
) {
  const categoryBreakdown = (categories || []).map((cat) => {
    const catKeywords = (matchedKeywords || [])
      .filter((kw) => kw.category === cat.category)
      .map((kw) => ({
        keyword: kw.keyword,
        category: kw.category,
        weight: kw.weight,
        importance: getKeywordImportance(kw.keyword, kw.category),
        context: extractKeywordContext(kw.keyword, paragraphs),
      }));

    const hasKeywords = catKeywords.length > 0;
    const fallbackKeywords = (cat.topKeywords || []).slice(0, 3).map((kw) => ({
      keyword: kw,
      category: cat.category,
      weight: Math.max(1, Math.round(cat.score / 3)),
      importance: getKeywordImportance(kw, cat.category),
      context: extractKeywordContext(kw, paragraphs),
    }));

    return {
      category: cat.category,
      score: cat.score,
      keywords: hasKeywords ? catKeywords : fallbackKeywords,
    };
  });

  const totalScore = categoryBreakdown.reduce((sum, c) => sum + c.score, 0);

  return {
    totalScore,
    categoryBreakdown,
  };
}
