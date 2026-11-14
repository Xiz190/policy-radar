import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  buildFeedParams,
  groupByDay,
  primaryCategory,
  type FeedFilters,
} from "@/lib/companion/feed";
import { SIGNAL_CATEGORIES } from "@/lib/monitor/content-meta";
import type { ContentItem } from "@/hooks/use-item-list";

function makeItem(over: Partial<ContentItem> = {}): ContentItem {
  return {
    sourceId: "s1",
    departmentName: "北京市人民政府",
    channelName: "政策文件",
    displayName: "北京市人民政府",
    url: "https://example.com/a",
    title: "关于促进人工智能产业发展的若干措施",
    listPublishedAt: "2026-09-18",
    firstSeenAt: "2026-09-18T00:00:00.000Z",
    isRead: false,
    isStarred: false,
    keywordScore: 0,
    importanceLevel: "普通内容",
    categories: [],
    genres: [],
    ...over,
  };
}

const params = (o: Parameters<typeof buildFeedParams>[0]) => buildFeedParams(o);
const base = { filters: DEFAULT_FILTERS, limit: 30, offset: 0 };

describe("Feed · 请求参数拼装", () => {
  it("全部段不带订阅条件", () => {
    const p = params({ ...base, view: "all" });
    expect(p.get("subscribedDepartments")).toBeNull();
    expect(p.get("subscribedKeywords")).toBeNull();
    expect(p.get("categories")).toBeNull();
  });

  it("关注段下发订阅；订阅为空时不下发", () => {
    const p = params({
      ...base,
      view: "following",
      subscriptions: { departments: ["北京市人民政府"], keywords: ["算力"] },
    });
    expect(p.get("subscribedDepartments")).toBe("北京市人民政府");
    expect(p.get("subscribedKeywords")).toBe("算力");

    const empty = params({ ...base, view: "following", subscriptions: { departments: [], keywords: [] } });
    expect(empty.get("subscribedDepartments")).toBeNull();
    expect(empty.get("subscribedKeywords")).toBeNull();
  });

  it("信号段按信号层五个分类过滤，且默认按 relevance 排", () => {
    const p = params({ ...base, view: "signals" });
    expect(p.get("categories")).toBe([...SIGNAL_CATEGORIES].join(","));
    expect(p.get("sort")).toBe("relevance");
  });

  it("用户显式选了分类档位时，覆盖信号段的整层过滤", () => {
    const filters: FeedFilters = { ...DEFAULT_FILTERS, category: "risk" };
    const p = params({ ...base, view: "signals", filters });
    expect(p.get("categories")).toBe("C·风险信号");
    expect(p.get("categories")).not.toContain("A·强执行信号");
  });

  it("用户显式改过排序时以用户为准（信号段不再强制 relevance）", () => {
    const filters: FeedFilters = { ...DEFAULT_FILTERS, sort: "latest" };
    // latest 是默认值，仍走信号段的 relevance
    expect(params({ ...base, view: "signals", filters }).get("sort")).toBe("relevance");
    // 显式选了别的档位就听用户的
    expect(
      params({ ...base, view: "signals", filters: { ...filters, sort: "first_seen" } }).get("sort"),
    ).toBe("first_seen_at");
  });

  it("排序三档映射到后端参数", () => {
    expect(params({ ...base, view: "all", filters: { ...DEFAULT_FILTERS, sort: "latest" } }).get("sort")).toBe("published_at");
    expect(params({ ...base, view: "all", filters: { ...DEFAULT_FILTERS, sort: "relevance" } }).get("sort")).toBe("relevance");
    expect(params({ ...base, view: "all", filters: { ...DEFAULT_FILTERS, sort: "first_seen" } }).get("sort")).toBe("first_seen_at");
  });

  it("未读 / 收藏 开关", () => {
    const p = params({
      ...base,
      view: "all",
      filters: { ...DEFAULT_FILTERS, unreadOnly: true, starredOnly: true },
    });
    expect(p.get("onlyUnread")).toBe("1");
    expect(p.get("onlyStarred")).toBe("1");
  });

  it("日期范围带了才下发 dateField（避免无谓地改变后端默认）", () => {
    expect(params({ ...base, view: "all" }).get("dateField")).toBeNull();
    const p = params({
      ...base,
      view: "all",
      filters: { ...DEFAULT_FILTERS, fromDate: "2026-09-01", toDate: "2026-09-18" },
    });
    expect(p.get("fromDate")).toBe("2026-09-01");
    expect(p.get("toDate")).toBe("2026-09-18");
    expect(p.get("dateField")).toBe("list_published_at");
  });

  it("分页参数照传", () => {
    const p = params({ view: "all", filters: DEFAULT_FILTERS, limit: 30, offset: 60 });
    expect(p.get("limit")).toBe("30");
    expect(p.get("offset")).toBe("60");
  });

  it("搜索词带了才下发，纯空白不下发", () => {
    expect(params({ ...base, view: "all", q: "  算力  " }).get("q")).toBe("算力");
    expect(params({ ...base, view: "all", q: "   " }).get("q")).toBeNull();
    expect(params({ ...base, view: "all" }).get("q")).toBeNull();
  });
});

describe("Feed · 筛选角标计数", () => {
  it("默认筛选为 0", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it("每开一项加一，日期范围整体算一项", () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, unreadOnly: true })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, starredOnly: true, category: "exec" })).toBe(2);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, fromDate: "2026-09-01", toDate: "2026-09-18" })).toBe(1);
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        unreadOnly: true,
        starredOnly: true,
        category: "risk",
        fromDate: "2026-09-01",
        sort: "relevance",
      }),
    ).toBe(5);
  });
});

describe("Feed · 行首分类", () => {
  it("优先取信号层分类，跳过主题层", () => {
    const item = makeItem({
      categories: [
        { category: "AI/智能体/大模型", score: 2 },
        { category: "D·探索信号", score: 1 },
      ],
    });
    expect(primaryCategory(item)).toBe("D·探索信号");
  });

  it("旧英文 key 也能归一后命中信号层", () => {
    // signal_exec 经 getCategoryStyle 的 legacyMap 归一为 A·强执行信号
    expect(primaryCategory(makeItem({ categories: [{ category: "signal_exec", score: 3 }] }))).toBe("A·强执行信号");
  });

  it("没有信号层分类时退回第一个分类；完全没分类时返回空串", () => {
    expect(primaryCategory(makeItem({ categories: [{ category: "AI/智能体/大模型", score: 2 }] }))).toBe(
      "AI/智能体/大模型",
    );
    expect(primaryCategory(makeItem({ categories: [] }))).toBe("");
  });
});

describe("Feed · 按天分组", () => {
  const now = new Date(2026, 8, 18, 15, 0, 0); // 2026-09-18 本地

  it("同一天的归到一组，保持传入顺序", () => {
    const items = [
      makeItem({ url: "a", listPublishedAt: "2026-09-18" }),
      makeItem({ url: "b", listPublishedAt: "2026-09-18" }),
      makeItem({ url: "c", listPublishedAt: "2026-09-17" }),
    ];
    const groups = groupByDay(items, now);
    expect(groups.map((g) => g.key)).toEqual(["2026-09-18", "2026-09-17"]);
    expect(groups[0].items.map((i) => i.url)).toEqual(["a", "b"]);
    expect(groups[1].items.map((i) => i.url)).toEqual(["c"]);
  });

  it("今天/昨天用 今天 / 昨天，更早用星期名", () => {
    const groups = groupByDay(
      [
        makeItem({ url: "a", listPublishedAt: "2026-09-18" }),
        makeItem({ url: "b", listPublishedAt: "2026-09-17" }),
        makeItem({ url: "c", listPublishedAt: "2026-09-15" }),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["今天", "昨天", "星期二"]);
  });

  it("每组都带可显示的短日期", () => {
    const groups = groupByDay([makeItem({ listPublishedAt: "2026-09-15" })], now);
    expect(groups[0].date).toBe("9月15日");
  });

  it("空输入返回空数组", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});
