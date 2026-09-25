import type { MonitorListItem } from "@/lib/monitor/types";

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeUrl(url: string, base: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return new URL(url, base).toString();
}

function isRealDocumentLink(url: string) {
  // 体裁分类的真实详情页一般是 .../YYYYMM/tYYYYMMDD_xxxxxx.html 或 .../YYYYMM/tYYYYMMDD_xxxxxx.shtml
  return /\.html?$/i.test(url) && /(\/20\d{2,}|t20\d{6,}_\d+\.html$)/i.test(url);
}

function isValidDateStr(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  const now = new Date();
  const maxYear = now.getUTCFullYear() + 1;
  if (year < 2000 || year > maxYear) return false;
  return true;
}

export async function fetchMctZwgkGenreLatest(listUrl: string, limit: number): Promise<MonitorListItem[]> {
  const response = await fetch(listUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 SOLO monitor",
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`抓取失败: ${response.status}`);
  }

  const html = await response.text();
  const rightBoxStart = html.indexOf('<div class="rightBox');
  const paginationStart = html.indexOf('<div class="fanye_list">', rightBoxStart);
  const listHtml =
    rightBoxStart !== -1 && paginationStart !== -1 ? html.slice(rightBoxStart, paginationStart) : html;

  // 按 <li> 逐条处理，避免跨条目误匹配
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const items: MonitorListItem[] = [];
  let liMatch: RegExpExecArray | null;

  while ((liMatch = liPattern.exec(listHtml)) !== null) {
    if (items.length >= limit) break;
    const liInner = liMatch[1];

    const aMatch = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(liInner);
    if (!aMatch) continue;
    const href = aMatch[1].trim();
    const rawTitle = aMatch[2];
    const title = stripTags(rawTitle);
    if (!title || !href || href === "#" || href.startsWith("javascript:")) continue;

    // 日期从 <a> 以外区域寻找，避免把标题中的数字当成日期
    const outsideAnchor = liInner.replace(/<a\b[\s\S]*?<\/a>/gi, " ");

    let date = "";
    const dateSpan = /<span[^>]*class="[^"]*date[^"]*"[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/span>/i.exec(outsideAnchor);
    if (dateSpan) {
      date = dateSpan[1];
    } else {
      const dashDate = /(\d{4}-\d{2}-\d{2})/.exec(outsideAnchor);
      if (dashDate) date = dashDate[1];
    }
    if (!date) continue;
    if (!isValidDateStr(date)) continue;

    const url = normalizeUrl(href.trim(), listUrl);
    if (!isRealDocumentLink(url)) continue;
    if (items.some((item) => item.url === url)) continue;

    items.push({ title, url, listPublishedAt: date });
  }

  return items;
}
