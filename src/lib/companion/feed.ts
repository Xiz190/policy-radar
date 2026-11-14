/**
 * 伴侣版 Feed 屏的数据逻辑。纯函数，便于单测
 * （项目 vitest 无 jsdom，渲染不了组件——同 nav.ts / today.ts / format.ts）。
 */

import { SIGNAL_CATEGORIES, getCategoryStyle } from "@/lib/monitor/content-meta";
import { localDayKey, shortDate, weekdayOf } from "@/lib/companion/format";
import type { ContentItem } from "@/hooks/use-item-list";

/** Feed 顶部的三段。 */
export type FeedView = "all" | "following" | "signals";

/**
 * 筛选 sheet 里的分类档位，对应政策信号层的四类。
 * 政策雷达的信号类型就是领域本身（强执行 / 强支持 / 风险 / 试点探索），
 * 不要照搬创作者雷达的工具 / 机会 / 截止。
 */
export type FeedCategory = "all" | "exec" | "support" | "risk" | "explore";

export interface FeedFilters {
  unreadOnly: boolean;
  starredOnly: boolean;
  category: FeedCategory;
  fromDate?: string;
  toDate?: string;
  sort: "latest" | "relevance" | "first_seen";
}

export const DEFAULT_FILTERS: FeedFilters = {
  unreadOnly: false,
  starredOnly: false,
  category: "all",
  sort: "latest",
};

/**
 * 分类档位 → content-meta 里的信号层分类名。
 * 值必须是 SIGNAL_CATEGORIES 里的原样字符串，否则后端筛选命中不了。
 */
const CATEGORY_MAP: Record<Exclude<FeedCategory, "all">, string> = {
  exec: "A·强执行信号",
  support: "B·强支持信号",
  risk: "C·风险信号",
  explore: "D·探索信号",
};

/** mockup 的 Sort 三档 → 后端 sort 参数。 */
const SORT_MAP: Record<FeedFilters["sort"], string> = {
  latest: "published_at",
  relevance: "relevance",
  first_seen: "first_seen_at",
};

/** 筛选里"已生效"的项数，用于 Filters 按钮上的角标。 */
export function activeFilterCount(f: FeedFilters): number {
  let n = 0;
  if (f.unreadOnly) n++;
  if (f.starredOnly) n++;
  if (f.category !== "all") n++;
  if (f.fromDate || f.toDate) n++;
  if (f.sort !== "latest") n++;
  return n;
}

/**
 * 拼 Feed 的请求参数。
 *
 * 关于「关注」：后端只在明确下发 subscribedDepartments/subscribedKeywords 时才按订阅做
 * 硬过滤。这是刻意设计的——桌面端踩过坑：无条件下发会让选中某来源时被"仅匹配标题"的
 * 订阅词二次过滤成 0 条（见 inbox/page.tsx buildParams 里那段注释）。
 * 所以这里也只在 view === "following" 时才下发。
 */
export function buildFeedParams(opts: {
  view: FeedView;
  filters: FeedFilters;
  subscriptions?: { departments: string[]; keywords: string[] };
  /** 搜索词。后端按标题/来源/正文段落匹配。 */
  q?: string;
  limit: number;
  offset: number;
}): URLSearchParams {
  const { view, filters, subscriptions, q, limit, offset } = opts;
  const p = new URLSearchParams();
  p.set("view", "list");
  p.set("limit", String(limit));
  p.set("offset", String(offset));

  const query = (q ?? "").trim();
  if (query) p.set("q", query);

  if (view === "following") {
    const depts = subscriptions?.departments ?? [];
    const kws = subscriptions?.keywords ?? [];
    if (depts.length > 0) p.set("subscribedDepartments", depts.join(","));
    if (kws.length > 0) p.set("subscribedKeywords", kws.join(","));
  }

  // 分类：用户显式选了档位就按档位，否则 Signals 段整体按信号层过滤。
  if (filters.category !== "all") {
    p.set("categories", CATEGORY_MAP[filters.category]);
  } else if (view === "signals") {
    p.set("categories", [...SIGNAL_CATEGORIES].join(","));
  }

  if (filters.unreadOnly) p.set("onlyUnread", "1");
  if (filters.starredOnly) p.set("onlyStarred", "1");
  if (filters.fromDate) {
    p.set("fromDate", filters.fromDate);
    p.set("dateField", "list_published_at");
  }
  if (filters.toDate) {
    p.set("toDate", filters.toDate);
    p.set("dateField", "list_published_at");
  }

  // Signals 段的默认排序是 relevance（与桌面 signals 页一致）；用户显式改过就听用户的。
  p.set("sort", view === "signals" && filters.sort === "latest" ? "relevance" : SORT_MAP[filters.sort]);

  return p;
}

/**
 * 行首显示的那个分类：取**信号层**里第一个。
 *
 * 政策雷达的信号层就是强执行 / 强支持 / 风险 / 试点探索（外加"通用启动/落地"）。
 * 分类字段可能存的是旧英文 key（如 signal_exec），所以先经 getCategoryStyle 归一。
 */
/**
 * 只依赖 categories 这一个字段——列表项（ContentItem）与详情（MonitorItemDetail）
 * 都能喂进来，不必为了复用而伪造一个完整对象。
 */
type HasCategories = { categories?: Array<{ category: string; score?: number }> };

export function primaryCategory(item: HasCategories): string {
  for (const c of item.categories ?? []) {
    const label = getCategoryStyle(c.category).label;
    if (SIGNAL_CATEGORIES.has(label)) return label;
  }
  const first = item.categories?.[0];
  return first ? getCategoryStyle(first.category).label : "";
}

export interface DayGroup {
  /** "2026-09-17" */
  key: string;
  /** "今天" / "昨天" / "星期四" */
  label: string;
  /** "9月17日" */
  date: string;
  items: ContentItem[];
}

/**
 * 按发布日分组，保持传入顺序（服务端已按选定 sort 排好，这里不重排）。
 * 同一天的多条归到一组。
 */
export function groupByDay(items: ContentItem[], now: Date): DayGroup[] {
  const todayKey = localDayKey(now);
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = localDayKey(y);

  const groups: DayGroup[] = [];
  const index = new Map<string, DayGroup>();

  for (const item of items) {
    const key = (item.listPublishedAt ?? "").slice(0, 10);
    let g = index.get(key);
    if (!g) {
      g = {
        key,
        label: key === todayKey ? "今天" : key === yesterdayKey ? "昨天" : weekdayOf(key),
        date: shortDate(key),
        items: [],
      };
      index.set(key, g);
      groups.push(g);
    }
    g.items.push(item);
  }

  return groups;
}
