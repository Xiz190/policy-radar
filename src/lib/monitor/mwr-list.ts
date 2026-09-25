// 中华人民共和国水利部（www.mwr.gov.cn / spjc.mwr.gov.cn）各栏目抓取器
// 适用栏目：通知公告 / 政策法规 / 行政法规和法规性文件 / 部门规章、规范性文件 /
//           政策解读 / 时政要闻 / 水利要闻 / 新闻发布会 / 司局直属 / 地方水事 /
//           人民日报 / 新华社 / 光明日报 / 经济日报 / 中央人民广播电台 / 中央电视台 /
//           中国水利报社 / 其他媒体 / 网上展厅 / 中共中央国务院文件 /
//           通知公示 / 招标公告 / 水利部公报 / 重大会议信息 / 规划计划 /
//           法律 / 部门规章 / 规范性文件 / 政策解读 / 人事信息 / 财务信息 /
//           权责清单 / 审批公告 / 受理公示 / 信访制度 / 在线访谈等
//
// 子站说明：
//   · spjc.mwr.gov.cn —— 审批监督信息公开（政策法规栏目入口；
//   · www.mwr.gov.cn —— 主站（新闻/政务/专题等）。

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

// 水利部文档链接识别
//   · 主站内容页：/202506/t20250612_xxx.shtml 或 /xxx/2025-06/xxx.shtml
//   · 公开站：gz/... 或 xxgk/... 
//   · 政策法规/政策解读/规划计划等栏目
function isMwrDocument(url: string): boolean {
  if (/\.(png|jpe?g|gif|bmp|webp|svg|css|js|mp4|mp3)$/i.test(url)) return false;
  if (/\/index(\.(?:s?html?|htm|jsp))?$/i.test(url)) return false;

  if (/\.pdf$/i.test(url)) return true;
  if (/\.doc(x)?$/i.test(url)) return true;

  if (/\/t?20\d{6,}_\d+\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{2}[-_]?\d{2}[-_/]\d{2}[_\-/].*\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{4}\/t?20\d{6,}_?\d*\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{2}\/\d{2}\/\d{2}\/.*\.(?:s?html?|htm)$/i.test(url)) return true;

  if (/mwr\.gov\.cn\/(?:xw|zw|hdjl|xxgk|gongkai|gongkai\/zcfg)[^.]*\.(?:s?html?|htm|jsp)$/i.test(url)) {
    return true;
  }

  // spjc.mwr.gov.cn/.../xxx.html / xxx.jsp（公开站点）
  if (/spjc\.mwr\.gov\.cn.*\.(?:s?html?|htm|jsp)$/i.test(url)) return true;

  if (/\.(?:s?html?|htm|jsp)$/i.test(url) && /20\d{2}/.test(url)) return true;
  return false;
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

function extractFromListItem(liHtml: string, baseUrl: string): MonitorListItem | null {
  const hrefMatch = /<a[^>]+href="([^"]+)"[^>]*>/.exec(liHtml);
  if (!hrefMatch) return null;
  const href = hrefMatch[1].trim();
  if (!href || href === "#" || href.startsWith("javascript:")) return null;

  let title = "";
  const titleAttr = /<a[^>]+title="([^"]+)"[^>]*>/.exec(liHtml);
  if (titleAttr && titleAttr[1].trim()) {
    title = stripTags(titleAttr[1]);
  } else {
    const bodyMatch = /<a[^>]*>([\s\S]*?)<\/a>/.exec(liHtml);
    if (bodyMatch) title = stripTags(bodyMatch[1]);
  }
  if (!title) return null;

  const outsideAnchor = liHtml.replace(/<a\b[\s\S]*?<\/a>/gi, " ");

  let date = "";
  const spanDate = /<span[^>]*>(?:\s|&nbsp;)*(\d{4}-\d{2}-\d{2})(?:\s|&nbsp;)*<\/span>/i.exec(outsideAnchor);
  if (spanDate) {
    date = spanDate[1];
  } else {
    const blockDate = /class="[^"]*(?:date|time|day|发布|日期|time)[^"]*"[^>]*>\s*(\d{4}-\d{2}-\d{2})/i.exec(outsideAnchor);
    if (blockDate) {
      date = blockDate[1];
    } else {
      const dashDate = /(\d{4}-\d{2}-\d{2})/.exec(outsideAnchor);
      if (dashDate) date = dashDate[1];
    }
  }

  if (!date) {
    const cnDate = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(outsideAnchor);
    if (cnDate) {
      date = `${cnDate[1]}-${String(cnDate[2]).padStart(2, "0")}-${String(cnDate[3]).padStart(2, "0")}`;
    }
  }

  if (!date) {
    const loose = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(outsideAnchor);
    if (loose) {
      date = `${loose[1]}-${String(loose[2]).padStart(2, "0")}-${String(loose[3]).padStart(2, "0")}`;
    }
  }

  if (!date) return null;
  if (!isValidDateStr(date)) return null;

  const url = normalizeUrl(href, baseUrl);
  if (!isMwrDocument(url) && !/\.pdf$/i.test(url)) return null;

  return { title, url, listPublishedAt: date };
}

const KNOWN_CONTAINER_PATTERNS = [
  /<ul[^>]*class="[^"]*(?:list|news|xw|wzlb|item|news[_-]?list|news[_-]?box|content[_-]?list)[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
  /<div[^>]*class="[^"]*(?:news[_-]?box|list[_-]?box|content[_-]?box|article[_-]?list)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  /<table[^>]*>[\s\S]*?<\/table>/gi,
];

function pickListHtml(html: string): string {
  for (const pattern of KNOWN_CONTAINER_PATTERNS) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      const best = matches.reduce((a, b) =>
        (a.match(/<li[\s>]/gi) || []).length >= (b.match(/<li[\s>]/gi) || []).length ? a : b,
      );
      if ((best.match(/<li[\s>]/gi) || []).length >= 3) return best;
    }
  }
  return html;
}

export async function fetchMwrListLatest(
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
    throw new Error(`抓取失败: ${response.status} for ${listUrl}`);
  }

  const html = await response.text();
  const listHtml = pickListHtml(html);

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
