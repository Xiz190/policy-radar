import { describe, it, expect, beforeEach, vi } from "vitest";
import { batchUpdateItems, type BatchFilter } from "@/lib/monitor/db";

// ============================================================================
// batchUpdateItems 参数编号偏移测试
//
// 背景：batchUpdateItems 会将 SET 参数（如 is_read, is_starred 的布尔值）
// 放在 allValues 数组前面，随后再 push WHERE 参数（source_id, url 等字符串）。
// 但是 WHERE 子句中的 $N 编号是在 buildBatchWhere 中分配的，编号从 1 开始。
// 如果不把 WHERE 的 $N 向右偏移 SET 参数的数量，就会出现类型冲突：
//   - SET is_starred = $1 期望 $1 是布尔值
//   - WHERE mi.source_id = $1 期望 $1 是字符串
//   最终 $1 = true（布尔），却被当作 source_id 传进去 → SQL type error
//
// 本测试：mock getPgPool，捕获最终 SQL 和参数数组，然后验证
// "按 $N 编号索引的参数类型" 和 "该 $N 所在 SQL 子句的语义" 是匹配的。
// ============================================================================

type QueryRecord = { sql: string; values: unknown[] };

function createMockPool() {
  const queries: QueryRecord[] = [];
  const pool = {
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
      queries.push({ sql, values: vals });
      return { rows: [], rowCount: 3 };
    }),
  };
  return { pool, queries };
}

// Mock getPgPool —— 让 db.ts 调用时拿到我们的 mock pool
vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return {
    ...actual,
    getPgPool: () => mockPoolRef.pool,
  };
});

// 用 ref 让每个测试可以替换不同的 mock pool
const mockPoolRef: { pool: ReturnType<typeof createMockPool>["pool"] } = {
  pool: createMockPool().pool,
};

// —— 辅助：从 SQL 中提取 $N 的上下文位置 ———————————————————————————————
// 返回 { paramIndex: { sqlSegment, context, typesExpected } }
// 其中 context 可能是 "SET" / "WHERE" / "OTHER"
//
// 基本思路：用正则扫描整条 SQL，在 $N 出现处向前回溯最近的关键字，
// 来判断它属于哪个 SQL 子句。
function analyzeParams(sql: string, values: unknown[]) {
  const params: Array<{
    idx: number; // $N 的 N（1-based）
    value: unknown;
    context: string; // 最近的子句：SET / WHERE / WITH / UPDATE / FROM
    rawContext: string; // 附近 120 字符的上下文，便于调试
  }> = [];

  const clauseStack: string[] = [];
  // 按顺序扫描每一个字符；遇到 $N 时记录当前上下文
  for (let i = 0; i < sql.length; i++) {
    const restUpper = sql.slice(i, i + 80).toUpperCase();

    // 识别子句关键字
    if (/^\bSET\b/.test(restUpper)) clauseStack.push("SET");
    else if (/^\bWHERE\b/.test(restUpper)) clauseStack.push("WHERE");
    else if (/^\bFROM\b/.test(restUpper)) clauseStack.push("FROM");
    else if (/^\bWITH\b/.test(restUpper)) clauseStack.push("WITH");
    else if (/^\bUPDATE\b/.test(restUpper)) clauseStack.push("UPDATE");

    // 识别 $N
    if (sql[i] === "$") {
      const m = /^\$(\d+)/.exec(sql.slice(i));
      if (m) {
        const n = parseInt(m[1], 10);
        const ctx = clauseStack[clauseStack.length - 1] ?? "UNKNOWN";
        const ctxStart = Math.max(0, i - 60);
        const ctxEnd = Math.min(sql.length, i + 60);
        params.push({
          idx: n,
          value: values[n - 1],
          context: ctx,
          rawContext: sql.slice(ctxStart, ctxEnd).replace(/\s+/g, " ").trim(),
        });
        i += m[0].length - 1;
      }
    }
  }
  return params;
}

// 判断某个 $N 的 SQL 子句上下文期望的参数类型
// - SET is_read / SET is_starred → boolean
// - WHERE mi.source_id / WHERE mi.url / in(...)  → string (一般是字符串过滤)
function expectedTypes(sql: string, paramIdx: number): string[] {
  // 找到 $N 附近的内容（往前找最近的 "=" 或 "in("）
  const $pos = sql.indexOf(`$${paramIdx}`);
  if ($pos < 0) return [];
  const before = sql.slice(Math.max(0, $pos - 60), $pos).toLowerCase();
  if (/is_read\s*=\s*$/.test(before) || /is_starred\s*=\s*$/.test(before)) {
    return ["boolean"];
  }
  if (/mi\.source_id/.test(before) || /mi\.url/.test(before) || /in\s*\(\s*$/.test(before)) {
    return ["string"];
  }
  return [];
}

describe("batchUpdateItems - 参数编号偏移", () => {
  let queries: QueryRecord[] = [];

  beforeEach(() => {
    const mp = createMockPool();
    queries = mp.queries;
    mockPoolRef.pool = mp.pool;
  });

  it("用单个 SET 参数 + 单个 WHERE 参数时：SET 的 $1 是布尔，WHERE 的 $2 是字符串", async () => {
    const result = await batchUpdateItems({
      sourceId: "demo_source_01",
      url: "https://example.com/article.html",
      isStarred: true,
    });

    expect(queries.length).toBeGreaterThan(0);
    const last = queries[queries.length - 1];

    // 关键断言：$1 对应的值必须是 boolean（SET is_starred = $1）
    const params = analyzeParams(last.sql, last.values);

    // 找到 SET 上下文里的 $1
    const setParam = params.find((p) => p.context === "SET" && p.idx === 1);
    expect(setParam).toBeDefined();
    expect(typeof setParam!.value).toBe("boolean");

    // WHERE 上下文里的参数必须是 string（source_id, url）
    const whereParams = params.filter((p) => p.context === "WHERE");
    expect(whereParams.length).toBeGreaterThan(0);
    for (const p of whereParams) {
      expect(typeof p.value).toBe("string");
    }

    // SET 和 WHERE 的参数编号不能重叠
    const setIndices = params.filter((p) => p.context === "SET").map((p) => p.idx);
    const whereIndices = params.filter((p) => p.context === "WHERE").map((p) => p.idx);
    const overlap = setIndices.filter((i) => whereIndices.includes(i));
    expect(overlap).toEqual([]);

    expect(result.updated).toBeTypeOf("number");
  });

  it("用两个 SET 参数（isRead + isStarred）+ 多个 WHERE 参数时：WHERE 的编号要偏移 2", async () => {
    await batchUpdateItems({
      sourceIds: ["A", "B"],
      isRead: true,
      isStarred: false,
    });

    const last = queries[queries.length - 1];
    const params = analyzeParams(last.sql, last.values);

    const setParams = params.filter((p) => p.context === "SET");
    const whereParams = params.filter((p) => p.context === "WHERE");

    expect(setParams.length).toBeGreaterThanOrEqual(2);
    expect(whereParams.length).toBeGreaterThanOrEqual(2);

    // 类型校验：SET 里的 $1/$2 都是 boolean
    for (const p of setParams) {
      expect(typeof p.value).toBe("boolean");
    }
    // WHERE 里的参数都是 string
    for (const p of whereParams) {
      expect(typeof p.value).toBe("string");
    }

    // 参数编号不能重叠
    const setIdx = setParams.map((p) => p.idx);
    const whereIdx = whereParams.map((p) => p.idx);
    expect(setIdx.some((i) => whereIdx.includes(i))).toBe(false);

    // WHERE 的最小编号必须 > SET 的最大编号
    const minWhereIdx = Math.min(...whereIdx);
    const maxSetIdx = Math.max(...setIdx);
    expect(minWhereIdx).toBeGreaterThan(maxSetIdx);
  });

  it("不传 SET 参数（既没有 isRead 也没有 isStarred）：直接返回 updated: 0，不发 SQL", async () => {
    const result = await batchUpdateItems({ sourceId: "x" } as BatchFilter & {
      isRead?: boolean;
      isStarred?: boolean;
    });
    expect(result.updated).toBe(0);
    // 不应该有最终 UPDATE 语句（至多 schema 初始化）
    const hasUpdate = queries.some((q) => /update\s+monitor_items/i.test(q.sql));
    expect(hasUpdate).toBe(false);
  });

  it("不传 WHERE 过滤条件：安全护栏触发，返回 error: 'no_filter'", async () => {
    const result = await batchUpdateItems({ isRead: true });
    expect((result as { error?: string }).error).toBe("no_filter");
  });

  it("批量场景：markAllRead 全量标已读的 WHERE 编号不与 SET 冲突", async () => {
    await batchUpdateItems({ departmentName: "工信部", isRead: true });

    const last = queries[queries.length - 1];
    const params = analyzeParams(last.sql, last.values);

    const setParams = params.filter((p) => p.context === "SET");
    const whereParams = params.filter((p) => p.context === "WHERE");

    expect(setParams.length).toBeGreaterThanOrEqual(1);
    expect(whereParams.length).toBeGreaterThanOrEqual(1);

    // SET $1 必须是 boolean（is_read）
    const set$1 = setParams.find((p) => p.idx === 1);
    expect(set$1).toBeDefined();
    expect(typeof set$1!.value).toBe("boolean");

    // WHERE 子句中不能出现 $1
    const hasWhere$1 = whereParams.some((p) => p.idx === 1);
    expect(hasWhere$1).toBe(false);
  });

  it("类型一致性：所有 $N 的值类型必须与该位置的 SQL 语义匹配", async () => {
    // 构造一个典型组合调用：包含 SET (boolean) + WHERE (string) 的多种参数
    await batchUpdateItems({
      sourceId: "src_123",
      url: "https://example.com/page",
      channelNames: ["政策文件"],
      isStarred: true,
      isRead: true,
    });

    const last = queries[queries.length - 1];
    const params = analyzeParams(last.sql, last.values);

    // 对每个 $N 判断它在 SQL 中的位置，并校验值类型
    for (const p of params) {
      const expected = expectedTypes(last.sql, p.idx);
      if (expected.length === 0) continue; // 无法判断的位置跳过
      const actualType = typeof p.value;
      expect.soft(expected).toContain(actualType);
    }
  });
});
