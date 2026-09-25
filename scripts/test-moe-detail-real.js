// 使用 Node.js 直接测试教育部详情页解析
const https = require('https');
const http = require('http');

const url = "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202606/t20260629_1442042.html";

function fetchHtml(urlStr) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
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

// 简化版的正文提取逻辑
function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function findMatchingClose(html, openStart, tagName) {
  const openEndMatch = /^[^>]*>/.exec(html.slice(openStart));
  if (!openEndMatch) return null;
  let scanPos = openStart + openEndMatch[0].length;
  let depth = 1;
  const openRe = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, 'gi');
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
  while (depth > 0) {
    openRe.lastIndex = scanPos;
    closeRe.lastIndex = scanPos;
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      scanPos = nextOpen.index + nextOpen[0].length;
    } else {
      depth -= 1;
      if (depth === 0) return nextClose.index;
      scanPos = nextClose.index + nextClose[0].length;
    }
  }
  return null;
}

const CONTENT_SELECTORS = [
  { kind: 'id', value: 'pages_content' },
  { kind: 'class', value: 'pages_content' },
  { kind: 'id', value: 'UCAP-CONTENT' },
  { kind: 'id', value: 'TRS_Editor' },
  { kind: 'class', value: 'TRS_Editor' },
  { kind: 'id', value: 'mainText' },
  { kind: 'id', value: 'content' },
  { kind: 'class', value: 'content' },
  { kind: 'id', value: 'article' },
  { kind: 'class', value: 'article' },
  { kind: 'id', value: 'main' },
  { kind: 'class', value: 'main' },
  { kind: 'id', value: 'body' },
  { kind: 'class', value: 'body' },
  { kind: 'id', value: 'zhengwen' },
  { kind: 'id', value: 'zw' },
];

function findContentContainer(html) {
  for (const selector of CONTENT_SELECTORS) {
    const attrName = selector.kind === 'id' ? 'id' : 'class';
    const targetValue = selector.value.toLowerCase();
    const openRegex = new RegExp(
      `<(div|section|article|td|span)(?:\\s+[^>]*?)?\\s+${attrName}\\s*=\\s*["']([^"']*)["'][^>]*>`,
      'gi',
    );

    let om;
    while ((om = openRegex.exec(html)) !== null) {
      const tagName = om[1].toLowerCase();
      const attrVal = (om[2] || '').toLowerCase();

      if (selector.kind === 'id') {
        if (attrVal !== targetValue) continue;
      } else {
        const tokens = attrVal.split(/\s+/).filter(Boolean);
        if (!tokens.includes(targetValue)) continue;
      }

      const openStart = om.index;
      const closePos = findMatchingClose(html, openStart, tagName);
      if (closePos == null) continue;
      const openEnd = openStart + om[0].length;
      if (closePos <= openEnd) continue;
      return {
        selector: `${selector.kind}="${selector.value}"`,
        html: html.slice(openEnd, closePos),
      };
    }
  }
  return null;
}

function extractParagraphs(html) {
  const paragraphs = [];
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');

  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(stripped)) !== null) {
    const text = decodeHtml(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (text.length >= 6) {
      paragraphs.push(text);
    }
  }
  
  if (paragraphs.length === 0) {
    const divRegex = /<div[^>]*>([\s\S]*?)<\/div>/gi;
    while ((m = divRegex.exec(stripped)) !== null) {
      const text = decodeHtml(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      if (text.length >= 20) {
        paragraphs.push(text);
      }
    }
  }
  
  return paragraphs;
}

async function main() {
  console.log('========================================');
  console.log('教育部详情页解析测试（真实页面）');
  console.log('========================================\n');
  
  console.log(`目标 URL: ${url}\n`);
  
  try {
    const html = await fetchHtml(url);
    console.log(`页面大小: ${html.length} 字节\n`);
    
    // 查找正文容器
    const container = findContentContainer(html);
    console.log('【正文容器定位】');
    if (container) {
      console.log(`  ✅ 找到: ${container.selector}`);
      console.log(`  容器大小: ${container.html.length} 字节\n`);
      
      const paragraphs = extractParagraphs(container.html);
      console.log(`【正文段落】（共 ${paragraphs.length} 段）`);
      paragraphs.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.slice(0, 150)}${p.length > 150 ? '...' : ''}`);
      });
      
      const totalLen = paragraphs.reduce((s, p) => s + p.length, 0);
      console.log(`\n总字数: ${totalLen}`);
      console.log(`质量评估: ${totalLen > 400 ? 'full (完整)' : totalLen > 80 ? 'partial (部分)' : 'empty (空)'}`);
    } else {
      console.log('  ❌ 未找到白名单容器，尝试启发式...');
      
      const paragraphs = extractParagraphs(html);
      console.log(`\n【启发式提取段落】（共 ${paragraphs.length} 段）`);
      paragraphs.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.slice(0, 150)}${p.length > 150 ? '...' : ''}`);
      });
    }
    
    console.log('\n========================================');
    console.log('测试完成');
    console.log('========================================');
  } catch (err) {
    console.error('错误:', err.message);
  }
}

main();