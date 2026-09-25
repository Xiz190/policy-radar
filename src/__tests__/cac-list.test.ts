import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCacHtml } from "@/lib/monitor/cac-list";

// 真实页面 fixture：从 www.cac.gov.cn 网信政务栏目（A0937index_1.htm）原样截取，
// 覆盖该站独有的「无引号 href + 双引号 title + <div class="times"> 日期」结构。
const REAL_HTML = readFileSync(
  fileURLToPath(new URL("./fixtures/cac-list-real.html", import.meta.url)),
  "utf-8",
);

describe("parseCacHtml — 真实页面片段", () => {
  it("解析出全部 5 条,url 规整为 https、日期取自 div.times", () => {
    const items = parseCacHtml(REAL_HTML);
    expect(items).toHaveLength(5);
    expect(items[0]).toEqual({
      title: "2026“把青春华章写在祖国大地上”大思政课网络主题宣传和互动引导活动在中国科学技术大学举行",
      url: "https://www.cac.gov.cn/2026-09/07/c_1790481801044829.htm",
      listPublishedAt: "2026-09-07",
    });
    expect(items[4]).toEqual({
      title: "庄荣文：提高网络生态治理效能 营造风清气正网络空间",
      url: "https://www.cac.gov.cn/2026-08/04/c_1787588881709766.htm",
      listPublishedAt: "2026-08-04",
    });
  });

  it("每条都是 CAC 日期化文章链接,且无重复 url", () => {
    const items = parseCacHtml(REAL_HTML);
    const urls = items.map((i) => i.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) {
      expect(u).toMatch(
        /^https:\/\/www\.cac\.gov\.cn\/\d{4}-\d{2}\/\d{2}\/c_\d+\.htm$/,
      );
    }
  });
});

describe("parseCacHtml — 边界与防御", () => {
  it("无文章链接的 li(导航/外链)被忽略", () => {
    const html = `
      <li><a href="/about/" title="关于我们">关于我们</a><div class="times">2026-01-01</div></li>
      <li><a href="https://example.com/x.htm" title="站外">站外</a><div class="times">2026-01-01</div></li>
      <li><h5><a href=//www.cac.gov.cn/2026-01/01/c_111.htm target=_blank title="一篇真文章">一篇真文章</a></h5><div class="times">2026-01-01</div></li>`;
    const items = parseCacHtml(html);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://www.cac.gov.cn/2026-01/01/c_111.htm");
  });

  it("缺日期的 li 被跳过", () => {
    const html = `
      <li><h5><a href=//www.cac.gov.cn/2026-01/01/c_222.htm target=_blank title="无日期">无日期</a></h5></li>`;
    expect(parseCacHtml(html)).toHaveLength(0);
  });

  it("缺 title 的文章链接被跳过", () => {
    const html = `
      <li><h5><a href=//www.cac.gov.cn/2026-01/01/c_333.htm target=_blank>无标题</a></h5><div class="times">2026-01-01</div></li>`;
    expect(parseCacHtml(html)).toHaveLength(0);
  });

  it("重复 url 去重", () => {
    const html = `
      <li><h5><a href=//www.cac.gov.cn/2026-01/01/c_444.htm target=_blank title="A">A</a></h5><div class="times">2026-01-01</div></li>
      <li><h5><a href=//www.cac.gov.cn/2026-01/01/c_444.htm target=_blank title="A">A</a></h5><div class="times">2026-01-01</div></li>`;
    expect(parseCacHtml(html)).toHaveLength(1);
  });

  it("已是 https 绝对地址的 href 原样保留", () => {
    const html = `
      <li><h5><a href="https://www.cac.gov.cn/2026-01/01/c_555.htm" target="_blank" title="绝对地址">绝对地址</a></h5><div class="times">2026-01-01</div></li>`;
    const items = parseCacHtml(html);
    expect(items[0].url).toBe("https://www.cac.gov.cn/2026-01/01/c_555.htm");
  });
});
