import { describe, expect, it } from "vitest";
import { COMPANION_TABS, activeTab, isCompanionPath } from "@/lib/companion/nav";

describe("伴侣版路径判定", () => {
  it("/m 与 /m/ 子路径为真", () => {
    expect(isCompanionPath("/m")).toBe(true);
    expect(isCompanionPath("/m/feed")).toBe(true);
    expect(isCompanionPath("/m/item/abc")).toBe(true);
  });

  it("以 /m 开头的其他路由必须为假（/monitor 与 /method 两个陷阱）", () => {
    expect(isCompanionPath("/monitor")).toBe(false);
    expect(isCompanionPath("/monitor/sources")).toBe(false);
    expect(isCompanionPath("/method")).toBe(false);
  });

  it("桌面站路由为假", () => {
    for (const p of ["/", "/inbox", "/signals", "/dashboard", "/search"]) {
      expect(isCompanionPath(p), `${p} 不应被判为伴侣版`).toBe(false);
    }
  });
});

describe("伴侣版底部 tab 高亮", () => {
  it("三个 tab 各自高亮自己", () => {
    expect(activeTab("/m")).toBe("today");
    expect(activeTab("/m/feed")).toBe("feed");
    expect(activeTab("/m/saved")).toBe("saved");
  });

  it("详情页不高亮任何 tab（它有自己的底部 toolbar）", () => {
    expect(activeTab("/m/item/abc")).toBeNull();
  });

  it("带尾斜杠的 /m/ 也归到 today（与 isCompanionPath 保持一致）", () => {
    expect(isCompanionPath("/m/")).toBe(true);
    expect(activeTab("/m/")).toBe("today");
  });

  it("每个 tab 都能被自己的 href 高亮（防止 COMPANION_TABS 与 activeTab 漂移）", () => {
    for (const tab of COMPANION_TABS) {
      expect(activeTab(tab.href), `${tab.key} 的 href 未被高亮，两个真源已漂移`).toBe(tab.key);
    }
  });

  it("子路径也能高亮对应的 tab", () => {
    expect(activeTab("/m/feed/anything")).toBe("feed");
    expect(activeTab("/m/saved/anything")).toBe("saved");
  });

  it("桌面站路由返回 null", () => {
    expect(activeTab("/monitor")).toBeNull();
    expect(activeTab("/inbox")).toBeNull();
  });
});

describe("tab 定义", () => {
  it("恰好三个 tab，顺序为 今日 / 动态 / 收藏", () => {
    expect(COMPANION_TABS.map((t) => t.key)).toEqual(["today", "feed", "saved"]);
  });

  it("每个 tab 都有 i18n key 与 href", () => {
    for (const t of COMPANION_TABS) {
      expect(t.href.startsWith("/m"), `${t.key} href 应以 /m 开头`).toBe(true);
      expect(t.labelKey, `${t.key} 缺少 labelKey`).toBeTruthy();
    }
  });
});
