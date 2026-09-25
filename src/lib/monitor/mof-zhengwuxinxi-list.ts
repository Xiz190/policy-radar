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
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

// 匹配文档链接：.htm / .html / .pdf（支持财政文告中的 PDF）
function isDocumentLink(url: string) {
  if (!/(\.html?$|\.pdf$)/i.test(url)) return false;
  // 还要排除明显不是文档的 URL（比如站点根目录）
  if (!/(\/20\d{2,}|\/t20\d{6,}_|\/content_|P020\d+\.pdf$|\.pdf$)/i.test(url)) {
    // 对于财政文告的 pdf 链接形如 ./wg2025/wg202512/202603/P020260330347121505841.pdf
    if (!/P020\d+\.pdf$/i.test(url)) return false;
  }
  return true;
}

// 在一个 <li> 片段里抽取：href, 标题（<a> 文本或 title 属性），日期（YYYY-MM-DD 或 YYYY年MM月DD日）
// —— 关键改进：
//   1) 日期从 <a> 以外的区域寻找（排除标题/正文中的误匹配日期）
//   2) 日期必须位于独立的 span/小文本区域，避免提取到标题里的 2024 等数字
//   3) 对抽取的日期做范围校验（1970-01-01 ~ today+1 天），明显无效的日期直接丢弃
function isValidDateStr(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  // 只保留 2000 ~ 当前年份+1 范围内的日期（排除明显错误或过期内容）
  const now = new Date();
  const maxYear = now.getUTCFullYear() + 1;
  if (year < 2000 || year > maxYear) return false;
  return true;
}

function extractFromListItem(liHtml: string, baseUrl: string): MonitorListItem | null {
  const hrefMatch = /<a[^>]+href="([^"]+)"[^>]*>/.exec(liHtml);
  if (!hrefMatch) return null;
  const href = hrefMatch[1].trim();
  if (!href || href === "#" || href.startsWith("javascript:")) return null;

  // 提取标题：优先用 title 属性，其次 <a>...</a> 之间的文本
  let title = "";
  const titleAttr = /<a[^>]+title="([^"]+)"[^>]*>/.exec(liHtml);
  if (titleAttr && titleAttr[1].trim()) {
    title = stripTags(titleAttr[1]);
  } else {
    const bodyMatch = /<a[^>]*>([\s\S]*?)<\/a>/.exec(liHtml);
    if (bodyMatch) title = stripTags(bodyMatch[1]);
  }
  if (!title) return null;

  // 提取日期：
  // ——从 <a> 标签"以外"的文本中找日期。先把 <a>...</a> 整块移除，再在剩余文本里找日期
  //   这样避免标题本身出现年份数字（如"关于 2024 年..."）被误当成发布日期
  const outsideAnchor = liHtml.replace(/<a\b[\s\S]*?<\/a>/gi, " ");

  let date = "";

  // 优先匹配 <span class="date"/time/日期样式> YYYY-MM-DD </span> 模式
  const spanDate = /<span[^>]*>(?:\s|&nbsp;)*(\d{4}-\d{2}-\d{2})(?:\s|&nbsp;)*<\/span>/i.exec(outsideAnchor);
  if (spanDate) {
    date = spanDate[1];
  } else {
    // 其次匹配 <time> / class 含 date/time 的块
    const blockDate = /class="[^"]*(?:date|time|day|发布|日期|time)[^"]*"[^>]*>\s*(\d{4}-\d{2}-\d{2})/i.exec(outsideAnchor);
    if (blockDate) {
      date = blockDate[1];
    } else {
      // 再退一步：在 <a> 以外区域里找第一个 YYYY-MM-DD
      const dashDate = /(\d{4}-\d{2}-\d{2})/.exec(outsideAnchor);
      if (dashDate) date = dashDate[1];
    }
  }

  // 如果上述都没命中，再尝试中文日期（"2024年5月23日"），同样仅在 <a> 以外区域
  if (!date) {
    const cnDate = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(outsideAnchor);
    if (cnDate) {
      const y = cnDate[1];
      const m = cnDate[2].padStart(2, "0");
      const d = cnDate[3].padStart(2, "0");
      date = `${y}-${m}-${d}`;
    }
  }

  if (!date) return null;
  if (!isValidDateStr(date)) return null; // 年份不在合理范围 → 丢弃

  const url = normalizeUrl(href, baseUrl);
  if (!isDocumentLink(url)) return null;

  return { title, url, listPublishedAt: date };
}

// 财政部（及国务院时政要闻）页面的三种常见容器
const KNOWN_CONTAINER_PATTERNS = [
  /<ul[^>]*class="[^"]*xwbd_lianbolistfrcon[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
  /<ul[^>]*class="[^"]*xwfb_listbox[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
  /<div[^>]*class="[^"]*news_box[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
];

function pickListHtml(html: string): string {
  for (const pattern of KNOWN_CONTAINER_PATTERNS) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      // 取容器中 <li> 条目数量最多的那个
      const best = matches.reduce((a, b) =>
        (a.match(/<li[\s>]/gi) || []).length >= (b.match(/<li[\s>]/gi) || []).length ? a : b,
      );
      if ((best.match(/<li[\s>]/gi) || []).length >= 3) return best;
    }
  }
  // 如果没有明确的容器，回退到整页（会按 URL 白名单过滤）
  return html;
}

export async function fetchMofZhengwuxinxiLatest(
  listUrl: string,
  limit: number,
): Promise<MonitorListItem[]> {
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
  const listHtml = pickListHtml(html);

  // 逐个 <li> 处理
  const liRe = /<li[^>]*>[\s\S]*?<\/li>/gi;
  const items: MonitorListItem[] = [];
  let match: RegExpExecArray | null;
  while ((match = liRe.exec(listHtml)) !== null) {
    if (items.length >= limit) break;
    const item = extractFromListItem(match[0], listUrl);
    if (item && !items.some((existing) => existing.url === item.url)) {
      items.push(item);
    }
  }

  return items;
}
