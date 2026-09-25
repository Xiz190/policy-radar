import type { MonitorListItem } from "@/lib/monitor/types";

// 中国政府网（www.gov.cn）多个栏目使用同样的数据结构：
//   页面通过 $ajax("./XXX.json") 拉取同级目录的 JSON 文件
//   JSON 结构：[{ TITLE, SUB_TITLE, URL, DOCRELPUBTIME }]
// 本文件提供统一的"列表页面 → JSON URL → MonitorListItem"解析器

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeUrl(rawUrl: string, base: string): string {
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  try {
    return new URL(rawUrl, base).toString();
  } catch {
    return rawUrl;
  }
}

function isValidDateStr(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  const now = new Date();
  if (year < 2000 || year > now.getUTCFullYear() + 1) return false;
  return true;
}

/**
 * 通用入口：传入列表页面 URL 和该页面的 JSON 文件名（或完整 JSON URL），
 * 解析成 MonitorListItem[]。
 *
 * @param listUrl 列表页面 URL（例如 https://www.gov.cn/yaowen/liebiao/）
 * @param jsonSource JSON 文件相对路径或完整 URL（例如 "YAOWENLIEBIAO.json"）
 * @param limit 最大条目数
 */
export async function fetchGovcnJsonList(
  listUrl: string,
  jsonSource: string,
  limit: number,
): Promise<MonitorListItem[]> {
  const jsonUrl = /^https?:\/\//i.test(jsonSource)
    ? jsonSource
    : new URL(jsonSource, listUrl).toString();

  const res = await fetch(jsonUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; SOLO monitor; +https://www.gov.cn/)",
      accept: "application/json, text/plain, */*",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`govcn JSON 抓取失败: ${res.status} ${res.statusText} (${jsonUrl})`);
  }

  // gov.cn 有时会在 JSON 前面塞点 BOM 或奇怪的前缀，做个兜底处理
  const rawText = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    const trimmed = rawText.replace(/^\s*\ufeff/, "").trim();
    if (!trimmed) return [];
    data = JSON.parse(trimmed);
  }

  if (!Array.isArray(data)) return [];

  const items: MonitorListItem[] = [];
  for (const rawRow of data) {
    const row = (rawRow && typeof rawRow === "object" ? rawRow : {}) as Record<string, unknown>;
    const title = row.TITLE || row.title;
    const url = row.URL || row.url;
    const date = row.DOCRELPUBTIME || row.docRelPubTime || row.pubTime;
    if (!title || !url || !date) continue;

    const titleStr = decodeHtmlEntities(String(title)).trim();
    const urlStr = normalizeUrl(String(url), listUrl);
    const dateStr = String(date).slice(0, 10);
    if (!titleStr || !urlStr) continue;
    if (!isValidDateStr(dateStr)) continue;

    items.push({ title: titleStr, url: urlStr, listPublishedAt: dateStr });
    if (items.length >= limit) break;
  }

  return items;
}

// —— 以下为三个栏目的快捷函数 ——
export const fetchGovcnYaowen = (limit = 50) =>
  fetchGovcnJsonList(
    "https://www.gov.cn/yaowen/liebiao/",
    "YAOWENLIEBIAO.json",
    limit,
  );

export const fetchGovcnZuixin = (limit = 50) =>
  fetchGovcnJsonList(
    "https://www.gov.cn/zhengce/zuixin/",
    "ZUIXINZHENGCE.json",
    limit,
  );

export const fetchGovcnZhongyang = (limit = 50) =>
  fetchGovcnJsonList(
    "https://www.gov.cn/zhengce/wenjian/zhongyang/",
    "TONGYONGLIEBIAODRQ.json",
    limit,
  );
