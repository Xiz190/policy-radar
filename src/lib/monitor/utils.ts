import { DEFAULT_MONITOR_SOURCES } from "@/lib/monitor/config";

export function getMonitorSourceDisplayName(sourceId: string) {
  return DEFAULT_MONITOR_SOURCES.find((source) => source.id === sourceId)?.displayName ?? sourceId;
}

export function isDemoItem(item: { sourceId?: string; url?: string }): boolean {
  if (!item.sourceId && !item.url) return true;
  if (item.sourceId) {
    if (item.sourceId.startsWith("demo_")) return true;
    if (item.sourceId.startsWith("src_mock_")) return true;
    if (item.sourceId.startsWith("mock_")) return true;
  }
  if (!item.url) return true;
  try {
    const u = new URL(item.url);
    if (u.pathname.includes("/demo/") || u.pathname.startsWith("/demo")) return true;
    if (u.hostname === "example.com") return true;
    if (u.hostname.includes("example")) return true;
    if (u.hostname.includes("invalid")) return true;
    const simplePathPattern = /^\/[a-z0-9_-]+(-[a-z0-9_-]+)?-\d+$/;
    if (simplePathPattern.test(u.pathname)) return true;
    return false;
  } catch {
    return true;
  }
}

export function getHomepageFromDemo(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return url;
  }
}

export function normalizeItemUrl(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);

    const trackingKeys = new Set([
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "spm", "clickid", "gclid", "fbclid", "from", "ref", "referer", "referrer",
    ]);

    const keys = Array.from(u.searchParams.keys());
    for (const k of keys) {
      if (trackingKeys.has(k.toLowerCase())) u.searchParams.delete(k);
      const v = u.searchParams.get(k);
      if (v === null || v === "") u.searchParams.delete(k);
    }
    u.searchParams.sort();

    let p = u.pathname.replace(/\/+/g, "/");
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    u.pathname = p;

    return u.toString();
  } catch {
    return trimmed;
  }
}

