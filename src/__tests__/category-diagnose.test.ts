import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  analyzeCategories,
  SIMULATE_SCENARIOS,
  GET,
  POST,
} from "@/app/api/monitor/category-diagnose/route";
import {
  SIGNAL_CATEGORIES,
  TOPIC_CATEGORIES,
  NOISE_CATEGORIES,
} from "@/lib/monitor/content-meta";

// ============================================================================
// Mock 数据库层 - 用于数据库异常场景测试
// ============================================================================

type QueryCall = { sql: string; values: unknown[] };

let queryCalls: QueryCall[] = [];
let queryShouldThrow = false;
let throwMessage = "DB connection failed";
let queryFailOnCall = -1; // -1 = 不失败，0+ = 第N次调用失败

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  let callCount = 0;
  return {
    ...actual,
    getPgPool: () => ({
      query: vi.fn(
        async (
          sqlOrConfig: string | { text: string; values?: unknown[] },
          values?: unknown[],
        ) => {
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
          callCount++;
          if (queryShouldThrow || (queryFailOnCall >= 0 && callCount - 1 === queryFailOnCall)) {
            throw new Error(throwMessage);
          }
          return { rows: [], rowCount: 0 };
        },
      ),
    }),
  };
});

vi.mock("@/lib/monitor/db", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/monitor/db")>(
      "@/lib/monitor/db",
    );
  return {
    ...actual,
    ensureMonitorSchema: vi.fn(async () => undefined),
    getSameTopicItems: vi.fn(async () => []),
  };
});

// ============================================================================
// category-diagnose 接口单元测试
// 测试 analyzeCategories 纯函数 - 分类分析与健全性检查
// ============================================================================

describe("category-diagnose - analyzeCategories 核心分析函数", () => {
  describe("基础分类统计 (breakdown)", () => {
    it("信号层分类正确统计", () => {
      const input = [
        { category: "A·强执行信号", score: 30 },
        { category: "B·强支持信号", score: 28 },
      ];
      const result = analyzeCategories(input);
      expect(result.breakdown.signalCount).toBe(2);
      expect(result.breakdown.signalCategories).toEqual([
        "A·强执行信号",
        "B·强支持信号",
      ]);
    });

    it("主题层分类正确统计", () => {
      const input = [
        { category: "AI/智能体/大模型", score: 45 },
        { category: "算力/算力网/算电协同", score: 38 },
      ];
      const result = analyzeCategories(input);
      expect(result.breakdown.topicCount).toBe(2);
      expect(result.breakdown.topicCategories).toEqual([
        "AI/智能体/大模型",
        "算力/算力网/算电协同",
      ]);
    });

    it("噪音分类正确统计", () => {
      const input = [
        { category: "噪音词汇", score: 10 },
      ];
      const result = analyzeCategories(input);
      expect(result.breakdown.noiseCount).toBe(1);
      expect(result.breakdown.noiseCategories).toEqual(["噪音词汇"]);
    });

    it("未知分类正确统计", () => {
      const input = [
        { category: "未知分类A", score: 20 },
        { category: "结构·正式发文", score: 50 },
      ];
      const result = analyzeCategories(input);
      expect(result.breakdown.unknownCount).toBe(2);
      expect(result.breakdown.unknownCategories).toEqual([
        "未知分类A",
        "结构·正式发文",
      ]);
    });

    it("混合分类（4种类型）正确统计", () => {
      const input = [
        { category: "A·强执行信号", score: 30 },
        { category: "AI/智能体/大模型", score: 45 },
        { category: "噪音词汇", score: 10 },
        { category: "未知分类", score: 20 },
      ];
      const result = analyzeCategories(input);
      expect(result.breakdown.signalCount).toBe(1);
      expect(result.breakdown.topicCount).toBe(1);
      expect(result.breakdown.noiseCount).toBe(1);
      expect(result.breakdown.unknownCount).toBe(1);
    });

    it("空数组输入统计全为0", () => {
      const result = analyzeCategories([]);
      expect(result.breakdown.signalCount).toBe(0);
      expect(result.breakdown.topicCount).toBe(0);
      expect(result.breakdown.noiseCount).toBe(0);
      expect(result.breakdown.unknownCount).toBe(0);
    });
  });

  describe("filterTopicCategories 输出验证", () => {
    it("全信号层输入输出空数组", () => {
      const input = Array.from(SIGNAL_CATEGORIES).map((c) => ({
        category: c,
        score: 20,
      }));
      const result = analyzeCategories(input);
      expect(result.filterTopicCategories.outputCount).toBe(0);
      expect(result.filterTopicCategories.outputCategories).toEqual([]);
    });

    it("全主题层输入全部保留", () => {
      const input = Array.from(TOPIC_CATEGORIES).map((c, i) => ({
        category: c,
        score: 20 + i,
      }));
      const result = analyzeCategories(input);
      expect(result.filterTopicCategories.outputCount).toBe(6);
      expect(result.filterTopicCategories.outputCategories.map((c) => c.category)).toEqual(
        Array.from(TOPIC_CATEGORIES),
      );
    });

    it("噪音词汇不被计入主题层", () => {
      const input = [
        { category: "AI/智能体/大模型", score: 45 },
        { category: "噪音词汇", score: 10 },
      ];
      const result = analyzeCategories(input);
      expect(result.filterTopicCategories.outputCount).toBe(1);
      expect(result.filterTopicCategories.outputCategories[0].category).toBe(
        "AI/智能体/大模型",
      );
    });

    it("score 字段值完整保留", () => {
      const input = [
        { category: "AI/智能体/大模型", score: 45 },
        { category: "算力/算力网/算电协同", score: 38 },
      ];
      const result = analyzeCategories(input);
      expect(result.filterTopicCategories.allScoresPreserved).toBe(true);
      expect(result.filterTopicCategories.outputCategories[0].score).toBe(45);
      expect(result.filterTopicCategories.outputCategories[1].score).toBe(38);
    });

    it("无 score 字段也能正确处理", () => {
      const input = [{ category: "AI/智能体/大模型" }];
      const result = analyzeCategories(input);
      expect(result.filterTopicCategories.outputCount).toBe(1);
      expect(result.filterTopicCategories.outputCategories[0].score).toBe(0);
    });
  });

  describe("getFirstTopicCategory 结果验证", () => {
    it("信号层在前时取第一个主题层（跳过信号层）", () => {
      const input = [
        { category: "A·强执行信号", score: 30 },
        { category: "B·强支持信号", score: 28 },
        { category: "AI/智能体/大模型", score: 45 },
      ];
      const result = analyzeCategories(input);
      expect(result.getFirstTopicCategory.result).toBe("AI/智能体/大模型");
      expect(result.getFirstTopicCategory.matchesExpectation).toBe(true);
    });

    it("主题层在前时取第一个", () => {
      const input = [
        { category: "数据要素/高质量数据集", score: 42 },
        { category: "政务服务/平台经济/数字经济", score: 35 },
      ];
      const result = analyzeCategories(input);
      expect(result.getFirstTopicCategory.result).toBe("数据要素/高质量数据集");
      expect(result.getFirstTopicCategory.matchesExpectation).toBe(true);
    });

    it("纯信号层返回 null", () => {
      const input = [
        { category: "A·强执行信号", score: 30 },
        { category: "B·强支持信号", score: 28 },
      ];
      const result = analyzeCategories(input);
      expect(result.getFirstTopicCategory.result).toBeNull();
      expect(result.getFirstTopicCategory.expectedIfAny).toBeNull();
      expect(result.getFirstTopicCategory.matchesExpectation).toBe(true);
    });

    it("噪音在前时跳过噪音取第一个主题层", () => {
      const input = [
        { category: "噪音词汇", score: 10 },
        { category: "产业合作/京津冀协同", score: 40 },
      ];
      const result = analyzeCategories(input);
      expect(result.getFirstTopicCategory.result).toBe("产业合作/京津冀协同");
      expect(result.getFirstTopicCategory.matchesExpectation).toBe(true);
    });

    it("空数组返回 null", () => {
      const result = analyzeCategories([]);
      expect(result.getFirstTopicCategory.result).toBeNull();
      expect(result.getFirstTopicCategory.matchesExpectation).toBe(true);
    });
  });

  describe("健全性检查 (sanityChecks)", () => {
    it("信号层与主题层无交集", () => {
      const input = [
        { category: "A·强执行信号", score: 30 },
        { category: "AI/智能体/大模型", score: 45 },
      ];
      const result = analyzeCategories(input);
      expect(result.sanityChecks.signalAndTopicDisjoint).toBe(true);
    });

    it("噪音不在主题层中", () => {
      const input = [
        { category: "噪音词汇", score: 10 },
        { category: "AI/智能体/大模型", score: 45 },
      ];
      const result = analyzeCategories(input);
      expect(result.sanityChecks.noiseNotInTopic).toBe(true);
    });

    it("噪音不在信号层中", () => {
      const input = [
        { category: "噪音词汇", score: 10 },
        { category: "A·强执行信号", score: 30 },
      ];
      const result = analyzeCategories(input);
      expect(result.sanityChecks.noiseNotInSignal).toBe(true);
    });

    it("过滤结果只包含主题层分类", () => {
      const input = [
        { category: "A·强执行信号", score: 30 },
        { category: "AI/智能体/大模型", score: 45 },
        { category: "噪音词汇", score: 10 },
        { category: "未知分类", score: 20 },
      ];
      const result = analyzeCategories(input);
      expect(result.sanityChecks.filteredOnlyContainsTopic).toBe(true);
    });

    it("第一个主题层在输入中确实存在", () => {
      const input = [
        { category: "A·强执行信号", score: 30 },
        { category: "AI/智能体/大模型", score: 45 },
      ];
      const result = analyzeCategories(input);
      expect(result.sanityChecks.firstTopicIsFirstInInput).toBe(true);
    });

    it("空数组所有健全性检查都通过", () => {
      const result = analyzeCategories([]);
      expect(result.sanityChecks.signalAndTopicDisjoint).toBe(true);
      expect(result.sanityChecks.noiseNotInTopic).toBe(true);
      expect(result.sanityChecks.noiseNotInSignal).toBe(true);
      expect(result.sanityChecks.filteredOnlyContainsTopic).toBe(true);
      expect(result.sanityChecks.firstTopicIsFirstInInput).toBe(true);
    });
  });

  describe("7 个预设模拟场景全部通过", () => {
    SIMULATE_SCENARIOS.forEach((scenario, index) => {
      it(`场景${index + 1}: ${scenario.name} - 所有健全性检查通过`, () => {
        const result = analyzeCategories(scenario.categories);
        const allPass = Object.values(result.sanityChecks).every((v) => v === true);
        expect(allPass).toBe(true);
      });

      it(`场景${index + 1}: ${scenario.name} - getFirstTopicCategory 匹配预期`, () => {
        const result = analyzeCategories(scenario.categories);
        expect(result.getFirstTopicCategory.matchesExpectation).toBe(true);
      });

      it(`场景${index + 1}: ${scenario.name} - 输入总数正确`, () => {
        const result = analyzeCategories(scenario.categories);
        expect(result.input.total).toBe(scenario.categories.length);
      });

      it(`场景${index + 1}: ${scenario.name} - 各分类计数之和等于总数`, () => {
        const result = analyzeCategories(scenario.categories);
        const sum =
          result.breakdown.signalCount +
          result.breakdown.topicCount +
          result.breakdown.noiseCount +
          result.breakdown.unknownCount;
        expect(sum).toBe(result.input.total);
      });
    });
  });

  describe("分类计数与分类体系一致性", () => {
    it("所有信号层分类都被 SIGNAL_CATEGORIES 正确识别", () => {
      const input = Array.from(SIGNAL_CATEGORIES).map((c) => ({ category: c }));
      const result = analyzeCategories(input);
      expect(result.breakdown.signalCount).toBe(SIGNAL_CATEGORIES.size);
      expect(result.breakdown.topicCount).toBe(0);
    });

    it("所有主题层分类都被 TOPIC_CATEGORIES 正确识别", () => {
      const input = Array.from(TOPIC_CATEGORIES).map((c) => ({ category: c }));
      const result = analyzeCategories(input);
      expect(result.breakdown.topicCount).toBe(TOPIC_CATEGORIES.size);
      expect(result.filterTopicCategories.outputCount).toBe(TOPIC_CATEGORIES.size);
    });

    it("所有噪音分类都被 NOISE_CATEGORIES 正确识别", () => {
      const input = Array.from(NOISE_CATEGORIES).map((c) => ({ category: c }));
      const result = analyzeCategories(input);
      expect(result.breakdown.noiseCount).toBe(NOISE_CATEGORIES.size);
      expect(result.breakdown.topicCount).toBe(0);
      expect(result.breakdown.signalCount).toBe(0);
    });

    it("全部分类体系（信号+主题+噪音）计数正确", () => {
      const allCats = [
        ...Array.from(SIGNAL_CATEGORIES),
        ...Array.from(TOPIC_CATEGORIES),
        ...Array.from(NOISE_CATEGORIES),
      ];
      const input = allCats.map((c) => ({ category: c }));
      const result = analyzeCategories(input);
      expect(result.breakdown.signalCount).toBe(SIGNAL_CATEGORIES.size);
      expect(result.breakdown.topicCount).toBe(TOPIC_CATEGORIES.size);
      expect(result.breakdown.noiseCount).toBe(NOISE_CATEGORIES.size);
      expect(result.breakdown.unknownCount).toBe(0);
    });
  });

  describe("边界与异常场景", () => {
    it("空字符串分类归为未知", () => {
      const input = [{ category: "", score: 0 }];
      const result = analyzeCategories(input);
      expect(result.breakdown.unknownCount).toBe(1);
    });

    it("仅包含未知分类时主题输出为空", () => {
      const input = [
        { category: "分类A", score: 10 },
        { category: "分类B", score: 20 },
      ];
      const result = analyzeCategories(input);
      expect(result.filterTopicCategories.outputCount).toBe(0);
      expect(result.getFirstTopicCategory.result).toBeNull();
    });

    it("大量混合分类（20+）正确统计", () => {
      const signalCats = Array.from(SIGNAL_CATEGORIES);
      const topicCats = Array.from(TOPIC_CATEGORIES);
      const noiseCats = Array.from(NOISE_CATEGORIES);
      const unknownCats = ["未知1", "未知2", "未知3", "未知4", "未知5"];

      const input = [
        ...signalCats.map((c, i) => ({ category: c, score: 10 + i })),
        ...topicCats.map((c, i) => ({ category: c, score: 20 + i })),
        ...noiseCats.map((c, i) => ({ category: c, score: 5 + i })),
        ...unknownCats.map((c, i) => ({ category: c, score: 1 + i })),
      ];

      const result = analyzeCategories(input);
      expect(result.input.total).toBe(signalCats.length + topicCats.length + noiseCats.length + unknownCats.length);
      expect(result.breakdown.signalCount).toBe(signalCats.length);
      expect(result.breakdown.topicCount).toBe(topicCats.length);
      expect(result.breakdown.noiseCount).toBe(noiseCats.length);
      expect(result.breakdown.unknownCount).toBe(unknownCats.length);
      expect(result.filterTopicCategories.outputCount).toBe(topicCats.length);
      expect(result.getFirstTopicCategory.result).toBe(topicCats[0]);
    });

    it("京津冀/北京/区域 不计入主题层（区域类）", () => {
      const input = [
        { category: "京津冀/北京/区域", score: 30 },
        { category: "AI/智能体/大模型", score: 45 },
      ];
      const result = analyzeCategories(input);
      expect(result.breakdown.topicCount).toBe(1);
      expect(result.breakdown.unknownCount).toBe(1);
      expect(result.filterTopicCategories.outputCount).toBe(1);
      expect(result.getFirstTopicCategory.result).toBe("AI/智能体/大模型");
    });
  });
});

describe("category-diagnose - SIMULATE_SCENARIOS 预设场景", () => {
  it("包含 7 个预设场景", () => {
    expect(SIMULATE_SCENARIOS.length).toBe(7);
  });

  it("每个场景都有 name 和 categories", () => {
    SIMULATE_SCENARIOS.forEach((s) => {
      expect(typeof s.name).toBe("string");
      expect(s.name.length).toBeGreaterThan(0);
      expect(Array.isArray(s.categories)).toBe(true);
    });
  });

  it("场景覆盖了主要类型（纯信号、纯主题、混合、空、未知、噪音）", () => {
    const types = new Set<string>();
    SIMULATE_SCENARIOS.forEach((s) => {
      const hasSignal = s.categories.some((c) => SIGNAL_CATEGORIES.has(c.category));
      const hasTopic = s.categories.some((c) => TOPIC_CATEGORIES.has(c.category));
      const hasNoise = s.categories.some((c) => NOISE_CATEGORIES.has(c.category));
      const hasUnknown = s.categories.some(
        (c) =>
          !SIGNAL_CATEGORIES.has(c.category) &&
          !TOPIC_CATEGORIES.has(c.category) &&
          !NOISE_CATEGORIES.has(c.category),
      );
      const isEmpty = s.categories.length === 0;

      if (isEmpty) types.add("empty");
      if (hasSignal && hasTopic) types.add("mixed");
      if (hasSignal && !hasTopic) types.add("signal-only");
      if (hasTopic && !hasSignal && s.categories.length === 1) types.add("single-topic");
      if (hasNoise) types.add("with-noise");
      if (hasUnknown) types.add("with-unknown");
    });

    expect(types.has("empty")).toBe(true);
    expect(types.has("mixed")).toBe(true);
    expect(types.has("signal-only")).toBe(true);
    expect(types.has("single-topic")).toBe(true);
    expect(types.has("with-noise")).toBe(true);
    expect(types.has("with-unknown")).toBe(true);
  });
});

// ============================================================================
// 数据库异常场景测试
// ============================================================================

function mockGetRequest(path: string): Request {
  return {
    url: `http://localhost${path}`,
    method: "GET",
    headers: new Headers(),
  } as unknown as Request;
}

function mockPostRequest(body: unknown): Request {
  return {
    headers: new Headers({ "content-type": "application/json" }),
    url: "http://localhost/api/monitor/category-diagnose",
    method: "POST",
    json: async () => body,
  } as unknown as Request;
}

describe("category-diagnose - GET 接口数据库异常", () => {
  beforeEach(() => {
    queryCalls = [];
    queryShouldThrow = false;
    throwMessage = "DB connection failed";
    queryFailOnCall = -1;
  });

  it("simulate 模式不依赖数据库，即使 DB 异常也正常返回", async () => {
    queryShouldThrow = true;
    const res = await GET(mockGetRequest("/api/monitor/category-diagnose?simulate=1"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; mode: string; scenarioCount: number };
    expect(data.ok).toBe(true);
    expect(data.mode).toBe("simulate");
    expect(data.scenarioCount).toBe(7);
  });

  it("simulate 模式返回所有健全性检查通过", async () => {
    const res = await GET(mockGetRequest("/api/monitor/category-diagnose?simulate=1"));
    const data = (await res.json()) as {
      ok: boolean;
      summary: { allPassed: boolean; totalChecks: number; passedChecks: number };
    };
    expect(data.summary.allPassed).toBe(true);
    expect(data.summary.totalChecks).toBe(data.summary.passedChecks);
  });

  it("ensureMonitorSchema 失败时返回 500", async () => {
    const { ensureMonitorSchema } = await import("@/lib/monitor/db");
    const mockFn = ensureMonitorSchema as Mock;
    const original = mockFn.getMockImplementation();
    mockFn.mockImplementation(async () => {
      throw new Error("Schema init failed");
    });

    const res = await GET(mockGetRequest("/api/monitor/category-diagnose"));
    expect(res.status).toBe(500);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Schema init failed");

    mockFn.mockImplementation(original ?? (async () => undefined));
  });

  it("第一次查询（分类分布）失败时返回 500", async () => {
    queryFailOnCall = 0;
    throwMessage = "category distribution query failed";
    const res = await GET(mockGetRequest("/api/monitor/category-diagnose"));
    expect(res.status).toBe(500);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toContain("category distribution query failed");
  });

  it("第二次查询（总数）失败时返回 500", async () => {
    queryFailOnCall = 1;
    throwMessage = "total items query failed";
    const res = await GET(mockGetRequest("/api/monitor/category-diagnose"));
    expect(res.status).toBe(500);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toContain("total items query failed");
  });

  it("第三次查询（有分类条目数）失败时返回 500", async () => {
    queryFailOnCall = 2;
    throwMessage = "items with categories query failed";
    const res = await GET(mockGetRequest("/api/monitor/category-diagnose"));
    expect(res.status).toBe(500);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toContain("items with categories query failed");
  });

  it("第四次查询（纯信号层条目数）失败时返回 500", async () => {
    queryFailOnCall = 3;
    throwMessage = "signal-only items query failed";
    const res = await GET(mockGetRequest("/api/monitor/category-diagnose"));
    expect(res.status).toBe(500);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toContain("signal-only items query failed");
  });

  it("第五次查询（混合分类条目数）失败时返回 500", async () => {
    queryFailOnCall = 4;
    throwMessage = "mixed categories query failed";
    const res = await GET(mockGetRequest("/api/monitor/category-diagnose"));
    expect(res.status).toBe(500);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toContain("mixed categories query failed");
  });

  it("数据库连接完全失败时错误信息正确透传", async () => {
    queryShouldThrow = true;
    throwMessage = "ECONNREFUSED: Connection refused";
    const res = await GET(mockGetRequest("/api/monitor/category-diagnose"));
    expect(res.status).toBe(500);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("ECONNREFUSED: Connection refused");
  });

  it("非 Error 类型异常也能正确处理", async () => {
    const { getPgPool } = await import("@/lib/db");
    queryShouldThrow = true;
    const pool = getPgPool() as unknown as { query: Mock };
    const originalQuery = pool.query.getMockImplementation();
    pool.query.mockImplementation(() => {
      throw "plain string error";
    });

    const res = await GET(mockGetRequest("/api/monitor/category-diagnose"));
    expect(res.status).toBe(500);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(typeof data.error).toBe("string");

    pool.query.mockImplementation(originalQuery ?? (() => Promise.resolve({ rows: [], rowCount: 0 })));
  });
});

describe("category-diagnose - POST 接口数据库异常", () => {
  beforeEach(() => {
    queryCalls = [];
    queryShouldThrow = false;
    throwMessage = "DB connection failed";
    queryFailOnCall = -1;
  });

  it("无主题层分类时不查询数据库，直接返回空结果", async () => {
    queryShouldThrow = true; // 即使数据库完全挂掉也不影响
    const body = {
      categories: [
        { category: "A·强执行信号", score: 30 },
        { category: "B·强支持信号", score: 28 },
      ],
      sourceId: "test-id",
      url: "https://example.com/test",
    };
    const res = await POST(mockPostRequest(body));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      ok: boolean;
      analysis: { filterTopicCategories: { outputCount: number } };
      sameTopicQuery: { queried: boolean; count: number; error: string };
    };
    expect(data.ok).toBe(true);
    expect(data.analysis.filterTopicCategories.outputCount).toBe(0);
    expect(data.sameTopicQuery.queried).toBe(true);
    expect(data.sameTopicQuery.count).toBe(0);
    expect(data.sameTopicQuery.error).toContain("无有效主题层分类");
  });

  it("缺少 sourceId 和 url 时不查询数据库", async () => {
    queryShouldThrow = true;
    const body = {
      categories: [{ category: "AI/智能体/大模型", score: 45 }],
    };
    const res = await POST(mockPostRequest(body));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      ok: boolean;
      sameTopicQuery: { queried: boolean };
    };
    expect(data.ok).toBe(true);
    expect(data.sameTopicQuery.queried).toBe(false);
  });

  it("getSameTopicItems 失败时返回错误信息但状态 200（优雅降级）", async () => {
    const { getSameTopicItems } = await import("@/lib/monitor/db");
    const mockFn = getSameTopicItems as Mock;
    const original = mockFn.getMockImplementation();
    mockFn.mockImplementation(async () => {
      throw new Error("same topic query timed out");
    });

    const body = {
      categories: [{ category: "AI/智能体/大模型", score: 45 }],
      sourceId: "test-id",
      url: "https://example.com/test",
    };
    const res = await POST(mockPostRequest(body));
    expect(res.status).toBe(200); // 注意：是 200 不是 500
    const data = (await res.json()) as {
      ok: boolean;
      sameTopicQuery: { queried: boolean; count: number; error: string };
    };
    expect(data.ok).toBe(true);
    expect(data.sameTopicQuery.queried).toBe(true);
    expect(data.sameTopicQuery.count).toBe(0);
    expect(data.sameTopicQuery.error).toContain("same topic query timed out");

    mockFn.mockImplementation(original ?? (async () => undefined));
  });

  it("ensureMonitorSchema 失败时返回 500", async () => {
    const { ensureMonitorSchema } = await import("@/lib/monitor/db");
    const mockFn = ensureMonitorSchema as Mock;
    const original = mockFn.getMockImplementation();
    mockFn.mockImplementation(async () => {
      throw new Error("Schema init failed in POST");
    });

    const body = { categories: [{ category: "AI/智能体/大模型", score: 45 }] };
    const res = await POST(mockPostRequest(body));
    expect(res.status).toBe(500);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Schema init failed in POST");

    mockFn.mockImplementation(original ?? (async () => undefined));
  });

  it("categories 不是数组时返回 400", async () => {
    const body = { categories: "not an array" };
    const res = await POST(mockPostRequest(body));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toContain("categories must be an array");
  });

  it("请求 body 解析失败时使用空数组 fallback", async () => {
    const req = {
      headers: new Headers({ "content-type": "application/json" }),
      url: "http://localhost/api/monitor/category-diagnose",
      method: "POST",
      json: async () => {
        throw new SyntaxError("Invalid JSON");
      },
    } as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      ok: boolean;
      analysis: { input: { total: number } };
    };
    expect(data.ok).toBe(true);
    expect(data.analysis.input.total).toBe(0);
  });

  it("非 Error 类型的 getSameTopicItems 异常也能正确处理", async () => {
    const { getSameTopicItems } = await import("@/lib/monitor/db");
    const mockFn = getSameTopicItems as Mock;
    const original = mockFn.getMockImplementation();
    mockFn.mockImplementation(async () => {
      throw { code: "DB_TIMEOUT", message: "timeout" };
    });

    const body = {
      categories: [{ category: "AI/智能体/大模型", score: 45 }],
      sourceId: "test-id",
      url: "https://example.com/test",
    };
    const res = await POST(mockPostRequest(body));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      sameTopicQuery: { error: string };
    };
    expect(typeof data.sameTopicQuery.error).toBe("string");

    mockFn.mockImplementation(original ?? (async () => undefined));
  });
});

describe("category-diagnose - 数据库正常时的接口集成验证", () => {
  beforeEach(() => {
    queryCalls = [];
    queryShouldThrow = false;
    queryFailOnCall = -1;
  });

  it("GET 分布模式正常时调用 5 次查询", async () => {
    const res = await GET(mockGetRequest("/api/monitor/category-diagnose"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; mode: string };
    expect(data.ok).toBe(true);
    expect(data.mode).toBe("distribution");
    expect(queryCalls.length).toBe(5);
  });

  it("GET simulate 模式不调用任何数据库查询", async () => {
    const res = await GET(mockGetRequest("/api/monitor/category-diagnose?simulate=1"));
    expect(res.status).toBe(200);
    expect(queryCalls.length).toBe(0);
  });

  it("POST 有主题层分类 + 有 sourceId/url 时调用 getSameTopicItems", async () => {
    const { getSameTopicItems } = await import("@/lib/monitor/db");
    const mockFn = getSameTopicItems as Mock;
    mockFn.mockClear();

    const body = {
      categories: [{ category: "AI/智能体/大模型", score: 45 }],
      sourceId: "test-id",
      url: "https://example.com/test",
    };
    const res = await POST(mockPostRequest(body));
    expect(res.status).toBe(200);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("POST 返回包含完整的 analysis 和 sameTopicQuery 结构", async () => {
    const body = {
      categories: [
        { category: "A·强执行信号", score: 30 },
        { category: "AI/智能体/大模型", score: 45 },
      ],
      sourceId: "test-id",
      url: "https://example.com/test",
    };
    const res = await POST(mockPostRequest(body));
    const data = (await res.json()) as {
      ok: boolean;
      analysis: {
        input: { total: number };
        breakdown: { signalCount: number; topicCount: number };
        filterTopicCategories: { outputCount: number };
        getFirstTopicCategory: { result: string | null };
        sanityChecks: Record<string, boolean>;
      };
      sameTopicQuery: {
        queried: boolean;
        count: number;
        items?: unknown[];
        error?: string;
      };
    };

    expect(data.ok).toBe(true);
    expect(data.analysis.input.total).toBe(2);
    expect(data.analysis.breakdown.signalCount).toBe(1);
    expect(data.analysis.breakdown.topicCount).toBe(1);
    expect(data.analysis.filterTopicCategories.outputCount).toBe(1);
    expect(data.analysis.getFirstTopicCategory.result).toBe("AI/智能体/大模型");
    expect(Object.keys(data.analysis.sanityChecks).length).toBeGreaterThan(0);
    expect(data.sameTopicQuery.queried).toBe(true);
  });
});
