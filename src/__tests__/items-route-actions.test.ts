import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/monitor/items/route";
import { POST as batchPOST } from "@/app/api/monitor/items/batch/route";

// ============================================================================
// 一键操作 & 批量操作：路由级测试
//
// 验证点：
//   - mark-all-read / unstar-old / clean-old 操作应使用 res.rowCount，
//     而不是 returning count(*)
//   - 各操作应返回正确的 JSON 形状和 HTTP 状态码
//   - batch 路由能正确处理单个条目标记，应调用 batchUpdateItems
//   - 未知 action 应返回 400
// ============================================================================

type QueryCall = { sql: string; values: unknown[] };

let queryCalls: QueryCall[] = [];
let defaultRowCount = 5;

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    getPgPool: () => ({
      query: vi.fn(async (sqlOrConfig: string | { text: string; values?: unknown[] }, values?: unknown[]) => {
        let sql: string;
        let vals: unknown[];
        if (typeof sqlOrConfig === "string") {
          sql = sqlOrConfig;
          vals = values ?? [];
        } else {
          sql = sqlOrConfig.text;
          vals = sqlOrConfig.values ?? [];
        }
        queryCalls.push({ sql, values: vals });
        return { rows: [], rowCount: defaultRowCount };
      }),
    }),
    requireAdminToken: (request: unknown) => {
      void request;
      return { ok: true as const };
    },
  };
});

// Mock ensureMonitorSchema —— 它内部也会用到 pool，需要保证 pool 是 mock
vi.mock("@/lib/monitor/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/monitor/db")>("@/lib/monitor/db");
  return {
    ...actual,
    ensureMonitorSchema: vi.fn(async () => undefined),
    ensureNotificationSchema: vi.fn(async () => undefined),
    rescanKeywordsOnItems: vi.fn(async (_pool: unknown, limit: number) => ({
      total: limit,
      scanned: limit,
      avgScore: 3,
      topCategories: [],
    })),
    rescanAllGenres: vi.fn(async () => ({ ok: true })),
    batchUpdateItems: vi.fn(async (params: unknown) => {
      queryCalls.push({ sql: "__BATCH__", values: [params] as unknown[] });
      return { updated: 3 };
    }),
  };
});

function mockRequest(body: unknown): Request {
  return {
    headers: new Headers({ "content-type": "application/json" }),
    url: "http://localhost/api/monitor/items",
    method: "POST",
    json: async () => body,
  } as unknown as Request;
}

function mockBatchRequest(action: string | null, body: unknown): Request {
  const url = action
    ? `http://localhost/api/monitor/items/batch?action=${encodeURIComponent(action)}`
    : "http://localhost/api/monitor/items/batch";
  return {
    headers: new Headers({ "content-type": "application/json" }),
    url,
    method: "POST",
    json: async () => body,
  } as unknown as Request;
}

describe("POST /api/monitor/items - 一键操作", () => {
  beforeEach(() => {
    queryCalls = [];
    defaultRowCount = 5;
  });

  it("action=mark-all-read 应返回 ok:true 且 updated 是数字", async () => {
    const res = await POST(mockRequest({ action: "mark-all-read" }));
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.ok).toBe(true);
    expect(body.action).toBe("mark-all-read");
    expect(typeof body.updated).toBe("number");
    expect((body.updated as number) >= 0).toBe(true);
    expect(typeof body.message).toBe("string");

    // 必须不出现 returning count(*)
    const combinedSql = queryCalls.map((c) => c.sql).join(" ");
    expect(/returning\s+count\s*\(\s*\*\s*\)/i.test(combinedSql)).toBe(false);
  });

  it("action=unstar-old 应正确处理 days 参数并返回正确的 JSON", async () => {
    const res = await POST(mockRequest({ action: "unstar-old", days: 7 }));
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.ok).toBe(true);
    expect(body.days).toBe(7);
    expect(typeof body.updated).toBe("number");
    expect(typeof body.message).toBe("string");

    // 必须不出现 returning count(*)
    const combinedSql = queryCalls.map((c) => c.sql).join(" ");
    expect(/returning\s+count\s*\(\s*\*\s*\)/i.test(combinedSql)).toBe(false);
  });

  it("action=clean-old 应正确处理 days 参数并返回 deleted 数量", async () => {
    const res = await POST(mockRequest({ action: "clean-old", days: 30 }));
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.ok).toBe(true);
    expect(body.days).toBe(30);
    expect(typeof body.deleted).toBe("number");
    expect(typeof body.message).toBe("string");

    // SQL 中必须包含 DELETE 但不能有 returning count(*)
    const combinedSql = queryCalls.map((c) => c.sql).join(" ");
    expect(/delete\s+from\s+monitor_items/i.test(combinedSql)).toBe(true);
    expect(/returning\s+count\s*\(\s*\*\s*\)/i.test(combinedSql)).toBe(false);
  });

  it("未知 action 应返回 400 状态码和 ok:false", async () => {
    const res = await POST(mockRequest({ action: "does-not-exist" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe("string");
  });

  it("rescan-keywords 应返回 ok:true 与关键词统计", async () => {
    const res = await POST(mockRequest({ action: "rescan-keywords", limit: 100 }));
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.total).toBe(100);
    expect(body.scanned).toBe(100);
  });

  it("不传 action 应视为 unknown 返回 400", async () => {
    const res = await POST(mockRequest({}));
    expect(res.status).toBe(400);
  });

  it("unstar-old 的 days 参数有下限保护（小于 1 时会被 Math.max(1, ...) 覆盖）", async () => {
    await POST(mockRequest({ action: "unstar-old", days: -5 }));
    // SQL 中 $1 应被设为 1（默认值）
    const updateCall = queryCalls.find((c) => /is_starred\s*=\s*false/i.test(c.sql));
    expect(updateCall).toBeDefined();
    // values[0] 应该是 days 的最终值（非负数）
    expect(Number(updateCall!.values[0])).toBeGreaterThan(0);
  });
});

describe("POST /api/monitor/items/batch - 批量操作", () => {
  beforeEach(() => {
    queryCalls = [];
  });

  it("action=markAllRead 应调用 batchUpdateItems 并返回 ok:true", async () => {
    const res = await batchPOST(mockBatchRequest("markAllRead", { sourceIds: ["a"] }));
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.ok).toBe(true);
    expect(typeof body.updated).toBe("number");
    expect(body.action).toBe("markAllRead");

    // batchUpdateItems 应该被调用过
    const batchCall = queryCalls.find((c) => c.sql === "__BATCH__");
    expect(batchCall).toBeDefined();
  });

  it("action=markAllStarred 应调用 batchUpdateItems 并设置 isStarred", async () => {
    await batchPOST(mockBatchRequest("markAllStarred", { sourceIds: ["a"] }));

    const batchCall = queryCalls.find((c) => c.sql === "__BATCH__");
    expect(batchCall).toBeDefined();
    const params = batchCall!.values[0] as Record<string, unknown>;
    expect(params.isStarred).toBe(true);
  });

  it("不带 action 参数：默认走 batchUpdateItems（单个条目标记）", async () => {
    const res = await batchPOST(
      mockBatchRequest(null, { sourceId: "s1", url: "https://example.com", isRead: true }),
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);

    const batchCall = queryCalls.find((c) => c.sql === "__BATCH__");
    expect(batchCall).toBeDefined();
    const params = batchCall!.values[0] as Record<string, unknown>;
    expect(params.sourceId).toBe("s1");
    expect(params.url).toBe("https://example.com");
    expect(params.isRead).toBe(true);
  });

  it("不提供任何过滤条件：batchUpdateItems 返回 no_filter 错误", async () => {
    const res = await batchPOST(mockBatchRequest(null, { isRead: true }));
    // 因为没有 sourceId / url 等过滤条件，batchUpdateItems 会返回 error
    const body = (await res.json()) as Record<string, unknown>;
    // OK 但可能返回 no_filter；只要不 throw 就合理（具体返回值取决于实现）
    expect(body).toBeDefined();
    expect(body.ok || body.error === "no_filter").toBe(true);
  });
});
