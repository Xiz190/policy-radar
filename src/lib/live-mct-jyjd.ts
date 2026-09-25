export type MctDecisionItem = {
  title: string;
  url: string;
  listPublishedAt: string;
  sourceListUrl: string;
  detailPublishedAt?: string;
  issuingDepartment?: string;
  referenceNumber?: string;
  classificationText?: string;
  contentParagraphs?: string[];
  originJudgment: "站内发布" | "待判断";
  originReason: string;
};

const MCT_JYJD_URL = "https://zwgk.mct.gov.cn/zfxxgkml/503/504/index_3081.html";

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

function cleanHtmlNoise(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

function normalizeUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return new URL(url, MCT_JYJD_URL).toString();
}

function normalizeChineseDate(value: string) {
  const match = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);

  if (!match) {
    return value.trim();
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isBodyNoiseParagraph(paragraph: string, referenceNumber?: string) {
  const trimmed = paragraph.trim();

  if (!trimmed) {
    return true;
  }

  if (trimmed.startsWith("发布时间：") || trimmed.startsWith("字体：") || trimmed.startsWith("分享到") || trimmed.startsWith("打印")) {
    return true;
  }

  if (
    trimmed.includes(".TRS_Editor") ||
    trimmed.includes("temp = document.getElementById") ||
    trimmed.includes("扫一扫在手机打开当前页")
  ) {
    return true;
  }

  if (referenceNumber && trimmed === referenceNumber.trim()) {
    return true;
  }

  if (trimmed === "文化和旅游部") {
    return true;
  }

  if (/^20\d{2}年\d{1,2}月\d{1,2}日$/.test(trimmed)) {
    return true;
  }

  if (/^（此件公开发布）$/.test(trimmed)) {
    return true;
  }

  return false;
}

function extractBodyParagraphsFromHtml(contentHtml: string, referenceNumber?: string) {
  const blockMatches = contentHtml.match(/<(?:p|div)[^>]*>[\s\S]*?<\/(?:p|div)>/gi) ?? [];
  const cleanedBlocks = blockMatches
    .map((block) => stripTags(block))
    .filter((paragraph) => !isBodyNoiseParagraph(paragraph, referenceNumber));

  const deduped = Array.from(new Set(cleanedBlocks));
  if (deduped.length > 0) {
    return deduped.slice(0, 8);
  }

  const plainText = stripTags(contentHtml)
    .split(/\s{2,}|\n+/)
    .map((part) => part.trim())
    .filter((paragraph) => !isBodyNoiseParagraph(paragraph, referenceNumber));

  return Array.from(new Set(plainText)).slice(0, 8);
}

function extractListItems(html: string, limit: number) {
  const liRegex = /<li>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span class="date">(\d{4}-\d{2}-\d{2})<\/span>[\s\S]*?<\/li>/g;
  const items: MctDecisionItem[] = [];
  let match: RegExpExecArray | null = liRegex.exec(html);

  while (match && items.length < limit) {
    const [, href, rawTitle, date] = match;
    items.push({
      title: stripTags(rawTitle),
      url: normalizeUrl(href.trim()),
      listPublishedAt: date,
      sourceListUrl: MCT_JYJD_URL,
      originJudgment: "待判断",
      originReason: "尚未完成详情页解析。",
    });
    match = liRegex.exec(html);
  }

  return items;
}

async function enrichDecisionItem(item: MctDecisionItem): Promise<MctDecisionItem> {
  try {
    const response = await fetch(item.url, {
      headers: {
        "user-agent": "Mozilla/5.0 SOLO public-info-sync decision",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return item;
    }

    const html = await response.text();
    const safeHtml = cleanHtmlNoise(html);
    const detailTimeMatch =
      safeHtml.match(/<p class="pubtime">发布时间：([\s\S]*?)<\/p>/) ??
      safeHtml.match(/<dt>发布日期：<\/dt>\s*<dd>([\s\S]*?)<\/dd>/);
    const departmentMatch = safeHtml.match(/<dt>发布机构：<\/dt>\s*<dd>([\s\S]*?)<\/dd>/);
    const referenceNumberMatch =
      safeHtml.match(/<p class="fileNum">([\s\S]*?)<\/p>/) ??
      safeHtml.match(/<dt>文号：<\/dt>\s*<dd>([\s\S]*?)<\/dd>/);
    const classificationMatch =
      safeHtml.match(/<dt>分[\s\S]{0,80}?类：<\/dt>\s*<dd>([\s\S]*?)<\/dd>/) ??
      safeHtml.match(/<dt>分类：<\/dt>\s*<dd>([\s\S]*?)<\/dd>/);

    const contentStart =
      safeHtml.indexOf('<div class="gsj_htmlcon_bot">') !== -1
        ? safeHtml.indexOf('<div class="gsj_htmlcon_bot">')
        : safeHtml.indexOf('<div class="gsj_htmlcon">') !== -1
          ? safeHtml.indexOf('<div class="gsj_htmlcon">')
          : safeHtml.indexOf('class="TRS_Editor"');
    const attachmentStart = safeHtml.indexOf('<div class="nyb_fj"', contentStart);
    const contentEnd = attachmentStart !== -1 ? attachmentStart : contentStart + 30000;

    let contentParagraphs: string[] | undefined;

    const referenceNumber = referenceNumberMatch ? stripTags(referenceNumberMatch[1]) : undefined;

    if (contentStart !== -1) {
      const contentSlice = safeHtml.slice(contentStart, contentEnd);
      const cleaned = extractBodyParagraphsFromHtml(contentSlice, referenceNumber);

      if (cleaned.length > 0) {
        contentParagraphs = cleaned;
      }
    }

    return {
      ...item,
      detailPublishedAt: detailTimeMatch ? normalizeChineseDate(stripTags(detailTimeMatch[1])) : undefined,
      issuingDepartment: departmentMatch ? stripTags(departmentMatch[1]) : undefined,
      referenceNumber,
      classificationText: classificationMatch ? stripTags(classificationMatch[1]) : undefined,
      contentParagraphs,
      originJudgment: "站内发布",
      originReason: "该栏目来自文化和旅游部政府信息公开站，当前优先按站内正式公开内容处理。",
    };
  } catch {
    return item;
  }
}

export async function getLatestMctDecisionNews(limit = 10): Promise<{
  sourceUrl: string;
  fetchedAt: string;
  items: MctDecisionItem[];
}> {
  const response = await fetch(MCT_JYJD_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 SOLO public-info-sync list",
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
    throw new Error("未能从页面中解析到决议决定列表");
  }

  const enrichedItems = await Promise.all(items.map((item) => enrichDecisionItem(item)));

  return {
    sourceUrl: MCT_JYJD_URL,
    fetchedAt: new Date().toISOString(),
    items: enrichedItems,
  };
}
