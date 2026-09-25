const fs = require('fs');
const path = require('path');

const MOE_MOCK_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>教育部 - 时政要闻</title>
</head>
<body>
  <div class="header">
    <div class="nav">导航栏</div>
  </div>
  
  <div class="main-content">
    <div class="news-list-box">
      <ul class="news-list">
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250615_1135264.html" title="教育部召开2025年全国教育工作会议">
            教育部召开2025年全国教育工作会议
          </a>
          <span class="date">2025-06-15</span>
        </li>
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250614_1135123.html" title="关于印发《新时代基础教育强师计划》的通知">
            关于印发《新时代基础教育强师计划》的通知
          </a>
          <span class="date">2025-06-14</span>
        </li>
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250613_1135089.html" title="教育部部署暑期校外培训治理工作">
            教育部部署暑期校外培训治理工作
          </a>
          <span>2025-06-13</span>
        </li>
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250612_1135045.html">
            2025年高考招生政策解读
          </a>
          <span class="time">2025-06-12</span>
        </li>
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250611_1134987.html" title="教育部发布《职业教育法》实施细则">
            教育部发布《职业教育法》实施细则
          </a>
          <span class="fbtime">2025-06-11</span>
        </li>
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250610_1134923.html" title="教育部发布2025年全国教育事业发展统计公报">
            教育部发布2025年全国教育事业发展统计公报
          </a>
          <span>2025年6月10日</span>
        </li>
        <li>
          <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250609_1134867.html" title="关于深化现代职业教育体系建设改革的意见">
            关于深化现代职业教育体系建设改革的意见
          </a>
          <span>2025/06/09</span>
        </li>
      </ul>
    </div>
    
    <div class="sidebar">
      <div class="related-links">相关链接</div>
      <ul>
        <li><a href="/index.html">首页</a></li>
        <li><a href="/about.html">关于我们</a></li>
      </ul>
    </div>
  </div>
  
  <div class="footer">
    <div class="copyright">版权所有</div>
  </div>
</body>
</html>`;

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function normalizeUrl(url, base) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function isGovernmentPortalDocument(url) {
  if (/\.(png|jpe?g|gif|bmp|webp|svg|css|js|mp4|mp3)$/i.test(url)) return false;
  if (/\/index(\.(?:s?html?|htm|jsp))?$/i.test(url)) return false;
  if (/\.pdf$/i.test(url)) return true;
  if (/\.docx?$/i.test(url)) return true;
  if (/\/t?20\d{6,}_\d+\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{2}[-_]?\d{2}[-_/]\d{2}[_\-/].*\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{4,}\/t?20\d{6,}_?\d*\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/\/20\d{2}\/\d{2}\/\d{2}\/.*\.(?:s?html?|htm)$/i.test(url)) return true;
  if (/(forestry|mee|tobacco|jtw\.beijing|miit|xxgk|zwgk|moe)\.gov\.cn.*\.(?:s?html?|htm|jsp)$/i.test(url)) {
    return true;
  }
  if (/\.(?:s?html?|htm|jsp)$/i.test(url) && /20\d{2}/.test(url)) return true;
  return false;
}

function isValidDateStr(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  const now = new Date();
  const maxYear = now.getUTCFullYear() + 1;
  if (year < 2000 || year > maxYear) return false;
  return true;
}

function extractFromListItem(liHtml, baseUrl) {
  const hrefMatch = /<a[^>]+href="([^"]+)"[^>]*>/.exec(liHtml);
  if (!hrefMatch) return null;
  const href = hrefMatch[1].trim();
  if (!href || href === '#' || href.startsWith('javascript:')) return null;

  let title = '';
  const titleAttr = /<a[^>]+title="([^"]+)"[^>]*>/.exec(liHtml);
  if (titleAttr && titleAttr[1].trim()) {
    title = stripTags(titleAttr[1]);
  } else {
    const bodyMatch = /<a[^>]*>([\s\S]*?)<\/a>/.exec(liHtml);
    if (bodyMatch) title = stripTags(bodyMatch[1]);
  }
  if (!title) return null;

  const outsideAnchor = liHtml.replace(/<a\b[\s\S]*?<\/a>/gi, ' ');

  let date = '';
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
      date = `${cnDate[1]}-${String(cnDate[2]).padStart(2, '0')}-${String(cnDate[3]).padStart(2, '0')}`;
    }
  }

  if (!date) {
    const loose = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(outsideAnchor);
    if (loose) {
      date = `${loose[1]}-${String(loose[2]).padStart(2, '0')}-${String(loose[3]).padStart(2, '0')}`;
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

function pickListHtml(html) {
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

function parseGovernmentList(html, baseUrl, limit = 10) {
  const listHtml = pickListHtml(html);
  const liRe = /<li[^>]*>[\s\S]*?<\/li>/gi;
  const items = [];
  let match;
  
  while ((match = liRe.exec(listHtml)) !== null) {
    if (items.length >= limit) break;
    const item = extractFromListItem(match[0], baseUrl);
    if (item && !items.some((existing) => existing.url === item.url)) {
      items.push(item);
    }
  }
  return items;
}

console.log('========================================');
console.log('教育部列表解析测试');
console.log('========================================\n');

const baseUrl = 'https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/xxfb/';
const items = parseGovernmentList(MOE_MOCK_HTML, baseUrl, 10);

console.log(`解析结果：共抓取到 ${items.length} 条记录\n`);

items.forEach((item, index) => {
  console.log(`【${index + 1}】${item.title}`);
  console.log(`    URL: ${item.url}`);
  console.log(`    日期: ${item.listPublishedAt}`);
  console.log('');
});

console.log('========================================');
console.log('测试完成');
console.log('========================================');