import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseNcacHtml } from "@/lib/monitor/ncac-list";

// 真实页面 fixture：从 www.ncac.gov.cn 通知公告栏目（xxfb/tzgg/）原样截取，
// 覆盖 <ul class="m2newsList"><li class="ellipsis"> + 相对 href + <span> 日期的结构。
const REAL_HTML = readFileSync(
  fileURLToPath(new URL("./fixtures/ncac-list-real.html", import.meta.url)),
  "utf-8",
);
const LIST_URL = "https://www.ncac.gov.cn/xxfb/tzgg/";

describe("parseNcacHtml — 真实页面片段", () => {
  it("解析出全部 5 条,相对 href 基于 listUrl 解析、标题折叠空白", () => {
    const items = parseNcacHtml(REAL_HTML, LIST_URL);
    expect(items).toHaveLength(5);
    expect(items[0]).toEqual({
      title: "国家版权局关于印发《版权工作“十五五”规划》的通知",
      url: "https://www.ncac.gov.cn/xxfb/tzgg/202609/t20260907_1007129.html",
      listPublishedAt: "2026-09-07",
    });
    expect(items[4]).toEqual({
      title: "2026年度第九批重点作品版权保护预警名单（院线电影）",
      url: "https://www.ncac.gov.cn/xxfb/tzgg/202607/t20260703_997771.html",
      listPublishedAt: "2026-07-03",
    });
  });

  it("listUrl 不带尾部斜杠时解析结果一致", () => {
    const items = parseNcacHtml(REAL_HTML, "https://www.ncac.gov.cn/xxfb/tzgg");
    expect(items[0].url).toBe(
      "https://www.ncac.gov.cn/xxfb/tzgg/202609/t20260907_1007129.html",
    );
  });
});

describe("parseNcacHtml — 边界与防御", () => {
  it("忽略非 ellipsis 的 li", () => {
    const html = `
      <ul class="m2newsList">
        <li><a href="./202608/t20260812_1000000.html">普通li</a><span>2026-08-12</span></li>
        <li class="ellipsis"><a href="./202608/t20260812_1000001.html">真条目</a><span>2026-08-12</span></li>
      </ul>`;
    const items = parseNcacHtml(html, LIST_URL);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("真条目");
  });

  it("忽略 # / javascript: / 非 t 文章 链接", () => {
    const html = `
      <ul class="m2newsList">
        <li class="ellipsis"><a href="#">占位</a><span>2026-08-12</span></li>
        <li class="ellipsis"><a href="javascript:void(0)">脚本</a><span>2026-08-12</span></li>
        <li class="ellipsis"><a href="./202608/about.html">非文章页</a><span>2026-08-12</span></li>
        <li class="ellipsis"><a href="./202608/t20260812_1000002.html">真条目</a><span>2026-08-12</span></li>
      </ul>`;
    const items = parseNcacHtml(html, LIST_URL);
    expect(items).toHaveLength(1);
    expect(items[0].url).toContain("t20260812_1000002.html");
  });

  it("缺日期或标题的 li 被跳过", () => {
    const html = `
      <ul class="m2newsList">
        <li class="ellipsis"><a href="./202608/t20260812_1000003.html">无日期</a></li>
        <li class="ellipsis"><a href="./202608/t20260812_1000004.html"></a><span>2026-08-12</span></li>
      </ul>`;
    expect(parseNcacHtml(html, LIST_URL)).toHaveLength(0);
  });
});
