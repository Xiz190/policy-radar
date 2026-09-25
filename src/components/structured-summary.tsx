"use client";

import { useState } from "react";
import {
  Bot,
} from "lucide-react";

export type StructuredSummaryData = {
  coreContent: string[];
  impactScope: {
    industries: string[];
    departments: string[];
    regions: string[];
  };
  timeline: Array<{
    date: string;
    event: string;
    type: "deadline" | "effective" | "milestone" | "review";
  }>;
  actionItems: Array<{
    action: string;
    priority: "high" | "medium" | "low";
    department?: string;
    deadline?: string;
  }>;
};

type StructuredSummaryProps = {
  data: StructuredSummaryData;
};

const SECTION_ICONS: Record<string, string> = {
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级",
};

const TIMELINE_TYPE_STYLES: Record<string, string> = {
  deadline: "bg-red-100 text-red-700",
  effective: "bg-emerald-100 text-emerald-700",
  milestone: "bg-sky-100 text-sky-700",
  review: "bg-amber-100 text-amber-700",
};

const TIMELINE_TYPE_LABELS: Record<string, string> = {
  deadline: "截止",
  effective: "生效",
  milestone: "里程碑",
  review: "评估",
};

const LONG_CONTENT_THRESHOLD = 10;

export function StructuredSummary({ data }: StructuredSummaryProps) {
  const totalItems =
    data.coreContent.length +
    data.impactScope.industries.length +
    data.impactScope.departments.length +
    data.impactScope.regions.length +
    data.timeline.length +
    data.actionItems.length;

  const isLongContent = totalItems > LONG_CONTENT_THRESHOLD;

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    isLongContent ? new Set(["core"]) : new Set(["core", "impact", "timeline", "action"])
  );

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };

  const hasImpactData =
    data.impactScope.industries.length > 0 ||
    data.impactScope.departments.length > 0 ||
    data.impactScope.regions.length > 0;

  return (
    <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" aria-hidden />
          <h2 className="text-base font-semibold text-slate-900">AI 结构化摘要</h2>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
            辅助决策
          </span>
        </div>
        <span className="text-xs text-slate-400">基于正文智能分析生成</span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white/80">
          <button
            type="button"
            onClick={() => toggleSection("core")}
            className="flex w-full items-center justify-between p-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span>{SECTION_ICONS.core}</span>
              <span className="text-sm font-medium text-slate-900">核心内容</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                {data.coreContent.length} 条
              </span>
            </div>
            <span className="text-slate-400 transition-transform">
              {expandedSections.has("core") ? "−" : "+"}
            </span>
          </button>
          {expandedSections.has("core") && (
            <div className="border-t border-slate-100 px-3 pb-3 pt-2">
              <ul className="space-y-2 text-sm leading-6 text-slate-700">
                {data.coreContent.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-indigo-500">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {hasImpactData && (
          <div className="rounded-2xl border border-slate-200 bg-white/80">
            <button
              type="button"
              onClick={() => toggleSection("impact")}
              className="flex w-full items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span>{SECTION_ICONS.impact}</span>
                <span className="text-sm font-medium text-slate-900">影响范围</span>
              </div>
              <span className="text-slate-400 transition-transform">
                {expandedSections.has("impact") ? "−" : "+"}
              </span>
            </button>
            {expandedSections.has("impact") && (
              <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-2 text-sm">
                {data.impactScope.industries.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500">影响行业</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {data.impactScope.industries.map((ind, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700"
                        >
                          {ind}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {data.impactScope.departments.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500">涉及部委</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {data.impactScope.departments.map((dept, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
                        >
                          {dept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {data.impactScope.regions.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-500">重点区域</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {data.impactScope.regions.map((reg, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                        >
                          {reg}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {data.timeline.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white/80">
            <button
              type="button"
              onClick={() => toggleSection("timeline")}
              className="flex w-full items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span>{SECTION_ICONS.timeline}</span>
                <span className="text-sm font-medium text-slate-900">时间节点</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  {data.timeline.length} 个
                </span>
              </div>
              <span className="text-slate-400 transition-transform">
                {expandedSections.has("timeline") ? "−" : "+"}
              </span>
            </button>
            {expandedSections.has("timeline") && (
              <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                <div className="space-y-2">
                  {data.timeline.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5"
                    >
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${TIMELINE_TYPE_STYLES[item.type]}`}
                      >
                        {TIMELINE_TYPE_LABELS[item.type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-800">{item.event}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{item.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {data.actionItems.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white/80">
            <button
              type="button"
              onClick={() => toggleSection("action")}
              className="flex w-full items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span>{SECTION_ICONS.action}</span>
                <span className="text-sm font-medium text-slate-900">行动建议</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  {data.actionItems.length} 条
                </span>
              </div>
              <span className="text-slate-400 transition-transform">
                {expandedSections.has("action") ? "−" : "+"}
              </span>
            </button>
            {expandedSections.has("action") && (
              <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                <div className="space-y-2">
                  {data.actionItems.map((item, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-2.5 ${PRIORITY_STYLES[item.priority]}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium">{item.action}</div>
                        <span className="shrink-0 rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-medium">
                          {PRIORITY_LABELS[item.priority]}
                        </span>
                      </div>
                      {(item.department || item.deadline) && (
                        <div className="mt-1 flex flex-wrap gap-2 text-xs opacity-80">
                          {item.department && <span>责任方：{item.department}</span>}
                          {item.deadline && <span>截止：{item.deadline}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
