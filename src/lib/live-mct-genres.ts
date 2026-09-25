export type MctGenreEntry = {
  title: string;
  url: string;
  date: string;
  detailPublishedAt?: string;
  issuingDepartment?: string;
  referenceNumber?: string;
  classificationText?: string;
  contentParagraphs?: string[];
};

export type MctGenreGroup = {
  name: string;
  listUrl: string;
  items: MctGenreEntry[];
};

const GENRES: Array<{ name: string; url: string }> = [
  { name: "决议决定", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/504/index_3081.html" },
  { name: "部令", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/505/index_3081.html" },
  { name: "公报", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/506/index_3081.html" },
  { name: "公告", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/507/index_3081.html" },
  { name: "通告", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/508/index_3081.html" },
  { name: "意见", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/509/index_3081.html" },
  { name: "通知", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/510/index_3081.html" },
  { name: "通报", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/511/index_3081.html" },
  { name: "报告", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/512/index_3081.html" },
  { name: "批复", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/513/index_3081.html" },
  { name: "函", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/514/index_3081.html" },
  { name: "其他", url: "https://zwgk.mct.gov.cn/zfxxgkml/503/515/index_3081.html" },
];

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

function normalizeUrl(url: string, base: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return new URL(url, base).toString();
}

function isRealDocumentLink(url: string) {
  return /\.html?$/i.test(url) && /(\/20\d{2,}|t20\d{6,}_\d+\.html$)/i.test(url);
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

function parseGenreItems(html: string, listUrl: string, limit: number): MctGenreEntry[] {
  const rightBoxStart = html.indexOf('<div class="rightBox');
  const paginationStart = html.indexOf('<div class="fanye_list">', rightBoxStart);
  const listHtml =
    rightBoxStart !== -1 && paginationStart !== -1 ? html.slice(rightBoxStart, paginationStart) : html;
  const pattern = /<li>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span class="date">(\d{4}-\d{2}-\d{2})<\/span>[\s\S]*?<\/li>/g;
  const items: MctGenreEntry[] = [];
  let match: RegExpExecArray | null = pattern.exec(listHtml);

  while (match && items.length < limit) {
    const [, href, rawTitle, date] = match;
    const title = stripTags(rawTitle);
    const url = normalizeUrl(href.trim(), listUrl);

    if (title && isRealDocumentLink(url) && !items.some((item) => item.url === url)) {
      items.push({
        title,
        url,
        date,
      });
    }

    match = pattern.exec(listHtml);
  }

  return items;
}

async function enrichGenreEntry(item: MctGenreEntry): Promise<MctGenreEntry> {
  try {
    const response = await fetch(item.url, {
      headers: {
        "user-agent": "Mozilla/5.0 SOLO public-info-sync genre detail",
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
    };
  } catch {
    return item;
  }
}

async function fetchGenreGroup(name: string, listUrl: string, limit: number): Promise<MctGenreGroup> {
  const response = await fetch(listUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 SOLO public-info-sync genre list",
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`抓取 ${name} 失败: ${response.status}`);
  }

  const html = await response.text();
  const items = parseGenreItems(html, listUrl, limit);
  const enrichedItems = await Promise.all(items.map((item) => enrichGenreEntry(item)));

  return {
    name,
    listUrl,
    items: enrichedItems,
  };
}

export async function getLatestMctGenreGroups(limit = 10): Promise<{
  fetchedAt: string;
  groups: MctGenreGroup[];
}> {
  const groups = await Promise.all(GENRES.map((genre) => fetchGenreGroup(genre.name, genre.url, limit)));

  return {
    fetchedAt: new Date().toISOString(),
    groups,
  };
}
