import type { ContentItem } from "@/hooks/use-item-list";

/**
 * importance_level 的档位顺序，数值越大越重要。
 * 取值来自库里的真实分布（与桌面端 / 创作者雷达同一套）：
 *   普通内容 / 中等重点 / 重点内容 / 核心关注
 */
const LEVEL_ORDER: Record<string, number> = {
  核心关注: 4,
  重点内容: 3,
  中等重点: 2,
  普通内容: 1,
};

/** 「重点」的门槛：核心关注 + 重点内容（对齐桌面端 inbox 的 urgent+highlight 口径） */
const KEY_THRESHOLD = 3;

function levelRank(item: ContentItem): number {
  return LEVEL_ORDER[item.importanceLevel] ?? 0;
}

/**
 * Today 的「今日重点」。
 *
 * 政策雷达没有创作者视角（lens），所以按真实有的信号排序：
 * 重要性档位 → 是否收藏 → 关键词分 → 越新越前。
 * Today 的卖点是"先看这几条"，没有重点时退化成普通列表，跟 Feed 重复——
 * 所以空列表时由调用方显示空态，而不是硬凑。
 *
 * 不改动入参数组（用展开副本再排序）。
 */
export function pickRanked(items: ContentItem[], limit = 4): ContentItem[] {
  return [...items]
    .sort((a, b) => {
      const byLevel = levelRank(b) - levelRank(a);
      if (byLevel !== 0) return byLevel;
      const byStar = Number(b.isStarred) - Number(a.isStarred);
      if (byStar !== 0) return byStar;
      const byScore = (b.keywordScore ?? 0) - (a.keywordScore ?? 0);
      if (byScore !== 0) return byScore;
      return (b.listPublishedAt ?? "").localeCompare(a.listPublishedAt ?? "");
    })
    .slice(0, limit);
}

/**
 * Today 顶部的 "N 条新增 · M 条重点（近 24 小时）"。
 * 与桌面首页同一口径：按抓取时间（firstSeenAt）数近 24 小时新增，以及其中的重点。
 */
export function summarize(items: ContentItem[], now: Date = new Date()): { fresh: number; key: number } {
  const since = now.getTime() - 24 * 60 * 60 * 1000;
  let fresh = 0;
  let key = 0;
  for (const i of items) {
    if (!i.firstSeenAt || new Date(i.firstSeenAt).getTime() < since) continue;
    fresh++;
    if (levelRank(i) >= KEY_THRESHOLD) key++;
  }
  return { fresh, key };
}
