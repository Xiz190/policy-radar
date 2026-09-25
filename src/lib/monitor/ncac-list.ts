import type { MonitorListItem } from "@/lib/monitor/types";

/**
 * 国家版权局（www.ncac.gov.cn）栏目列表抓取器
 *
 * NCAC 是 SSR 站，栏目首页常套一层 JS 跳转壳（<script>location.href='./flfg_532/'</script>），
 * 真实列表在跳转后的栏目路径。列表结构（各栏目统一）：
 *   <ul class="m2newsList"><li class="ellipsis"><a href="./202608/t20260812_xxx.html">标题</a>…日期…</li></ul>
 * 标题在 <a> 文本，日期在 li 内 YYYY-MM-DD。
 * 版权政策/预警/监管动态主源（通知公告 tzgg / 要闻 ywxx / 法律法规 flfg_532）。
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function parseNcacHtml(html: string, listUrl: string): MonitorListItem[] {
  const items: MonitorListItem[] = [];
  const liRe = /<li[^>]*class="[^"]*\bellipsis\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(html)) !== null) {
    const li = m[1];
    const am = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(li);
    if (!am) continue;
    const href = am[1].trim();
    if (!href || href === "#" || href.startsWith("javascript:")) continue;
    if (!/t\d{8}_\d+\.html/i.test(href)) continue; // 只要文章链接（t+8位年月日）
    const title = stripTags(am[2]);
    if (!title) continue;
    const dm = /(\d{4}-\d{2}-\d{2})/.exec(li);
    if (!dm) continue;
    let url: string;
    try {
      url = new URL(href, listUrl.endsWith("/") ? listUrl : listUrl + "/").toString();
    } catch {
      continue;
    }
    if (items.some((x) => x.url === url)) continue;
    items.push({ title, url, listPublishedAt: dm[1] });
  }
  return items;
}

export async function fetchNcacColumnLatest(
  listUrl: string,
  limit: number,
): Promise<MonitorListItem[]> {
  const response = await fetch(listUrl, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`NCAC 抓取失败: ${response.status}`);
  }
  const html = await response.text();
  return parseNcacHtml(html, listUrl).slice(0, limit);
}
