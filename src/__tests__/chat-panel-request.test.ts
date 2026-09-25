import { describe, it, expect, beforeEach, vi } from "vitest";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ index: number; snippet: string }>;
};

type LogEntry = {
  level: "debug" | "error";
  message: string;
  timestamp: number;
};

type MockFetchFn = (
  url: string,
  options: { method?: string; body?: string; signal?: AbortSignal; delayMs?: number },
) => ReturnType<ChatPanelSimulator["mockFetch"]>;

type FetchRecord = {
  url: string;
  method: string;
  initiatedAt: number;
  completedAt: number | null;
  aborted: boolean;
  timeout: boolean;
  success: boolean;
  question?: string;
  roleId?: string;
  sourceId?: string;
};

class ChatPanelSimulator {
  messages: ChatMessage[] = [];
  loading = false;
  initLoading = true;
  logs: LogEntry[] = [];
  fetchRecords: FetchRecord[] = [];

  private sendRequestId = 0;
  private sendAbortController: AbortController | null = null;
  private sendTimeoutMs = 30000;
  private roleEffectController: AbortController | null = null;
  private initController: AbortController | null = null;
  private lastSendTime = 0;
  private throttleMs = 1000;

  private debug(msg: string) {
    this.logs.push({ level: "debug", message: `[ChatPanel] ${msg}`, timestamp: Date.now() });
  }

  private error(msg: string) {
    this.logs.push({ level: "error", message: `[ChatPanel] ${msg}`, timestamp: Date.now() });
  }

  setTimeoutMs(ms: number) {
    this.sendTimeoutMs = ms;
  }

  setThrottleMs(ms: number) {
    this.throttleMs = ms;
  }

  getLogsByPrefix(prefix: string): LogEntry[] {
    return this.logs.filter((l) => l.message.includes(prefix));
  }

  private async mockFetch(
    url: string,
    options: { method?: string; body?: string; signal?: AbortSignal; delayMs?: number },
  ): Promise<{ ok: boolean; json: () => Promise<{ message: ChatMessage }> }> {
    const record: FetchRecord = {
      url,
      method: options.method || "GET",
      initiatedAt: Date.now(),
      completedAt: null,
      aborted: false,
      timeout: false,
      success: false,
    };

    let bodyObj: { question?: string; roleId?: string } | null = null;
    if (options.body) {
      try {
        bodyObj = JSON.parse(options.body);
        if (bodyObj) {
          record.question = bodyObj.question;
          record.roleId = bodyObj.roleId;
        }
      } catch {}
    }

    const urlObj = new URL(url, "http://localhost");
    if (urlObj.searchParams.get("sourceId")) {
      record.sourceId = urlObj.searchParams.get("sourceId")!;
    }

    this.fetchRecords.push(record);

    const delayMs = options.delayMs ?? 100;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        record.completedAt = Date.now();
        record.success = true;

        const isPost = options.method === "POST";
        let answerContent = "您好，我是政策助手，有什么可以帮您的？";

        if (isPost && bodyObj?.question) {
          answerContent = `回答：${bodyObj.question}`;
        } else if (isPost && bodyObj?.roleId) {
          answerContent = `已切换到${bodyObj.roleId}视角，您好！`;
        }

        resolve({
          ok: true,
          json: async () => ({
            message: {
              id: `a_${Date.now()}`,
              role: "assistant",
              content: answerContent,
              citations: [{ index: 1, snippet: "引用段落1" }],
            } as ChatMessage,
          }),
        });
      }, delayMs);

      if (options.signal) {
        if (options.signal.aborted) {
          clearTimeout(timer);
          record.aborted = true;
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        options.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          record.aborted = true;
          reject(new DOMException("Aborted", "AbortError"));
        });
      }
    });
  }

  async initChat(sourceId: string, url: string, delayMs = 100): Promise<void> {
    if (this.initController) {
      this.debug(`切换文档，取消上一个初始化请求 sourceId=${sourceId}`);
      this.initController.abort();
    }
    const controller = new AbortController();
    this.initController = controller;

    this.debug(`初始化加载 sourceId=${sourceId}`);
    this.initLoading = true;

    try {
      const sp = new URLSearchParams();
      sp.set("sourceId", sourceId);
      sp.set("url", url);
      const res = await this.mockFetch(`/api/monitor/chat?${sp.toString()}`, { signal: controller.signal, delayMs });
      if (controller.signal.aborted) {
        this.debug(`初始化请求被取消（fetch 返回后检查 signal）`);
        return;
      }
      const json = await res.json();
      if (controller.signal.aborted) {
        this.debug(`初始化请求被取消（json 解析后检查 signal）`);
        return;
      }
      if (json && json.message) {
        this.debug(`初始化请求成功 contentLength=${json.message.content.length}`);
        this.messages = [json.message];
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        this.debug(`初始化请求被取消（catch AbortError）`);
        return;
      }
      if (controller.signal.aborted) return;
      this.error(`初始化请求失败 error=${(err as Error).message}`);
      this.messages = [{ id: "err-init", role: "assistant", content: "加载失败，请稍后再试。" }];
    } finally {
      if (!controller.signal.aborted) this.initLoading = false;
    }
  }

  async changeRole(roleId: string, delayMs = 100): Promise<void> {
    if (this.roleEffectController) {
      this.debug(`角色再次切换，取消上一次角色切换请求 roleId=${roleId || "通用"}`);
      this.roleEffectController.abort();
    }
    const controller = new AbortController();
    this.roleEffectController = controller;

    this.debug(`切换角色 roleId=${roleId || "通用"}`);

    try {
      const res = await this.mockFetch(`/api/monitor/chat`, {
        method: "POST",
        body: JSON.stringify({ sourceId: "src1", url: "https://example.com", question: "", roleId: roleId || undefined }),
        signal: controller.signal,
        delayMs,
      });
      if (controller.signal.aborted) {
        this.debug(`角色切换请求被取消（fetch 返回后检查 signal）`);
        return;
      }
      if (!res.ok) throw new Error("请求失败");
      const json = await res.json();
      if (controller.signal.aborted) {
        this.debug(`角色切换请求被取消（json 解析后检查 signal）`);
        return;
      }
      if (json && json.message) {
        this.debug(`角色切换请求成功 roleId=${roleId || "通用"}`);
        this.messages = [json.message as ChatMessage];
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        this.debug(`角色切换请求被取消（catch AbortError）`);
        return;
      }
      if (controller.signal.aborted) return;
      this.error(`角色切换请求失败 error=${(err as Error).message}`);
    }
  }

  async send(question: string, delayMs = 100, roleId = ""): Promise<ChatMessage | null> {
    const q = question.trim();
    if (!q || this.loading) return null;
    const now = Date.now();
    if (now - this.lastSendTime < this.throttleMs) return null;
    this.lastSendTime = now;

    this.sendRequestId += 1;
    const myRequestId = this.sendRequestId;
    this.debug(`发送消息 requestId=${myRequestId} roleId=${roleId || "通用"} question=${q.slice(0, 50)}${q.length > 50 ? "..." : ""}`);

    if (this.sendAbortController) {
      this.debug(`取消上一条请求 requestId=${myRequestId - 1}`);
      this.sendAbortController.abort();
    }
    const myController = new AbortController();
    this.sendAbortController = myController;

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", content: q };
    this.messages = [...this.messages, userMsg];
    this.loading = true;

    const timeoutTimer = setTimeout(() => {
      this.debug(`请求超时（${this.sendTimeoutMs}ms），自动取消 requestId=${myRequestId}`);
      const lastRecord = this.fetchRecords[this.fetchRecords.length - 1];
      if (lastRecord) lastRecord.timeout = true;
      myController.abort();
    }, this.sendTimeoutMs);

    try {
      const res = await this.mockFetch(`/api/monitor/chat`, {
        method: "POST",
        body: JSON.stringify({ question: q, roleId: roleId || undefined }),
        signal: myController.signal,
        delayMs,
      });
      if (myController.signal.aborted) {
        this.debug(`请求被取消（fetch 返回后检查 signal） requestId=${myRequestId}`);
        return null;
      }
      const json = await res.json();
      if (myController.signal.aborted) {
        this.debug(`请求被取消（json 解析后检查 signal） requestId=${myRequestId}`);
        return null;
      }
      if (myRequestId !== this.sendRequestId) {
        this.debug(`结果被丢弃（有更新的请求） requestId=${myRequestId} current=${this.sendRequestId}`);
        return null;
      }
      if (json && json.message) {
        this.debug(`请求成功 requestId=${myRequestId} contentLength=${json.message.content.length}`);
        this.messages = [...this.messages, json.message];
        return json.message;
      }
      return null;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        this.debug(`请求被取消（catch AbortError） requestId=${myRequestId}`);
        return null;
      }
      if (myRequestId !== this.sendRequestId) {
        this.debug(`错误被丢弃（有更新的请求） requestId=${myRequestId}`);
        return null;
      }
      this.error(`请求失败 requestId=${myRequestId} error=${(err as Error).message}`);
      const errorMsg: ChatMessage = { id: `e_${Date.now()}`, role: "assistant", content: "回答失败，请稍后重试。" };
      this.messages = [...this.messages, errorMsg];
      return null;
    } finally {
      clearTimeout(timeoutTimer);
      if (myRequestId === this.sendRequestId) {
        this.loading = false;
        if (this.sendAbortController === myController) {
          this.sendAbortController = null;
        }
      }
    }
  }
}

describe("聊天面板请求竞态与超时", () => {
  let sim: ChatPanelSimulator;

  beforeEach(() => {
    sim = new ChatPanelSimulator();
    sim.setThrottleMs(0);
  });

  describe("初始化加载", () => {
    it("正常初始化加载成功", async () => {
      await sim.initChat("src1", "https://example.com/doc1");

      expect(sim.messages.length).toBe(1);
      expect(sim.messages[0].role).toBe("assistant");
      expect(sim.initLoading).toBe(false);

      const successLogs = sim.getLogsByPrefix("初始化请求成功");
      expect(successLogs.length).toBe(1);
    });

    it("初始化加载失败显示错误消息", async () => {
      const simWithMock = sim as unknown as { mockFetch: MockFetchFn };
      const originalMockFetch = simWithMock.mockFetch.bind(sim);
      simWithMock.mockFetch = async () => {
        throw new Error("Network error");
      };

      await sim.initChat("src1", "https://example.com/doc1");

      expect(sim.messages.length).toBe(1);
      expect(sim.messages[0].content).toContain("加载失败");

      const errorLogs = sim.getLogsByPrefix("初始化请求失败");
      expect(errorLogs.length).toBe(1);

      simWithMock.mockFetch = originalMockFetch;
    });

    it("快速切换文档时，旧的初始化请求被取消", async () => {
      const init1 = sim.initChat("src1", "https://example.com/doc1", 200);
      await vi.waitFor(() => sim.fetchRecords.length >= 1);

      const init2 = sim.initChat("src2", "https://example.com/doc2", 100);

      await Promise.allSettled([init1, init2]);

      expect(sim.fetchRecords.length).toBe(2);
      expect(sim.fetchRecords[0].aborted).toBe(true);
      expect(sim.fetchRecords[1].aborted).toBe(false);
      expect(sim.fetchRecords[1].success).toBe(true);
      expect(sim.fetchRecords[1].sourceId).toBe("src2");

      expect(sim.messages.length).toBe(1);

      const cancelLogs = sim.getLogsByPrefix("切换文档，取消上一个初始化请求");
      expect(cancelLogs.length).toBe(1);

      const abortLogs = sim.getLogsByPrefix("初始化请求被取消（catch AbortError）");
      expect(abortLogs.length).toBe(1);
    });
  });

  describe("角色切换竞态控制", () => {
    beforeEach(async () => {
      await sim.initChat("src1", "https://example.com/doc1");
    });

    it("快速切换角色时，只有最后一次成功", async () => {
      const initCount = sim.fetchRecords.length;

      const role1 = sim.changeRole("product_strategy", 200);
      await vi.waitFor(() => sim.fetchRecords.length >= initCount + 1);

      const role2 = sim.changeRole("policy_researcher", 150);
      await vi.waitFor(() => sim.fetchRecords.length >= initCount + 2);

      const role3 = sim.changeRole("public_affairs", 100);

      await Promise.allSettled([role1, role2, role3]);

      expect(sim.fetchRecords.length).toBe(initCount + 3);
      expect(sim.fetchRecords[initCount + 0].aborted).toBe(true);
      expect(sim.fetchRecords[initCount + 1].aborted).toBe(true);
      expect(sim.fetchRecords[initCount + 2].aborted).toBe(false);
      expect(sim.fetchRecords[initCount + 2].success).toBe(true);
      expect(sim.fetchRecords[initCount + 2].roleId).toBe("public_affairs");

      expect(sim.messages.length).toBe(1);
      expect(sim.messages[0].content).toContain("public_affairs");

      const cancelLogs = sim.getLogsByPrefix("角色再次切换，取消上一次角色切换请求");
      expect(cancelLogs.length).toBe(2);
    });

    it("角色切换：旧请求结果被正确丢弃", async () => {
      const initCount = sim.fetchRecords.length;

      const role1 = sim.changeRole("product_strategy", 300);
      await vi.waitFor(() => sim.fetchRecords.length >= initCount + 1);

      const role2 = sim.changeRole("policy_researcher", 50);

      await Promise.allSettled([role1, role2]);

      expect(sim.messages.length).toBe(1);
      expect(sim.messages[0].content).toContain("policy_researcher");

      const abortLogs = sim.getLogsByPrefix("角色切换请求被取消");
      expect(abortLogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("发送消息超时处理", () => {
    let initRecordCount: number;
    let initSuccessLogCount: number;

    beforeEach(async () => {
      await sim.initChat("src1", "https://example.com/doc1");
      initRecordCount = sim.fetchRecords.length;
      initSuccessLogCount = sim.getLogsByPrefix("请求成功").length;
    });

    it("发送消息超过超时时间自动取消", async () => {
      sim.setTimeoutMs(100);

      const result = await sim.send("测试超时的问题", 200);

      expect(result).toBeNull();
      expect(sim.fetchRecords[initRecordCount].timeout).toBe(true);
      expect(sim.fetchRecords[initRecordCount].aborted).toBe(true);
      expect(sim.loading).toBe(false);

      const timeoutLogs = sim.getLogsByPrefix("请求超时");
      expect(timeoutLogs.length).toBe(1);
      expect(timeoutLogs[0].message).toContain("100ms");

      const abortLogs = sim.getLogsByPrefix("请求被取消（catch AbortError）");
      expect(abortLogs.length).toBe(1);
    }, 3000);

    it("请求在超时前完成，不触发超时", async () => {
      sim.setTimeoutMs(5000);

      const result = await sim.send("正常问题", 100);

      expect(result).not.toBeNull();
      expect(sim.fetchRecords[initRecordCount].timeout).toBe(false);
      expect(sim.fetchRecords[initRecordCount].success).toBe(true);
      expect(sim.loading).toBe(false);

      const timeoutLogs = sim.getLogsByPrefix("请求超时");
      expect(timeoutLogs.length).toBe(0);

      const successLogs = sim.getLogsByPrefix("请求成功");
      expect(successLogs.length).toBe(initSuccessLogCount + 1);
    }, 3000);

    it("超时后不显示错误消息，loading 状态正确重置", async () => {
      sim.setTimeoutMs(50);

      await sim.send("超时测试问题", 200);

      const assistantMessages = sim.messages.filter((m) => m.role === "assistant");
      expect(assistantMessages.length).toBe(1);
      expect(assistantMessages[0].content).not.toContain("失败");
      expect(assistantMessages[0].content).not.toContain("超时");

      expect(sim.loading).toBe(false);
    }, 3000);

    it("极短超时立即取消请求", async () => {
      sim.setTimeoutMs(10);

      const result = await sim.send("极短超时测试", 500);

      expect(result).toBeNull();
      expect(sim.fetchRecords[initRecordCount].aborted).toBe(true);
      expect(sim.fetchRecords[initRecordCount].timeout).toBe(true);
      expect(sim.loading).toBe(false);

      const timeoutLogs = sim.getLogsByPrefix("请求超时");
      expect(timeoutLogs.length).toBe(1);
      expect(timeoutLogs[0].message).toContain("10ms");
    }, 3000);

    it("连续超时后新的正常请求仍能成功", async () => {
      sim.setTimeoutMs(50);

      const r1 = await sim.send("超时问题1", 200);
      expect(r1).toBeNull();
      expect(sim.fetchRecords[initRecordCount].timeout).toBe(true);

      const r2 = await sim.send("超时问题2", 200);
      expect(r2).toBeNull();
      expect(sim.fetchRecords[initRecordCount + 1].timeout).toBe(true);

      sim.setTimeoutMs(5000);
      const r3 = await sim.send("正常问题", 50);
      expect(r3).not.toBeNull();
      expect(sim.fetchRecords[initRecordCount + 2].timeout).toBe(false);
      expect(sim.fetchRecords[initRecordCount + 2].success).toBe(true);

      const assistantMessages = sim.messages.filter((m) => m.role === "assistant");
      expect(assistantMessages.length).toBe(2);

      const timeoutLogs = sim.getLogsByPrefix("请求超时");
      expect(timeoutLogs.length).toBe(2);

      const successLogs = sim.getLogsByPrefix("请求成功");
      expect(successLogs.length).toBe(initSuccessLogCount + 1);
    }, 3000);

    it("发送失败时显示错误消息", async () => {
      const simWithMock = sim as unknown as { mockFetch: MockFetchFn };
      const originalMockFetch = simWithMock.mockFetch.bind(sim);
      simWithMock.mockFetch = async () => {
        throw new Error("Network error");
      };

      const result = await sim.send("测试失败的问题");

      expect(result).toBeNull();
      expect(sim.loading).toBe(false);

      const assistantMessages = sim.messages.filter((m) => m.role === "assistant");
      expect(assistantMessages.length).toBe(2);
      expect(assistantMessages[1].content).toContain("失败");

      const errorLogs = sim.getLogsByPrefix("请求失败");
      expect(errorLogs.length).toBe(1);

      simWithMock.mockFetch = originalMockFetch;
    }, 3000);
  });

  describe("日志系统", () => {
    let initSuccessLogCount: number;

    beforeEach(async () => {
      await sim.initChat("src1", "https://example.com/doc1");
      initSuccessLogCount = sim.getLogsByPrefix("请求成功").length;
    });

    it("所有日志都以 [ChatPanel] 前缀开头", () => {
      sim.send("测试问题");

      for (const log of sim.logs) {
        expect(log.message).toContain("[ChatPanel]");
      }
    });

    it("成功发送消息的完整日志链路", async () => {
      await sim.send("测试日志链路", 50);

      const sendLogs = sim.getLogsByPrefix("发送消息");
      const successLogs = sim.getLogsByPrefix("请求成功");

      expect(sendLogs.length).toBe(1);
      expect(successLogs.length).toBe(initSuccessLogCount + 1);
      expect(sendLogs[0].timestamp).toBeLessThan(successLogs[successLogs.length - 1].timestamp);
    });

    it("角色切换时的取消日志顺序正确", async () => {
      const initCount = sim.fetchRecords.length;

      const role1 = sim.changeRole("product_strategy", 200);
      await vi.waitFor(() => sim.fetchRecords.length >= initCount + 1);
      const role2 = sim.changeRole("policy_researcher", 50);
      await Promise.allSettled([role1, role2]);

      const cancelLog = sim.getLogsByPrefix("角色再次切换，取消上一次角色切换请求");
      const switchLogs = sim.getLogsByPrefix("切换角色");

      expect(cancelLog.length).toBe(1);
      expect(switchLogs.length).toBe(2);

      const firstSwitchIdx = sim.logs.findIndex((l) => l.message.includes("切换角色") && l.message.includes("product_strategy"));
      const cancelIdx = sim.logs.findIndex((l) => l.message.includes("角色再次切换，取消上一次角色切换请求"));
      const secondSwitchIdx = sim.logs.findIndex((l) => l.message.includes("切换角色") && l.message.includes("policy_researcher"));

      expect(firstSwitchIdx).toBeGreaterThanOrEqual(0);
      expect(cancelIdx).toBeGreaterThanOrEqual(0);
      expect(secondSwitchIdx).toBeGreaterThanOrEqual(0);
      expect(cancelIdx).toBeGreaterThan(firstSwitchIdx);
      expect(secondSwitchIdx).toBeGreaterThan(cancelIdx);
    });
  });
});
