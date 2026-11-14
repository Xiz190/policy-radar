/**
 * 伴侣版（/m）的展示格式化。全部是纯函数，放这里以便单测——
 * 项目 vitest 是 environment:"node"、无 jsdom，渲染不了组件，
 * 所以能测的只有抽出来的逻辑（见 nav.ts / today.ts / feed.ts 同样的理由）。
 *
 * 政策雷达界面固定中文，所以这里直接输出中文，不做语言分支。
 */

// mockup 的日期格式："星期四 · 11月12日"。
// 用显式数组而非 toLocaleDateString：后者受运行环境 locale 影响，
// 服务端与客户端可能给出不同结果，在预渲染的 /m 上会造成水合不一致。
const WEEKDAYS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
] as const;

/**
 * 页头副标题用的日期，如 "11月12日 · 星期四"。
 *
 * ⚠️ 调用方必须**挂载后**再算（见 /m 页里的 state + effect）：
 * /m 是构建时预渲染的静态路由，若在渲染期调用，构建当天的日期会被烤进
 * 产物 HTML，之后每天访问都会与服务端发来的字符串对不上 → 水合不一致。
 */
export function formatCompanionDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEKDAYS[d.getDay()]}`;
}

/**
 * 来源缩写（行首小方块）。
 *
 * 中文来源名（北京市人民政府、北京经信局……）缩略字没有意义时取前两字；
 * 带空格的外文名仍按各词首字母取。单字名原样返回。
 */
export function sourceAbbr(name?: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "??";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (/[㐀-鿿]/.test(trimmed)) return trimmed.slice(0, 2);
  return trimmed.slice(0, 2).toUpperCase();
}

/** 本地时区下的 "YYYY-MM-DD"。 */
export function localDayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2026-09-17" → "9月17日"。喂进来的不是这个形状就原样返回。 */
export function shortDate(dayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey ?? "");
  if (!m) return dayKey ?? "";
  return `${Number(m[2])}月${Number(m[3])}日`;
}

/** 星期名，"2026-09-17" → "星期四"。喂进来的不是日期就原样返回。 */
export function weekdayOf(dayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey ?? "");
  if (!m) return dayKey ?? "";
  return WEEKDAYS[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()];
}

/**
 * Feed 行尾的时间戳，如 "今天" / "1天" / "5天"。
 *
 * ⚠️ 只按**发布日**算天数差，不做小时级。
 * 库里 `list_published_at` 是纯日期（无时刻），拿不到"发布后 2 小时"这种精度；
 * 若改用 firstSeenAt（确实有时刻）会变成"我们抓到的时刻"而不是"发布的时刻"，
 * 那是另一回事、会误导。所以这里老实显示天，不假装有小时。
 */
export function shortAgo(dayKey: string, now: Date): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey ?? "");
  if (!m) return "";
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return "今天";
  return `${days}天`;
}

/**
 * 最近浏览的相对时间；超一周退回绝对日期。
 *
 * `now` 可注入，仅为可测性——生产调用不传，行为与 Date.now() 直取一致。
 */
export function viewedLabel(iso?: string, now: number = Date.now()): string {
  if (!iso) return "刚刚";
  const diff = now - new Date(iso).getTime();
  // 无效日期会得到 NaN；比"未来时间"（diff 为负）一并归到刚刚。
  if (!Number.isFinite(diff) || diff < 60_000) return "刚刚";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} 天前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 估算阅读时长（分钟），如 "4 分钟读完" 里的那个 4。
 *
 * 库里没有这个字段，只能从正文估。中日韩字符按 ~350 字/分，
 * 拉丁词按 ~220 词/分，两者相加再向上取整。
 * 取 1 分钟为下限——"0 分钟读完"读起来像坏了。
 *
 * ⚠️ 这是**估算**，不是精确值。要在诚实局限里说明；别把它当成测量结果讲。
 */
export function readingMinutes(paragraphs: string[] | undefined): number {
  const text = (paragraphs ?? []).join(" ");
  if (!text.trim()) return 1;
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const rest = text.replace(/[㐀-鿿豈-﫿]/g, " ");
  const words = (rest.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
  const minutes = cjk / 350 + words / 220;
  return Math.max(1, Math.ceil(minutes));
}
