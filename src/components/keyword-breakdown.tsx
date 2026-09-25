"use client";

import { useState } from "react";
import { getCategoryStyle } from "@/lib/monitor/content-meta";
import {
  Search,
} from "lucide-react";

export type KeywordDetailItem = {
  keyword: string;
  category: string;
  weight: number;
  importance: string;
  context: string[];
};

export type KeywordBreakdownData = {
  totalScore: number;
  categoryBreakdown: Array<{
    category: string;
    score: number;
    keywords: KeywordDetailItem[];
  }>;
};

type KeywordBreakdownProps = {
  data: KeywordBreakdownData;
};

export function KeywordBreakdown({ data }: KeywordBreakdownProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    data.categoryBreakdown[0]?.category ?? null
  );

  return (
    <section className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-tint)]/40 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5" aria-hidden />
          <h2 className="text-base font-semibold text-slate-900">关键词命中详情</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-sm font-semibold text-violet-700">
            {data.totalScore} 分
          </span>
        </div>
      </div>

      <p className="mt-1 text-xs text-slate-500">
        共命中 {data.categoryBreakdown.reduce((acc, c) => acc + c.keywords.length, 0)} 个关键词，
        分布在 {data.categoryBreakdown.length} 个分类中
      </p>

      <div className="mt-4 space-y-2">
        {data.categoryBreakdown.map((cat, index) => {
          const style = getCategoryStyle(cat.category);
          const isExpanded = expandedCategory === cat.category;

          return (
            <div
              key={cat.category ?? `cat-${index}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <button
                type="button"
                onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                className="flex w-full items-center justify-between p-3 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.chip}`}
                    title={style.tooltip}
                  >
                    {style.displayLabel}
                  </span>
                  <span className="text-sm text-slate-700">
                    {cat.keywords.length} 个关键词
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {cat.score} 分
                  </span>
                  <span className="text-slate-400 transition-transform">
                    {isExpanded ? "−" : "+"}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-3">
                  <div className="space-y-2">
                    {cat.keywords.map((kw, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <mark className={style.highlight}>
                              {kw.keyword}
                            </mark>
                            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                              {kw.weight} 分
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 text-xs text-slate-500">
                          <span className="font-medium text-slate-600">为什么重要：</span>
                          {kw.importance}
                        </div>
                        {kw.context.length > 0 && (
                          <div className="mt-2">
                            <div className="text-[11px] font-medium text-slate-500">
                              出现位置
                            </div>
                            <div className="mt-1 space-y-1">
                              {kw.context.slice(0, 2).map((ctx, ci) => (
                                <div
                                  key={ci}
                                  className="rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-600"
                                >
                                  …{ctx}…
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] leading-5 text-slate-400">
        提示：关键词得分是优先级评分的核心依据（占 65%），命中的关键词越多、权重越高，政策优先级越高。
      </div>
    </section>
  );
}
