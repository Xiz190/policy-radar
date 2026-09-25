import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  GENRE_LIST,
  extractDateKey,
  getShanghaiDateKeys,
  formatDateLabel,
  makeEmptyUrlState,
  readInitialUrlState,
  parseUrlStateFromLocation,
} from "@/lib/inbox-page-utils";

describe("inbox-page-utils - GENRE_LIST 常量", () => {
  it("包含 12 个公文类型", () => {
    expect(GENRE_LIST.length).toBe(12);
  });

  it("每个类型非空且不重复", () => {
    const unique = new Set(GENRE_LIST);
    expect(unique.size).toBe(GENRE_LIST.length);
    for (const g of GENRE_LIST) {
      expect(g.length).toBeGreaterThan(0);
    }
  });
});

describe("inbox-page-utils - extractDateKey", () => {
  it("空值/undefined 返回 'unknown'", () => {
    expect(extractDateKey(undefined)).toBe("unknown");
    expect(extractDateKey("")).toBe("unknown");
  });

  it("ISO 格式字符串直接提取前 10 位", () => {
    expect(extractDateKey("2025-06-15T10:30:00Z")).toBe("2025-06-15");
    expect(extractDateKey("2025-01-01")).toBe("2025-01-01");
  });

  it("非标准但可解析的日期字符串返回 YYYY-MM-DD", () => {
    const result = extractDateKey("June 15, 2025");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("完全无效的字符串返回 'unknown'", () => {
    expect(extractDateKey("not-a-date-at-all")).toBe("unknown");
  });

  it("前后空格会被 trim", () => {
    expect(extractDateKey("  2025-06-15  ")).toBe("2025-06-15");
  });
});

describe("inbox-page-utils - getShanghaiDateKeys", () => {
  it("返回 todayKey 和 yesterdayKey，格式均为 YYYY-MM-DD", () => {
    const { todayKey, yesterdayKey } = getShanghaiDateKeys();
    expect(todayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(yesterdayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("使用上海时区（UTC 凌晨时，北京时间已进入新的一天）", () => {
    // 用固定时间 mock Date 来验证
    const FixedDate = class extends Date {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super("2025-06-15T00:30:00Z"); // UTC 00:30 = 北京时间 08:30
        } else {
          super(...(args as ConstructorParameters<typeof Date>));
        }
      }
    };
    const OriginalDate = global.Date;
    global.Date = FixedDate as typeof Date;

    try {
      const { todayKey } = getShanghaiDateKeys();
      // UTC 6/15 00:30，上海时间已经是 6/15 08:30
      expect(todayKey).toBe("2025-06-15");
    } finally {
      global.Date = OriginalDate;
    }
  });
});

describe("inbox-page-utils - formatDateLabel", () => {
  it("unknown 日期返回 '未知日期'", () => {
    const result = formatDateLabel("unknown");
    expect(result.label).toBe("未知日期");
    expect(result.isTodayOrYesterday).toBe(false);
  });

  it("无效格式的 dateKey 原样返回 label", () => {
    const result = formatDateLabel("bad-format");
    expect(result.label).toBe("bad-format");
    expect(result.isTodayOrYesterday).toBe(false);
  });

  it("今天的日期 label 前缀 '今天'，isTodayOrYesterday=true", () => {
    const { todayKey } = getShanghaiDateKeys();
    const result = formatDateLabel(todayKey);
    expect(result.label).toContain("今天");
    expect(result.isTodayOrYesterday).toBe(true);
  });

  it("昨天的日期 label 前缀 '昨天'，isTodayOrYesterday=true", () => {
    const { yesterdayKey } = getShanghaiDateKeys();
    const result = formatDateLabel(yesterdayKey);
    expect(result.label).toContain("昨天");
    expect(result.isTodayOrYesterday).toBe(true);
  });

  it("其他日期包含月日和周几，isTodayOrYesterday=false", () => {
    const result = formatDateLabel("2025-01-01");
    expect(result.isTodayOrYesterday).toBe(false);
    expect(result.label).toMatch(/\d+月\d+日/);
    expect(["周日", "周一", "周二", "周三", "周四", "周五", "周六"].some(
      (w) => result.label.includes(w),
    )).toBe(true);
  });
});

describe("inbox-page-utils - makeEmptyUrlState", () => {
  it("返回的所有字段均有正确的默认值", () => {
    const state = makeEmptyUrlState();
    expect(state.q).toBe("");
    expect(state.onlyUnread).toBe(false);
    expect(state.onlyStarred).toBe(false);
    expect(state.onlyUrgent).toBe(false);
    expect(state.selectedDepts.size).toBe(0);
    expect(state.selectedChannels.size).toBe(0);
    expect(state.expandedDepts.size).toBe(0);
    expect(state.importanceLevels.size).toBe(0);
    expect(state.selectedCategories.size).toBe(0);
    expect(state.selectedGenres.size).toBe(0);
    expect(state.fromDate).toBe("");
    expect(state.toDate).toBe("");
    expect(state.dateField).toBe("list_published_at");
    expect(state.sort).toBe("first_seen_at");
  });

  it("每次调用返回新的 Set 实例（不共享引用）", () => {
    const a = makeEmptyUrlState();
    const b = makeEmptyUrlState();
    expect(a.selectedDepts).not.toBe(b.selectedDepts);
    expect(a.selectedChannels).not.toBe(b.selectedChannels);
    // 验证互不影响
    a.selectedDepts.add("test");
    expect(b.selectedDepts.size).toBe(0);
  });
});

describe("inbox-page-utils - readInitialUrlState", () => {
  it("返回空状态（SSR 安全）", () => {
    const state = readInitialUrlState();
    expect(state.q).toBe("");
    expect(state.selectedDepts.size).toBe(0);
  });
});

describe("inbox-page-utils - parseUrlStateFromLocation", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  function setupUrl(search: string) {
    globalThis.window = {
      location: {
        search,
        pathname: "/inbox",
        hash: "",
      },
      history: { replaceState: vi.fn(), pushState: vi.fn() },
    } as unknown as typeof globalThis.window;
  }

  it("无 window 时返回 null（SSR 安全）", () => {
    globalThis.window = undefined as unknown as typeof globalThis.window;
    const result = parseUrlStateFromLocation();
    expect(result).toBeNull();
  });

  it("空 URL 返回默认值", () => {
    setupUrl("");
    const result = parseUrlStateFromLocation();
    expect(result).not.toBeNull();
    expect(result!.q).toBe("");
    expect(result!.onlyUnread).toBe(false);
    expect(result!.onlyStarred).toBe(false);
    expect(result!.selectedDepts.size).toBe(0);
  });

  it("解析 q 参数", () => {
    setupUrl("?q=测试关键词");
    const result = parseUrlStateFromLocation();
    expect(result!.q).toBe("测试关键词");
  });

  it("解析 onlyStarred 参数（支持 '1' 和 'true'）", () => {
    setupUrl("?onlyStarred=1");
    expect(parseUrlStateFromLocation()!.onlyStarred).toBe(true);

    setupUrl("?onlyStarred=true");
    expect(parseUrlStateFromLocation()!.onlyStarred).toBe(true);
  });

  it("解析 onlyUnread 参数", () => {
    setupUrl("?onlyUnread=1");
    expect(parseUrlStateFromLocation()!.onlyUnread).toBe(true);
  });

  it("解析 departmentName（逗号分隔）", () => {
    setupUrl("?departmentName=发改委,工信部");
    const result = parseUrlStateFromLocation();
    expect(result!.selectedDepts.has("发改委")).toBe(true);
    expect(result!.selectedDepts.has("工信部")).toBe(true);
    expect(result!.expandedDepts.has("发改委")).toBe(true);
    expect(result!.expandedDepts.has("工信部")).toBe(true);
  });

  it("解析 channelNames（逗号分隔，自动 trim 和去空）", () => {
    setupUrl("?channelNames= 微信 , 微博 ,,");
    const result = parseUrlStateFromLocation();
    expect(result!.selectedChannels.has("微信")).toBe(true);
    expect(result!.selectedChannels.has("微博")).toBe(true);
    expect(result!.selectedChannels.size).toBe(2);
  });

  it("解析 categories 参数", () => {
    setupUrl("?categories=资金,监管");
    const result = parseUrlStateFromLocation();
    expect(result!.selectedCategories.has("资金")).toBe(true);
    expect(result!.selectedCategories.has("监管")).toBe(true);
  });

  it("解析 genres 参数", () => {
    setupUrl("?genres=通知,公告");
    const result = parseUrlStateFromLocation();
    expect(result!.selectedGenres.has("通知")).toBe(true);
    expect(result!.selectedGenres.has("公告")).toBe(true);
  });

  it("解析 fromDate 和 toDate（格式校验）", () => {
    setupUrl("?fromDate=2025-01-01&toDate=2025-06-15");
    const result = parseUrlStateFromLocation();
    expect(result!.fromDate).toBe("2025-01-01");
    expect(result!.toDate).toBe("2025-06-15");
  });

  it("fromDate 格式不对时忽略", () => {
    setupUrl("?fromDate=bad-date");
    const result = parseUrlStateFromLocation();
    expect(result!.fromDate).toBe("");
  });

  it("解析 dateField 参数（默认 list_published_at）", () => {
    setupUrl("?dateField=first_seen_at");
    expect(parseUrlStateFromLocation()!.dateField).toBe("first_seen_at");

    setupUrl("?dateField=invalid");
    expect(parseUrlStateFromLocation()!.dateField).toBe("list_published_at");
  });

  it("解析 sort 参数（默认 first_seen_at）", () => {
    setupUrl("?sort=relevance");
    expect(parseUrlStateFromLocation()!.sort).toBe("relevance");

    setupUrl("?sort=published_at");
    expect(parseUrlStateFromLocation()!.sort).toBe("published_at");

    setupUrl("?sort=invalid");
    expect(parseUrlStateFromLocation()!.sort).toBe("first_seen_at");
  });

  it("onlyUrgent=1 时 importanceLevels 包含 '核心关注'", () => {
    setupUrl("?onlyUrgent=1");
    const result = parseUrlStateFromLocation();
    expect(result!.onlyUrgent).toBe(true);
    expect(result!.importanceLevels.has("核心关注")).toBe(true);
  });

  it("异常情况返回 null", () => {
    // 模拟 URLSearchParams 抛错
    const origSearchParams = URLSearchParams;
    vi.stubGlobal(
      "URLSearchParams",
      class {
        constructor() {
          throw new Error("boom");
        }
        get() { return null; }
      },
    );
    setupUrl("?q=test");
    const result = parseUrlStateFromLocation();
    expect(result).toBeNull();
    vi.unstubAllGlobals();
    globalThis.URLSearchParams = origSearchParams;
  });
});
