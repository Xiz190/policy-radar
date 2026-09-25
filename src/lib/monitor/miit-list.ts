import type { MonitorListItem } from "@/lib/monitor/types";

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

function extractItemsFromHtml(html: string, baseUrl: string): MonitorListItem[] {
  const items: MonitorListItem[] = [];
  const liRe = /<li[^>]*>[\s\S]*?<\/li>/gi;
  let match: RegExpExecArray | null;
  
  while ((match = liRe.exec(html)) !== null) {
    const liHtml = match[0];
    
    const hrefMatch = /<a[^>]+href="([^"]+)"[^>]*>/.exec(liHtml);
    if (!hrefMatch) continue;
    const href = hrefMatch[1].trim();
    if (!href || href === "#" || href.startsWith("javascript:")) continue;
    
    const url = normalizeUrl(href, baseUrl);
    
    const titleAttr = /<a[^>]+title="([^"]+)"[^>]*>/.exec(liHtml);
    let title = "";
    if (titleAttr && titleAttr[1].trim()) {
      title = titleAttr[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    } else {
      const bodyMatch = /<a[^>]*>([\s\S]*?)<\/a>/.exec(liHtml);
      if (bodyMatch) {
        title = bodyMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }
    }
    if (!title) continue;
    
    const outsideAnchor = liHtml.replace(/<a\b[\s\S]*?<\/a>/gi, " ");
    const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(outsideAnchor);
    if (!dateMatch || !isValidDateStr(dateMatch[1])) continue;
    
    items.push({
      title,
      url,
      listPublishedAt: dateMatch[1],
    });
  }
  
  return items;
}

export async function fetchMiitListLatest(listUrl: string, limit: number): Promise<MonitorListItem[]> {
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
  
  const scriptMatch = /<script[^>]*id="[^"]*"[^>]*src="[^"]*"[^>]*queryData="([^"]+)"[^>]*><\/script>/i.exec(html);
  if (!scriptMatch) {
    throw new Error(`无法找到动态加载脚本的 queryData 参数`);
  }
  
  let queryData: Record<string, string>;
  try {
    const jsonStr = scriptMatch[1].replace(/'/g, '"');
    queryData = JSON.parse(jsonStr);
  } catch {
    throw new Error(`无法解析 queryData JSON`);
  }
  
  const apiUrl = "https://www.miit.gov.cn/api-gateway/jpaas-publish-server/front/page/build/unit";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryData)) {
    params.set(key, String(value));
  }
  
  const apiResponse = await fetch(`${apiUrl}?${params.toString()}`, {
    headers: {
      "user-agent": "Mozilla/5.0 SOLO monitor",
      accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  
  if (!apiResponse.ok) {
    throw new Error(`API 请求失败: ${apiResponse.status} for ${apiUrl}`);
  }
  
  const apiData = await apiResponse.json();
  if (!apiData.success || !apiData.data || !apiData.data.html) {
    throw new Error(`API 返回数据无效: ${JSON.stringify(apiData)}`);
  }
  
  const items = extractItemsFromHtml(apiData.data.html, listUrl);
  return items.slice(0, limit);
}