import type { MonitorListItem } from "@/lib/monitor/types";

// 通用 RSS / Atom feed 抓取器
// 支持格式：RSS 2.0、Atom 1.0
// 用法：在 runner.ts 里注册 type = "rss_feed"，listUrl 填 feed 地址

export async function fetchRssFeed(feedUrl: string, limit: number): Promise<MonitorListItem[]> {
  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CreatorIntelBot/1.0)",
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const isAtom = xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"");

  return isAtom ? parseAtom(xml, limit) : parseRss(xml, limit);
}

function parseRss(xml: string, limit: number): MonitorListItem[] {
  const items: MonitorListItem[] = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks.slice(0, limit)) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link") || extractAttr(block, "link", "href");
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "dc:date");

    if (!title || !link) continue;
    items.push({
      title: decodeEntities(title),
      url: link.trim(),
      listPublishedAt: normalizeDate(pubDate),
    });
  }

  return items;
}

function parseAtom(xml: string, limit: number): MonitorListItem[] {
  const items: MonitorListItem[] = [];
  const entryBlocks = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];

  for (const block of entryBlocks.slice(0, limit)) {
    const title = extractTag(block, "title");
    // Atom link: <link href="..." rel="alternate"/> or <link href="..."/>
    const link =
      extractAttrWhere(block, "link", "href", "alternate") ||
      extractAttrWhere(block, "link", "href", "") ||
      extractAttr(block, "link", "href");
    const published = extractTag(block, "published") || extractTag(block, "updated");

    if (!title || !link) continue;
    items.push({
      title: decodeEntities(title),
      url: link.trim(),
      listPublishedAt: normalizeDate(published),
    });
  }

  return items;
}

// 提取 <tag>内容</tag>，兼容 CDATA
function extractTag(xml: string, tag: string): string {
  const m =
    xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i")) ||
    xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

// 提取 <tag attr="value"/> 形式
function extractAttr(xml: string, tag: string, attr: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, "i"));
  return m ? m[1].trim() : "";
}

// 提取带特定 rel 的 <link rel="alternate" href="..."/>，rel 为空则匹配无 rel 的
function extractAttrWhere(xml: string, tag: string, attr: string, rel: string): string {
  const relPattern = rel ? `rel=["']${rel}["'][^>]*` : `(?!.*rel=)`;
  const m = xml.match(
    new RegExp(`<${tag}[^>]*${relPattern}\\s${attr}=["']([^"']+)["'][^>]*>`, "i"),
  ) || xml.match(
    new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*${relPattern}>`, "i"),
  );
  return m ? m[1].trim() : "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeDate(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw.trim());
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}
