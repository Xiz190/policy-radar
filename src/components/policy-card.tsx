"use client";

import Link from "next/link";
import { CategoryChip } from "@/components/category-chip";
import { ImportanceBadge } from "@/components/importance-badge";
import { formatDateShort } from "@/lib/date-utils";
import type { PolicyItem } from "@/hooks/use-policy-list";
import {
  Lightbulb, Rocket, Ruler, ShoppingCart,
} from "lucide-react";

type PolicyCardProps = {
  item: PolicyItem;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onToggleRead?: (next: boolean) => void;
  onToggleStarred?: (next: boolean) => void;
  onToggleCompare?: () => void;
  isInCompare?: boolean;
  detail?: Record<string, unknown>;
  detailLoading?: boolean;
  compact?: boolean;
};

export function PolicyCard({
  item,
  isExpanded = false,
  onToggleExpand,
  onToggleRead,
  onToggleStarred,
  onToggleCompare,
  isInCompare = false,
  detail,
  detailLoading = false,
  compact = false,
}: PolicyCardProps) {
  const itemHref = `/items/${encodeURIComponent(item.sourceId)}?sourceId=${encodeURIComponent(item.sourceId)}&url=${encodeURIComponent(item.url)}`;

  return (
    <li
      className={`rounded-2xl border transition ${
        isExpanded
          ? "border-slate-300 bg-slate-50 shadow-sm"
          : "border-slate-200 bg-white hover:shadow-sm"
      }`}
    >
      <div
        className={compact ? "cursor-pointer p-3" : "cursor-pointer p-3 sm:p-4"}
        onClick={onToggleExpand}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 sm:gap-2">
              <ImportanceBadge level={item.importanceLevel} keywordScore={item.keywordScore} />
              {item.isStarred ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  ★ 重点
                </span>
              ) : null}
              {!item.isRead ? (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                  未读
                </span>
              ) : null}
              <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 max-w-[120px] sm:max-w-none sm:text-xs">
                {item.departmentName}
              </span>
              <span className="hidden sm:inline">{item.channelName}</span>
              <span className="text-[11px] sm:text-xs">· {formatDateShort(item.listPublishedAt)}</span>
              {item.keywordScore > 0 ? (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                  关键词 {item.keywordScore}
                  {item.matchedKeywordCount && item.matchedKeywordCount > 0 ? (
                    <span className="ml-1 text-violet-400">· {item.matchedKeywordCount}词</span>
                  ) : null}
                </span>
              ) : null}
              <span
                className={`ml-auto text-slate-400 transition sm:ml-1 ${isExpanded ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </div>
            <h3 className="mt-1 block text-sm font-semibold leading-snug text-slate-900 sm:mt-1.5">
              <Link
                href={itemHref}
                className="hover:text-indigo-700"
                onClick={(e) => e.stopPropagation()}
              >
                {item.title}
              </Link>
            </h3>

            {!compact && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.hasFunding ? (
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    <Lightbulb className="mr-1 inline h-3.5 w-3.5" aria-hidden />资金支持
                  </span>
                ) : null}
                {item.hasProcurement ? (
                  <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                    <ShoppingCart className="mr-1 inline h-3.5 w-3.5" aria-hidden />采购机会
                  </span>
                ) : null}
                {item.hasPilot ? (
                  <span className="rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-800">
                    <Rocket className="mr-1 inline h-3.5 w-3.5" aria-hidden />试点示范
                  </span>
                ) : null}
                {item.hasStandards ? (
                  <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                    <Ruler className="mr-1 inline h-3.5 w-3.5" aria-hidden />标准规范
                  </span>
                ) : null}
                {item.categories.slice(0, 3).map((cat, idx) => (
                  <CategoryChip key={`${cat.category}-${idx}`} category={cat.category} />
                ))}
                {item.categories.length > 3 ? (
                  <span className="text-[11px] text-slate-400">+{item.categories.length - 3}</span>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
            {onToggleStarred ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStarred(!item.isStarred);
                }}
                className={`text-sm ${
                  item.isStarred ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                }`}
                title={item.isStarred ? "取消重点" : "标记重点"}
              >
                ★
              </button>
            ) : null}
            {onToggleRead ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleRead(!item.isRead);
                }}
                className="text-xs text-slate-400 hover:text-slate-600"
                title={item.isRead ? "标记为未读" : "标记为已读"}
              >
                {item.isRead ? "标未读" : "标已读"}
              </button>
            ) : null}
            {onToggleCompare ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCompare();
                }}
                className={`text-xs ${
                  isInCompare
                    ? "text-emerald-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title={isInCompare ? "移出对比" : "加入对比"}
              >
                {isInCompare ? "✓ 对比中" : "＋对比"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div className="border-t border-slate-200 bg-white/70 p-4">
          {detailLoading ? (
            <div className="text-sm text-slate-500">加载详情中…</div>
          ) : detail ? (
            <div className="space-y-3 text-sm">
              {(detail as { summary?: string }).summary ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-slate-700">
                  <div className="text-xs font-medium text-slate-500">摘要</div>
                  <div className="mt-1 leading-6">
                    {(detail as { summary: string }).summary}
                  </div>
                </div>
              ) : null}

              {(detail as { matchedKeywords?: string[] }).matchedKeywords &&
              (detail as { matchedKeywords: string[] }).matchedKeywords.length > 0 ? (
                <div>
                  <div className="text-xs font-medium text-slate-500">命中关键词</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(detail as { matchedKeywords: string[] }).matchedKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Link
                  href={itemHref}
                  className="inline-flex h-8 items-center rounded-full bg-slate-900 px-3 text-xs text-white transition hover:bg-slate-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  查看详情 →
                </Link>
                <a
                  href={item.finalUrl || item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  打开原网址 →
                </a>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
