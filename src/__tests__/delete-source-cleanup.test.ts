import { describe, it, expect, beforeEach, vi } from "vitest";
import { DELETE as deleteSourceRoute } from "@/app/api/monitor/sources/[sourceId]/route";
import { DELETE as deleteDeptRoute } from "@/app/api/monitor/sources/groups/route";

// ============================================================================
// 删除部委（监测源）同步清理历史数据 - 单元测试
//
// 覆盖场景：
//   1. 删除单个 sourceId 时，同步清理 monitor_items
//   2. 删除整个部委 departmentName 时，同步清理 monitor_items + monitor_keywords
//   3. dryRun=true 只统计不删除
//   4. 幂等性：连续删两次不报错
//   5. 事务性：中途失败时整体回滚
//   6. API 返回值包含 deletedCountsByTable
// ============================================================================

type QueryCall = { sql: string; values: unknown[] };

let queryCalls: QueryCall[] = [];
let rowCountsByTable: Record<string, number> = {
  monitor_sources: 1,
  monitor_items: 42,
  monitor_keywords: 8,
};
let shouldThrowOnTable: string | null = null;

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    getPgPool: () => ({
      connect: vi.fn(() => ({
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

          const lowerSql = sql.toLowerCase().trim();

          if (lowerSql === "begin" || lowerSql === "commit" || lowerSql === "rollback") {
            return { rows: [], rowCount: null };
          }

          for (const table of Object.keys(rowCountsByTable)) {
            if (shouldThrowOnTable === table && lowerSql.includes(`delete from ${table}`)) {
              throw new Error(`simulated failure on ${table}`);
            }
          }

          if (lowerSql.includes("select count(*)")) {
            for (const table of Object.keys(rowCountsByTable)) {
              if (lowerSql.includes(`from ${table}`)) {
                return { rows: [{ cnt: rowCountsByTable[table] }], rowCount: 1 };
              }
            }
          }

          if (lowerSql.startsWith("select * from") || lowerSql.includes("select * from")) {
            for (const table of Object.keys(rowCountsByTable)) {
              if (lowerSql.includes(`from ${table}`)) {
                const cnt = rowCountsByTable[table] ?? 0;
                return { rows: cnt > 0 ? [{ id: "test" }] : [], rowCount: cnt > 0 ? 1 : 0 };
              }
            }
          }

          if (lowerSql.includes("delete from")) {
            for (const table of Object.keys(rowCountsByTable)) {
              if (lowerSql.includes(`delete from ${table}`)) {
                const cnt = rowCountsByTable[table] ?? 0;
                return { rows: [], rowCount: cnt };
              }
            }
          }

          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      })),
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
        return { rows: [], rowCount: 0 };
      }),
    }),
    requireAdminToken: () => {
      return { ok: true as const };
    },
  };
});

vi.mock("@/lib/monitor/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/monitor/db")>("@/lib/monitor/db");
  return {
    ...actual,
    ensureMonitorSchema: vi.fn(async () => undefined),
  };
});

function mockDeleteSourceRequest(sourceId: string, dryRun = false): Request {
  const url = dryRun
    ? `http://localhost/api/monitor/sources/${encodeURIComponent(sourceId)}?dryRun=true`
    : `http://localhost/api/monitor/sources/${encodeURIComponent(sourceId)}`;
  return {
    headers: new Headers({ "content-type": "application/json" }),
    url,
    method: "DELETE",
    json: async () => ({}),
  } as unknown as Request;
}

function mockDeleteDeptRequest(departmentName: string, dryRun = false): Request {
  const url = dryRun
    ? `http://localhost/api/monitor/sources/departments?departmentName=${encodeURIComponent(departmentName)}&dryRun=true`
    : `http://localhost/api/monitor/sources/departments?departmentName=${encodeURIComponent(departmentName)}`;
  return {
    headers: new Headers({ "content-type": "application/json" }),
    url,
    method: "DELETE",
    json: async () => ({}),
  } as unknown as Request;
}

describe("删除部委同步清理历史数据 - DB层逻辑验证", () => {
  beforeEach(() => {
    queryCalls = [];
    shouldThrowOnTable = null;
    rowCountsByTable = {
      monitor_sources: 1,
      monitor_items: 42,
      monitor_keywords: 8,
    };
  });

  describe("deleteMonitorSource - 删除单个监测源", () => {
    it("应在事务中先删 monitor_items 再删 monitor_sources", async () => {
      const res = await deleteSourceRoute(
        mockDeleteSourceRequest("src_test_001"),
        { params: Promise.resolve({ sourceId: "src_test_001" }) },
      );
      const body = (await res.json()) as Record<string, unknown>;

      expect(body.ok).toBe(true);
      expect(body.deletedSource).toBe(true);
      expect(body.dryRun).toBe(false);
      expect(body.durationMs).toBeGreaterThanOrEqual(0);

      const counts = body.deletedCountsByTable as Record<string, number>;
      expect(counts.monitor_sources).toBe(1);
      expect(counts.monitor_items).toBe(42);

      const deleteCalls = queryCalls.filter((c) =>
        c.sql.toLowerCase().includes("delete from"),
      );
      expect(deleteCalls.length).toBe(2);
      expect(deleteCalls[0].sql.toLowerCase()).toContain("monitor_items");
      expect(deleteCalls[1].sql.toLowerCase()).toContain("monitor_sources");

      const sqlTexts = queryCalls.map((c) => c.sql.toLowerCase().trim());
      expect(sqlTexts).toContain("begin");
      expect(sqlTexts).toContain("commit");
      expect(sqlTexts).not.toContain("rollback");
    });

    it("dryRun=true 时只统计不真正删除，事务回滚", async () => {
      const res = await deleteSourceRoute(
        mockDeleteSourceRequest("src_test_001", true),
        { params: Promise.resolve({ sourceId: "src_test_001" }) },
      );
      const body = (await res.json()) as Record<string, unknown>;

      expect(body.ok).toBe(true);
      expect(body.dryRun).toBe(true);
      expect(body.deletedSource).toBe(true);

      const counts = body.deletedCountsByTable as Record<string, number>;
      expect(counts.monitor_sources).toBe(1);
      expect(counts.monitor_items).toBe(42);

      const sqlTexts = queryCalls.map((c) => c.sql.toLowerCase().trim());
      expect(sqlTexts).toContain("begin");
      expect(sqlTexts).toContain("rollback");
      expect(sqlTexts).not.toContain("commit");

      const deleteCalls = queryCalls.filter((c) =>
        c.sql.toLowerCase().includes("delete from"),
      );
      expect(deleteCalls.length).toBe(0);
    });

    it("幂等：源不存在时返回 deletedSource=false 不报错", async () => {
      rowCountsByTable.monitor_sources = 0;
      rowCountsByTable.monitor_items = 0;

      const res = await deleteSourceRoute(
        mockDeleteSourceRequest("src_nonexistent"),
        { params: Promise.resolve({ sourceId: "src_nonexistent" }) },
      );
      const body = (await res.json()) as Record<string, unknown>;

      expect(body.ok).toBe(true);
      expect(body.deletedSource).toBe(false);

      const counts = body.deletedCountsByTable as Record<string, number>;
      expect(counts.monitor_sources).toBe(0);
      expect(counts.monitor_items).toBe(0);

      const sqlTexts = queryCalls.map((c) => c.sql.toLowerCase().trim());
      expect(sqlTexts).toContain("commit");
    });

    it("删除失败时触发回滚，不出现部分删除", async () => {
      shouldThrowOnTable = "monitor_sources";

      await expect(
        deleteSourceRoute(
          mockDeleteSourceRequest("src_test_001"),
          { params: Promise.resolve({ sourceId: "src_test_001" }) },
        ),
      ).rejects.toThrow("simulated failure");

      const sqlTexts = queryCalls.map((c) => c.sql.toLowerCase().trim());
      expect(sqlTexts).toContain("begin");
      expect(sqlTexts).toContain("rollback");
      expect(sqlTexts).not.toContain("commit");
    });
  });

  describe("deleteDepartmentByName - 删除整个部委", () => {
    it("应在事务中删除 items、keywords、sources 三张表", async () => {
      const res = await deleteDeptRoute(mockDeleteDeptRequest("工信部"));
      const body = (await res.json()) as Record<string, unknown>;

      expect(body.ok).toBe(true);
      expect(body.deletedMinistry).toBe(true);
      expect(body.dryRun).toBe(false);

      const counts = body.deletedCountsByTable as Record<string, number>;
      expect(counts.monitor_sources).toBe(1);
      expect(counts.monitor_items).toBe(42);
      expect(counts.monitor_keywords).toBe(8);

      const deleteCalls = queryCalls.filter((c) =>
        c.sql.toLowerCase().includes("delete from"),
      );
      expect(deleteCalls.length).toBe(3);

      const sqlTexts = queryCalls.map((c) => c.sql.toLowerCase().trim());
      expect(sqlTexts).toContain("begin");
      expect(sqlTexts).toContain("commit");
    });

    it("dryRun=true 时只统计三张表数量不删除", async () => {
      const res = await deleteDeptRoute(mockDeleteDeptRequest("工信部", true));
      const body = (await res.json()) as Record<string, unknown>;

      expect(body.ok).toBe(true);
      expect(body.dryRun).toBe(true);
      expect(body.deletedMinistry).toBe(true);

      const counts = body.deletedCountsByTable as Record<string, number>;
      expect(counts.monitor_sources).toBe(1);
      expect(counts.monitor_items).toBe(42);
      expect(counts.monitor_keywords).toBe(8);

      const sqlTexts = queryCalls.map((c) => c.sql.toLowerCase().trim());
      expect(sqlTexts).toContain("rollback");
      expect(sqlTexts).not.toContain("commit");

      const deleteCalls = queryCalls.filter((c) =>
        c.sql.toLowerCase().includes("delete from"),
      );
      expect(deleteCalls.length).toBe(0);
    });

    it("幂等：部委不存在时返回 deletedMinistry=false 不报错", async () => {
      rowCountsByTable.monitor_sources = 0;
      rowCountsByTable.monitor_items = 0;
      rowCountsByTable.monitor_keywords = 0;

      const res = await deleteDeptRoute(mockDeleteDeptRequest("不存在的部委"));
      const body = (await res.json()) as Record<string, unknown>;

      expect(body.ok).toBe(true);
      expect(body.deletedMinistry).toBe(false);

      const counts = body.deletedCountsByTable as Record<string, number>;
      expect(counts.monitor_sources).toBe(0);
      expect(counts.monitor_items).toBe(0);
      expect(counts.monitor_keywords).toBe(0);
    });

    it("删除失败时触发回滚", async () => {
      shouldThrowOnTable = "monitor_keywords";

      await expect(deleteDeptRoute(mockDeleteDeptRequest("工信部"))).rejects.toThrow(
        "simulated failure",
      );

      const sqlTexts = queryCalls.map((c) => c.sql.toLowerCase().trim());
      expect(sqlTexts).toContain("rollback");
      expect(sqlTexts).not.toContain("commit");
    });

    it("缺少 departmentName 参数返回 400", async () => {
      const req = {
        headers: new Headers(),
        url: "http://localhost/api/monitor/sources/groups",
        method: "DELETE",
        json: async () => ({}),
      } as unknown as Request;

      const res = await deleteDeptRoute(req);
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("missing departmentName");
    });
  });
});
