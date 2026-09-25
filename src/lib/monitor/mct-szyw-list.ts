import type { MonitorListItem } from "@/lib/monitor/types";

const MCT_SZYW_URL = "https://www.mct.gov.cn/whzx/szyw/";

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return new URL(url, MCT_SZYW_URL).toString();
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

export async function fetchMctSzywLatest(limit: number): Promise<MonitorListItem[]> {
  const response = await fetch(MCT_SZYW_URL, {
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
  const trRegex = /<tr[\s\S]*?<\/tr>/g;
  const rows = html.match(trRegex) ?? [];
  const items: MonitorListItem[] = [];

  for (const row of rows) {
    if (!/class="bt_time"/.test(row)) {
      continue;
    }

    const anchorMatch = row.match(/<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"[^>]*>/);
    const dateMatch = row.match(/class="bt_time"[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/td>/);

    if (!anchorMatch || !dateMatch) {
      continue;
    }
    if (!isValidDateStr(dateMatch[1])) continue;

    items.push({
      title: decodeHtml(anchorMatch[2].trim()),
      url: normalizeUrl(anchorMatch[1].trim()),
      listPublishedAt: dateMatch[1],
    });

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

