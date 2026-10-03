import { describe, it, expect } from "vitest";
import { parseEmbeddedJsonList } from "@/lib/monitor/beijing-gov-list";

// 丰台「政策文件」等页面把列表藏在 <abbr id="json"> 里、HTML 的 <li> 是空的；通用解析器以前读不到任何条目

describe("parseEmbeddedJsonList", () => {
  const page = (json: string) => `<html><body><ul class="list"></ul><abbr id="json" style="display:none;">${json}</abbr></body></html>`;

  it("读出标题、日期、链接（相对链接按栏目页补全）", () => {
    const html = page(JSON.stringify([
      { title: "关于印发某某办法的通知", time: "2026-09-29", url: "https://www.bjft.gov.cn/xxfb/ftzcwj/ftbmwj/202609/t20260929_226388.shtml" },
      { title: "第二条", time: "2026-09-28 10:00", url: "./ftzfwj/202609/t20260928_1.shtml" },
    ]));
    expect(parseEmbeddedJsonList(html, "https://www.bjft.gov.cn/xxfb/ftzcwj/", 10)).toEqual([
      { title: "关于印发某某办法的通知", url: "https://www.bjft.gov.cn/xxfb/ftzcwj/ftbmwj/202609/t20260929_226388.shtml", listPublishedAt: "2026-09-29" },
      { title: "第二条", url: "https://www.bjft.gov.cn/xxfb/ftzcwj/ftzfwj/202609/t20260928_1.shtml", listPublishedAt: "2026-09-28" },
    ]);
  });

  it("缺标题/日期/链接的行跳过；同一链接只取一次；遵守条数上限", () => {
    const html = page(JSON.stringify([
      { title: "", time: "2026-09-01", url: "/a" },
      { title: "无日期", url: "/b" },
      { title: "A", time: "2026-09-02", url: "/c" },
      { title: "A 重复", time: "2026-09-02", url: "/c" },
      { title: "B", time: "2026-09-03", url: "/d" },
      { title: "C", time: "2026-09-04", url: "/e" },
    ]));
    expect(parseEmbeddedJsonList(html, "https://x.gov.cn/list/", 2).map((i) => i.title)).toEqual(["A", "B"]);
  });

  it("没有隐藏 JSON 或 JSON 坏掉时返回空数组（交回 HTML 解析）", () => {
    expect(parseEmbeddedJsonList("<ul><li>普通列表</li></ul>", "https://x.gov.cn/", 10)).toEqual([]);
    expect(parseEmbeddedJsonList(page("[{坏掉的"), "https://x.gov.cn/", 10)).toEqual([]);
  });
});
