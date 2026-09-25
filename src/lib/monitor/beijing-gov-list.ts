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

// 中国政府门户文档链接识别规则（通用版，适用于 moa.gov.cn、beijing.gov.cn、gov.cn、farmer.com.cn 等）：
//   ——内容页典型路径：/202506/t20250612_xxxxxxx.htm 或 .html
//   ——或以 /content_xxxxx.html 风格
//   ——或者是带日期段的纯路径：/2025/06/xx.html
//   ——数字报（szb.farmer.com.cn）：/nmrb/html/YYYY/MMDD/MMDD_X/nmrb_YYYYMMDD_XXXX_X.html
//   ——PDF 附件
//   ——URL 以 .htm / .html / .pdf 结尾且明显在内容栏目路径内
function isGovernmentPortalDocument(url: string): boolean {
  if (!/(\.htm$|\.s?html?$|\.pdf$)/i.test(url)) return false;

  // 通用：标准内容页模式（大部分政府门户）
  if (/\/(?:20\d{2}|20\d{6}|content_|t20\d{6,}_)/i.test(url)) return true;
  // 若 URL 本身含 t + 数字（如 t20260612_1234567），一定是内容页
  if (/\/t20\d{6,}_\d+\.(?:s?htm|s?html?)$/i.test(url)) return true;

  // moa.gov.cn / 农业农村部：各种栏目路径下的文档
  if (/moa\.gov\.cn/i.test(url)) {
    if (/\/(?:jg|xw|govpublic|gk|hd|ztzl|zt|shipin)\/.+\.(?:htm|html?)$/i.test(url)) return true;
    if (/\/20\d{4}\/\d+\.(?:htm|html?)$/i.test(url)) return true;
  }

  // farmer.com.cn / 中国农网：/farmer/*/YYYYMMDD/YYYYMMDD_XXXX.shtml
  if (/farmer\.com\.cn/i.test(url)) {
    if (/\/farmer\/[^/]+\/\d+\/\d+\.(?:s?html?|htm)$/i.test(url)) return true;
    if (/\/\d{4}\/\d{2}\/\d{2}\//i.test(url)) return true;
    if (/\d{4}\/\d{4}\/\d{4}_\d+\.(?:s?html?|htm)$/i.test(url)) return true;
  }

  // szb.farmer.com.cn / 农民日报数字报
  if (/szb\.farmer\.com\.cn/i.test(url)) {
    if (/\/nmrb\/html\/\d{4}\/\d{4}\/\d{4}_\d+\/nmrb_\d{8}_\d+_\d+\.html/i.test(url)) return true;
  }

  // beijing.gov.cn / 北京市政府门户
  if (/beijing\.gov\.cn/i.test(url)) {
    if (/\/(?:ywdt|zhengce|gongkai|fuwu|ztzl|shipin|so\/zcdh)\/.+\.(?:htm|html?)$/i.test(url)) return true;
  }

  // 北京郊区政府站点（丰台 bjft / 大兴 bjdx / 通州 bjtz / 朝阳 bjchy / 海淀 bjhd 等）
  // 典型路径：/xwdt/zwyw/202606/t20260612_215718.shtml
  //          /bjsdxqrmzf/zwfw/tzgg/2347353/index.html
  //          /bjsdxqrmzf/zwfw/zfwj67/zfwj/2346350/index.html
  if (/bj(?:ft|dx|tz|chy|hd|sh|cp|fs|pg|my|yq|dxq|mtg|yqrmzf|sjs|sjtz)[a-z]*\.gov\.cn/i.test(url)) {
    // 类政务公开/新闻动态/政策文件/公示公告等栏目下的内容页
    if (
      /\/(?:xwdt|xxfb|zwfw|zwgk|gkml|qzf|jcygk|zdly|ghjh|sjfb|tjgb|zfwj|zfbwj|zcwj|zfgg|tzgg|gkjcml|jwhyzl)\/.+\.(?:s?htm|s?html?)$/i.test(url)
    ) {
      return true;
    }
    // 目录数字 ID 的页面（/2347353/index.html 这类）
    if (/\/\d{5,}\/(?:index|content|show)?\.?(?:s?htm|s?html?)?$/i.test(url)) return true;
  }

  // gov.cn / 中国政府网
  if (/gov\.cn/i.test(url)) {
    if (/\/(?:xinwen|zhengce|jianwen|zhuanti|content|xinwen\/guowuyuan|yaowen|zuixin)\/.+\.(?:htm|html?)$/i.test(url)) return true;
  }

  // 兜底：任何带日期段的 URL
  if (
    /\/20\d{2}[-_/]?\d{2}[-_/]?\d{2}[_\-/.]/i.test(url) ||
    /\/20\d{4}\/\d+\.(?:htm|html?)$/i.test(url) ||
    /\/20\d{2}\/\d{2}\/\d{2}\//i.test(url)
  ) {
    return true;
  }

  return false;
}

// 宽松的日期格式识别（与财政部风格的 2024-05-15）或中文日期：2024年5月15日
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

// 从给定 HTML 片段中提取 YYYY-MM-DD（可能被 span 包裹）
function extractDateFromHtml(html: string): string {
  // 1) <span ...>YYYY-MM-DD</span>
  const spanDate = /<span[^>]*>(?:\s|&nbsp;)*(\d{4}-\d{2}-\d{2})(?:\s|&nbsp;)*<\/span>/i.exec(html);
  if (spanDate) return spanDate[1];
  // 2) class="...date/time/lmtime/发布/日期..." 的块后面的日期，或 "发布日期：" 文本
  const blockDate = /(?:class="[^"]*(?:date|time|day|发布|日期|lmtime)[^"]*"[^>]*>|发布日期[：:])\s*(\d{4}-\d{2}-\d{2})/i.exec(html);
  if (blockDate) return blockDate[1];
  // 3) 中文日期："2024年5月23日"
  const cnDate = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(html);
  if (cnDate) return `${cnDate[1]}-${String(cnDate[2]).padStart(2, "0")}-${String(cnDate[3]).padStart(2, "0")}`;
  // 4) 兜底：整个片段里的 YYYY-MM-DD
  const dashDate = /(\d{4}-\d{2}-\d{2})/.exec(html);
  if (dashDate) return dashDate[1];
  return "";
}

// 北京市政府门户：<li> 项提取：标题、链接、日期
// 日期可能出现在 <a> 内部（丰台区）或 <a> 外部（大兴区、北京市政府等）
function extractFromListItem(liHtml: string, baseUrl: string): MonitorListItem | null {
  const hrefMatch = /<a[^>]+href="([^"]+)"[^>]*>/.exec(liHtml);
  if (!hrefMatch) return null;
  const href = hrefMatch[1].trim();
  if (!href || href === "#" || href.startsWith("javascript:")) return null;

  // 提取标题：优先 <a> 的 title 属性，否则 <a> 的 inner text
  // 注意：必须使用非贪婪匹配，避免 istitle="true" 这类伪 title 被匹配
  let title = "";
  let anchorInner = "";
  const titleAttr = /<a\b[^>]*?\btitle="([^"]*)"[^>]*>/.exec(liHtml);
  if (titleAttr && titleAttr[1].trim()) {
    title = stripTags(titleAttr[1]);
  } else {
    const bodyMatch = /<a[^>]*>([\s\S]*?)<\/a>/.exec(liHtml);
    if (bodyMatch) {
      anchorInner = bodyMatch[1];
      // 1) 在 anchor 内移除无意义的 span（kzsfzd / sfzd / gjxy / 置顶图标相关）
      const cleanInner = anchorInner
        // 移除 kzsfzd/sfzd/gjxy 等控制用的 span（包括嵌套的 display:none 子 span）
        .replace(/<span\b[^>]*\bclass="[^"]*(?:kzsfzd|sfzd|gjxy|zhidingdingxiang|zhiding|top)[^"]*"[^>]*>[\s\S]*?<\/span>/gi, " ")
        // 移除 HTML 注释
        .replace(/<!--[\s\S]*?-->/g, " ")
        // 移除 style="display:none" 的节点
        .replace(/<([a-z][a-z0-9]*)[^>]*style="[^"]*display\s*:\s*none[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, " ")
        // 移除空的 span
        .replace(/<span\s*[^>]*>\s*<\/span>/gi, " ");
      // 2) 再找 "bttit" 类的明确标题容器（可能嵌套了其他 span，用深度计数法）
      const bttitStart = /<span\b[^>]*\bclass="[^"]*(?:bttit|item_title|itemTitle|news_title|newstitle|titlebox|title_box)[^"]*"[^>]*>/i.exec(cleanInner);
      if (bttitStart) {
        const closePos = findMatchingClose(cleanInner, bttitStart.index, "span");
        if (closePos !== null) {
          const innerText = cleanInner.slice(bttitStart.index + bttitStart[0].length, closePos);
          const cleanTitle = stripTags(innerText);
          if (cleanTitle.trim()) title = cleanTitle;
        }
      }
      // 3) 兜底：直接 stripTags
      if (!title) {
        title = stripTags(cleanInner);
      }
    }
  }
  // 二次清理：标题里可能残留 [区XX] 这类标注
  if (title) {
    title = title
      .replace(/\s*\[[^\]]{1,15}\]\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (!title) return null;

  // 日期：先在 <a> 外找（大多数站点），找不到再在 <a> 内找（丰台等）
  const outsideAnchor = liHtml.replace(/<a\b[\s\S]*?<\/a>/gi, " ");
  let date = extractDateFromHtml(outsideAnchor);
  if (!date) {
    // 在 <a> 内部找日期（从 anchorInner 找），但不覆盖已处理好的 title
    const insideAnchor = anchorInner || ((/<a[^>]*>([\s\S]*?)<\/a>/.exec(liHtml) || [])[1] || "");
    date = extractDateFromHtml(insideAnchor);
  }

  if (!date) return null;
  if (!isValidDateStr(date)) return null;

  const url = normalizeUrl(href, baseUrl);
  if (!isGovernmentPortalDocument(url) && !/\.pdf$/i.test(url)) return null;

  return { title, url, listPublishedAt: date };
}

// 用深度计数方式查找同级别容器的闭合位置（比简单 [\s\S]*?<\/tag> 更准确，避免嵌套）
function findMatchingClose(html: string, openStart: number, tag: string): number | null {
  const openRe = new RegExp(`<${tag}\\b`, "gi");
  const closeRe = new RegExp(`<\\/${tag}\\b`, "gi");
  let depth = 1;
  let pos = openStart + `<${tag}`.length;
  while (pos < html.length) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      pos = nextOpen.index + `<${tag}`.length;
    } else {
      depth--;
      if (depth === 0) return nextClose.index;
      pos = nextClose.index + `</${tag}>`.length;
    }
  }
  return null;
}

// 从 HTML 中提取所有 tag 容器（带 class/id 名），用函数过滤
function extractContainers(
  html: string,
  tag: string,
  classFilter: (attrs: string, classAttr: string, idAttr: string) => boolean,
): Array<{ start: number; end: number; innerHtml: string; classAttr: string; idAttr: string }> {
  const result: Array<{ start: number; end: number; innerHtml: string; classAttr: string; idAttr: string }> = [];
  const openRe = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    const attrs = m[1] || "";
    const classMatch = /\bclass\s*=\s*"([^"]*)"/i.exec(attrs);
    const idMatch = /\bid\s*=\s*"([^"]*)"/i.exec(attrs);
    const classAttr = classMatch ? classMatch[1] : "";
    const idAttr = idMatch ? idMatch[1] : "";
    if (!classFilter(attrs, classAttr, idAttr)) continue;
    const closePos = findMatchingClose(html, m.index, tag);
    if (closePos == null) continue;
    const openEnd = m.index + m[0].length;
    if (closePos <= openEnd) continue;
    result.push({
      start: m.index,
      end: closePos + `</${tag}>`.length,
      innerHtml: html.slice(openEnd, closePos),
      classAttr,
      idAttr,
    });
  }
  return result;
}

function containsContentKeywords(classAttr: string, idAttr: string): boolean {
  const combined = (classAttr + " " + idAttr).toLowerCase();
  // 明确的内容列表容器关键字
  if (/\b(?:lmgglist|listnews|newslist|news_list|news-list|article-list|content-list|articlelist|artlist|listnr|listcon|listbox|newsbox|tzggbox|zfwjbox|zwlb|zwlbx|newslb|gongshi|gonggao|zwgk-list|news-box|info-list|infobox)\b/.test(combined)) return true;
  return false;
}

function pickListHtml(html: string): string {
  // 1) 优先尝试带内容类名的 <ul> / <div>
  const ulContainers = extractContainers(html, "ul", (_attrs, cls, id) =>
    containsContentKeywords(cls, id),
  );
  if (ulContainers.length > 0) {
    ulContainers.sort((a, b) => (b.innerHtml.match(/<li[\s>]/gi) || []).length - (a.innerHtml.match(/<li[\s>]/gi) || []).length);
    const best = ulContainers[0];
    if ((best.innerHtml.match(/<li[\s>]/gi) || []).length >= 2) return html.slice(best.start, best.end);
  }

  // 2) 带内容类名的 <div>
  const divContainers = extractContainers(html, "div", (_attrs, cls, id) =>
    containsContentKeywords(cls, id),
  );
  if (divContainers.length > 0) {
    divContainers.sort((a, b) => (b.innerHtml.match(/<li[\s>]/gi) || []).length - (a.innerHtml.match(/<li[\s>]/gi) || []).length);
    const best = divContainers[0];
    if ((best.innerHtml.match(/<li[\s>]/gi) || []).length >= 2) return html.slice(best.start, best.end);
  }

  // 3) 回退：在整个 HTML 找 <ul>...</ul>，取其中 <li> 数最多的
  const ulMatches = extractContainers(html, "ul", () => true);
  if (ulMatches.length > 0) {
    ulMatches.sort((a, b) => (b.innerHtml.match(/<li[\s>]/gi) || []).length - (a.innerHtml.match(/<li[\s>]/gi) || []).length);
    const best = ulMatches[0];
    if ((best.innerHtml.match(/<li[\s>]/gi) || []).length >= 3) return html.slice(best.start, best.end);
  }
  // 4) 如果没有明确的 ul 容器，回退到整个 HTML
  return html;
}

export async function fetchBeijingGovListLatest(
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
