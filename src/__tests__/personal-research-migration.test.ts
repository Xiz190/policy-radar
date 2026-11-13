import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  migrateLegacyInboxData,
  backfillResearchTitles,
  getPersonalResearch,
  setNote,
} from "@/lib/personal-research";

const storage = new Map<string, string>();
// @ts-expect-error - node 环境里模拟 window.localStorage
globalThis.window = {
  localStorage: {
    getItem: vi.fn((k: string) => storage.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void storage.set(k, v)),
    removeItem: vi.fn((k: string) => void storage.delete(k)),
    clear: vi.fn(() => storage.clear()),
    length: 0,
    key: vi.fn(),
  },
};

const K = (s: string, u: string) => `${s}__${u}`;

describe("旧的动态资讯本地数据并进待跟进", () => {
  beforeEach(() => storage.clear());

  it("稍后读→待读，置顶→待行动，标签按含义转换，便签进备注", () => {
    storage.set("inbox_reading_list", JSON.stringify([K("a", "https://x/1")]));
    storage.set("inbox_pinned_items", JSON.stringify([K("a", "https://x/2")]));
    storage.set("inbox_item_tags", JSON.stringify({ [K("b", "https://x/3")]: ["已处理", "资料"] }));
    storage.set("inbox_notes", JSON.stringify({ [K("a", "https://x/1")]: "试一下" }));

    const { moved } = migrateLegacyInboxData();
    expect(moved).toBe(5);
    expect(getPersonalResearch("a", "https://x/1")).toMatchObject({ followUpStatus: "to_read", note: "试一下" });
    expect(getPersonalResearch("a", "https://x/2")?.followUpStatus).toBe("to_act");
    expect(getPersonalResearch("b", "https://x/3")).toMatchObject({ followUpStatus: "done", tags: ["资料"] });
  });

  it("搬完删掉旧键、只执行一次", () => {
    storage.set("inbox_reading_list", JSON.stringify([K("a", "https://x/1")]));
    migrateLegacyInboxData();
    expect(storage.has("inbox_reading_list")).toBe(false);
    storage.set("inbox_reading_list", JSON.stringify([K("a", "https://x/9")]));
    expect(migrateLegacyInboxData().moved).toBe(0);
  });

  it("两边都写过备注就拼起来，不覆盖", () => {
    setNote("a", "https://x/1", "T", "详情页写的");
    storage.set("inbox_notes", JSON.stringify({ [K("a", "https://x/1")]: "列表里写的" }));
    migrateLegacyInboxData();
    expect(getPersonalResearch("a", "https://x/1")?.note).toBe("详情页写的\n\n列表里写的");
  });

  it("不降级已有状态：已完成的不会被稍后读改回待读", () => {
    storage.set("policy_personal_research_v1", JSON.stringify({ "a::https://x/1": { sourceId: "a", url: "https://x/1", title: "T", note: "", followUpStatus: "done", tags: [] } }));
    storage.set("inbox_reading_list", JSON.stringify([K("a", "https://x/1")]));
    migrateLegacyInboxData();
    expect(getPersonalResearch("a", "https://x/1")?.followUpStatus).toBe("done");
  });

  it("补标题只补空的", () => {
    storage.set("inbox_pinned_items", JSON.stringify([K("a", "https://x/2")]));
    migrateLegacyInboxData();
    expect(backfillResearchTitles([{ sourceId: "a", url: "https://x/2", title: "新标题" }])).toBe(1);
    expect(getPersonalResearch("a", "https://x/2")?.title).toBe("新标题");
    expect(backfillResearchTitles([{ sourceId: "a", url: "https://x/2", title: "别的" }])).toBe(0);
  });
});
