import type { MonitorListItem } from "@/lib/monitor/types";

/**
 * 国家互联网信息办公室（www.cac.gov.cn）栏目列表抓取器
 *
 * CAC 是 SSR 静态站，各栏目页为 A0xxxx 系列（政策法规 /wxzw/zcfg/、
 * 规范性文件、规章 等）。文章 URL 走政府通用日期化：
 *   //www.cac.gov.cn/2026-08/21/c_xxx.htm
 * 列表结构：<li><h5><a href=//www.cac.gov.cn/2026-08/21/c_xxx.htm target=_blank title="标题"></a>
 *            <div class="times">2026-08-21</div></li>
 * 注意：文章 <a> 的 href 常常是【无引号】的（href=//...），title 用双引号。
 * 生成式 AI/算法/数据治理等法规的发布主源。
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 匹配 CAC 站内文章链接：日期化路径 + c_ 开头的文章 id
const ARTICLE_HREF = /(?:https?:)?\/\/(?:www\.)?cac\.gov\.cn\/\d{4}-\d{2}\/\d{2}\/c_\d+\.htm/i;

function resolveUrl(href: string): string {
  const h = href.trim();
  if (h.startsWith("http")) return h;
  if (h.startsWith("//")) return "https:" + h;
  return "https://www.cac.gov.cn" + (h.startsWith("/") ? "" : "/") + h;
}

// 从 <a 开标签提取属性值（href 常无引号，需兼容三种写法）
function attr(openTag: string, name: string): string {
  const re = new RegExp(
    name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))',
    "i",
  );
  const m = re.exec(openTag);
  if (!m) return "";
  return (m[1] ?? m[2] ?? m[3] ?? "").trim();
}

export function parseCacHtml(html: string): MonitorListItem[] {
  const items: MonitorListItem[] = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(html)) !== null) {
    const li = m[1];
    const aRe = /<a\b[^>]*>/gi;
    let am: RegExpExecArray | null;
    let found: { title: string; url: string } | null = null;
    while ((am = aRe.exec(li)) !== null) {
      const href = attr(am[0], "href");
      if (!ARTICLE_HREF.test(href)) continue;
      const title = attr(am[0], "title").replace(/\s+/g, " ").trim();
      if (!title) continue;
      found = { title, url: resolveUrl(href) };
      break;
    }
    if (!found) continue;
    // 日期：同 li 的 div.times / 任意 YYYY-MM-DD，其次链接里的 YYYY-MM/DD
    const dm = /(\d{4}-\d{2}-\d{2})/.exec(li);
    if (!dm) continue;
    if (items.some((x) => x.url === found!.url)) continue;
    items.push({ title: found.title, url: found.url, listPublishedAt: dm[1] });
  }
  return items;
}

export async function fetchCacColumnLatest(
  listUrl: string,
  limit: number,
): Promise<MonitorListItem[]> {
  const response = await fetch(listUrl, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`CAC 抓取失败: ${response.status}`);
  }
  const html = await response.text();
  return parseCacHtml(html).slice(0, limit);
}
