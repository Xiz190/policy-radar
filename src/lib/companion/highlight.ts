/**
 * 正文里的关键词命中切分。纯函数，便于单测
 * （项目 vitest 无 jsdom，渲染不了组件——同 nav.ts / today.ts / feed.ts）。
 *
 * 为什么不复用桌面端的 HighlightedParagraph：那个按分类上色（每个分类一套
 * Tailwind 色），而伴侣版的正文高亮是**固定浅黄**、不随分类也不随品牌色走。
 * 两套高亮语言是刻意分开的（摘要块用品牌色 = "系统的话"，正文命中用固定
 * 浅黄 = 系统功能），混在一起就分不清谁说的。
 */

export type TextSegment = { text: string; hit: boolean };

/**
 * 把一段正文按命中的关键词切成片段。
 *
 * 规则（沿用桌面端 HighlightedParagraph 的算法，保证两端口径一致）：
 * - 关键词按**长度降序**处理，长词优先，避免短词把长词切碎
 * - 重叠的部分**先到先得**（长的先注册），后到的重叠段直接丢弃
 * - 大小写不敏感？——**不**。沿用桌面端的 `indexOf`，区分大小写。
 *   两端口径必须一致，否则同一条内容在手机和桌面上高亮的位置不一样。
 */
export function segmentByKeywords(text: string, keywords: string[]): TextSegment[] {
  if (!text) return [];
  const terms = Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean))).sort(
    (a, b) => b.length - a.length,
  );
  if (terms.length === 0) return [{ text, hit: false }];

  type Hit = { start: number; end: number };
  const hits: Hit[] = [];
  for (const term of terms) {
    let idx = 0;
    for (;;) {
      const pos = text.indexOf(term, idx);
      if (pos === -1) break;
      const overlaps = hits.some((h) => pos < h.end && pos + term.length > h.start);
      if (!overlaps) hits.push({ start: pos, end: pos + term.length });
      idx = pos + term.length;
    }
  }
  if (hits.length === 0) return [{ text, hit: false }];

  hits.sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start > cursor) segments.push({ text: text.slice(cursor, h.start), hit: false });
    segments.push({ text: text.slice(h.start, h.end), hit: true });
    cursor = h.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}

/** 从 matchedKeywords 里取出关键词字符串数组（去空）。 */
export function keywordStrings(matched: Array<{ keyword?: string }> | undefined): string[] {
  return (matched ?? []).map((m) => (m.keyword ?? "").trim()).filter(Boolean);
}
