// 通用部委列表抓取器（用于中国政府风格的 HTML 列表页）
// 适用部门：
//   · 国家烟草专卖局（www.tobacco.gov.cn）——时政要闻 / 国务院信息 / 行业要闻 /
//                                             央媒报道 / 各地新闻 / 基层工作 / 通知公告 /
//                                             乡村振兴工作信息 / 相关政策 / 专卖管理 /
//                                             数字化转型 / 统计信息 / 人才招聘平台 /
//                                             培训信息 / 工作信息 / 政府网站工作年度报表 /
//                                             行业政策 / 相关标准 / 政策解读（综合业务/专卖业务/生产经营）/
//                                             在线访谈 / 专题专栏
//   · 国家林业和草原局（www.forestry.gov.cn）——时政信息 / 政府网信息 /
//                                             改革发展 / 动态 / 地方动态 / 基层信息 /
//                                             政策解读 / 政策法规名录 / 公示公告 /
//                                             国务院文件 / 林草政策 / 招标公告 /
//                                             中标公告 / 政府采购 / 植树造林 /
//                                             国土绿化 / 森林城市 / 有害生物防治 /
//                                             松材线虫病 / 绿化基金 / 资源监测 /
//                                             采伐利用 / 林地管理 / 林政执法 /
//                                             资源监督 / 保护动态 / 荒漠化防治 /
//                                             动植物保护 / 自然保护地 / 林场种苗 /
//                                             林草防火 / 林草科技 / 国际合作 /
//                                             部门预决算 / 林草标准（公告通知/征求意见）
//                                             等 40+ 栏目
//   · 中华人民共和国生态环境部（www.mee.gov.cn）——新闻发布 / 时政要闻 /
//                                                 环境要闻 / 地方快讯 / 公示 /
//                                                 往期公示 / 公告区 / 直播访谈 /
//                                                 中央有关文件 / 国务院有关文件 /
//                                                 部令 / 公告 / 文件 / 函 /
//                                                 办公厅文件 / 行政审批文件 /
//                                                 核安全局文件 / 司函 /
//                                                 强化监督问题督办函 / 建议提案复文 /
//                                                 联合发文 / 其他 / 解读 /
//                                                 中国生态环境状况公报 /
//                                                 生态环境统计年报 /
//                                                 中国海洋生态环境状况公报 /
//                                                 中国噪声污染防治报告 /
//                                                 大中城市固体废物污染环境防治年报 /
//                                                 中国移动源环境管理年报 /
//                                                 督察进驻 / 督察整改 / 督察管理 /
//                                                 法规标准 / 技术文件 / 科技规划政策与体制改革 /
//                                                 重点实验室和科学观测研究站 /
//                                                 大气重污染成因与治理攻关 /
//                                                 生态环境科技成果 / 环保产业 /
//                                                 国家环境技术体系 / 部门预决算管理 /
//                                                 生态环境政策 / 生态环境规划计划 /
//                                                 统计与形势分析 / 规划信息 /
//                                                 生态文明示范创建 等 50+ 栏目
//   · 北京交通委员会（jtw.beijing.gov.cn）——规范性文件 / 其他政策文件 /
//                                                政策解读 / 规划计划 / 交通统计 /
//                                                财政性资金 / 政府采购意向公开 /
//                                                交通规费 / 收费公路政策 /
//                                                招投标信息 / 政务转载 / 工作动态 /
//                                                通知公告 / 新闻发布会 等 14 栏目
//
// 设计原则：使用与 beijing-gov-list / mof-zhengwuxinxi-list 相同的通用 <ul>/<li> 抽取逻辑，
// 不同部委通过不同的 URL 识别规则避免误匹配。

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

// 通用中国政府门户文档链接识别
function isGovernmentPortalDocument(url: string): boolean {
  if (/\.(png|jpe?g|gif|bmp|webp|svg|css|js|mp4|mp3)$/i.test(url)) return false;
  if (/\/index(\.(?:s?html?|htm|jsp))?$/i.test(url)) return false;

  if (/\.pdf$/i.test(url)) return true;
  if (/\.docx?$/i.test(url)) return true;

  // 主站内容页：/202506/t20250612_xxx.shtml / .html / .htm
  if (/\/t?20\d{6,}_\d+\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{2}[-_]?\d{2}[-_/]\d{2}[_\-/].*\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{4,}\/t?20\d{6,}_?\d*\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{2}\/\d{2}\/\d{2}\/.*\.(?:s?html?|htm)$/i.test(url)) return true;

  // forestry.gov.cn / mee.gov.cn / jtw.beijing.gov.cn / tobacco.gov.cn 各自域名下的 html
  if (/(forestry|mee|tobacco|jtw\.beijing|miit|xxgk|zwgk)\.gov\.cn.*\.(?:s?html?|htm|jsp)$/i.test(url)) {
    return true;
  }
  if (/tobacco\.gov\.cn\/.+\/list\.shtml/i.test(url)) return false; // 这是列表页

  // 兜底：以 .htm/.html/.shtml/.jsp 结尾，且 URL 中包含年份
  if (/\.(?:s?html?|htm|jsp)$/i.test(url) && /20\d{2}/.test(url)) return true;
  return false;
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

function extractFromListItem(liHtml: string, baseUrl: string): MonitorListItem | null {
  const hrefMatch = /<a[^>]+href="([^"]+)"[^>]*>/.exec(liHtml);
  if (!hrefMatch) return null;
  const href = hrefMatch[1].trim();
  if (!href || href === "#" || href.startsWith("javascript:")) return null;

  let title = "";
  const titleAttr = /<a[^>]+title="([^"]+)"[^>]*>/.exec(liHtml);
  if (titleAttr && titleAttr[1].trim()) {
    title = stripTags(titleAttr[1]);
  } else {
    const bodyMatch = /<a[^>]*>([\s\S]*?)<\/a>/.exec(liHtml);
    if (bodyMatch) title = stripTags(bodyMatch[1]);
  }
  if (!title) return null;

  const outsideAnchor = liHtml.replace(/<a\b[\s\S]*?<\/a>/gi, " ");

  let date = "";
  const spanDate = /<span[^>]*>(?:\s|&nbsp;)*(\d{4}-\d{2}-\d{2})(?:\s|&nbsp;)*<\/span>/i.exec(outsideAnchor);
  if (spanDate) {
    date = spanDate[1];
  } else {
    const blockDate = /class="[^"]*(?:date|time|day|发布|日期|time|sj|fbtime|times|rq)[^"]*"[^>]*>\s*(\d{4}-\d{2}-\d{2})/i.exec(outsideAnchor);
    if (blockDate) {
      date = blockDate[1];
    } else {
      const dashDate = /(\d{4}-\d{2}-\d{2})/.exec(outsideAnchor);
      if (dashDate) date = dashDate[1];
    }
  }

  if (!date) {
    const cnDate = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(outsideAnchor);
    if (cnDate) {
      date = `${cnDate[1]}-${String(cnDate[2]).padStart(2, "0")}-${String(cnDate[3]).padStart(2, "0")}`;
    }
  }

  if (!date) {
    const loose = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(outsideAnchor);
    if (loose) {
      date = `${loose[1]}-${String(loose[2]).padStart(2, "0")}-${String(loose[3]).padStart(2, "0")}`;
    }
  }

  if (!date) return null;
  if (!isValidDateStr(date)) return null;

  const url = normalizeUrl(href, baseUrl);
  if (!isGovernmentPortalDocument(url) && !/\.pdf$/i.test(url)) return null;

  return { title, url, listPublishedAt: date };
}

const KNOWN_CONTAINER_PATTERNS = [
  /<ul[^>]*class="[^"]*(?:list|news|xw|wzlb|item|news[_-]?list|news[_-]?box|content[_-]?list|page[_-]?list|xw_list|gongwen)[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
  /<div[^>]*class="[^"]*(?:news[_-]?box|list[_-]?box|content[_-]?box|article[_-]?list|listpage|page[_-]?list|newsList)[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  /<table[^>]*>[\s\S]*?<\/table>/gi,
];

function pickListHtml(html: string): string {
  for (const pattern of KNOWN_CONTAINER_PATTERNS) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      const best = matches.reduce((a, b) =>
        (a.match(/<li[\s>]/gi) || []).length >= (b.match(/<li[\s>]/gi) || []).length ? a : b,
      );
      if ((best.match(/<li[\s>]/gi) || []).length >= 3) return best;
    }
  }
  return html;
}

export async function fetchGenericGovernmentListLatest(
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
