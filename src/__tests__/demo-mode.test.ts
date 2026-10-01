import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Pool } from "pg";
import {
  OWNER_COOKIE,
  decideDemoAccess,
  isOwnerRequest,
  isValidAdminToken,
  ownerCookieValue,
} from "@/lib/demo-mode";
import { consumeDemoLlmQuota } from "@/lib/demo-quota";

// ============================================================================
// 公开演示模式：访客只读 + 作者口令解锁 + 问答每日限额
// 公开站上这些规则一旦写错，要么访客能改数据/刷 API 额度，要么作者自己被锁在外面。
// ============================================================================

const TOKEN = "test-owner-token-123";

function req(opts: { method?: string; bearer?: string; cookie?: string } = {}) {
  const headers = new Headers();
  if (opts.bearer) headers.set("authorization", `Bearer ${opts.bearer}`);
  if (opts.cookie) headers.set("cookie", opts.cookie);
  return new Request("http://localhost/api/x", { method: opts.method ?? "POST", headers });
}

describe("decideDemoAccess", () => {
  const base = { demo: true, isOwner: false };

  it("非演示模式（本地开发）一律放行", () => {
    expect(decideDemoAccess({ ...base, demo: false, method: "DELETE", pathname: "/api/monitor/sources/x" })).toBe("allow");
  });

  it("访客的读请求放行", () => {
    for (const method of ["GET", "HEAD", "OPTIONS", "get"]) {
      expect(decideDemoAccess({ ...base, method, pathname: "/api/monitor/items" })).toBe("allow");
    }
  });

  it("访客的写请求被挡，包括经 /api/proxy 转发的", () => {
    for (const [method, pathname] of [
      ["POST", "/api/monitor/items/batch"],
      ["POST", "/api/proxy/monitor/items/batch"],
      ["DELETE", "/api/monitor/sources/abc"],
      ["PATCH", "/api/monitor/subscriptions"],
      ["POST", "/api/monitor/seed"],
      ["POST", "/api/monitor/run"],
    ]) {
      expect(decideDemoAccess({ ...base, method, pathname })).toBe("deny");
    }
  });

  it("访客可以用问答助手和登录接口", () => {
    for (const pathname of ["/api/chat/search", "/api/chat/answer", "/api/auth/unlock"]) {
      expect(decideDemoAccess({ ...base, method: "POST", pathname })).toBe("allow");
    }
  });

  it("作者的写请求放行", () => {
    expect(decideDemoAccess({ ...base, isOwner: true, method: "POST", pathname: "/api/monitor/run" })).toBe("allow");
  });
});

describe("作者身份", () => {
  beforeEach(() => { vi.stubEnv("ADMIN_TOKEN", TOKEN); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("Bearer 口令正确才算", () => {
    expect(isOwnerRequest(req({ bearer: TOKEN }))).toBe(true);
    expect(isOwnerRequest(req({ bearer: "wrong" }))).toBe(false);
    expect(isOwnerRequest(req())).toBe(false);
  });

  it("登录 cookie 存的是哈希，拿口令原文当 cookie 不行", () => {
    expect(isOwnerRequest(req({ cookie: `a=1; ${OWNER_COOKIE}=${ownerCookieValue(TOKEN)}` }))).toBe(true);
    expect(isOwnerRequest(req({ cookie: `${OWNER_COOKIE}=${TOKEN}` }))).toBe(false);
    expect(isOwnerRequest(req({ cookie: `${OWNER_COOKIE}=${ownerCookieValue("wrong")}` }))).toBe(false);
  });

  it("没设 ADMIN_TOKEN 时谁都不是作者，空口令也不算对", () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    expect(isOwnerRequest(req({ bearer: "" }))).toBe(false);
    expect(isValidAdminToken("")).toBe(false);
  });
});

describe("consumeDemoLlmQuota", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  function poolWithCount(count: number) {
    const query = vi.fn(async (sql: string) => (sql.includes("returning count") ? { rows: [{ count }] } : { rows: [] }));
    return { pool: { query } as unknown as Pool, query };
  }

  it("非演示模式不计数", async () => {
    const { pool, query } = poolWithCount(999);
    expect(await consumeDemoLlmQuota(req(), pool)).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it("演示模式下作者不计数", async () => {
    vi.stubEnv("PUBLIC_DEMO", "1");
    vi.stubEnv("ADMIN_TOKEN", TOKEN);
    const { pool, query } = poolWithCount(999);
    expect(await consumeDemoLlmQuota(req({ bearer: TOKEN }), pool)).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it("访客在限额内可以调，超了不行", async () => {
    vi.stubEnv("PUBLIC_DEMO", "1");
    vi.stubEnv("DEMO_LLM_DAILY_LIMIT", "100");
    expect(await consumeDemoLlmQuota(req(), poolWithCount(100).pool)).toBe(true);
    expect(await consumeDemoLlmQuota(req(), poolWithCount(101).pool)).toBe(false);
  });

  it("数据库出错时保守地不让调", async () => {
    vi.stubEnv("PUBLIC_DEMO", "1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = { query: vi.fn(async () => { throw new Error("db down"); }) } as unknown as Pool;
    expect(await consumeDemoLlmQuota(req(), pool)).toBe(false);
  });
});
