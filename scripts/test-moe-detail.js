const fs = require('fs');
const path = require('path');

const MOE_DETAIL_MOCK_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>教育部召开2025年全国教育工作会议 - 教育部</title>
</head>
<body>
  <div class="header">
    <div class="nav">导航栏</div>
    <div class="breadcrumb">首页 > 时政要闻 > 正文</div>
  </div>
  
  <div class="main-content">
    <div class="article-header">
      <h1>教育部召开2025年全国教育工作会议</h1>
      <div class="article-info">
        <span class="date">发布时间：2025-06-15 09:30</span>
        <span class="source">来源：教育部</span>
      </div>
    </div>
    
    <div id="pages_content" class="pages_content">
      <p>6月15日，教育部在北京召开2025年全国教育工作会议。教育部党组书记、部长怀进鹏出席会议并讲话。</p>
      
      <p>会议强调，要深入学习贯彻习近平新时代中国特色社会主义思想，全面贯彻党的教育方针，落实立德树人根本任务，加快建设教育强国，为全面建设社会主义现代化国家提供坚实支撑。</p>
      
      <p>怀进鹏指出，2025年是实施"十四五"规划的关键一年，教育工作要重点抓好以下几个方面：</p>
      
      <p>一是坚持和加强党对教育工作的全面领导，确保教育事业始终沿着正确方向前进。</p>
      
      <p>二是扎实推进立德树人根本任务，培养德智体美劳全面发展的社会主义建设者和接班人。</p>
      
      <p>三是深化教育改革创新，激发教育发展活力。要推进义务教育优质均衡发展，大力发展职业教育，加强高等教育内涵建设。</p>
      
      <p>四是加强教师队伍建设，提升教师队伍整体素质。要完善教师培训体系，提高教师待遇，营造尊师重教的良好氛围。</p>
      
      <p>五是扩大教育对外开放，提升教育国际影响力。要加强与世界各国的教育交流合作，积极参与全球教育治理。</p>
      
      <p>会议要求，各地教育部门和各级各类学校要认真贯彻落实会议精神，扎实推进各项工作，确保完成全年教育工作目标任务。</p>
      
      <p><strong>《新时代基础教育强师计划》政策解读材料</strong></p>
      <p>为深入贯彻落实《新时代基础教育强师计划》，教育部制定了详细的实施方案，明确了工作目标和任务要求。</p>
      
      <div class="attachment-list">
        <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/P0202506155678901234.pdf">附件1：新时代基础教育强师计划全文.pdf</a>
        <a href="/jyb_xwfb/gzdt_gzdt/s5987/202506/P0202506155678901235.docx">附件2：实施方案.docx</a>
      </div>
    </div>
    
    <div class="sidebar">
      <div class="related-articles">
        <h3>相关文章</h3>
        <ul>
          <li><a href="/202506/t20250614_1135123.html">关于印发《新时代基础教育强师计划》的通知</a></li>
          <li><a href="/202506/t20250613_1135089.html">教育部部署暑期校外培训治理工作</a></li>
        </ul>
      </div>
      
      <div class="share-box">
        <span>分享到：</span>
        <a href="#" class="wechat">微信</a>
        <a href="#" class="weibo">微博</a>
      </div>
    </div>
  </div>
  
  <div class="footer">
    <div class="copyright">版权所有：中华人民共和国教育部</div>
    <div class="icp">京ICP备12345678号</div>
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

function pickBestBaseUrl(html, fallbackUrl) {
  const baseMatch = html.match(/<base\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i);
  return baseMatch ? baseMatch[1] : fallbackUrl;
}

function normalizeUrl(href, baseUrl) {
  try {
    return new URL(href.trim(), baseUrl).toString();
  } catch {
    return href;
  }
}

const LOW_VALUE_TOKEN_KEYWORDS = [
  'header', 'footer', 'aside', 'breadcrumb',
  'nav', 'navigation', 'navbox',
  'toolbar', 'toolbox',
  'share',
  'banner',
  'sider', 'side', 'sidebar',
  'comment', 'comments',
  'btn', 'button',
  'menu',
  'top',
  'back',
  'search',
  'login', 'register',
  'user', 'userbox',
  'qr', 'qrcode',
  'wechat', 'weixin',
  'weibo',
  'douyin',
  'shipinhao', 'video',
  'gzh',
  'khd', 'app', 'download', 'mobile', 'client',
  'android', 'ios', 'iphone', 'apple',
  'ewm', 'erweima',
  'related', 'xiangguan', 'friendlink', 'friend', 'linklist',
  'sitemap', 'site', 'map',
  'beian', 'icp', 'copyright', 'info', 'siteinfo',
  'fanye', 'pager', 'pagination', 'pagebox',
  'listbox', 'list', 'newsbox',
  'dangzhi', 'dangzhibanner',
  'shilaohuaicon',
  'guohui', 'emblem',
  'guanliyuan', 'guanli', 'admin',
  'xwbd', 'lianbolistfrcon', 'xwfb',
  'gov', 'govbanner', 'govfooter', 'govheader', 'govnav', 'govside', 'govtoolbar',
];

const LOW_VALUE_EXACT_TOKENS = [
  'topbar', 'top-bar', 'top_bar', 'topbanner', 'top-banner', 'top_banner',
  'titlebar', 'title-bar', 'title_bar', 'titletoolbar', 'title-toolbar',
  'mininav', 'mini-nav', 'mini_nav', 'minibar', 'mini-bar', 'mini_bar',
  'subnav', 'sub-nav', 'sub_nav',
  'headertoolbar', 'header-toolbar', 'header_toolbar',
  'breadcrumbnav', 'breadcrumb',
  'pagetoolbar', 'page-toolbar', 'page_toolbar',
  'pagetool', 'page-tool', 'page_tool',
  'pagetools', 'page-tools', 'page_tools',
  'sharebox', 'share-box', 'share_box',
  'print', 'dayin',
  'close', 'closewindow', 'guanbi',
  'rightbox', 'right-box', 'right_box', 'rightbar', 'right-bar', 'right_bar',
  'leftbox', 'left-box', 'left_box', 'leftbar', 'left-bar', 'left_bar',
  'sidebox', 'side-box', 'side_box',
  'sidebar', 'side-bar', 'side_bar',
  'linklist', 'link-list', 'link_list',
  'friendlink', 'friend-link', 'friend_link',
  'relatedlinks', 'related-links', 'related_links',
  'youqinglianjie',
  'xiangguan', 'xiangguanlianbo',
  'searchbox', 'search-box', 'search_box', 'searchbar', 'search-bar', 'search_bar',
  'loginbox', 'login-box', 'login_box',
  'userbox', 'user-box', 'user_box',
  'qrcode', 'qr-code', 'qr_code',
  'wechatqr', 'wechat-qr', 'wechat_qr', 'weixinqr', 'weixin-qr', 'weixin_qr',
  'gzhimg', 'gzh-img', 'gzh_img',
  'gongzhonghao',
  'kehuduan', 'khdxz', 'yidongkehuduan', 'mobileclient', 'mobile-client', 'mobile_client',
  'mobiledown', 'mobile-down', 'mobile_down', 'appdown', 'app-down', 'app_down',
  'androiddown', 'android-down', 'android_down',
  'iosdown', 'ios-down', 'ios_down',
  'shipinhao', 'shipin-hao', 'shipin_hao', 'videohao', 'video-hao', 'video_hao',
  'douyinhao', 'douyin-hao', 'douyin_hao', 'dyhao',
  'backtop', 'back-top', 'back_top', 'gotop', 'go-top', 'go_top',
  'backhome', 'back-home', 'back_home', 'backto', 'back-to', 'back_to',
  'copyrightbox', 'copyright-box', 'copyright_box',
  'siteinfo', 'site-info', 'site_info', 'siteinformation', 'site-information', 'site_information',
  'icpbox', 'icp-box', 'icp_box',
  'beian', 'bei-an', 'bei_an',
  'fanyelist', 'fanye-list', 'fanye_list',
  'pagination', 'pager', 'pageinfo', 'page-info', 'page_info',
  'listbox', 'newsbox', 'news-box', 'news_box',
  'pagesdate', 'pages-date', 'pages_date',
  'pagesprint', 'pages-print', 'pages_print',
  'pagestoolbar', 'pages-toolbar', 'pages_toolbar',
  'xwbdlianbolistfrcon', 'xwbd-lianbolistfrcon', 'xwbd_lianbolistfrcon',
  'xwfblistbox', 'xwfb-listbox', 'xwfb_listbox',
  'dangzhibanner', 'dangzhi-banner', 'dangzhi_banner',
  'shilaohuaicon', 'shilaohua-icon', 'shilaohua_icon',
  'guohui03',
  'currentposition', 'current-position', 'current_position',
  'dazhongxiao', 'fontsize', 'font-size', 'font_size',
  'jiucuo', 'jiucuo-box', 'jiucuo_box',
  'fenxiang', 'fenxiangbox', 'fenxiang-box', 'fenxiang_box',
  'liuyan', 'message', 'feedback',
  'sousuo', 'denglu', 'zhuce', 'loginform', 'zhuceform',
  'liuyanban', 'liuyan-ban', 'liuyan_ban',
  'lianxiwomen', 'aboutus', 'about-us', 'about_us', 'guanyu',
  'shouye', 'shou-ye', 'shou_ye', 'homepage', 'home-page', 'home_page',
  'wangzhan', 'site-nav', 'site_nav', 'sitenavigation', 'site-navigation', 'site_navigation',
  'daohang', 'daohanglan',
  'fujianlist', 'fujian-list', 'fujian_list',
];

const MAIN_CONTENT_TOKENS = [
  'article', 'content', 'contents', 'body', 'main',
  'text', 'zhengwen', 'zw', 'post', 'entry', 'detail', 'details',
  'pages',
  'pagescontent', 'pages-content', 'pages_content',
  'ucap', 'ucap-content', 'ucap_content',
  'editor',
  'paragraph', 'paragraphs',
  'newsdetail', 'news_detail', 'news-detail',
  'article-detail', 'article_detail', 'articledetail',
  'contentdetail', 'content_detail', 'content-detail',
  'content-main', 'content_main', 'contentmain',
  'main-content', 'main_content', 'maincontent',
  'main-body', 'main_body', 'mainbody',
  'mainboxerji', 'myconboxzw', 'boxcontent', 'tihx', 'tish',
  'pagescontent', 'pages-content', 'pages_content',
  'ucap', 'ucapcontent', 'ucap-content', 'ucap_content',
  'ueditor', 'trsueditor',
];

function isLowValueSelector(classId) {
  if (!classId) return false;
  const clsTokens = classId.toLowerCase().split(/\s+/).filter(Boolean);
  if (clsTokens.length === 0) return false;

  for (const clsToken of clsTokens) {
    const normalized = clsToken.replace(/[-_]+/g, '');
    if (MAIN_CONTENT_TOKENS.some((m) => m.replace(/[-_]+/g, '') === normalized)) {
      return false;
    }
  }

  for (const clsToken of clsTokens) {
    const subTokens = clsToken.split(/[-_]/).filter(Boolean);
    if (subTokens.some((st) => ATTACHMENT_LIST_TOKENS.includes(st))) {
      return false;
    }
  }

  let hasLowValue = false;
  for (const clsToken of clsTokens) {
    const normalized = clsToken.replace(/[-_]+/g, '');
    if (LOW_VALUE_EXACT_TOKENS.some((ex) => ex.replace(/[-_]+/g, '') === normalized)) {
      hasLowValue = true;
      break;
    }
    const subTokens = clsToken.split(/[-_]/).filter(Boolean);
    for (const st of subTokens) {
      if (LOW_VALUE_TOKEN_KEYWORDS.includes(st)) {
        hasLowValue = true;
        break;
      }
    }
    if (hasLowValue) break;
  }
  if (hasLowValue) return true;

  return false;
}

const DOCUMENT_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar', '7z'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];

const NOISE_PARAGRAPH_KEYWORDS = [
  '【 大 中 小 】', '【打印此页】', '【关闭窗口】', '【打印】', '【关闭】',
  '大 中 小', '大中小', '字体大小', '字号',
  '打印此页', '关闭窗口', '关闭本页', '关闭网页',
  '当前位置', '您所在的位置', '您现在的位置',
  '网站无障碍', '无障碍浏览', '无障碍服务', '适老化',
  '返回首页', '返回顶部', '回到顶部', '返回主页', '返回主站',
  '无障碍', '读屏', '读屏软件',
  '站点地图', '网站地图', 'sitemap',
  'rss订阅', 'rss 订阅', 'rss',
  '财政部微信', '财政部视频号', '财政部微信公众号',
  '微信公众号', '官方微信', '微信', '扫码关注', '扫一扫',
  '视频号', '官方视频号',
  '官方抖音号', '抖音号', '抖音',
  '移动客户端', '客户端下载', 'app下载', '扫码下载', '扫描二维码',
  'android下载', '安卓下载', 'iphone下载', '苹果下载', 'ios下载', '下载客户端',
  '友情链接', '相关链接', '相关新闻', '相关部门', '相关地区',
  '返回列表', '返回上一页', '上一页', '下一页', '上一篇', '下一篇',
  '更多阅读', '延伸阅读',
  '版权所有', '主办单位', '承办单位', '联系我们', '关于我们', '网站声明', '隐私政策',
  'icp备案', '备案号', '京公网安备', '京icp', '网站标识码',
  'copyright', '©', '网站导航', '跳转到', '跳到', '快速入口', '导航菜单',
  '首页', '网站首页', '网站无障碍开关', '相关稿件', '新闻列表',
  '责任编辑', '编辑：', '责编：', '作者：',
  '发布日期', '发稿日期', '稿件日期', '发布时间',
  '来源：', '文章来源', '信息来源', '来源:',
  '【我要纠错】', '我要纠错', '【纠错】', '【编辑】', '【审核】',
];

const ATTACHMENT_LIST_TOKENS = [
  'attachment', 'attach', 'fujian', 'fj', 'filelist', 'file-list', 'file_list',
];

function isNoiseParagraph(text) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 5) return true;
  const lower = trimmed.toLowerCase();
  if (/^(https?:\/\/|www\.)/i.test(trimmed) && trimmed.length < 120) return true;
  if (/^[\d\s\-—–_:：/\\.。,，、;；|()（）\[\]【】《》"'""''`\p{P}]+$/u.test(trimmed) && trimmed.length < 60) return true;
  if (NOISE_PARAGRAPH_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) return true;
  return false;
}

const GOVERNMENT_CONTENT_SELECTORS = [
  { kind: 'id', value: 'pages_content' },
  { kind: 'class', value: 'pages_content' },
  { kind: 'id', value: 'UCAP-CONTENT' },
  { kind: 'id', value: 'ucap-content' },
  { kind: 'id', value: 'ucap_content' },
  { kind: 'class', value: 'TRS_Editor' },
  { kind: 'id', value: 'TRS_Editor' },
  { kind: 'class', value: 'trs_editor_view' },
  { kind: 'class', value: 'TRS_UEDITOR' },
  { kind: 'class', value: 'trs_paper_default' },
  { kind: 'class', value: 'trs_web' },
  { kind: 'class', value: 'TRS_PRE' },
  { kind: 'id', value: 'pagescontent' },
  { kind: 'class', value: 'pages-content' },
  { kind: 'class', value: 'content_body_box' },
  { kind: 'class', value: 'content_body' },
  { kind: 'class', value: 'content_box' },
  { kind: 'class', value: 'content_top' },
  { kind: 'class', value: 'Custom_UnionStyle' },
  { kind: 'id', value: 'print_html' },
  { kind: 'class', value: 'content_box_xg' },
  { kind: 'class', value: 'content_down' },
  { kind: 'id', value: 'mainText' },
  { kind: 'class', value: 'mainTextBox' },
  { kind: 'class', value: 'tyContent' },
  { kind: 'class', value: 'tycontent' },
  { kind: 'class', value: 'tyContentMain' },
  { kind: 'class', value: 'tycontentmain' },
  { kind: 'class', value: 'ldConRMain' },
  { kind: 'class', value: 'ldconrmain' },
  { kind: 'class', value: 'inContent' },
  { kind: 'class', value: 'incontent' },
  { kind: 'id', value: 'content-main' },
  { kind: 'class', value: 'content_main' },
  { kind: 'id', value: 'main-content' },
  { kind: 'class', value: 'main_content' },
  { kind: 'id', value: 'maincontent' },
  { kind: 'class', value: 'content-container' },
  { kind: 'id', value: 'content-container' },
  { kind: 'id', value: 'contentdetail' },
  { kind: 'id', value: 'content_detail' },
  { kind: 'id', value: 'content-detail' },
  { kind: 'id', value: 'text-body' },
  { kind: 'class', value: 'text-body' },
  { kind: 'id', value: 'article-detail' },
  { kind: 'class', value: 'article-detail' },
  { kind: 'id', value: 'news-detail' },
  { kind: 'class', value: 'news-detail' },
  { kind: 'id', value: 'news_detail' },
  { kind: 'id', value: 'newsdetail' },
  { kind: 'id', value: 'article-body' },
  { kind: 'class', value: 'article-body' },
  { kind: 'id', value: 'text' },
  { kind: 'class', value: 'text' },
  { kind: 'id', value: 'body' },
  { kind: 'class', value: 'articlebody' },
  { kind: 'id', value: 'body-layer' },
  { kind: 'class', value: 'body-layer' },
  { kind: 'id', value: 'article' },
  { kind: 'class', value: 'article' },
  { kind: 'id', value: 'zw' },
  { kind: 'id', value: 'zhengwen' },
  { kind: 'id', value: 'zwbody' },
  { kind: 'id', value: 'zw-main' },
  { kind: 'id', value: 'zw_main' },
  { kind: 'id', value: 'mainbody' },
  { kind: 'id', value: 'main-body' },
  { kind: 'id', value: 'main_body' },
  { kind: 'id', value: 'maincontainer' },
  { kind: 'id', value: 'main-container' },
  { kind: 'id', value: 'main_container' },
  { kind: 'id', value: 'mainContent' },
];

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

function extractGovernmentContentContainer(html) {
  for (const selector of GOVERNMENT_CONTENT_SELECTORS) {
    const attrName = selector.kind === 'id' ? 'id' : 'class';
    const targetValue = selector.value.toLowerCase();
    const openRegex = new RegExp(
      `<(div|section|article)(?:\\s+[^>]*?)?\\s+${attrName}\\s*=\\s*["']([^"']*)["'][^>]*>`,
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
      return html.slice(openEnd, closePos);
    }
  }
  return null;
}

function parseAndExtract(html, baseUrl, options) {
  const paragraphs = [];
  const attachments = [];
  const externalLinks = [];
  const seenAttachments = new Set();
  const seenExternalLinks = new Set();
  let pageTitle = options?.fallbackTitle || null;

  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');

  const tokens = [];
  let last = 0;
  const tagRegex = /<([^>]+)>/g;
  let m;
  while ((m = tagRegex.exec(stripped)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: stripped.slice(last, m.index) });
    tokens.push({ type: 'tag', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < stripped.length) tokens.push({ type: 'text', value: stripped.slice(last) });

  const stack = [];
  function insideLowValueRegion() {
    for (let i = stack.length - 1; i >= 0; i--) {
      const { tag, classId } = stack[i];
      const t = tag.toLowerCase();
      if (t === 'header' || t === 'footer' || t === 'nav' || t === 'aside') return true;
      if (isLowValueSelector(classId)) return true;
    }
    return false;
  }

  let currentPara = [];
  function flushPara() {
    if (currentPara.length === 0) return;
    const text = decodeHtml(currentPara.join(' ')).replace(/\s+/g, ' ').trim();
    if (text.length > 0 && !isNoiseParagraph(text)) paragraphs.push(text);
    currentPara = [];
  }

  const blockTags = new Set(['p', 'div', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote']);
  const breakTags = new Set(['br']);

  for (const tok of tokens) {
    if (tok.type === 'tag') {
      const raw = tok.value;
      if (raw.startsWith('!--')) continue;
      const closing = raw.startsWith('/');
      const selfClose = raw.endsWith('/');
      const tagMatch = raw.match(/^\/?\s*([a-zA-Z0-9]+)/);
      if (!tagMatch) continue;
      const tag = tagMatch[1].toLowerCase();

      const attrs = {};
      const attrRegex = /([a-zA-Z][a-zA-Z0-9\-:]*)\s*=\s*["']([^"']*)["']/g;
      let am;
      while ((am = attrRegex.exec(raw)) !== null) {
        attrs[am[1].toLowerCase()] = am[2];
      }
      const classIdChunk = [attrs.class, attrs.id].filter(Boolean).join(' ');

      if (!closing && tag === 'a') {
        const href = attrs.href ? attrs.href.trim() : '';
        const normalized = href ? normalizeUrl(href, baseUrl) : '';

        let innerText = '';
        const startIdx = tokens.indexOf(tok);
        if (startIdx >= 0) {
          let depth = 1;
          for (let i = startIdx + 1; i < tokens.length && depth > 0; i++) {
            const t = tokens[i];
            if (t.type === 'tag') {
              const m2 = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec('<' + t.value + '>');
              const innerTag = m2 ? m2[1].toLowerCase() : '';
              if (t.value.startsWith('</')) {
                if (innerTag === 'a') depth--;
              } else if (innerTag === 'a') {
              }
            } else if (t.type === 'text') {
              innerText += t.value;
            }
          }
        }
        const linkText = decodeHtml(innerText).replace(/\s+/g, ' ').trim();

        const fileExtMatch = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|png|jpg|jpeg|gif|bmp|webp|svg|txt|csv|zip|rar|7z)(\?|$)/i.exec(normalized.split('?')[0]);
        const isFileLink = !!fileExtMatch;
        const isDocumentFile = fileExtMatch && DOCUMENT_EXT.includes(fileExtMatch[1].toLowerCase());
        const isImageFile = fileExtMatch && IMAGE_EXT.includes(fileExtMatch[1].toLowerCase());

        if (normalized && !insideLowValueRegion()) {
          if (isFileLink) {
            if (isDocumentFile && !seenAttachments.has(normalized)) {
              seenAttachments.add(normalized);
              attachments.push({
                url: normalized,
                text: linkText || attrs.title || href.split('/').pop() || href,
                kind: 'document',
              });
            }
          }
        }
      }

      if (closing) {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tag === tag) {
            stack.splice(i, 1);
            break;
          }
        }
        if (blockTags.has(tag)) flushPara();
      } else {
        if (!selfClose && tag !== 'br' && tag !== 'hr' && tag !== 'img') {
          stack.push({ tag, classId: classIdChunk });
        }
        if (blockTags.has(tag) || breakTags.has(tag)) flushPara();
      }
    } else {
      const text = decodeHtml(tok.value).replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const top = stack[stack.length - 1];
      const inTitle = !!(top && top.tag === 'title');
      if (inTitle && !pageTitle) pageTitle = text;
      const inHead = stack.some((s) => s.tag === 'head');
      if (inTitle || inHead) continue;
      if (!insideLowValueRegion()) {
        currentPara.push(text);
      }
    }
  }
  flushPara();

  const cleaned = paragraphs
    .map((p) => p.trim())
    .filter((p) => p.length >= 6)
    .filter(
      (p) =>
        !/^(Copyright|©|备案号|ICP|版权所有|关于我们|网站地图|联系我们|回到顶部|返回顶部|加入收藏|设为首页|友情链接|相关链接|返回列表|返回上一页)\b/i.test(
          p
        )
    )
    .filter((p, idx, arr) => idx === 0 || arr[idx - 1] !== p);

  const totalTextLen = cleaned.reduce((s, p) => s + p.length, 0);
  let contentQuality = 'full';
  let captureNote = '';

  if (cleaned.length === 0 || totalTextLen < 80) {
    contentQuality = 'empty';
    captureNote = '未能提取到有效正文。';
  } else if (
    totalTextLen < 400 ||
    cleaned.some((p) => /(点击|下载|查看)?(附件|原文|全文|链接|正文)/.test(p) && p.length < 40)
  ) {
    contentQuality = 'partial';
    captureNote = '提取到的正文较短，可能不完整。';
  } else {
    captureNote = '已自动提取网页正文。';
  }

  if (attachments.length > 0) {
    const docs = attachments.filter((a) => a.kind === 'document').length;
    if (docs > 0) {
      captureNote += `（检测到文档 ${docs} 个。）`;
    }
  }

  return {
    paragraphs: cleaned,
    attachments: attachments.slice(0, 50),
    externalLinks: externalLinks.slice(0, 30),
    contentQuality,
    captureNote,
    pageTitle,
    finalUrl: null,
  };
}

function extractPageTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

console.log('========================================');
console.log('教育部详情页解析测试');
console.log('========================================\n');

const baseUrl = 'https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202506/t20250615_1135264.html';

const containerHtml = extractGovernmentContentContainer(MOE_DETAIL_MOCK_HTML);
console.log('【正文容器定位】');
console.log(`  白名单命中: ${containerHtml ? '是' : '否'}`);
if (containerHtml) {
  console.log(`  容器长度: ${containerHtml.length} 字符`);
}
console.log('');

const result = parseAndExtract(
  containerHtml || MOE_DETAIL_MOCK_HTML,
  baseUrl,
  {
    fallbackTitle: extractPageTitle(MOE_DETAIL_MOCK_HTML),
    preferStrictBody: true,
  }
);

console.log('【页面标题】');
console.log(`  ${result.pageTitle}`);
console.log('');

console.log('【内容质量】');
console.log(`  等级: ${result.contentQuality}`);
console.log(`  备注: ${result.captureNote}`);
console.log('');

console.log('【正文段落】（共 ' + result.paragraphs.length + ' 段）');
result.paragraphs.forEach((p, index) => {
  console.log(`  ${index + 1}. ${p.slice(0, 120)}${p.length > 120 ? '...' : ''}`);
});
console.log('');

console.log('【附件】（共 ' + result.attachments.length + ' 个）');
result.attachments.forEach((a) => {
  console.log(`  · [${a.kind}] ${a.text}`);
  console.log(`    URL: ${a.url}`);
});
console.log('');

console.log('========================================');
console.log('测试完成');
console.log('========================================');