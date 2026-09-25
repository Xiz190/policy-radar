import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getMockDelayMs, mockDelay } from "@/lib/mock";

describe("通用 Mock 工具 - getMockDelayMs（环境变量读取）", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("未设置环境变量时返回 0", () => {
    delete process.env.MOCK_API_DELAY_MS;
    expect(getMockDelayMs()).toBe(0);
  });

  it("空字符串环境变量返回 0", () => {
    process.env.MOCK_API_DELAY_MS = "";
    expect(getMockDelayMs()).toBe(0);
  });

  it("有效数字字符串返回对应数值", () => {
    process.env.MOCK_API_DELAY_MS = "100";
    expect(getMockDelayMs()).toBe(100);

    process.env.MOCK_API_DELAY_MS = "0";
    expect(getMockDelayMs()).toBe(0);

    process.env.MOCK_API_DELAY_MS = "1500";
    expect(getMockDelayMs()).toBe(1500);
  });

  it("浮点数环境变量返回数值", () => {
    process.env.MOCK_API_DELAY_MS = "100.5";
    expect(getMockDelayMs()).toBe(100.5);
  });

  it("负数环境变量返回 0", () => {
    process.env.MOCK_API_DELAY_MS = "-100";
    expect(getMockDelayMs()).toBe(0);

    process.env.MOCK_API_DELAY_MS = "-1";
    expect(getMockDelayMs()).toBe(0);
  });

  it("非数字字符串返回 0", () => {
    process.env.MOCK_API_DELAY_MS = "abc";
    expect(getMockDelayMs()).toBe(0);

    process.env.MOCK_API_DELAY_MS = "100ms";
    expect(getMockDelayMs()).toBe(0);

    process.env.MOCK_API_DELAY_MS = "true";
    expect(getMockDelayMs()).toBe(0);
  });

  it("Infinity 等特殊值返回 0", () => {
    process.env.MOCK_API_DELAY_MS = "Infinity";
    expect(getMockDelayMs()).toBe(0);

    process.env.MOCK_API_DELAY_MS = "-Infinity";
    expect(getMockDelayMs()).toBe(0);

    process.env.MOCK_API_DELAY_MS = "NaN";
    expect(getMockDelayMs()).toBe(0);
  });

  it("前后有空白字符时仍能正确解析", () => {
    process.env.MOCK_API_DELAY_MS = "  100  ";
    expect(getMockDelayMs()).toBe(100);
  });
});

describe("通用 Mock 工具 - mockDelay（模拟延迟）", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  it("延迟为 0 时立即 resolve", async () => {
    process.env.MOCK_API_DELAY_MS = "0";
    const startTime = Date.now();
    const promise = mockDelay();
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(10);
  });

  it("未设置环境变量时立即 resolve", async () => {
    delete process.env.MOCK_API_DELAY_MS;
    const promise = mockDelay();
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBeUndefined();
  });

  it("延迟 100ms 时等待约 100ms", async () => {
    process.env.MOCK_API_DELAY_MS = "100";
    let resolved = false;
    const promise = mockDelay().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(50);
    await promise;
    expect(resolved).toBe(true);
  });

  it("延迟 1500ms 时等待约 1500ms", async () => {
    process.env.MOCK_API_DELAY_MS = "1500";
    let resolved = false;
    const promise = mockDelay().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(500);
    await promise;
    expect(resolved).toBe(true);
  });

  it("返回 Promise<void>", () => {
    process.env.MOCK_API_DELAY_MS = "100";
    const result = mockDelay();
    expect(result).toBeInstanceOf(Promise);
  });

  it("负数延迟时立即 resolve", async () => {
    process.env.MOCK_API_DELAY_MS = "-100";
    let resolved = false;
    const promise = mockDelay().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(resolved).toBe(true);
  });

  it("非数字延迟配置时立即 resolve", async () => {
    process.env.MOCK_API_DELAY_MS = "abc";
    let resolved = false;
    const promise = mockDelay().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(resolved).toBe(true);
  });

  it("多次调用 mockDelay 互不干扰", async () => {
    process.env.MOCK_API_DELAY_MS = "100";
    let count = 0;

    const p1 = mockDelay().then(() => count++);
    const p2 = mockDelay().then(() => count++);

    expect(count).toBe(0);

    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([p1, p2]);

    expect(count).toBe(2);
  });
});
