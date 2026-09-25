"use client";

import { useMemo } from "react";
import { getCategoryStyle } from "@/lib/monitor/content-meta";
import { RichTooltip } from "@/components/rich-tooltip";

// 分类标签（胶囊）
export function CategoryBadge({
  category,
  score,
  topKeywords,
}: {
  category: string;
  score: number;
  topKeywords?: string[];
}) {
  const style = getCategoryStyle(category);
  return (
    <RichTooltip style={style}>
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${style.chip}`}>
        <span className="font-medium">{style.displayLabel}</span>
        <span className="text-[11px] opacity-75">({score})</span>
        {topKeywords && topKeywords.length > 0 ? (
          <span className="text-[11px] opacity-80">{topKeywords.slice(0, 2).join(" / ")}</span>
        ) : null}
      </span>
    </RichTooltip>
  );
}

// 段落内关键词高亮渲染
export function HighlightedParagraph({
  text,
  matches,
}: {
  text: string;
  matches: Array<{ keyword: string; category: string }>;
}) {
  const sortedMatches = useMemo(() => {
    const seen = new Set<string>();
    const unique = matches.filter((m) => {
      if (!m.keyword) return false;
      if (seen.has(m.keyword)) return false;
      seen.add(m.keyword);
      return true;
    });
    unique.sort((a, b) => b.keyword.length - a.keyword.length);
    return unique;
  }, [matches]);

  if (!text) return null;
  if (sortedMatches.length === 0) return <>{text}</>;

  type Hit = { start: number; end: number; keyword: string; category: string };
  const hits: Hit[] = [];
  for (const m of sortedMatches) {
    if (!m.keyword) continue;
    let idx = 0;
    while (true) {
      const pos = text.indexOf(m.keyword, idx);
      if (pos === -1) break;
      const overlap = hits.some((h) => pos < h.end && pos + m.keyword.length > h.start);
      if (!overlap) hits.push({ start: pos, end: pos + m.keyword.length, keyword: m.keyword, category: m.category });
      idx = pos + m.keyword.length;
    }
  }
  if (hits.length === 0) return <>{text}</>;
  hits.sort((a, b) => a.start - b.start);

  const segments: Array<{ kind: "plain" | "hit"; text: string; category?: string }> = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start > cursor) segments.push({ kind: "plain", text: text.slice(cursor, h.start) });
    segments.push({ kind: "hit", text: h.keyword, category: h.category });
    cursor = h.end;
  }
  if (cursor < text.length) segments.push({ kind: "plain", text: text.slice(cursor) });

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "plain") return <span key={i}>{seg.text}</span>;
        const style = getCategoryStyle(seg.category ?? "");
        return (
          <mark key={i} className={style.highlight} title={style.displayLabel}>
            {seg.text}
          </mark>
        );
      })}
    </>
  );
}
