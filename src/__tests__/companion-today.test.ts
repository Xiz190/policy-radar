import { describe, expect, it } from "vitest";
import { pickRanked, summarize } from "@/lib/companion/today";
import type { ContentItem } from "@/hooks/use-item-list";

function makeItem(over: Partial<ContentItem>): ContentItem {
  return {
    sourceId: "s1",
    departmentName: "北京市人民政府",
    channelName: "政策文件",
    displayName: "北京市人民政府",
    url: "https://example.com/a",
    title: "关于促进人工智能产业发展的若干措施",
    listPublishedAt: "2026-09-17",
    firstSeenAt: "2026-09-17T00:00:00.000Z",
    isRead: false,
    isStarred: false,
    keywordScore: 0,
    importanceLevel: "普通内容",
    categories: [],
    genres: [],
    ...over,
  };
}

describe("Today · 今日重点", () => {
  it("按四档排序：核心关注 > 重点内容 > 中等重点 > 普通内容", () => {
    const items = [
      makeItem({ url: "d", importanceLevel: "普通内容" }),
      makeItem({ url: "b", importanceLevel: "重点内容" }),
      makeItem({ url: "c", importanceLevel: "中等重点" }),
      makeItem({ url: "a", importanceLevel: "核心关注" }),
    ];
    expect(pickRanked(items).map((i) => i.url)).toEqual(["a", "b", "c", "d"]);
  });

  it("同优先级时，收藏的排前面", () => {
    const items = [
      makeItem({ url: "a", importanceLevel: "重点内容" }),
      makeItem({ url: "b", importanceLevel: "重点内容", isStarred: true }),
    ];
    expect(pickRanked(items).map((i) => i.url)).toEqual(["b", "a"]);
  });

  it("同档同收藏时，关键词分高的排前面", () => {
    const items = [
      makeItem({ url: "a", keywordScore: 1 }),
      makeItem({ url: "b", keywordScore: 9 }),
    ];
    expect(pickRanked(items).map((i) => i.url)).toEqual(["b", "a"]);
  });

  it("最多返回 4 条", () => {
    const items = Array.from({ length: 9 }, (_, i) => makeItem({ url: `u${i}` }));
    expect(pickRanked(items)).toHaveLength(4);
  });

  it("不足 4 条时有几条给几条，不报错", () => {
    expect(pickRanked([])).toEqual([]);
    expect(pickRanked([makeItem({})])).toHaveLength(1);
  });

  it("不改动传入的数组（排序不应有副作用）", () => {
    const items = [makeItem({ url: "a" }), makeItem({ url: "b", importanceLevel: "核心关注" })];
    const before = items.map((i) => i.url);
    pickRanked(items);
    expect(items.map((i) => i.url)).toEqual(before);
  });
});

describe("Today · 计数", () => {
  const now = new Date("2026-09-25T12:00:00.000Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  it("只数近 24 小时新增；重点=核心关注+重点内容，中等重点不算", () => {
    const items = [
      makeItem({ url: "a", firstSeenAt: hoursAgo(1), importanceLevel: "核心关注" }),
      makeItem({ url: "b", firstSeenAt: hoursAgo(5), importanceLevel: "重点内容" }),
      makeItem({ url: "c", firstSeenAt: hoursAgo(23), importanceLevel: "中等重点" }),
      makeItem({ url: "d", firstSeenAt: hoursAgo(30), importanceLevel: "重点内容" }),
    ];
    expect(summarize(items, now)).toEqual({ fresh: 3, key: 2 });
  });

  it("缺 firstSeenAt 的条目不计入", () => {
    expect(summarize([makeItem({ url: "x", firstSeenAt: undefined as unknown as string })], now)).toEqual({ fresh: 0, key: 0 });
  });
});
