import { describe, expect, it } from "vitest";
import { keywordStrings, segmentByKeywords } from "@/lib/companion/highlight";

describe("正文关键词切分", () => {
  it("没有关键词时整段原样返回", () => {
    expect(segmentByKeywords("hello world", [])).toEqual([{ text: "hello world", hit: false }]);
    expect(segmentByKeywords("hello", ["   "])).toEqual([{ text: "hello", hit: false }]);
  });

  it("命中一个词时切成 前/中/后 三段", () => {
    expect(segmentByKeywords("a 算力 here", ["算力"])).toEqual([
      { text: "a ", hit: false },
      { text: "算力", hit: true },
      { text: " here", hit: false },
    ]);
  });

  it("词在开头或结尾时不产生空片段", () => {
    expect(segmentByKeywords("算力 edit", ["算力"])).toEqual([
      { text: "算力", hit: true },
      { text: " edit", hit: false },
    ]);
    expect(segmentByKeywords("use 算力", ["算力"])).toEqual([
      { text: "use ", hit: false },
      { text: "算力", hit: true },
    ]);
  });

  it("同一个词出现多次全部命中", () => {
    const segs = segmentByKeywords("算力 and 算力", ["算力"]);
    expect(segs.filter((s) => s.hit).map((s) => s.text)).toEqual(["算力", "算力"]);
  });

  it("长词优先：短的嵌套词不会把长词切碎", () => {
    const segs = segmentByKeywords("AI 智能体 tools", ["AI", "AI 智能体"]);
    const hits = segs.filter((s) => s.hit).map((s) => s.text);
    expect(hits).toEqual(["AI 智能体"]);
    // 拼接后必须与原文完全一致（切分不丢字、不重字）
    expect(segs.map((s) => s.text).join("")).toBe("AI 智能体 tools");
  });

  it("重复关键词只算一次", () => {
    const segs = segmentByKeywords("算力", ["算力", "算力", " 算力 "]);
    expect(segs).toEqual([{ text: "算力", hit: true }]);
  });

  it("没命中的词不影响切分", () => {
    const segs = segmentByKeywords("nothing here", ["absent"]);
    expect(segs).toEqual([{ text: "nothing here", hit: false }]);
  });

  it("任何情况下片段拼接都等于原文（不丢字不重字）", () => {
    const text = "本市发布人工智能产业发展措施，支持算力基础设施建设与数据要素流通";
    for (const kws of [[], ["算力"], ["人工智能", "数据"], ["数据", "数据要素"], ["产业", "人工智能产业"]]) {
      const joined = segmentByKeywords(text, kws)
        .map((s) => s.text)
        .join("");
      expect(joined, `关键词 ${JSON.stringify(kws)} 时切分失真`).toBe(text);
    }
  });

  it("空文本返回空数组", () => {
    expect(segmentByKeywords("", ["x"])).toEqual([]);
  });

  it("区分大小写（与桌面端口径一致，不能两端不一样）", () => {
    expect(segmentByKeywords("AI", ["ai"])).toEqual([{ text: "AI", hit: false }]);
  });
});

describe("从 matchedKeywords 取关键词", () => {
  it("取出并去掉空值", () => {
    expect(keywordStrings([{ keyword: "a" }, { keyword: "" }, { keyword: " b " }, {}])).toEqual(["a", "b"]);
  });

  it("undefined 返回空数组", () => {
    expect(keywordStrings(undefined)).toEqual([]);
  });
});
