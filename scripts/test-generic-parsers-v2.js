const https = require('https');
const http = require('http');

function fetchHtml(urlStr) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 SOLO monitor',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 30000,
    };

    const req = protocol.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, urlStr).toString();
        fetchHtml(redirectUrl).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const html = Buffer.concat(data).toString('utf-8');
        resolve(html);
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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
    title = decodeHtml(titleAttr[1]);
  } else {
    const bodyMatch = /<a[^>]*>([\s\S]*?)<\/a>/.exec(liHtml);
    if (bodyMatch) title = decodeHtml(bodyMatch[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  }
  if (!title) return null;

  const outsideAnchor = liHtml.replace(/<a\b[\s\S]*?<\/a>/gi, ' ');

  let date = '';
  const spanDate = /<span[^>]*>(?:\s|&nbsp;)*(\d{4}-\d{2}-\d{2})(?:\s|&nbsp;)*<\/span>/i.exec(outsideAnchor);
  if (spanDate) {
    date = spanDate[1];
  } else {
    const dashDate = /(\d{4}-\d{2}-\d{2})/.exec(outsideAnchor);
    if (dashDate) date = dashDate[1];
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
  if (!/\.html?$/i.test(url) && !/\.pdf$/i.test(url)) {
    if (!/(gov\.cn|moe\.gov\.cn).*\.(?:html?)$/i.test(url)) return null;
  }

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

const TEST_SITES = [
  { name: '科技部', homeUrl: 'https://www.most.gov.cn/' },
  { name: '民政部', homeUrl: 'https://www.mca.gov.cn/' },
  { name: '司法部', homeUrl: 'https://www.moj.gov.cn/' },
  { name: '财政部', homeUrl: 'http://www.mof.gov.cn/' },
  { name: '人力资源和社会保障部', homeUrl: 'https://www.mohrss.gov.cn/' },
  { name: '自然资源部', homeUrl: 'https://www.mnr.gov.cn/' },
  { name: '住房和城乡建设部', homeUrl: 'https://www.mohurd.gov.cn/' },
  { name: '农业农村部', homeUrl: 'https://www.moa.gov.cn/' },
  { name: '商务部', homeUrl: 'https://www.mofcom.gov.cn/' },
  { name: '国家卫生健康委员会', homeUrl: 'http://www.nhc.gov.cn/' },
  { name: '退役军人事务部', homeUrl: 'https://www.mva.gov.cn/' },
  { name: '应急管理部', homeUrl: 'https://www.mem.gov.cn/' },
  { name: '审计署', homeUrl: 'http://www.audit.gov.cn/' },
  { name: '海关总署', homeUrl: 'http://www.customs.gov.cn/' },
  { name: '国家税务总局', homeUrl: 'http://www.chinatax.gov.cn/' },
  { name: '国家市场监督管理总局', homeUrl: 'https://www.samr.gov.cn/' },
];

async function findNewsUrls(html, baseUrl) {
  const newsKeywords = ['新闻', 'xwdt', 'xwfb', 'gzdt', 'zwgk', 'zhengwuxinxi', '通知公告'];
  const hrefRegex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const urls = [];
  
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].trim();
    
    if (href.startsWith('http')) continue;
    
    const normalized = normalizeUrl(href, baseUrl);
    
    let isNews = false;
    if (newsKeywords.some(kw => text.includes(kw))) isNews = true;
    if (newsKeywords.some(kw => href.includes(kw))) isNews = true;
    
    if (isNews && !urls.includes(normalized)) {
      urls.push({ url: normalized, text });
    }
  }
  
  return urls.slice(0, 5);
}

async function testSite(site) {
  console.log(`\n========================================`);
  console.log(`${site.name}`);
  console.log(`首页: ${site.homeUrl}`);
  console.log(`========================================`);
  
  try {
    const homeHtml = await fetchHtml(site.homeUrl);
    console.log(`首页大小: ${homeHtml.length.toLocaleString()} 字节`);
    
    const newsUrls = await findNewsUrls(homeHtml, site.homeUrl);
    console.log(`\n找到的新闻栏目:`);
    newsUrls.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.text}: ${u.url}`);
    });
    
    for (const { url, text } of newsUrls.slice(0, 2)) {
      console.log(`\n--- 测试: ${text} ---`);
      try {
        const html = await fetchHtml(url);
        console.log(`页面大小: ${html.length.toLocaleString()} 字节`);
        
        const items = parseGovernmentList(html, url, 10);
        
        if (items.length > 0) {
          console.log(`✅ 通用解析器可用！`);
          console.log(`抓取到 ${items.length} 条记录:`);
          items.forEach((item, i) => {
            console.log(`  ${i + 1}. ${item.title.slice(0, 50)}${item.title.length > 50 ? '...' : ''}`);
            console.log(`     URL: ${item.url.slice(0, 80)}${item.url.length > 80 ? '...' : ''}`);
            console.log(`     日期: ${item.listPublishedAt}`);
          });
          
          return { name: site.name, success: true, count: items.length, url, category: text };
        } else {
          console.log(`❌ 通用解析器未能抓取到数据`);
        }
      } catch (err) {
        console.log(`❌ 请求失败: ${err.message}`);
      }
    }
    
    return { name: site.name, success: false, count: 0, url: null, category: null };
  } catch (err) {
    console.log(`❌ 首页请求失败: ${err.message}`);
    return { name: site.name, success: false, count: 0, url: null, category: null };
  }
}

async function main() {
  console.log('========================================');
  console.log('政府网站通用解析器兼容性测试');
  console.log('========================================');
  
  const results = [];
  
  for (const site of TEST_SITES) {
    const result = await testSite(site);
    results.push(result);
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n\n========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`\n通用解析器可用: ${successCount} 个`);
  console.log(`需要专用解析器: ${failCount} 个`);
  
  console.log('\n【通用解析器可用站点】');
  results.filter(r => r.success).forEach(r => {
    console.log(`  ✅ ${r.name}`);
    console.log(`     栏目: ${r.category}`);
    console.log(`     URL: ${r.url}`);
    console.log(`     数据量: ${r.count} 条`);
  });
  
  console.log('\n【需要专用解析器站点】');
  results.filter(r => !r.success).forEach(r => {
    console.log(`  ❌ ${r.name}`);
  });
}

main();