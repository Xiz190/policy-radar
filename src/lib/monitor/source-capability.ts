/*
 * 来源采集能力字典（爬取经验的结构化沉淀）。
 *
 * 设计意图（属于"壳"的一部分，与领域无关）：
 *   - 每个源标注它"怎么爬得下来"以及"为什么难"，把一次性的踩坑经验固化成可消费的字段，
 *     而不是散落在注释或某人脑子里。换领域时，新领域的源同样需要标注采集方式，字段直接复用。
 *   - 与 source-meta.ts（搜索别名）一样，按 departmentName 解耦对齐；命中不到返回 null，
 *     UI 只在"确实评估过"的源上渲染徽章，不臆造。
 *
 * 该字段被消费的地方（避免沦为死注释）：
 *   1. 来源目录卡片的"采集状态徽章"（用户/评审可见的诚实呈现）；
 *   2. 可据此自动生成"数据源说明 · 已知局限"（哪些源是 SPA / 已失效 / 如何处理）。
 */

/** 采集适配方式：描述"这个源用什么方式才爬得下来"。 */
import {
  Camera, CircleCheck, OctagonAlert, RadioTower, Settings, type LucideIcon,
} from "lucide-react";

export type SourceAdapterType =
  | "static-html" // 静态/服务端渲染列表页，可直接解析 HTML
  | "spa-json-api" // 前端渲染（SPA），需逆向其公开 JSON 接口，而非解析首屏 HTML
  | "rss" // 提供 RSS/Atom 订阅源
  | "manual-snapshot" // 无稳定接口，靠人工/半自动快照录入
  | "blocked-dead"; // 反爬严格 / 已失效 / 长期不可达，主动排除

/** 采集接入状态。 */
export type SourceCrawlStatus =
  | "live" // 已跑通，真实数据在库
  | "planned"; // 已评估采集方式，尚未接入

export type SourceCapability = {
  adapter: SourceAdapterType;
  status: SourceCrawlStatus;
  /** 一句话说明"为什么这样爬 / 难点在哪"。 */
  note?: string;
};

/** 适配方式的展示元数据（徽章文案 / 图标 / 配色）。 */
export const ADAPTER_META: Record<
  SourceAdapterType,
  { label: string; icon: LucideIcon; className: string }
> = {
  "static-html": { label: "静态页可解析", icon: CircleCheck, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "spa-json-api": { label: "SPA · 逆向接口", icon: Settings, className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  rss: { label: "RSS 订阅", icon: RadioTower, className: "bg-sky-50 text-sky-700 border-sky-200" },
  "manual-snapshot": { label: "手动快照", icon: Camera, className: "bg-amber-50 text-amber-800 border-amber-200" },
  "blocked-dead": { label: "受限 / 已排除", icon: OctagonAlert, className: "bg-rose-50 text-rose-700 border-rose-200" },
};

/**
 * 已评估过的源 → 采集能力。按 departmentName 对齐。
 * 只登记"确实处理/评估过"的源；未登记的源不渲染徽章（不臆造）。
 */
export const SOURCE_CAPABILITY: Record<string, SourceCapability> = {
  // —— 已跑通、真实数据在库 ——
  "文化和旅游部": {
    adapter: "static-html",
    status: "live",
    note: "政府信息公开站，列表页服务端渲染，可直接解析；作为站点结构配置驱动抓取的已跑通样例。",
  },
  "工业和信息化部": {
    adapter: "static-html",
    status: "live",
    note: "政策文件栏目为静态列表，可直接解析。",
  },
  "国家发展和改革委员会": {
    adapter: "static-html",
    status: "live",
    note: "政策发布列表页服务端渲染，可稳定解析。",
  },
  "国家互联网信息办公室": {
    adapter: "static-html",
    status: "live",
    note: "政策法规为静态列表，可直接解析。",
  },

  // —— 已评估采集方式，属 SPA，需逆向公开接口 ——
  "上海数据交易所": {
    adapter: "spa-json-api",
    status: "planned",
    note: "官网是 SPA，首屏 HTML 无内容；数据产品与动态通过 XHR 拉 JSON。需逆向其公开 API 稳定采集，而非解析 HTML。",
  },
  "北京国际大数据交易所": {
    adapter: "spa-json-api",
    status: "planned",
    note: "SPA + 接口带鉴权/风控，数据要素动态采集难点，需逆向并处理反爬。",
  },
  "贵阳大数据交易所": {
    adapter: "spa-json-api",
    status: "planned",
    note: "SPA，数据产品列表走 JSON 接口，可逆向接入。",
  },
};

/** 查询某个源的采集能力；未评估过返回 null（UI 据此决定是否渲染徽章）。 */
export function getSourceCapability(departmentName: string): SourceCapability | null {
  return SOURCE_CAPABILITY[departmentName] ?? null;
}

// ============ 第二消费者：由能力字典自动生成"采集方法与已知局限" ============
// 让这份结构化经验不只是徽章，还能自动汇总成一份可展示的"数据源说明"。

export type CapabilityGroup = {
  adapter: SourceAdapterType;
  meta: (typeof ADAPTER_META)[SourceAdapterType];
  /** 对该采集方式的一句话方法论说明（换域也适用）。 */
  methodology: string;
  sources: Array<{ departmentName: string; status: SourceCrawlStatus; note?: string }>;
};

/** 每种采集方式的方法论说明（领域无关，属于"壳"的沉淀）。 */
const ADAPTER_METHODOLOGY: Record<SourceAdapterType, string> = {
  "static-html": "服务端渲染的列表页，直接解析 HTML 即可稳定采集，是最省成本的一档。",
  rss: "站点自带 RSS/Atom，订阅解析即可，无需模拟浏览器。",
  "spa-json-api": "前端渲染站点，首屏 HTML 无内容。正确做法是打开 Network 面板逆向其列表用的公开 JSON 接口，而非硬渲染整页——这是 SPA 站点能否爬通的关键判断。",
  "manual-snapshot": "无稳定接口或反爬过强，采用人工/半自动快照录入，牺牲实时性换取可得性。",
  "blocked-dead": "反爬严格、需登录或长期不可达，评估后主动排除，避免污染数据质量。",
};

/** 分组展示顺序：从最易到最难/排除。 */
const ADAPTER_ORDER: SourceAdapterType[] = [
  "static-html",
  "rss",
  "spa-json-api",
  "manual-snapshot",
  "blocked-dead",
];

/**
 * 把能力字典汇总成按采集方式分组的"数据源说明 · 已知局限"。
 * UI 直接渲染此结果，改字典即改文档，无需手写维护。
 */
export function buildCapabilityDigest(): {
  groups: CapabilityGroup[];
  totals: { total: number; live: number; planned: number };
} {
  const entries = Object.entries(SOURCE_CAPABILITY);
  const groups: CapabilityGroup[] = ADAPTER_ORDER.map((adapter) => ({
    adapter,
    meta: ADAPTER_META[adapter],
    methodology: ADAPTER_METHODOLOGY[adapter],
    sources: entries
      .filter(([, cap]) => cap.adapter === adapter)
      .map(([departmentName, cap]) => ({ departmentName, status: cap.status, note: cap.note })),
  })).filter((g) => g.sources.length > 0);

  const total = entries.length;
  const live = entries.filter(([, c]) => c.status === "live").length;
  return { groups, totals: { total, live, planned: total - live } };
}
