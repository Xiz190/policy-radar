export type MctLiveNewsItem = {
  title: string;
  url: string;
  listPublishedAt: string;
  sourceListUrl: string;
  detailPublishedAt?: string;
  detailSource?: string;
  detailTitle?: string;
  contentParagraphs?: string[];
  originJudgment?: "疑似首发" | "疑似转载" | "待判断";
  originReason?: string;
  sourceSiteUrl?: string;
  sourceSiteLabel?: string;
};

const MCT_SZYW_URL = "https://www.mct.gov.cn/whzx/szyw/";

function normalizeUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return new URL(url, MCT_SZYW_URL).toString();
}

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

function normalizeDetailTime(rawValue: string) {
  const normalized = rawValue.trim().replace(/-/g, "-").replace(/:/g, ":");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    return normalized;
  }

  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
}

function extractListItems(html: string, limit: number) {
  const trRegex = /<tr[\s\S]*?<\/tr>/g;
  const items: MctLiveNewsItem[] = [];
  const rows = html.match(trRegex) ?? [];

  for (const row of rows) {
    if (!/class="bt_time"/.test(row)) {
      continue;
    }

    const anchorMatch = row.match(/<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"[^>]*>/);
    const dateMatch = row.match(/class="bt_time"[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/td>/);

    if (!anchorMatch || !dateMatch) {
      continue;
    }

    items.push({
      title: decodeHtml(anchorMatch[2].trim()),
      url: normalizeUrl(anchorMatch[1].trim()),
      listPublishedAt: dateMatch[1],
      sourceListUrl: MCT_SZYW_URL,
    });

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

function getSourceSiteInfo(sourceName?: string) {
  if (!sourceName) {
    return null;
  }

  if (sourceName.includes("新华社")) {
    return {
      label: "新华社",
      url: "https://www.news.cn/",
      hostKeywords: ["news.cn", "xinhuanet.com"],
    };
  }

  if (sourceName.includes("人民日报")) {
    return {
      label: "人民日报",
      url: "https://www.people.com.cn/",
      hostKeywords: ["people.com.cn"],
    };
  }

  if (sourceName.includes("中国政府网")) {
    return {
      label: "中国政府网",
      url: "https://www.gov.cn/",
      hostKeywords: ["gov.cn"],
    };
  }

  if (sourceName.includes("央视网")) {
    return {
      label: "央视网",
      url: "https://www.cctv.com/",
      hostKeywords: ["cctv.com"],
    };
  }

  return null;
}

function judgeOrigin(detailUrl: string, detailSource?: string) {
  if (!detailSource) {
    return {
      originJudgment: "待判断" as const,
      originReason: "详情页暂未稳定识别到来源字段，先保留当前详情页作为主链接。",
      sourceSiteUrl: undefined,
      sourceSiteLabel: undefined,
    };
  }

  const currentHost = new URL(detailUrl).hostname;
  const sourceSite = getSourceSiteInfo(detailSource);

  if (!sourceSite) {
    return {
      originJudgment: "待判断" as const,
      originReason: `已识别来源为“${detailSource}”，但当前还没有为这个来源建立固定源站映射。`,
      sourceSiteUrl: undefined,
      sourceSiteLabel: detailSource,
    };
  }

  const isSameSourceDomain = sourceSite.hostKeywords.some((keyword) => currentHost.includes(keyword));

  if (isSameSourceDomain) {
    return {
      originJudgment: "疑似首发" as const,
      originReason: `详情页域名与来源“${sourceSite.label}”一致，当前页更可能就是源站首发页。`,
      sourceSiteUrl: sourceSite.url,
      sourceSiteLabel: sourceSite.label,
    };
  }

  return {
    originJudgment: "疑似转载" as const,
    originReason: `详情页当前在 ${currentHost}，但来源字段显示为“${sourceSite.label}”，更像是转载或转发页。`,
    sourceSiteUrl: sourceSite.url,
    sourceSiteLabel: sourceSite.label,
  };
}

async function enrichDetailInfo(item: MctLiveNewsItem): Promise<MctLiveNewsItem> {
  try {
    const response = await fetch(item.url, {
      headers: {
        "user-agent": "Mozilla/5.0 SOLO public-info-sync detail",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return item;
    }

    const html = await response.text();
    const metaTimeMatch =
      html.match(/meta name="firstpublishedtime" content="([^"]+)"/) ??
      html.match(/meta name="lastmodifiedtime" content="([^"]+)"/);
    const visibleTimeMatch =
      html.match(/<div class="pages-date">[\s\S]{0,200}?(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/) ?? null;
    const sourceMatch =
      html.match(/<span class="font">来源：\s*([\s\S]{0,60}?)<\/span>/) ??
      html.match(/来源：[\s\S]{0,40}?>([^<]+)/);
    const titleMatch = html.match(/<h1 id="ti">([\s\S]*?)<\/h1>/);
    const contentStart = html.indexOf('id="UCAP-CONTENT"');

    let contentParagraphs: string[] | undefined;

    if (contentStart !== -1) {
      const contentSlice = html.slice(contentStart, contentStart + 25000);
      const paragraphMatches = contentSlice.match(/<p[^>]*>[\s\S]*?<\/p>/g) ?? [];
      const cleanedParagraphs = paragraphMatches
        .map((paragraph) => stripTags(paragraph))
        .filter((paragraph) => paragraph.length > 0)
        .slice(0, 6);

      if (cleanedParagraphs.length > 0) {
        contentParagraphs = cleanedParagraphs;
      }
    }

    const detailPublishedAt = metaTimeMatch
      ? normalizeDetailTime(metaTimeMatch[1])
      : visibleTimeMatch?.[1]?.replace(/\s+/g, " ").trim();
    const detailSource = sourceMatch ? stripTags(sourceMatch[1]) : undefined;
    const detailTitle = titleMatch ? stripTags(titleMatch[1]) : undefined;
    const origin = judgeOrigin(item.url, detailSource);

    return {
      ...item,
      detailPublishedAt,
      detailSource,
      detailTitle,
      contentParagraphs,
      originJudgment: origin.originJudgment,
      originReason: origin.originReason,
      sourceSiteUrl: origin.sourceSiteUrl,
      sourceSiteLabel: origin.sourceSiteLabel,
    };
  } catch {
    return item;
  }
}

export async function getLatestMctSzywNews(limit = 10): Promise<{
  sourceUrl: string;
  fetchedAt: string;
  items: MctLiveNewsItem[];
}> {
  const response = await fetch(MCT_SZYW_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 SOLO public-info-sync demo",
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`抓取失败: ${response.status}`);
  }

  const html = await response.text();
  const items = extractListItems(html, limit);

  if (items.length === 0) {
    throw new Error("未能从页面中解析到时政要闻列表");
  }

  const enrichedItems = await Promise.all(items.map((item) => enrichDetailInfo(item)));

  return {
    sourceUrl: MCT_SZYW_URL,
    fetchedAt: new Date().toISOString(),
    items: enrichedItems,
  };
}
