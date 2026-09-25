"use client";

import { useState, useMemo, useCallback, memo } from "react";
import {
  ChartColumn, ScrollText,
} from "lucide-react";

export type PolicyHistoryItem = {
  sourceId: string;
  url: string;
  title: string;
  departmentName: string;
  publishedAt: string;
  stage: "early" | "draft" | "trial" | "official" | "update";
  keyPoint: string;
};

export type PolicyEvolutionData = {
  domain: string;
  timeline: PolicyHistoryItem[];
  trendSummary: string;
  currentStage: string;
};

type PolicyHistoryProps = {
  data: PolicyEvolutionData;
};

const STAGE_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  early: { label: "早期探索", color: "bg-slate-50 text-slate-600 border-slate-200", dotColor: "bg-slate-400" },
  draft: { label: "征求意见", color: "bg-amber-50 text-amber-700 border-amber-200", dotColor: "bg-amber-400" },
  trial: { label: "试点试行", color: "bg-sky-50 text-sky-700 border-sky-200", dotColor: "bg-sky-400" },
  official: { label: "正式发布", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dotColor: "bg-emerald-500" },
  update: { label: "修订更新", color: "bg-violet-50 text-violet-700 border-violet-200", dotColor: "bg-violet-500" },
};

const DEFAULT_VISIBLE_COUNT = 5;

const PolicyHistoryItemCard = memo(function PolicyHistoryItemCard({
  item,
  index,
  isExpanded,
  onToggle,
}: {
  item: PolicyHistoryItem;
  index: number;
  isExpanded: boolean;
  onToggle: (index: number) => void;
}) {
  const stage = STAGE_CONFIG[item.stage] || STAGE_CONFIG.official;

  return (
    <div className="relative pl-7">
      <div
        className={`absolute left-0 top-2.5 h-[9px] w-[9px] rounded-full ring-2 ring-white ${stage.dotColor}`}
      />
      <button
        type="button"
        onClick={() => onToggle(index)}
        className={`w-full rounded-xl border p-3 text-left transition ${
          isExpanded
            ? "border-slate-300 bg-slate-50"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${stage.color}`}
              >
                {stage.label}
              </span>
              <span className="text-xs text-slate-500">{item.publishedAt}</span>
            </div>
            <div className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-900">
              {item.title}
            </div>
          </div>
          <span className="shrink-0 text-slate-400">
            {isExpanded ? "−" : "+"}
          </span>
        </div>
        {isExpanded && (
          <div className="mt-2 border-t border-slate-200 pt-2">
            <div className="text-xs text-slate-600">
              <span className="font-medium text-slate-700">关键点：</span>
              {item.keyPoint}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {item.departmentName}
              </span>
              <a
                href={`/items/${item.sourceId}?sourceId=${item.sourceId}&url=${encodeURIComponent(item.url)}`}
                className="text-[11px] text-sky-600 hover:text-sky-700"
                onClick={(e) => e.stopPropagation()}
              >
                查看详情 →
              </a>
            </div>
          </div>
        )}
      </button>
    </div>
  );
});

export function PolicyHistory({ data }: PolicyHistoryProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [showAll, setShowAll] = useState(false);

  const visibleTimeline = useMemo(() => {
    if (showAll || data.timeline.length <= DEFAULT_VISIBLE_COUNT) {
      return data.timeline;
    }
    return data.timeline.slice(0, DEFAULT_VISIBLE_COUNT);
  }, [data.timeline, showAll]);

  const hasMore = data.timeline.length > DEFAULT_VISIBLE_COUNT;
  const hiddenCount = data.timeline.length - DEFAULT_VISIBLE_COUNT;

  const handleToggle = useCallback((index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  }, []);

  const handleToggleShowAll = useCallback(() => {
    setShowAll((prev) => !prev);
  }, []);

  if (data.timeline.length === 0) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" aria-hidden />
            <h2 className="text-base font-semibold text-slate-900">政策沿革</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            「{data.domain}」领域政策演进脉络 · 共 {data.timeline.length} 份文件
          </p>
        </div>
        <div className="shrink-0 rounded-2xl bg-slate-50 px-3 py-2 text-right">
          <div className="text-[10px] text-slate-500">当前阶段</div>
          <div className="text-sm font-semibold text-slate-800">{data.currentStage}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 p-3 text-sm leading-6 text-slate-700">
        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700"><ChartColumn className="h-4 w-4" aria-hidden />趋势总结：</span>
        {data.trendSummary}
      </div>

      <div className="mt-4 relative">
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" />
        <div className="space-y-3">
          {visibleTimeline.map((item, idx) => (
            <PolicyHistoryItemCard
              key={`${item.sourceId}-${idx}`}
              item={item}
              index={idx}
              isExpanded={expandedIndex === idx}
              onToggle={handleToggle}
            />
          ))}
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={handleToggleShowAll}
            className="mt-3 ml-7 text-xs text-sky-600 hover:text-sky-700"
          >
            {showAll ? "收起" : `展开更早的 ${hiddenCount} 条 →`}
          </button>
        )}
      </div>
    </section>
  );
}
