import type { MonitorListItem } from "@/lib/monitor/types";

// 通用 HTML 博客列表页抓取器
// 适用于没有 RSS 的博客首页，通过识别 <a> 标签中的文章链接提取条目
// 用法：在 runner.ts 里注册 type = "html_blog"，listUrl 填博客列表页地址

export async function fetchHtmlBlog(listUrl: string, limit: number): Promise<MonitorListItem[]> {
  const response = await fetch(listUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`HTML blog fetch failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const base = new URL(listUrl);

  return extractBlogLinks(html, base, limit);
}

function extractBlogLinks(html: string, base: URL, limit: number): MonitorListItem[] {
  const items: MonitorListItem[] = [];
  const seen = new Set<string>();

  // 找所有 <a href="...">文字</a>，过滤出长得像文章标题的链接
  const linkPattern = /<a[^>]+href=["']([^"'#?][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkPattern.exec(html)) !== null && items.length < limit) {
    let href = m[1].trim();
    const rawText = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // 标题太短或太长的跳过（通常是菜单/按钮/图片alt）
    if (rawText.length < 8 || rawText.length > 200) continue;

    // 补全相对路径
    try {
      href = new URL(href, base).toString();
    } catch {
      continue;
    }

    // 只保留同域链接，排除锚点、图片、PDF等
    const u = new URL(href);
    if (u.hostname !== base.hostname) continue;
    if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|mp4)$/i.test(u.pathname)) continue;
    if (seen.has(href)) continue;

    // 路径要比根路径深至少一级（排除导航链接如 /about、/contact）
    const depth = u.pathname.replace(/\/$/, "").split("/").filter(Boolean).length;
    if (depth < 1) continue;

    seen.add(href);

    // 尝试从临近 HTML 提取日期
    const contextStart = Math.max(0, m.index - 300);
    const context = html.slice(contextStart, m.index + m[0].length + 300);
    const date = extractNearbyDate(context);

    items.push({
      title: rawText,
      url: href,
      listPublishedAt: date,
    });
  }

  return items;
}

// 从链接附近的 HTML 片段里找日期
function extractNearbyDate(context: string): string {
  const today = new Date().toISOString().slice(0, 10);

  // ISO 格式：2024-03-15
  const iso = context.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) {
    const d = new Date(iso[1]);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) return iso[1];
  }

  // 英文格式：March 15, 2024 / Mar 15, 2024
  const eng = context.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+(\d{4})\b/i,
  );
  if (eng) {
    const d = new Date(eng[0]);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  return "";
}
