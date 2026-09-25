// 中华人民共和国交通运输部（www.mot.gov.cn）各栏目列表抓取器
// 适用栏目：时政要闻 / 交通要闻 / 政策解读 / 图片新闻 / 新闻发布会 /
//           数据开放 / 公路水路 / 铁路 / 民航 / 邮政 / 城市客运 /
//           港口货物旅客吞吐量 / 固定资产投资 / 行业公报 / 经济分析 /
//           运力分析 / 沿海散货运价指数 / 出口集装箱运价指数 /
//           长江航运指数分析 / 珠江水运经济运行分析 / 在线访谈等
//
// 注：规章（xxgk.mot.gov.cn/gz/）与行政规范性文件（xxgk.mot.gov.cn/xzgfxwj/）
//     通常是政府信息公开站的体裁分类，HTML 结构与主站略有不同，本模块尽力适配。

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

// 交通运输部主站（mot.gov.cn）的文档链接识别规则：
//   · 内容页典型：/202506/t20250612_xxxxxxx.html 或 .shtml
//   · 或 /xxx/202506/t20250612_xxxxxxx.html
//   · 规章/公开站：xxgk.mot.gov.cn/gz/ 目录下的文档
//   · 或者是 /index.html 这类列表页本身要排除（以避免重复抓取）
function isMotDocument(url: string): boolean {
  // 先排除明显的图片 / 外部广告 / 列表页路径
  if (/\.(png|jpe?g|gif|bmp|webp|svg|css|js|mp4|mp3)$/i.test(url)) return false;
  // 以 index.html / index.shtml 结尾，通常是栏目首页本身（不是文章）
  if (/\/index(\.(?:s?html?|htm))?$/i.test(url)) return false;

  // PDF 视为文档
  if (/\.pdf$/i.test(url)) return true;

  // 纯数字日期的内容页
  if (/\/t?20\d{6,}_\d+\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{2}[-_]?\d{2}[-_/]\d{2}[_\-/].*\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{4,}\/t?20\d{6,}_?\d*\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{2}\/\d{2}\/\d{2}\/.*\.(?:s?html?|htm)$/i.test(url)) return true;

  // 规章站：xxgk.mot.gov.cn/gz/... / ...html
  if (/xxgk\.mot\.gov\.cn\/.*\.(?:s?html?|htm)$/i.test(url)) return true;

  // 主站各栏目（xinwen / gongkai / shuiju / ...）下的 html 文档
  if (/mot\.gov\.cn\/(?:xinwen|gongkai|shuju|hdjl|jtysswh|jtyss|zcfg|xxgk)\/.+\.(?:s?html?|htm)$/i.test(url)) {
    return true;
  }

  // 兜底：任何以 .htm/.html/.shtml 结尾且含日期信息的 URL
  if (/\.(?:s?html?|htm)$/i.test(url) && /20\d{2}/.test(url)) {
    return true;
  }
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

  // 日期从 <a> 以外寻找
  const outsideAnchor = liHtml.replace(/<a\b[\s\S]*?<\/a>/gi, " ");

  let date = "";
  const spanDate = /<span[^>]*>(?:\s|&nbsp;)*(\d{4}-\d{2}-\d{2})(?:\s|&nbsp;)*<\/span>/i.exec(outsideAnchor);
  if (spanDate) {
    date = spanDate[1];
  } else {
    const blockDate = /class="[^"]*(?:date|time|day|发布|日期|time|sj|fbtime)[^"]*"[^>]*>\s*(\d{4}-\d{2}-\d{2})/i.exec(outsideAnchor);
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

  // 月份/日期数字格式：2025-6-12 或 2025/6/12，再兜底
  if (!date) {
    const loose = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(outsideAnchor);
    if (loose) {
      date = `${loose[1]}-${String(loose[2]).padStart(2, "0")}-${String(loose[3]).padStart(2, "0")}`;
    }
  }

  if (!date) return null;
  if (!isValidDateStr(date)) return null;

  const url = normalizeUrl(href, baseUrl);
  if (!isMotDocument(url) && !/\.pdf$/i.test(url)) return null;

  return { title, url, listPublishedAt: date };
}

// 常见的列表容器 class，交通运输部主站使用的类名
const KNOWN_CONTAINER_PATTERNS = [
  /<ul[^>]*class="[^"]*(?:list|news|xw|wzlb|item|news[_-]?list|news[_-]?box|content[_-]?list|page[_-]?list)[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
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

export async function fetchMotListLatest(
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
