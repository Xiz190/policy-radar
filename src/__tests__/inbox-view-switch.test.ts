import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  type ViewMode,
  VALID_VIEWS,
  deriveViewFromUrlParams,
  getViewPresetState,
  SIGNAL_VIEW_CATEGORIES,
  buildViewSearchParams,
  syncViewToUrl,
} from "@/lib/inbox-view-utils";

// ============================================================================
// 政策库视图切换逻辑 - 单元测试
// ============================================================================

describe("视图切换 - 基础常量", () => {
  it("VALID_VIEWS 包含全部 6 种视图", () => {
    expect(VALID_VIEWS.length).toBe(6);
    expect(VALID_VIEWS).toContain("all");
    expect(VALID_VIEWS).toContain("unread");
    expect(VALID_VIEWS).toContain("starred");
    expect(VALID_VIEWS).toContain("signals");
    expect(VALID_VIEWS).toContain("byDepartment");
    expect(VALID_VIEWS).toContain("byCategory");
  });

  it("VALID_VIEWS 顺序与 UI Tab 顺序一致（全部→未读→收藏→信号→部委→标签）", () => {
    expect(VALID_VIEWS[0]).toBe("all");
    expect(VALID_VIEWS[1]).toBe("unread");
    expect(VALID_VIEWS[2]).toBe("starred");
    expect(VALID_VIEWS[3]).toBe("signals");
    expect(VALID_VIEWS[4]).toBe("byDepartment");
    expect(VALID_VIEWS[5]).toBe("byCategory");
  });

  it("SIGNAL_VIEW_CATEGORIES 包含 5 个信号分类", () => {
    expect(SIGNAL_VIEW_CATEGORIES.length).toBe(5);
    expect(SIGNAL_VIEW_CATEGORIES).toContain("A·强执行信号");
    expect(SIGNAL_VIEW_CATEGORIES).toContain("B·强支持信号");
    expect(SIGNAL_VIEW_CATEGORIES).toContain("C·风险信号");
    expect(SIGNAL_VIEW_CATEGORIES).toContain("D·探索信号");
    expect(SIGNAL_VIEW_CATEGORIES).toContain("通用启动/落地");
  });
});

// ============================================================================
// deriveViewFromUrlParams - URL 参数到视图的推断
// ============================================================================

describe("deriveViewFromUrlParams - 默认视图", () => {
  it("无任何参数时返回 all", () => {
    expect(deriveViewFromUrlParams(null, false, false)).toBe("all");
  });

  it("view 参数为空字符串时返回 all", () => {
    expect(deriveViewFromUrlParams("", false, false)).toBe("all");
  });
});

describe("deriveViewFromUrlParams - view 参数直接指定", () => {
  it("view=all 返回 all", () => {
    expect(deriveViewFromUrlParams("all", false, false)).toBe("all");
  });

  it("view=unread 返回 unread", () => {
    expect(deriveViewFromUrlParams("unread", false, false)).toBe("unread");
  });

  it("view=starred 返回 starred", () => {
    expect(deriveViewFromUrlParams("starred", false, false)).toBe("starred");
  });

  it("view=signals 返回 signals", () => {
    expect(deriveViewFromUrlParams("signals", false, false)).toBe("signals");
  });

  it("view=byDepartment 返回 byDepartment", () => {
    expect(deriveViewFromUrlParams("byDepartment", false, false)).toBe("byDepartment");
  });

  it("view=byCategory 返回 byCategory", () => {
    expect(deriveViewFromUrlParams("byCategory", false, false)).toBe("byCategory");
  });
});

describe("deriveViewFromUrlParams - 非法 view 参数回退", () => {
  it("非法 view 参数时回退到 all", () => {
    expect(deriveViewFromUrlParams("invalid", false, false)).toBe("all");
  });

  it("非法 view 参数 + onlyStarred=true 时回退到 starred（旧参数兼容）", () => {
    expect(deriveViewFromUrlParams("invalid", true, false)).toBe("starred");
  });

  it("非法 view 参数 + onlyUnread=true 时回退到 unread（旧参数兼容）", () => {
    expect(deriveViewFromUrlParams("invalid", false, true)).toBe("unread");
  });

  it("view 参数大小写敏感（All 不匹配，回退 all）", () => {
    expect(deriveViewFromUrlParams("All", false, false)).toBe("all");
  });
});

describe("deriveViewFromUrlParams - 旧参数兼容（onlyStarred / onlyUnread）", () => {
  it("onlyStarred=true 时推断为 starred", () => {
    expect(deriveViewFromUrlParams(null, true, false)).toBe("starred");
  });

  it("onlyUnread=true 时推断为 unread", () => {
    expect(deriveViewFromUrlParams(null, false, true)).toBe("unread");
  });

  it("onlyStarred 和 onlyUnread 同时为 true 时，onlyStarred 优先级更高", () => {
    expect(deriveViewFromUrlParams(null, true, true)).toBe("starred");
  });
});

describe("deriveViewFromUrlParams - view 参数优先级最高", () => {
  it("view=all  + onlyStarred=true → 返回 all（view 参数优先）", () => {
    expect(deriveViewFromUrlParams("all", true, false)).toBe("all");
  });

  it("view=signals + onlyStarred=true → 返回 signals（view 参数优先）", () => {
    expect(deriveViewFromUrlParams("signals", true, false)).toBe("signals");
  });

  it("view=unread + onlyStarred=true → 返回 unread（view 参数优先）", () => {
    expect(deriveViewFromUrlParams("unread", true, true)).toBe("unread");
  });
});

// ============================================================================
// getViewPresetState - 视图预设筛选状态
// ============================================================================

describe("getViewPresetState - all（全部政策）", () => {
  const preset = getViewPresetState("all");

  it("onlyStarred = false", () => {
    expect(preset.onlyStarred).toBe(false);
  });

  it("onlyUnread = false", () => {
    expect(preset.onlyUnread).toBe(false);
  });

  it("selectedCategories 为空（不预设分类）", () => {
    expect(preset.selectedCategories).toEqual([]);
  });
});

describe("getViewPresetState - unread（未读）", () => {
  const preset = getViewPresetState("unread");

  it("onlyUnread = true", () => {
    expect(preset.onlyUnread).toBe(true);
  });

  it("onlyStarred = false（互斥）", () => {
    expect(preset.onlyStarred).toBe(false);
  });

  it("selectedCategories 为空", () => {
    expect(preset.selectedCategories).toEqual([]);
  });
});

describe("getViewPresetState - starred（我的收藏）", () => {
  const preset = getViewPresetState("starred");

  it("onlyStarred = true", () => {
    expect(preset.onlyStarred).toBe(true);
  });

  it("onlyUnread = false（互斥）", () => {
    expect(preset.onlyUnread).toBe(false);
  });

  it("selectedCategories 为空", () => {
    expect(preset.selectedCategories).toEqual([]);
  });
});

describe("getViewPresetState - signals（有信号）", () => {
  const preset = getViewPresetState("signals");

  it("onlyStarred = false", () => {
    expect(preset.onlyStarred).toBe(false);
  });

  it("onlyUnread = false", () => {
    expect(preset.onlyUnread).toBe(false);
  });

  it("selectedCategories 包含全部 5 个信号分类", () => {
    expect(preset.selectedCategories.length).toBe(5);
    expect(preset.selectedCategories).toContain("A·强执行信号");
    expect(preset.selectedCategories).toContain("B·强支持信号");
    expect(preset.selectedCategories).toContain("C·风险信号");
    expect(preset.selectedCategories).toContain("D·探索信号");
    expect(preset.selectedCategories).toContain("通用启动/落地");
  });

  it("selectedCategories 与 SIGNAL_VIEW_CATEGORIES 常量一致", () => {
    expect(preset.selectedCategories).toEqual(SIGNAL_VIEW_CATEGORIES);
  });
});

describe("getViewPresetState - byDepartment（按部委）", () => {
  const preset = getViewPresetState("byDepartment");

  it("onlyStarred = false", () => {
    expect(preset.onlyStarred).toBe(false);
  });

  it("onlyUnread = false", () => {
    expect(preset.onlyUnread).toBe(false);
  });

  it("selectedCategories 为空（不预设分类）", () => {
    expect(preset.selectedCategories).toEqual([]);
  });
});

describe("getViewPresetState - byCategory（按标签）", () => {
  const preset = getViewPresetState("byCategory");

  it("onlyStarred = false", () => {
    expect(preset.onlyStarred).toBe(false);
  });

  it("onlyUnread = false", () => {
    expect(preset.onlyUnread).toBe(false);
  });

  it("selectedCategories 为空（不预设分类）", () => {
    expect(preset.selectedCategories).toEqual([]);
  });
});

describe("视图互斥性 - 收藏与未读不同时为 true", () => {
  const views: ViewMode[] = ["all", "unread", "starred", "signals", "byDepartment", "byCategory"];

  it("所有视图都不会出现 onlyStarred 和 onlyUnread 同时为 true", () => {
    for (const view of views) {
      const preset = getViewPresetState(view);
      expect(
        preset.onlyStarred && preset.onlyUnread,
        `${view} 视图中 onlyStarred 和 onlyUnread 不能同时为 true`,
      ).toBe(false);
    }
  });
});

describe("类型完整性 - ViewMode 与 VALID_VIEWS 一致", () => {
  it("VALID_VIEWS 包含所有 ViewMode 可能值（防止新增视图时漏更新）", () => {
    const allViews: ViewMode[] = ["all", "unread", "starred", "signals", "byDepartment", "byCategory"];
    expect(VALID_VIEWS.length).toBe(allViews.length);
    for (const v of allViews) {
      expect(VALID_VIEWS, `缺少 ${v}`).toContain(v);
    }
  });

  it("getViewPresetState 覆盖所有 6 种视图（防止新增视图时漏处理）", () => {
    const views: ViewMode[] = ["all", "unread", "starred", "signals", "byDepartment", "byCategory"];
    for (const view of views) {
      const result = getViewPresetState(view);
      expect(result, `${view} 视图预设状态不应为 undefined`).toBeDefined();
      expect(typeof result.onlyStarred, `${view} onlyStarred 类型错误`).toBe("boolean");
      expect(typeof result.onlyUnread, `${view} onlyUnread 类型错误`).toBe("boolean");
      expect(Array.isArray(result.selectedCategories), `${view} selectedCategories 类型错误`).toBe(true);
    }
  });
});

// ============================================================================
// buildViewSearchParams - 构造视图 URL 参数（纯函数测试）
// ============================================================================

describe("buildViewSearchParams - 空 URL 设置视图", () => {
  it("空 URL + all 视图 → 空字符串（不写 view 参数）", () => {
    expect(buildViewSearchParams("", "all")).toBe("");
  });

  it("空 URL + unread 视图 → ?view=unread", () => {
    expect(buildViewSearchParams("", "unread")).toBe("?view=unread");
  });

  it("空 URL + starred 视图 → ?view=starred", () => {
    expect(buildViewSearchParams("", "starred")).toBe("?view=starred");
  });

  it("空 URL + signals 视图 → ?view=signals", () => {
    expect(buildViewSearchParams("", "signals")).toBe("?view=signals");
  });

  it("空 URL + byDepartment 视图 → ?view=byDepartment", () => {
    expect(buildViewSearchParams("", "byDepartment")).toBe("?view=byDepartment");
  });

  it("空 URL + byCategory 视图 → ?view=byCategory", () => {
    expect(buildViewSearchParams("", "byCategory")).toBe("?view=byCategory");
  });
});

describe("buildViewSearchParams - 切换视图时更新 view 参数", () => {
  it("从 ?view=starred 切到 all → 移除 view 参数", () => {
    expect(buildViewSearchParams("?view=starred", "all")).toBe("");
  });

  it("从 ?view=unread 切到 signals → 替换为 view=signals", () => {
    expect(buildViewSearchParams("?view=unread", "signals")).toBe("?view=signals");
  });

  it("从 ?view=all 切到 starred → 替换为 view=starred（虽然 all 一般不写在 URL 里）", () => {
    expect(buildViewSearchParams("?view=all", "starred")).toBe("?view=starred");
  });
});

describe("buildViewSearchParams - 保留其他查询参数", () => {
  it("已有 q=xxx 参数 + 切到 starred → 同时保留 q 和 view", () => {
    const result = buildViewSearchParams("?q=人工智能", "starred");
    expect(result).toContain("q=%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD");
    expect(result).toContain("view=starred");
  });

  it("已有多个参数 + 切回 all → 移除 view，保留其他参数", () => {
    const result = buildViewSearchParams("?q=test&onlyStarred=1&view=starred", "all");
    expect(result).not.toContain("view=");
    expect(result).toContain("q=test");
    expect(result).toContain("onlyStarred=1");
  });

  it("已有参数 + 切换视图 → 只改 view 参数，其他不动", () => {
    const result = buildViewSearchParams("?q=test&fromDate=2024-01-01&view=unread", "signals");
    expect(result).toContain("view=signals");
    expect(result).not.toContain("view=unread");
    expect(result).toContain("q=test");
    expect(result).toContain("fromDate=2024-01-01");
  });
});

describe("buildViewSearchParams - 边界情况", () => {
  it("入参 search 带 ? 前缀也能正确处理", () => {
    expect(buildViewSearchParams("?q=test", "starred")).toContain("view=starred");
    expect(buildViewSearchParams("?q=test", "starred")).toContain("q=test");
  });

  it("入参 search 不带 ? 前缀也能正确处理", () => {
    expect(buildViewSearchParams("q=test", "starred")).toContain("view=starred");
    expect(buildViewSearchParams("q=test", "starred")).toContain("q=test");
  });

  it("all 视图 + 无其他参数 → 返回空字符串（干净 URL）", () => {
    expect(buildViewSearchParams("", "all")).toBe("");
    expect(buildViewSearchParams("?", "all")).toBe("");
    expect(buildViewSearchParams("?view=starred", "all")).toBe("");
  });
});

// ============================================================================
// syncViewToUrl - URL 写入（带副作用，需 mock window）
// ============================================================================

describe("syncViewToUrl - SSR 安全", () => {
  it("无 window 对象时不报错，静默返回", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error 模拟 SSR 环境
    delete globalThis.window;
    expect(() => syncViewToUrl("starred")).not.toThrow();
    globalThis.window = originalWindow;
  });
});

describe("syncViewToUrl - 调用 replaceState 更新 URL", () => {
  let replaceStateSpy: ReturnType<typeof vi.fn>;
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
    replaceStateSpy = vi.fn();
    globalThis.window = {
      location: {
        pathname: "/inbox",
        search: "",
        hash: "",
      },
      history: {
        replaceState: replaceStateSpy,
      },
    } as unknown as typeof globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("切到 starred 时调用 replaceState，URL 带 ?view=starred", () => {
    syncViewToUrl("starred");
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    const url = replaceStateSpy.mock.calls[0][2];
    expect(url).toBe("/inbox?view=starred");
  });

  it("切到 all 时调用 replaceState，URL 不带 view 参数", () => {
    globalThis.window.location.search = "?view=starred";
    syncViewToUrl("all");
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    const url = replaceStateSpy.mock.calls[0][2];
    expect(url).toBe("/inbox");
    expect(url).not.toContain("view=");
  });

  it("保留 hash 部分", () => {
    globalThis.window.location.hash = "#section-1";
    syncViewToUrl("signals");
    const url = replaceStateSpy.mock.calls[0][2];
    expect(url).toBe("/inbox?view=signals#section-1");
  });

  it("保留已有查询参数", () => {
    globalThis.window.location.search = "?q=test";
    syncViewToUrl("starred");
    const url = replaceStateSpy.mock.calls[0][2];
    expect(url).toContain("q=test");
    expect(url).toContain("view=starred");
  });
});
