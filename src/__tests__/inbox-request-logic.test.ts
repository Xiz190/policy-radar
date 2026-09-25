import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// 收件箱请求逻辑测试 - Mock 数据验证
//
// 验证点：
//   1. 订阅数据未加载完成时，不发起列表请求（避免 ERR_ABORTED）
//   2. 订阅数据加载完成后，才发起第一次列表请求
//   3. 快速切换筛选条件时，旧请求被取消（AbortController 竞态控制）
//   4. 只有最后一次请求的结果会被使用
// ============================================================================

type Subscriptions = {
  departments: Set<string>;
  keywords: Set<string>;
};

type FetchRecord = {
  url: string;
  aborted: boolean;
  requestId: number;
};

class RequestController {
  private requestId = 0;
  private abortController: AbortController | null = null;
  private currentRequestId = 0;

  fetchRecords: FetchRecord[] = [];

  startRequest(url: string): { signal: AbortSignal; requestId: number } {
    this.requestId++;
    const myRequestId = this.requestId;

    if (this.abortController) {
      this.abortController.abort();
      const lastRecord = this.fetchRecords[this.fetchRecords.length - 1];
      if (lastRecord) lastRecord.aborted = true;
    }

    const controller = new AbortController();
    this.abortController = controller;
    this.currentRequestId = myRequestId;

    this.fetchRecords.push({
      url,
      aborted: false,
      requestId: myRequestId,
    });

    return { signal: controller.signal, requestId: myRequestId };
  }

  isLatestRequest(requestId: number): boolean {
    return requestId === this.currentRequestId;
  }

  markAborted(requestId: number) {
    const record = this.fetchRecords.find((r) => r.requestId === requestId);
    if (record) record.aborted = true;
  }

  get totalRequests(): number {
    return this.fetchRecords.length;
  }

  get abortedCount(): number {
    return this.fetchRecords.filter((r) => r.aborted).length;
  }

  get completedCount(): number {
    return this.fetchRecords.filter((r) => !r.aborted).length;
  }
}

function buildMockSubscriptions(): Subscriptions {
  return {
    departments: new Set(["国家发展和改革委员会", "工业和信息化部", "财政部"]),
    keywords: new Set(["数字经济", "人工智能", "数据安全"]),
  };
}

function buildMockItems(count: number) {
  const departments = ["国家发展和改革委员会", "工业和信息化部", "财政部", "科技部"];
  const categories = ["数字经济", "人工智能", "数据安全", "产业政策"];
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      sourceId: `src_${i}`,
      departmentName: departments[i % departments.length],
      channelName: "政策发布",
      displayName: `测试政策 ${i + 1}`,
      url: `https://example.com/policy/${i}`,
      title: `关于推进测试政策 ${i + 1} 的通知`,
      listPublishedAt: `2026-06-${String(26 - Math.floor(i / 3)).padStart(2, "0")}`,
      firstSeenAt: `2026-06-${String(26 - Math.floor(i / 3)).padStart(2, "0")}T10:00:00Z`,
      isRead: i % 3 === 0,
      isStarred: i % 5 === 0,
      keywordScore: 60 + (i % 40),
      importanceLevel: i < 3 ? "核心关注" : i < 8 ? "重点内容" : "普通内容",
      categories: [categories[i % categories.length]],
      genres: ["通知"],
      matchedKeywordCount: 2 + (i % 3),
      signalStrength: 10 + (i % 20),
    });
  }
  return {
    items,
    totalCount: count,
    sourcesTree: [
      {
        departmentName: "国家发展和改革委员会",
        channels: [{ channelName: "政策发布", sourceId: "src_1", itemCount: 100 }],
      },
      {
        departmentName: "工业和信息化部",
        channels: [{ channelName: "政策发布", sourceId: "src_2", itemCount: 80 }],
      },
    ],
    categoriesWithCounts: [
      { category: "数字经济", count: 50 },
      { category: "人工智能", count: 30 },
    ],
    genresWithCounts: [
      { genre: "通知", count: 100 },
      { genre: "意见", count: 50 },
    ],
  };
}

describe("收件箱请求逻辑 - 订阅加载时序", () => {
  let controller: RequestController;
  let subscriptions: Subscriptions;

  beforeEach(() => {
    controller = new RequestController();
    subscriptions = { departments: new Set(), keywords: new Set() };
  });

  it("订阅未加载时（subscriptionsLoaded=false），不发起列表请求", () => {
    const subscriptionsLoaded = false;

    function maybeLoadItems() {
      if (!subscriptionsLoaded) return;
      controller.startRequest("/api/monitor/items?view=list&page=1");
    }

    maybeLoadItems();

    expect(controller.totalRequests).toBe(0);
    expect(controller.abortedCount).toBe(0);
  });

  it("订阅加载完成后（subscriptionsLoaded=true），才发起第一次列表请求", async () => {
    let subscriptionsLoaded = false;

    const loadSubscriptions = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      subscriptions = buildMockSubscriptions();
      subscriptionsLoaded = true;
    };

    const effectCalls: string[] = [];

    function triggerEffect() {
      effectCalls.push(`effect-loaded=${subscriptionsLoaded}`);
      if (!subscriptionsLoaded) return;
      controller.startRequest(
        `/api/monitor/items?view=list&page=1&depts=${[...subscriptions.departments].join(",")}`,
      );
    }

    triggerEffect();

    expect(controller.totalRequests).toBe(0);
    expect(effectCalls).toEqual(["effect-loaded=false"]);

    await loadSubscriptions();

    triggerEffect();

    expect(controller.totalRequests).toBe(1);
    expect(controller.abortedCount).toBe(0);
    expect(controller.completedCount).toBe(1);
    expect(controller.fetchRecords[0].url).toContain("depts=");
    expect(controller.fetchRecords[0].url).toContain("国家发展和改革委员会");
  });

  it("修复前：订阅加载前先发一次请求，加载后再发一次并取消第一次 → 产生 ERR_ABORTED", async () => {
    const loadSubscriptions = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      subscriptions = buildMockSubscriptions();
    };

    function loadItemsWithBug() {
      controller.startRequest(
        `/api/monitor/items?view=list&page=1&depts=${[...subscriptions.departments].join(",")}`,
      );
    }

    loadItemsWithBug();

    expect(controller.totalRequests).toBe(1);
    expect(controller.fetchRecords[0].url).toContain("depts=");

    await loadSubscriptions();

    loadItemsWithBug();

    expect(controller.totalRequests).toBe(2);
    expect(controller.abortedCount).toBe(1);
    expect(controller.completedCount).toBe(1);
    expect(controller.fetchRecords[0].aborted).toBe(true);
    expect(controller.fetchRecords[1].aborted).toBe(false);
  });

  it("修复后：等待订阅加载完成才发请求 → 只有 1 次请求，无 ERR_ABORTED", async () => {
    let subscriptionsLoaded = false;

    const loadSubscriptions = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      subscriptions = buildMockSubscriptions();
      subscriptionsLoaded = true;
    };

    function loadItemsFixed() {
      if (!subscriptionsLoaded) return;
      controller.startRequest(
        `/api/monitor/items?view=list&page=1&depts=${[...subscriptions.departments].join(",")}`,
      );
    }

    loadItemsFixed();
    expect(controller.totalRequests).toBe(0);

    await loadSubscriptions();

    loadItemsFixed();
    expect(controller.totalRequests).toBe(1);
    expect(controller.abortedCount).toBe(0);
    expect(controller.completedCount).toBe(1);
    expect(controller.fetchRecords[0].url).toContain("国家发展和改革委员会");
  });
});

describe("收件箱请求逻辑 - 竞态控制（AbortController）", () => {
  let controller: RequestController;

  beforeEach(() => {
    controller = new RequestController();
  });

  it("快速连续发起多次请求，只有最后一次有效", () => {
    const { requestId: req1 } = controller.startRequest("/api/monitor/items?page=1");
    const { requestId: req2 } = controller.startRequest("/api/monitor/items?page=2");
    const { requestId: req3 } = controller.startRequest("/api/monitor/items?page=3");

    expect(controller.totalRequests).toBe(3);
    expect(controller.isLatestRequest(req1)).toBe(false);
    expect(controller.isLatestRequest(req2)).toBe(false);
    expect(controller.isLatestRequest(req3)).toBe(true);
  });

  it("旧请求返回时，如果已有新请求，结果应被忽略", async () => {
    let result1Used = false;
    let result2Used = false;

    const { requestId: reqId1, signal: signal1 } = controller.startRequest(
      "/api/monitor/items?page=1",
    );
    const { requestId: reqId2, signal: signal2 } = controller.startRequest(
      "/api/monitor/items?page=2",
    );

    const mockResponse1 = buildMockItems(15);
    const mockResponse2 = buildMockItems(10);

    await new Promise((resolve) => setTimeout(resolve, 5));

    if (controller.isLatestRequest(reqId1) && !signal1.aborted) {
      result1Used = true;
    }
    if (controller.isLatestRequest(reqId2) && !signal2.aborted) {
      result2Used = true;
    }

    expect(result1Used).toBe(false);
    expect(result2Used).toBe(true);
    expect(mockResponse1.items.length).toBe(15);
    expect(mockResponse2.items.length).toBe(10);
  });

  it("筛选条件快速切换时，最终只保留最后一次请求的结果", async () => {
    const filters = [
      "dept=发改委",
      "dept=工信部",
      "dept=财政部",
      "dept=科技部",
    ];

    const requestIds: number[] = [];

    for (const filter of filters) {
      const { requestId } = controller.startRequest(`/api/monitor/items?${filter}`);
      requestIds.push(requestId);

      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    const usedCount = requestIds.filter((id) => controller.isLatestRequest(id)).length;

    expect(controller.totalRequests).toBe(4);
    expect(usedCount).toBe(1);
    expect(controller.isLatestRequest(requestIds[requestIds.length - 1])).toBe(true);
    expect(controller.fetchRecords[controller.fetchRecords.length - 1].url).toContain("dept=科技部");
  });
});

describe("收件箱 Mock 数据 - 数据结构验证", () => {
  it("Mock 订阅数据结构正确", () => {
    const subs = buildMockSubscriptions();
    expect(subs.departments.size).toBe(3);
    expect(subs.keywords.size).toBe(3);
    expect(subs.departments.has("国家发展和改革委员会")).toBe(true);
    expect(subs.keywords.has("数字经济")).toBe(true);
  });

  it("Mock 列表数据结构正确", () => {
    const data = buildMockItems(15);
    expect(data.items.length).toBe(15);
    expect(data.totalCount).toBe(15);
    expect(data.sourcesTree.length).toBeGreaterThan(0);
    expect(data.categoriesWithCounts.length).toBeGreaterThan(0);
    expect(data.genresWithCounts.length).toBeGreaterThan(0);

    const first = data.items[0];
    expect(first.sourceId).toBeDefined();
    expect(first.title).toBeDefined();
    expect(typeof first.keywordScore).toBe("number");
    expect(first.categories.length).toBeGreaterThan(0);
    expect(Array.isArray(first.genres)).toBe(true);
  });

  it("Mock 数据包含优先级相关字段", () => {
    const data = buildMockItems(10);
    const importanceLevels = new Set(data.items.map((i) => i.importanceLevel));

    expect(importanceLevels.size).toBeGreaterThan(0);
    expect(data.items.some((i) => i.matchedKeywordCount !== undefined)).toBe(true);
    expect(data.items.some((i) => i.signalStrength !== undefined)).toBe(true);
  });

  it("Mock 数据包含已读/收藏状态", () => {
    const data = buildMockItems(10);
    const hasUnread = data.items.some((i) => !i.isRead);
    const hasStarred = data.items.some((i) => i.isStarred);

    expect(hasUnread).toBe(true);
    expect(hasStarred).toBe(true);
  });
});

// ============================================================================
// 竞态场景模拟 - 带日志验证
//
// 模拟真实场景：
//   1. 订阅数据加载（带延迟）
//   2. 快速切换筛选条件（连续发起多次请求）
//   3. 验证日志是否正确反映整个竞态过程
// ============================================================================

type LogEntry = {
  level: "debug" | "error" | "log";
  message: string;
  timestamp: number;
};

class InboxFetchSimulator {
  private requestId = 0;
  private abortController: AbortController | null = null;
  private currentRequestId = 0;
  private subscriptionsLoaded = false;
  private subscriptions: Subscriptions = { departments: new Set(), keywords: new Set() };
  private timeoutMs = 10000;

  logs: LogEntry[] = [];
  fetchRecords: Array<{
    requestId: number;
    url: string;
    delayMs: number;
    startedAt: number;
    aborted: boolean;
    completed: boolean;
    timeout: boolean;
  }> = [];
  renderedItems: Array<{ title: string; requestId: number }> = [];

  setTimeoutMs(ms: number) {
    this.timeoutMs = ms;
  }

  log(level: LogEntry["level"], message: string) {
    this.logs.push({ level, message, timestamp: Date.now() });
  }

  async loadSubscriptions(delayMs: number = 50): Promise<void> {
    this.log("debug", "[InboxFetch] 开始加载订阅数据");

    await new Promise((resolve) => setTimeout(resolve, delayMs));

    this.subscriptions = buildMockSubscriptions();
    this.subscriptionsLoaded = true;

    this.log(
      "debug",
      `[InboxFetch] 订阅数据加载完成 部委=${this.subscriptions.departments.size}个 关键词=${this.subscriptions.keywords.size}个`,
    );
    this.log("debug", "[InboxFetch] subscriptionsLoaded = true，准备发起首次列表请求");
  }

  fetchItems(url: string, delayMs: number = 100): Promise<{ items: ReturnType<typeof buildMockItems>; requestId: number } | null> {
    this.requestId++;
    const myRequestId = this.requestId;

    if (this.abortController) {
      this.abortController.abort();
      const lastRecord = this.fetchRecords[this.fetchRecords.length - 1];
      if (lastRecord) lastRecord.aborted = true;
      this.log("debug", `[InboxFetch] 取消上一次请求 requestId=${myRequestId - 1}`);
    }

    const controller = new AbortController();
    this.abortController = controller;
    this.currentRequestId = myRequestId;

    const record = {
      requestId: myRequestId,
      url,
      delayMs,
      startedAt: Date.now(),
      aborted: false,
      completed: false,
      timeout: false,
    };
    this.fetchRecords.push(record);

    this.log("debug", `[InboxFetch] 发起请求 requestId=${myRequestId} url=${url}`);

    const timeoutTimer = setTimeout(() => {
      if (!record.completed && !record.aborted) {
        record.timeout = true;
        this.log("debug", `[InboxFetch] 请求超时（${this.timeoutMs}ms），自动取消 requestId=${myRequestId}`);
        controller.abort();
      }
    }, this.timeoutMs);

    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        clearTimeout(timeoutTimer);
        if (controller.signal.aborted) {
          this.log("debug", `[InboxFetch] 请求被取消（catch AbortError） requestId=${myRequestId}`);
          resolved = true;
          resolve(null);
          return;
        }
        if (myRequestId !== this.currentRequestId) {
          this.log(
            "debug",
            `[InboxFetch] 结果被丢弃（有更新的请求） requestId=${myRequestId} currentRequestId=${this.currentRequestId}`,
          );
          resolved = true;
          resolve(null);
          return;
        }
        const mockData = buildMockItems(15);
        record.completed = true;

        this.log(
          "debug",
          `[InboxFetch] 请求成功 requestId=${myRequestId} items=${mockData.items.length} total=${mockData.totalCount}`,
        );

        this.renderedItems.push({ title: mockData.items[0]?.title || "", requestId: myRequestId });
        resolved = true;
        resolve({ items: mockData, requestId: myRequestId });
      }, delayMs);

      controller.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        clearTimeout(timeoutTimer);
        record.aborted = true;
        if (!resolved) {
          this.log("debug", `[InboxFetch] 请求被取消（catch AbortError） requestId=${myRequestId}`);
          resolved = true;
          resolve(null);
        }
      });
    });
  }

  triggerEffect(page: number = 1): boolean {
    if (!this.subscriptionsLoaded) {
      this.log("debug", "[InboxFetch] 订阅未加载完成，跳过请求");
      return false;
    }
    this.log("debug", `[InboxFetch] 触发请求 effect queryKey变化 page=${page}`);
    return true;
  }

  getLogsByPrefix(prefix: string): LogEntry[] {
    return this.logs.filter((l) => l.message.includes(prefix));
  }

  get logCount(): number {
    return this.logs.length;
  }
}

describe("竞态场景模拟 - 日志验证", () => {
  let sim: InboxFetchSimulator;

  beforeEach(() => {
    sim = new InboxFetchSimulator();
  });

  it("场景一：正常加载流程 - 订阅先加载，再发请求", async () => {
    const effectTriggered = sim.triggerEffect(1);
    expect(effectTriggered).toBe(false);

    await sim.loadSubscriptions(30);

    const effectTriggered2 = sim.triggerEffect(1);
    expect(effectTriggered2).toBe(true);

    const result = await sim.fetchItems("/api/monitor/items?page=1", 50);

    expect(result).not.toBeNull();
    expect(result?.requestId).toBe(1);
    expect(sim.fetchRecords.length).toBe(1);
    expect(sim.fetchRecords[0].aborted).toBe(false);
    expect(sim.renderedItems.length).toBe(1);

    const subscriptionLogs = sim.getLogsByPrefix("订阅");
    expect(subscriptionLogs.length).toBeGreaterThanOrEqual(2);
    expect(subscriptionLogs.some((l) => l.message.includes("开始加载"))).toBe(true);
    expect(subscriptionLogs.some((l) => l.message.includes("加载完成"))).toBe(true);

    const skippedLogs = sim.getLogsByPrefix("订阅未加载完成，跳过请求");
    expect(skippedLogs.length).toBe(1);

    const requestLogs = sim.getLogsByPrefix("发起请求");
    expect(requestLogs.length).toBe(1);

    const successLogs = sim.getLogsByPrefix("请求成功");
    expect(successLogs.length).toBe(1);
  });

  it("场景二：快速切换筛选 - 前两次请求被取消，只有最后一次成功", async () => {
    await sim.loadSubscriptions(10);

    const p1 = sim.fetchItems("/api/monitor/items?dept=发改委", 200);
    const p2 = sim.fetchItems("/api/monitor/items?dept=工信部", 150);
    const p3 = sim.fetchItems("/api/monitor/items?dept=财政部", 100);

    const r1 = await p1;
    const r2 = await p2;
    const r3 = await p3;

    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(r3).not.toBeNull();

    expect(sim.fetchRecords.length).toBe(3);
    expect(sim.fetchRecords[0].aborted).toBe(true);
    expect(sim.fetchRecords[1].aborted).toBe(true);
    expect(sim.fetchRecords[2].aborted).toBe(false);
    expect(sim.renderedItems.length).toBe(1);

    const cancelLogs = sim.getLogsByPrefix("取消上一次请求");
    expect(cancelLogs.length).toBe(2);

    const abortLogs = sim.getLogsByPrefix("请求被取消");
    expect(abortLogs.length).toBe(2);

    const successLogs = sim.getLogsByPrefix("请求成功");
    expect(successLogs.length).toBe(1);
    expect(successLogs[0].message).toContain("requestId=3");

    const urlLogs = sim.getLogsByPrefix("发起请求");
    expect(urlLogs.length).toBe(3);
    expect(urlLogs[0].message).toContain("发改委");
    expect(urlLogs[1].message).toContain("工信部");
    expect(urlLogs[2].message).toContain("财政部");
  });

  it("场景三：慢请求后发先到 - 新请求先返回，旧请求后返回被丢弃", async () => {
    await sim.loadSubscriptions(10);

    const slowRequest = sim.fetchItems("/api/monitor/items?page=1", 200);
    const fastRequest = sim.fetchItems("/api/monitor/items?page=2", 50);

    const fastResult = await fastRequest;
    expect(fastResult).not.toBeNull();
    expect(fastResult?.requestId).toBe(2);
    expect(sim.renderedItems.length).toBe(1);

    const slowResult = await slowRequest;
    expect(slowResult).toBeNull();

    expect(sim.fetchRecords[0].aborted).toBe(true);
    expect(sim.fetchRecords[1].aborted).toBe(false);

    const discardLogs = sim.getLogsByPrefix("结果被丢弃（有更新的请求）");
    expect(discardLogs.length).toBe(0);

    const abortLogs = sim.getLogsByPrefix("请求被取消");
    expect(abortLogs.length).toBe(1);
    expect(abortLogs[0].message).toContain("requestId=1");
  });

  it("场景四：日志时序正确 - 按时间顺序记录", async () => {
    await sim.loadSubscriptions(10);

    await sim.fetchItems("/api/monitor/items?page=1", 30);
    await sim.fetchItems("/api/monitor/items?page=2", 30);

    const timestamps = sim.logs.map((l) => l.timestamp);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
    }
  });

  it("场景五：订阅加载前触发 effect - 正确跳过并记录日志", async () => {
    const triggered = sim.triggerEffect(1);
    expect(triggered).toBe(false);

    const skipLogs = sim.getLogsByPrefix("订阅未加载完成，跳过请求");
    expect(skipLogs.length).toBe(1);

    expect(sim.fetchRecords.length).toBe(0);

    await sim.loadSubscriptions(20);

    const triggered2 = sim.triggerEffect(1);
    expect(triggered2).toBe(true);

    const triggerLogs = sim.getLogsByPrefix("触发请求 effect");
    expect(triggerLogs.length).toBe(1);

    await sim.fetchItems("/api/monitor/items?page=1", 30);

    expect(sim.fetchRecords.length).toBe(1);
    expect(sim.fetchRecords[0].aborted).toBe(false);
  });

  it("日志前缀统计 - [InboxFetch] 前缀统一", () => {
    sim.log("debug", "[InboxFetch] 测试日志1");
    sim.log("debug", "[InboxFetch] 测试日志2");
    sim.log("error", "[InboxFetch] 错误日志");

    const inboxLogs = sim.getLogsByPrefix("[InboxFetch]");
    expect(inboxLogs.length).toBe(3);

    const allHavePrefix = sim.logs.every((l) => l.message.startsWith("[InboxFetch]"));
    expect(allHavePrefix).toBe(true);
  });

  it("超时处理：请求超过超时时间自动取消", async () => {
    await sim.loadSubscriptions(10);

    sim.setTimeoutMs(100);

    const result = await sim.fetchItems("/api/monitor/items?page=1", 200);

    expect(result).toBeNull();
    expect(sim.fetchRecords.length).toBe(1);
    expect(sim.fetchRecords[0].timeout).toBe(true);
    expect(sim.fetchRecords[0].aborted).toBe(true);
    expect(sim.fetchRecords[0].completed).toBe(false);
    expect(sim.renderedItems.length).toBe(0);

    const timeoutLogs = sim.getLogsByPrefix("请求超时");
    expect(timeoutLogs.length).toBe(1);
    expect(timeoutLogs[0].message).toContain("自动取消");
    expect(timeoutLogs[0].message).toContain("100ms");

    const abortLogs = sim.getLogsByPrefix("请求被取消");
    expect(abortLogs.length).toBe(1);
  }, 3000);

  it("超时处理：请求在超时前完成，不触发超时", async () => {
    await sim.loadSubscriptions(10);

    sim.setTimeoutMs(200);

    const result = await sim.fetchItems("/api/monitor/items?page=1", 100);

    expect(result).not.toBeNull();
    expect(sim.fetchRecords.length).toBe(1);
    expect(sim.fetchRecords[0].timeout).toBe(false);
    expect(sim.fetchRecords[0].aborted).toBe(false);
    expect(sim.fetchRecords[0].completed).toBe(true);
    expect(sim.renderedItems.length).toBe(1);

    const timeoutLogs = sim.getLogsByPrefix("请求超时");
    expect(timeoutLogs.length).toBe(0);

    const successLogs = sim.getLogsByPrefix("请求成功");
    expect(successLogs.length).toBe(1);
  }, 3000);

  it("超时处理：超时后取消的请求，结果正确被丢弃", async () => {
    await sim.loadSubscriptions(10);

    sim.setTimeoutMs(100);

    const result = await sim.fetchItems("/api/monitor/items?page=1", 200);

    expect(result).toBeNull();
    expect(sim.renderedItems.length).toBe(0);

    const logs = sim.getLogsByPrefix("[InboxFetch]");
    const hasTimeoutLog = logs.some((l) => l.message.includes("请求超时"));
    const hasAbortLog = logs.some((l) => l.message.includes("请求被取消"));

    expect(hasTimeoutLog).toBe(true);
    expect(hasAbortLog).toBe(true);
  }, 3000);

  it("超时处理：快速切换筛选时，超时机制与竞态控制协同工作", async () => {
    await sim.loadSubscriptions(10);

    sim.setTimeoutMs(150);

    const p1 = sim.fetchItems("/api/monitor/items?dept=发改委", 200);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const p2 = sim.fetchItems("/api/monitor/items?dept=工信部", 50);

    const r1 = await p1;
    const r2 = await p2;

    expect(r1).toBeNull();
    expect(r2).not.toBeNull();

    expect(sim.fetchRecords[0].aborted).toBe(true);
    expect(sim.fetchRecords[1].completed).toBe(true);
    expect(sim.renderedItems.length).toBe(1);

    const timeoutLogs = sim.getLogsByPrefix("请求超时");
    expect(timeoutLogs.length).toBe(0);

    const cancelLogs = sim.getLogsByPrefix("取消上一次请求");
    expect(cancelLogs.length).toBe(1);

    const abortLogs = sim.getLogsByPrefix("请求被取消");
    expect(abortLogs.length).toBe(1);
  }, 3000);

  it("超时处理：超时触发的取消与用户手动取消同样记录日志", async () => {
    await sim.loadSubscriptions(10);

    sim.setTimeoutMs(100);

    const result = await sim.fetchItems("/api/monitor/items?page=1", 200);

    expect(result).toBeNull();

    const timeoutLogs = sim.getLogsByPrefix("请求超时");
    expect(timeoutLogs.length).toBe(1);

    const abortLogs = sim.getLogsByPrefix("请求被取消");
    expect(abortLogs.length).toBe(1);

    expect(sim.fetchRecords[0].timeout).toBe(true);
    expect(sim.fetchRecords[0].aborted).toBe(true);
  }, 3000);

  it("超时处理边界：超时时间极短（10ms），请求立即被取消", async () => {
    await sim.loadSubscriptions(10);

    sim.setTimeoutMs(10);

    const result = await sim.fetchItems("/api/monitor/items?page=1", 100);

    expect(result).toBeNull();
    expect(sim.fetchRecords[0].timeout).toBe(true);
    expect(sim.fetchRecords[0].aborted).toBe(true);
    expect(sim.renderedItems.length).toBe(0);

    const timeoutLogs = sim.getLogsByPrefix("请求超时");
    expect(timeoutLogs.length).toBe(1);
    expect(timeoutLogs[0].message).toContain("10ms");
  }, 3000);

  it("超时处理边界：超时时间远大于请求时间，请求正常成功", async () => {
    await sim.loadSubscriptions(10);

    sim.setTimeoutMs(5000);

    const result = await sim.fetchItems("/api/monitor/items?page=1", 50);

    expect(result).not.toBeNull();
    expect(sim.fetchRecords[0].timeout).toBe(false);
    expect(sim.fetchRecords[0].completed).toBe(true);
    expect(sim.renderedItems.length).toBe(1);

    const timeoutLogs = sim.getLogsByPrefix("请求超时");
    expect(timeoutLogs.length).toBe(0);

    const successLogs = sim.getLogsByPrefix("请求成功");
    expect(successLogs.length).toBe(1);
  }, 3000);

  it("超时处理边界：多次连续超时后，新的正常请求仍能成功", async () => {
    await sim.loadSubscriptions(10);

    sim.setTimeoutMs(50);

    const r1 = await sim.fetchItems("/api/monitor/items?page=1", 200);
    expect(r1).toBeNull();
    expect(sim.fetchRecords[0].timeout).toBe(true);

    const r2 = await sim.fetchItems("/api/monitor/items?page=2", 200);
    expect(r2).toBeNull();
    expect(sim.fetchRecords[1].timeout).toBe(true);

    sim.setTimeoutMs(5000);

    const r3 = await sim.fetchItems("/api/monitor/items?page=3", 30);
    expect(r3).not.toBeNull();
    expect(sim.fetchRecords[2].timeout).toBe(false);
    expect(sim.fetchRecords[2].completed).toBe(true);

    expect(sim.renderedItems.length).toBe(1);

    const timeoutLogs = sim.getLogsByPrefix("请求超时");
    expect(timeoutLogs.length).toBe(2);

    const successLogs = sim.getLogsByPrefix("请求成功");
    expect(successLogs.length).toBe(1);
  }, 3000);
});
