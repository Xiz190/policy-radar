import { describe, it, expect } from "vitest";
import { decideDemoAccess } from "@/lib/demo-mode";
import { OWNER_ONLY_PAGES, isOwnerOnlyApi, isOwnerOnlyPage, normalizeApiPath } from "@/lib/owner-only";
import { settingsMenu, visitorSettingsMenu, isMenuDivider } from "@/hooks/use-navigation";
import { config } from "@/proxy";

// ============================================================================
// 公开演示站的作者专属清单：访客看不到管理页、调不了诊断/跳板类接口
// 写错的后果：要么访客能看内部信息、拿服务器当跳板，要么公开页面被误挡
// ============================================================================

const visitor = { demo: true, isOwner: false };

describe("作者专属接口", () => {
  it("访客连 GET 也被挡，包括经 /api/proxy 绕一圈的", () => {
    for (const pathname of [
      "/api/monitor/sources/ping",
      "/api/monitor/diagnose",
      "/api/monitor/category-diagnose",
      "/api/monitor/items/debug-priority",
      "/api/monitor/runs",
      "/api/monitor/auto-status",
      "/api/monitor/daily-summary",
      "/api/proxy/monitor/daily-summary",
      "/api/monitor/handoff",
    ]) {
      expect(decideDemoAccess({ ...visitor, method: "GET", pathname }), pathname).toBe("deny");
    }
  });

  it("会写状态的 GET（标记紧急提醒已读）当写操作挡，只读的 urgentCount 照常", () => {
    const pathname = "/api/monitor/items/batch";
    expect(decideDemoAccess({ ...visitor, method: "GET", pathname, search: "?action=markUrgentSeen" })).toBe("deny");
    expect(decideDemoAccess({ ...visitor, method: "GET", pathname: "/api/proxy/monitor/items/batch", search: "?action=markUrgentSeen" })).toBe("deny");
    expect(decideDemoAccess({ ...visitor, method: "GET", pathname, search: "?action=urgentCount" })).toBe("allow");
  });

  it("公开页面要用的读接口不受影响", () => {
    for (const pathname of [
      "/api/monitor/items",
      "/api/monitor/dashboard",
      "/api/monitor/subscriptions",
      "/api/monitor/keywords",
      "/api/monitor/corpus-stats",
      "/api/auth/me",
    ]) {
      expect(decideDemoAccess({ ...visitor, method: "GET", pathname }), pathname).toBe("allow");
    }
  });

  it("作者本人全部放行；本地开发（非演示）全部放行", () => {
    expect(decideDemoAccess({ demo: true, isOwner: true, method: "GET", pathname: "/api/monitor/sources/ping" })).toBe("allow");
    expect(decideDemoAccess({ demo: false, isOwner: false, method: "GET", pathname: "/api/monitor/sources/ping" })).toBe("allow");
  });

  it("前缀按路径段匹配，不会误伤同名开头的路径", () => {
    expect(isOwnerOnlyApi("/api/monitor/runs-public")).toBe(false);
    expect(normalizeApiPath("/api/proxy/monitor/items")).toBe("/api/monitor/items");
    expect(normalizeApiPath("/api/proxyish/x")).toBe("/api/proxyish/x");
  });
});

describe("作者专属页面", () => {
  it("管理与个人设置页及其子页属于作者专属", () => {
    for (const p of ["/monitor", "/monitor/sources", "/keywords", "/alerts", "/digest", "/settings/data", "/stats", "/readinglist"]) {
      expect(isOwnerOnlyPage(p), p).toBe(true);
    }
  });

  it("给评委看的公开页不受影响（/m 伴侣版、/method 都以 /m 开头）", () => {
    for (const p of ["/", "/inbox", "/signals", "/dashboard", "/changelog", "/method", "/m", "/m/feed", "/subscribe", "/search", "/monitoring"]) {
      expect(isOwnerOnlyPage(p), p).toBe(false);
    }
  });

  it("proxy 的 matcher 覆盖清单里的每一页（matcher 必须是字面量，只能手写一份，这里防漏改）", () => {
    const matchers = config.matcher as string[];
    for (const page of OWNER_ONLY_PAGES) {
      expect(matchers, page).toContain(`${page}/:path*`);
    }
  });
});

describe("访客的设置菜单", () => {
  const menu = visitorSettingsMenu(settingsMenu);
  const hrefs = menu.filter((e) => !isMenuDivider(e)).map((e) => (e as { href: string }).href);

  it("不出现任何作者专属入口", () => {
    expect(hrefs.some((h) => isOwnerOnlyPage(h))).toBe(false);
    expect(hrefs).toContain("/signals");
    expect(hrefs).toContain("/changelog");
  });

  it("不留空分组标题（例如整组都是管理入口的「管理后台」）", () => {
    menu.forEach((e, i) => {
      if (isMenuDivider(e)) expect(menu[i + 1] && !isMenuDivider(menu[i + 1]), e.groupLabel).toBe(true);
    });
  });
});
