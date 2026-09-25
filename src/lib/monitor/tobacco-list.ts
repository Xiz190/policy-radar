// 国家烟草专卖局（www.tobacco.gov.cn）列表页抓取器
// 适用栏目：时政要闻 / 国务院信息 / 行业要闻 / 央媒报道 / 各地新闻 / 基层工作 /
// 通知公告 / 乡村振兴工作信息 / 相关政策 / 专卖管理 / 数字化转型 / 统计信息 /
// 人才招聘平台 / 培训信息 / 工作信息 / 政府网站工作年度报表 / 行业政策 /
// 相关标准 / 政策解读（综合业务/专卖业务/生产经营） / 在线访谈 / 专题专栏
//
// 页面结构（典型）：
//   <ul class="inTyList">
//     <li>
//       <a href="http://www.tobacco.gov.cn/gjyc/hyyw/202606/xxx.shtml" ...>标题</a>
//       <span class="date fr">2026-06-15</span>
//     </li>
//   </ul>
//   分页：createPageHTML("page_div", 50, 1, "szywlist", "shtml", 1000)
//         —— URL 规则为 {列表文件名}_{页码}.shtml

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
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
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

// 从 <li> 中抽取一条
function extractLi(li: string, base: string): MonitorListItem | null {
  const href = /<a[^>]+href="([^"]+)"[^>]*>/.exec(li);
  if (!href) return null;
  const url = normalizeUrl(href[1].trim(), base);
  if (!url || url === "#" || url.startsWith("javascript:")) return null;
  // 允许 tobacco.gov.cn 内部链接或任何第三方媒体外链
  if (!/^https?:\/\//i.test(url)) return null;
  if (!/\.(?:s?html?|htm|jsp|pdf)(?:[?#].*)?$/i.test(url)) return null;

  let title = "";
  const titleAttr = /<a[^>]+title="([^"]+)"[^>]*>/.exec(li);
  if (titleAttr && titleAttr[1].trim()) {
    title = stripTags(titleAttr[1]);
  } else {
    const body = /<a[^>]*>([\s\S]*?)<\/a>/.exec(li);
    if (body) title = stripTags(body[1]);
  }
  if (!title) return null;

  let date = "";
  const spanDate = /<span[^>]*>(?:\s|&nbsp;)*(\d{4}-\d{2}-\d{2})(?:\s|&nbsp;)*<\/span>/i.exec(li);
  if (spanDate) {
    date = spanDate[1];
  } else {
    const blockDate = /class="[^"]*(?:date|time|发布|日期)[^"]*"[^>]*>\s*(\d{4}-\d{2}-\d{2})/i.exec(li);
    if (blockDate) date = blockDate[1];
  }
  if (!date || !isValidDateStr(date)) return null;

  return { title, url, listPublishedAt: date };
}

// 从一个列表页的 HTML 中抽取条目
function parseListPage(html: string, base: string): MonitorListItem[] {
  // 优先找 <ul class="inTyList"> 这个烟草局专用列表容器
  const inTy = /<ul[^>]*class="[^"]*inTyList[^"]*"[^>]*>([\s\S]*?)<\/ul>/i.exec(html);
  let listBlock: string;
  if (inTy) {
    listBlock = inTy[1];
  } else {
    // 回退：若某个栏目结构不同，找包含 createPageHTML 的页面主列表区域
    // —— 选择 class 包含 "List" 或 "list" 或 "news"，且内部 li 数量 >= 3 的 <ul>
    const ulCandidates = Array.from(
      html.matchAll(/<ul[^>]*class="[^"]*[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi),
    );
    let best = "";
    let bestLi = -1;
    for (const cand of ulCandidates) {
      const clsAttr = /<ul[^>]*class="([^"]*)"/i.exec(cand[0]);
      if (!clsAttr) continue;
      const cls = clsAttr[1].toLowerCase();
      if (!/list|news|xw|wzlb|item/.test(cls)) continue;
      const liCount = (cand[1].match(/<li[\s>]/gi) || []).length;
      if (liCount > bestLi) {
        bestLi = liCount;
        best = cand[1];
      }
    }
    listBlock = bestLi >= 3 ? best : html;
  }

  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const items: MonitorListItem[] = [];
  const seen = new Set<string>();
  let m;
  while ((m = liRe.exec(listBlock))) {
    const item = extractLi(m[0], base);
    if (!item) continue;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    items.push(item);
  }
  return items;
}

// 解析分页脚本 createPageHTML('page_div', totalPages, currentPage, 'filename', 'ext', 1000)
// 返回 { filename, ext, totalPages } 或 null
function parsePagination(html: string): { filename: string; ext: string; totalPages: number } | null {
  const m = /createPageHTML\(\s*(?:"|')[^"']*(?:"|')\s*,\s*(\d+)\s*,\s*\d+\s*,\s*(?:"|')([^"']+)(?:"|')\s*,\s*(?:"|')([^"']+)(?:"|')\s*,\s*\d+\s*\)/.exec(html);
  if (!m) return null;
  return { filename: m[2], ext: m[3], totalPages: parseInt(m[1], 10) };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 SOLO monitor",
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`抓取失败: ${response.status} for ${url}`);
  return response.text();
}

// 为一个列表页生成后续分页的 URL
function buildPageUrls(listUrl: string, firstPageHtml: string, maxPagesPerSource: number, maxItems: number): string[] {
  const pagination = parsePagination(firstPageHtml);
  const result: string[] = [listUrl];
  if (!pagination || pagination.totalPages <= 1) return result;

  // 根据 URL 推断：第一页形式为 /gjyc/<栏目>/<filename>.shtml，
  // 第 N 页为 /gjyc/<栏目>/<filename>_N.shtml
  const filenameRe = /\/([^\/]+)\.(s?html?|htm|jsp)$/i.exec(listUrl);
  if (!filenameRe) return result;
  const baseFilename = filenameRe[1];
  const baseExt = filenameRe[2];
  if (baseFilename !== pagination.filename) {
    // URL 中的文件名与 createPageHTML 里的不一致：按实际给定的文件名构建
  }
  const effectiveFilename = pagination.filename;
  const effectiveExt = pagination.ext || baseExt;
  const prefix = listUrl.slice(0, listUrl.length - filenameRe[0].length);

  const pages = Math.min(pagination.totalPages, maxPagesPerSource);
  for (let i = 2; i <= pages; i++) {
    if (result.length * 20 >= Math.max(20, maxItems * 2)) break;
    result.push(`${prefix}/${effectiveFilename}_${i}.${effectiveExt}`);
  }
  return result;
}

export async function fetchTobaccoListLatest(
  listUrl: string,
  limit: number,
): Promise<MonitorListItem[]> {
  const MAX_PAGES = 5; // 最多翻 5 页，每页约 20 条 = 最多 100 条/栏
  const pageUrls: string[] = [];
  const firstHtml = await fetchHtml(listUrl);
  const firstItems = parseListPage(firstHtml, listUrl);
  pageUrls.push(listUrl);

  // 如果 limit 要求 > 单页数量，才翻页
  if (limit > firstItems.length) {
    const moreUrls = buildPageUrls(listUrl, firstHtml, MAX_PAGES, limit);
    for (const u of moreUrls) {
      if (pageUrls.includes(u)) continue;
      pageUrls.push(u);
      if (pageUrls.length >= MAX_PAGES) break;
    }
  }

  const seen = new Set<string>();
  const all: MonitorListItem[] = [];
  for (const item of firstItems) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    all.push(item);
  }

  for (let i = 1; i < pageUrls.length; i++) {
    if (all.length >= limit) break;
    try {
      const html = await fetchHtml(pageUrls[i]);
      const items = parseListPage(html, pageUrls[i]);
      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        all.push(item);
      }
    } catch (err) {
      console.debug(`[tobacco-list] 抓取 ${pageUrls[i]} 失败：`,
        err instanceof Error ? err.message : String(err));
    }
  }

  // 按日期倒序
  all.sort((a, b) => (a.listPublishedAt < b.listPublishedAt ? 1 : -1));
  return all.slice(0, limit);
}
