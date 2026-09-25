"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  calculatePriorityScore,
  formatPriorityScore,
  type PriorityScoreResult,
} from "@/lib/monitor/priority-score";
import { generateMockDailySummary } from "@/lib/monitor/mock";
import {
  Calendar, Star,
} from "lucide-react";

export type ImportanceLevel = "核心关注" | "加急推荐" | "重点内容" | "普通内容";

export type TopListItem = {
  sourceId: string;
  url: string;
  title: string;
  departmentName: string;
  channelName: string;
  importanceLevel: ImportanceLevel | string;
  keywordScore: number;
  hasFunding?: boolean;
  hasProcurement?: boolean;
  hasPilot?: boolean;
  hasStandards?: boolean;
  categories: Array<string | { category: string }>;
  listPublishedAt?: string;
  isStarred?: boolean;
};

export type SortField = "comprehensive" | "importance" | "score" | "signals" | "date";

const IMPORTANCE_WEIGHT: Record<ImportanceLevel, number> = {
  "核心关注": 100,
  "加急推荐": 75,
  "重点内容": 50,
  "普通内容": 25,
};

const SIGNAL_DEFS: Array<{
  key: keyof Pick<TopListItem, "hasFunding" | "hasProcurement" | "hasPilot" | "hasStandards">;
  label: string;
  className: string;
}> = [
  { key: "hasFunding", label: "资金", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "hasProcurement", label: "采购", className: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "hasPilot", label: "试点", className: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "hasStandards", label: "标准", className: "bg-cyan-50 text-cyan-700 border-cyan-200" },
];

export function getPriorityInfo(item: TopListItem): PriorityScoreResult {
  return calculatePriorityScore({
    keywordScore: item.keywordScore,
    hasFunding: item.hasFunding,
    hasProcurement: item.hasProcurement,
    hasPilot: item.hasPilot,
    hasStandards: item.hasStandards,
    departmentName: item.departmentName,
  });
}

export function getSignalTags(item: TopListItem): Array<{ label: string; className: string }> {
  return SIGNAL_DEFS.filter((def) => item[def.key]).map((def) => ({
    label: def.label,
    className: def.className,
  }));
}

export function getCategoryDisplay(
  category: string | { category: string }
): string {
  if (typeof category === "string") {
    return category.split("·").pop() || category;
  }
  const raw = category.category || "分类";
  return raw.split("·").pop() || raw;
}

export function summarizeTitle(title: string, maxLen = 48): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen) + "…";
}

export function countSignals(item: TopListItem): number {
  return SIGNAL_DEFS.filter((def) => item[def.key]).length;
}

export function getImportanceScore(level: string): number {
  return IMPORTANCE_WEIGHT[level as ImportanceLevel] ?? 10;
}

export function computeComprehensiveScore(item: TopListItem): number {
  return getPriorityInfo(item).score;
}

export function sortTopItems(
  items: TopListItem[],
  sortField: SortField = "comprehensive",
  limit?: number
): TopListItem[] {
  const sorted = [...items].sort((a, b) => {
    switch (sortField) {
      case "importance":
        return getImportanceScore(b.importanceLevel) - getImportanceScore(a.importanceLevel);
      case "score":
        return b.keywordScore - a.keywordScore;
      case "signals":
        return countSignals(b) - countSignals(a);
      case "date":
        return (b.listPublishedAt || "").localeCompare(a.listPublishedAt || "");
      case "comprehensive":
      default:
        return computeComprehensiveScore(b) - computeComprehensiveScore(a);
    }
  });
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

export function generateMockTopItems(count: number = 5): TopListItem[] {
  const mockData = generateMockDailySummary(24, Math.max(count, 5));
  return mockData.topItems.slice(0, count).map((item) => ({
    sourceId: item.sourceId,
    url: item.url,
    title: item.title,
    departmentName: item.departmentName,
    channelName: item.channelName,
    importanceLevel: item.importanceLevel,
    keywordScore: item.keywordScore,
    hasFunding: Boolean((item as { hasFunding?: boolean }).hasFunding),
    hasProcurement: Boolean((item as { hasProcurement?: boolean }).hasProcurement),
    hasPilot: Boolean((item as { hasPilot?: boolean }).hasPilot),
    hasStandards: Boolean((item as { hasStandards?: boolean }).hasStandards),
    categories: item.categories.map((c) => ({ category: c.category })),
    listPublishedAt: item.listPublishedAt,
    isStarred: Boolean((item as { isStarred?: boolean }).isStarred),
  }));
}

export const MOCK_TOP_ITEMS: TopListItem[] = generateMockTopItems(5);

export type TodayTopListProps = {
  items: TopListItem[];
  title?: string;
  subtitle?: string;
  maxItems?: number;
  sortField?: SortField;
  showViewAll?: boolean;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
  itemClassName?: string;
  onItemClick?: (item: TopListItem, index: number) => void;
  renderExtra?: (item: TopListItem, index: number) => React.ReactNode;
};

export function TodayTopList({
  items,
  title = "今日必读",
  subtitle,
  maxItems = 6,
  sortField = "comprehensive",
  showViewAll = true,
  viewAllHref = "/inbox",
  viewAllLabel = "查看全部 →",
  className = "",
  itemClassName = "",
  onItemClick,
  renderExtra,
}: TodayTopListProps) {
  const sortedItems = useMemo(
    () => sortTopItems(items, sortField, maxItems),
    [items, sortField, maxItems]
  );

  const defaultSubtitle = `按重要性、关键词得分和信号强度排序的 ${sortedItems.length} 条内容`;

  if (sortedItems.length === 0) {
    return (
      <section className={`mt-8 ${className}`}>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">暂无数据</p>
      </section>
    );
  }

  return (
    <section className={className}>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {subtitle ?? defaultSubtitle}
          </p>
        </div>
        {showViewAll && (
          <Link
            href={viewAllHref}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            {viewAllLabel}
          </Link>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {sortedItems.map((item, idx) => {
          const priority = getPriorityInfo(item);
          const signalTags = getSignalTags(item);

          const allTags = [
            ...signalTags,
            ...item.categories.slice(0, 3).map((c) => ({
              label: getCategoryDisplay(c),
              className: "bg-slate-50 text-slate-600 border-slate-200",
            })),
          ];

          const itemContent = (
            <div
              className="group block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm cursor-pointer"
              onClick={() => onItemClick?.(item, idx)}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-500 group-hover:bg-slate-200">
                  {idx + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${priority.bgColor} ${priority.color} ${priority.borderColor}`}
                    >
                      <priority.levelIcon className="h-3.5 w-3.5" aria-hidden />
                      <span>{priority.levelLabel}</span>
                    </span>
                    <span className="text-xs text-slate-400">
                      {item.departmentName}
                    </span>
                    {item.isStarred && (
                      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                        <Star className="mr-1 inline h-3.5 w-3.5" aria-hidden />已收藏
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-slate-600">
                    {summarizeTitle(item.title, 56)}
                  </h3>

                  {allTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {allTags.map((tag, ti) => (
                        <span
                          key={ti}
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs ${tag.className}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span>{item.channelName}</span>
                    {item.listPublishedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="mr-1 inline h-3.5 w-3.5" aria-hidden />{item.listPublishedAt.split("T")[0]}
                      </span>
                    )}
                  </div>

                  {renderExtra?.(item, idx)}
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-xs text-slate-400">优先级</div>
                  <div className={`text-lg font-bold ${priority.color}`}>
                    {formatPriorityScore(priority.score)}
                    <span className="text-xs font-normal text-slate-400"> 分</span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {signalTags.length > 0 ? `${signalTags.length} 项信号` : "基础得分"}
                  </div>
                </div>
              </div>
            </div>
          );

          const href = `/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`;

          return onItemClick ? (
            <div key={`${item.sourceId}-${item.url}`} className={itemClassName}>
              {itemContent}
            </div>
          ) : (
            <Link
              key={`${item.sourceId}-${item.url}`}
              href={href}
              className={`block ${itemClassName}`}
            >
              {itemContent}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default TodayTopList;
