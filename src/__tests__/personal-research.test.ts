import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_STATUS_ICONS,
  FOLLOW_UP_STATUS_OPTIONS,
  getPersonalResearch,
  getNote,
  getFollowUpStatus,
  setNote,
  setFollowUpStatus,
  getAllPersonalResearch,
  getFollowUpCount,
  hasAnyPersonalResearch,
  type FollowUpStatus,
} from "@/lib/personal-research";

// 在 node 环境中 mock localStorage
const storage = new Map<string, string>();

const mockLocalStorage = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
  clear: vi.fn(() => {
    storage.clear();
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  length: 0,
  key: vi.fn(),
};

// @ts-expect-error - 模拟 window 对象用于测试
globalThis.window = { localStorage: mockLocalStorage };

describe("个人研究 - 常量与配置", () => {
  it("5 种跟进状态", () => {
    const statuses: FollowUpStatus[] = ["none", "to_read", "reading", "to_act", "done"];
    expect(statuses.length).toBe(5);
  });

  it("每个状态都有 label 和 icon", () => {
    const statuses: FollowUpStatus[] = ["none", "to_read", "reading", "to_act", "done"];
    for (const s of statuses) {
      expect(FOLLOW_UP_STATUS_LABELS[s], `${s} 缺少 label`).toBeTruthy();
      expect(FOLLOW_UP_STATUS_ICONS[s], `${s} 缺少 icon`).toBeTruthy();
    }
  });

  it("FOLLOW_UP_STATUS_OPTIONS 包含全部 5 种状态", () => {
    expect(FOLLOW_UP_STATUS_OPTIONS.length).toBe(5);
    for (const opt of FOLLOW_UP_STATUS_OPTIONS) {
      expect(opt.value).toBeTruthy();
      expect(opt.label).toBeTruthy();
      expect(opt.icon).toBeTruthy();
      expect(opt.desc).toBeTruthy();
    }
  });
});

describe("个人研究 - localStorage 读写", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  const sampleItem = {
    sourceId: "test-dept",
    url: "https://example.com/policy/123",
    title: "测试政策标题",
  };

  it("空存储下 getNote 返回空字符串", () => {
    expect(getNote(sampleItem.sourceId, sampleItem.url)).toBe("");
  });

  it("空存储下 getFollowUpStatus 返回 none", () => {
    expect(getFollowUpStatus(sampleItem.sourceId, sampleItem.url)).toBe("none");
  });

  it("空存储下 getPersonalResearch 返回 null", () => {
    expect(getPersonalResearch(sampleItem.sourceId, sampleItem.url)).toBeNull();
  });

  it("空存储下 hasAnyPersonalResearch 返回 false", () => {
    expect(hasAnyPersonalResearch()).toBe(false);
  });

  it("写入备注后可以正确读取", () => {
    const result = setNote(sampleItem.sourceId, sampleItem.url, sampleItem.title, "这是一条测试备注");
    expect(result.note).toBe("这是一条测试备注");
    expect(result.followUpStatus).toBe("none");
    expect(result.title).toBe(sampleItem.title);

    expect(getNote(sampleItem.sourceId, sampleItem.url)).toBe("这是一条测试备注");
    expect(hasAnyPersonalResearch()).toBe(true);
  });

  it("设置跟进状态后可以正确读取", () => {
    const result = setFollowUpStatus(sampleItem.sourceId, sampleItem.url, sampleItem.title, "to_read");
    expect(result.followUpStatus).toBe("to_read");
    expect(result.note).toBe("");

    expect(getFollowUpStatus(sampleItem.sourceId, sampleItem.url)).toBe("to_read");
    expect(hasAnyPersonalResearch()).toBe(true);
  });

  it("先写备注再改跟进状态，备注保留", () => {
    setNote(sampleItem.sourceId, sampleItem.url, sampleItem.title, "我的备注");
    setFollowUpStatus(sampleItem.sourceId, sampleItem.url, sampleItem.title, "to_act");

    const item = getPersonalResearch(sampleItem.sourceId, sampleItem.url);
    expect(item).not.toBeNull();
    expect(item?.note).toBe("我的备注");
    expect(item?.followUpStatus).toBe("to_act");
  });

  it("先设跟进状态再改备注，状态保留", () => {
    setFollowUpStatus(sampleItem.sourceId, sampleItem.url, sampleItem.title, "reading");
    setNote(sampleItem.sourceId, sampleItem.url, sampleItem.title, "新备注");

    const item = getPersonalResearch(sampleItem.sourceId, sampleItem.url);
    expect(item?.followUpStatus).toBe("reading");
    expect(item?.note).toBe("新备注");
  });

  it("清空备注后为空字符串", () => {
    setNote(sampleItem.sourceId, sampleItem.url, sampleItem.title, "先写一条");
    setNote(sampleItem.sourceId, sampleItem.url, sampleItem.title, "");
    expect(getNote(sampleItem.sourceId, sampleItem.url)).toBe("");
  });

  it("清除跟进状态后为 none", () => {
    setFollowUpStatus(sampleItem.sourceId, sampleItem.url, sampleItem.title, "done");
    setFollowUpStatus(sampleItem.sourceId, sampleItem.url, sampleItem.title, "none");
    expect(getFollowUpStatus(sampleItem.sourceId, sampleItem.url)).toBe("none");
  });

  it("不同政策的数据互不干扰", () => {
    setNote("dept-a", "url-1", "政策 A", "备注A");
    setFollowUpStatus("dept-b", "url-2", "政策 B", "to_read");

    expect(getNote("dept-a", "url-1")).toBe("备注A");
    expect(getFollowUpStatus("dept-a", "url-1")).toBe("none");
    expect(getNote("dept-b", "url-2")).toBe("");
    expect(getFollowUpStatus("dept-b", "url-2")).toBe("to_read");
  });

  it("getAllPersonalResearch 返回列表，数量正确", () => {
    setNote("dept-1", "url-1", "政策1", "第一个");
    setNote("dept-2", "url-2", "政策2", "第二个");

    const all = getAllPersonalResearch();
    expect(all.length).toBe(2);
  });

  it("getFollowUpCount 正确统计各状态数量", () => {
    setFollowUpStatus("d1", "u1", "p1", "to_read");
    setFollowUpStatus("d2", "u2", "p2", "to_read");
    setFollowUpStatus("d3", "u3", "p3", "to_act");
    setFollowUpStatus("d4", "u4", "p4", "done");

    expect(getFollowUpCount("to_read")).toBe(2);
    expect(getFollowUpCount("to_act")).toBe(1);
    expect(getFollowUpCount("done")).toBe(1);
    expect(getFollowUpCount("none")).toBe(0);
    expect(getFollowUpCount("reading")).toBe(0);
  });

  it("写入的数据包含 createdAt 和 updatedAt", () => {
    const result = setNote(sampleItem.sourceId, sampleItem.url, sampleItem.title, "测试");
    expect(result.createdAt).toBeTruthy();
    expect(result.updatedAt).toBeTruthy();
    expect(typeof result.createdAt).toBe("string");
    expect(typeof result.updatedAt).toBe("string");
  });

  it("tags 字段默认为空数组", () => {
    const result = setNote(sampleItem.sourceId, sampleItem.url, sampleItem.title, "测试");
    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags.length).toBe(0);
  });
});

describe("个人研究 - 边界情况", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("getAllPersonalResearch 空存储返回空数组", () => {
    expect(getAllPersonalResearch()).toEqual([]);
  });

  it("getFollowUpCount 空存储全部返回 0", () => {
    const statuses: FollowUpStatus[] = ["none", "to_read", "reading", "to_act", "done"];
    for (const s of statuses) {
      expect(getFollowUpCount(s)).toBe(0);
    }
  });

  it("存储损坏时静默降级（不抛异常）", () => {
    storage.set("policy_personal_research_v1", "invalid-json");
    expect(() => getNote("d", "u")).not.toThrow();
    expect(getNote("d", "u")).toBe("");
    expect(getFollowUpStatus("d", "u")).toBe("none");
  });

  it("来源 ID 和 URL 共同作为 key，只有其中一个相同不冲突", () => {
    setNote("dept-a", "url-1", "政策1", "备注1");
    setNote("dept-a", "url-2", "政策2", "备注2");
    setNote("dept-b", "url-1", "政策3", "备注3");

    expect(getNote("dept-a", "url-1")).toBe("备注1");
    expect(getNote("dept-a", "url-2")).toBe("备注2");
    expect(getNote("dept-b", "url-1")).toBe("备注3");
  });

  it("清除跟进状态（none）后，记录仍保留（备注不丢失）", () => {
    setNote("d1", "u1", "p1", "重要备注");
    setFollowUpStatus("d1", "u1", "p1", "done");
    setFollowUpStatus("d1", "u1", "p1", "none");

    const item = getPersonalResearch("d1", "u1");
    expect(item).not.toBeNull();
    expect(item?.followUpStatus).toBe("none");
    expect(item?.note).toBe("重要备注");
  });
});

describe("个人研究 - 存储失败容错", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  it("setItem 抛异常时不崩溃，静默降级", () => {
    mockLocalStorage.setItem.mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => setNote("d1", "u1", "p1", "测试备注")).not.toThrow();
  });

  it("存储失败后函数仍正常返回内存中的对象", () => {
    mockLocalStorage.setItem.mockImplementationOnce(() => {
      throw new Error("Write failed");
    });
    const result = setNote("d1", "u1", "p1", "测试备注");
    expect(result.note).toBe("测试备注");
    expect(result.followUpStatus).toBe("none");
  });

  it("getItem 抛异常时不崩溃，返回空记录", () => {
    mockLocalStorage.getItem.mockImplementationOnce(() => {
      throw new Error("Read failed");
    });
    expect(() => getNote("d1", "u1")).not.toThrow();
    expect(getNote("d1", "u1")).toBe("");
    expect(getFollowUpStatus("d1", "u1")).toBe("none");
    expect(hasAnyPersonalResearch()).toBe(false);
  });
});

describe("个人研究 - 数据损坏与字段缺失兼容", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("存储值为 null 时正常返回空记录", () => {
    // getItem 本身会返回 null，这是默认行为
    expect(getNote("d1", "u1")).toBe("");
    expect(getPersonalResearch("d1", "u1")).toBeNull();
  });

  it("某条记录缺少 note 字段，读取时用空字符串兜底", () => {
    const corruptedData = {
      "d1::u1": {
        sourceId: "d1",
        url: "u1",
        title: "测试",
        followUpStatus: "to_read",
        tags: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    storage.set("policy_personal_research_v1", JSON.stringify(corruptedData));
    expect(getNote("d1", "u1")).toBe("");
  });

  it("某条记录缺少 followUpStatus 字段，读取时用 none 兜底", () => {
    const corruptedData = {
      "d1::u1": {
        sourceId: "d1",
        url: "u1",
        title: "测试",
        note: "有备注",
        tags: [],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    storage.set("policy_personal_research_v1", JSON.stringify(corruptedData));
    expect(getFollowUpStatus("d1", "u1")).toBe("none");
  });

  it("某条记录缺少 tags 字段，getAllPersonalResearch 不崩溃", () => {
    const corruptedData = {
      "d1::u1": {
        sourceId: "d1",
        url: "u1",
        title: "测试",
        note: "备注",
        followUpStatus: "to_read",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    storage.set("policy_personal_research_v1", JSON.stringify(corruptedData));
    expect(() => getAllPersonalResearch()).not.toThrow();
    const all = getAllPersonalResearch();
    expect(all.length).toBe(1);
  });

  it("存储中是个空对象 {} 时正常工作", () => {
    storage.set("policy_personal_research_v1", "{}");
    expect(getAllPersonalResearch()).toEqual([]);
    expect(hasAnyPersonalResearch()).toBe(false);
    expect(getNote("d1", "u1")).toBe("");
  });
});

describe("个人研究 - 时间语义验证", () => {
  beforeEach(() => {
    storage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("新建记录时 createdAt === updatedAt", () => {
    vi.setSystemTime(new Date("2024-06-01T10:00:00.000Z"));
    const result = setNote("d1", "u1", "p1", "测试");
    expect(result.createdAt).toBe(result.updatedAt);
    expect(result.createdAt).toBe("2024-06-01T10:00:00.000Z");
  });

  it("更新备注时 updatedAt 变化、createdAt 不变", () => {
    vi.setSystemTime(new Date("2024-06-01T10:00:00.000Z"));
    const created = setNote("d1", "u1", "p1", "第一条");

    vi.advanceTimersByTime(3600 * 1000); // 1 小时后
    const updated = setNote("d1", "u1", "p1", "第二条");

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.updatedAt);
    expect(updated.updatedAt > created.updatedAt).toBe(true);
  });

  it("更新跟进状态时 updatedAt 变化、createdAt 不变", () => {
    vi.setSystemTime(new Date("2024-06-01T10:00:00.000Z"));
    const created = setFollowUpStatus("d1", "u1", "p1", "to_read");

    vi.advanceTimersByTime(1800 * 1000); // 30 分钟后
    const updated = setFollowUpStatus("d1", "u1", "p1", "done");

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.updatedAt);
  });

  it("getAllPersonalResearch 按 updatedAt 倒序排列", () => {
    vi.setSystemTime(new Date("2024-06-01T10:00:00.000Z"));
    setNote("d1", "u1", "最早的", "备注1");

    vi.advanceTimersByTime(1000);
    setNote("d2", "u2", "中间的", "备注2");

    vi.advanceTimersByTime(1000);
    setNote("d3", "u3", "最新的", "备注3");

    const all = getAllPersonalResearch();
    expect(all.length).toBe(3);
    expect(all[0].title).toBe("最新的");
    expect(all[1].title).toBe("中间的");
    expect(all[2].title).toBe("最早的");
  });
});

describe("个人研究 - 存储 key 与数据结构", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage.setItem.mockClear();
  });

  it("存储 key 为 policy_personal_research_v1", () => {
    setNote("d1", "u1", "p1", "测试");
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      "policy_personal_research_v1",
      expect.any(String),
    );
  });

  it("内部记录 key 格式为 sourceId::url", () => {
    setNote("my-dept", "my-url", "p1", "测试");
    const raw = storage.get("policy_personal_research_v1");
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw!);
    expect(data["my-dept::my-url"]).toBeTruthy();
  });

  it("空字符串 sourceId / url 也能正常工作", () => {
    expect(() => setNote("", "", "无题", "备注")).not.toThrow();
    expect(getNote("", "")).toBe("备注");
  });

  it("写入的数据是合法 JSON，可被 JSON.parse 正确解析", () => {
    setNote("d1", "u1", "p1", "测试备注");
    const raw = storage.get("policy_personal_research_v1");
    expect(() => JSON.parse(raw!)).not.toThrow();

    const parsed = JSON.parse(raw!);
    const item = parsed["d1::u1"];
    expect(item.sourceId).toBe("d1");
    expect(item.url).toBe("u1");
    expect(item.title).toBe("p1");
    expect(item.note).toBe("测试备注");
    expect(item.followUpStatus).toBe("none");
    expect(Array.isArray(item.tags)).toBe(true);
    expect(typeof item.createdAt).toBe("string");
    expect(typeof item.updatedAt).toBe("string");
  });
});

describe("个人研究 - SSR 安全（无 window 环境）", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    // @ts-expect-error - 模拟 SSR 环境
    delete globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("无 window 时 getNote 不崩溃，返回空字符串", () => {
    expect(() => getNote("d1", "u1")).not.toThrow();
    expect(getNote("d1", "u1")).toBe("");
  });

  it("无 window 时 getFollowUpStatus 返回 none", () => {
    expect(() => getFollowUpStatus("d1", "u1")).not.toThrow();
    expect(getFollowUpStatus("d1", "u1")).toBe("none");
  });

  it("无 window 时 getPersonalResearch 返回 null", () => {
    expect(getPersonalResearch("d1", "u1")).toBeNull();
  });

  it("无 window 时 getAllPersonalResearch 返回空数组", () => {
    expect(getAllPersonalResearch()).toEqual([]);
  });

  it("无 window 时 hasAnyPersonalResearch 返回 false", () => {
    expect(hasAnyPersonalResearch()).toBe(false);
  });

  it("无 window 时 setNote 不崩溃", () => {
    expect(() => setNote("d1", "u1", "p1", "测试")).not.toThrow();
  });

  it("无 window 时 setFollowUpStatus 不崩溃", () => {
    expect(() => setFollowUpStatus("d1", "u1", "p1", "to_read")).not.toThrow();
  });
});
