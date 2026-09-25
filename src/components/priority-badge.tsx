"use client";

import { useState } from "react";
import {
  calculatePriorityScore,
  type PriorityScoreInput,
  type PriorityScoreResult,
  formatPriorityScore,
} from "@/lib/monitor/priority-score";
import {
  FileText, Flame, Pin, Star,
} from "lucide-react";

export type PriorityBadgeProps = {
  input: PriorityScoreInput;
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
  showBreakdown?: boolean;
  className?: string;
};

export function PriorityBadge({
  input,
  size = "md",
  showScore = true,
  showBreakdown = true,
  className = "",
}: PriorityBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const result = calculatePriorityScore(input);

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  const scoreSizeClasses = {
    sm: "text-xs font-semibold",
    md: "text-sm font-semibold",
    lg: "text-base font-bold",
  };

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <button
        type="button"
        onClick={() => showBreakdown && setExpanded(!expanded)}
        className={`
          inline-flex items-center gap-1.5 rounded-md border font-medium
          transition-all
          ${result.bgColor} ${result.color} ${result.borderColor}
          ${sizeClasses[size]}
          ${showBreakdown ? "cursor-pointer hover:shadow-sm" : "cursor-default"}
        `}
        title={result.levelLabel}
      >
        <result.levelIcon className="h-3.5 w-3.5" aria-hidden />
        <span>{result.levelLabel}</span>
        {showScore && (
          <span className={`ml-0.5 opacity-80 ${scoreSizeClasses[size]}`}>
            {formatPriorityScore(result.score)}
          </span>
        )}
        {showBreakdown && (
          <svg
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {expanded && showBreakdown && (
        <div className="mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg z-10">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">
              优先级分数构成
            </span>
            <span className="text-lg font-bold text-slate-800">
              {formatPriorityScore(result.score)}
              <span className="text-xs font-normal text-slate-400">/100</span>
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <ScoreBar
              label="关键词得分"
              value={result.breakdown.keywordBase}
              max={60}
              color="bg-violet-500"
            />
            <ScoreBar
              label="信号加成"
              value={result.breakdown.signalBonus.total}
              max={25}
              color="bg-amber-500"
              detail={formatSignalDetail(result)}
            />
            {result.breakdown.departmentBonus > 0 && (
              <ScoreBar
                label="部委权重"
                value={result.breakdown.departmentBonus}
                max={10}
                color="bg-blue-500"
              />
            )}
            {result.breakdown.qualityBonus > 0 && (
              <ScoreBar
                label="内容质量"
                value={result.breakdown.qualityBonus}
                max={5}
                color="bg-emerald-500"
              />
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100">
            <div className="text-[11px] text-slate-500">
              {PRIORITY_LEVEL_DESCRIPTIONS[result.level]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  value,
  max,
  color,
  detail,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  detail?: string;
}) {
  const percent = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-700">
          {value.toFixed(1)} <span className="text-slate-400">/ {max}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {detail && <div className="mt-0.5 text-[10px] text-slate-400">{detail}</div>}
    </div>
  );
}

function formatSignalDetail(result: PriorityScoreResult): string {
  const parts: string[] = [];
  if (result.breakdown.signalBonus.funding > 0) parts.push(`资金+${result.breakdown.signalBonus.funding}`);
  if (result.breakdown.signalBonus.procurement > 0) parts.push(`采购+${result.breakdown.signalBonus.procurement}`);
  if (result.breakdown.signalBonus.pilot > 0) parts.push(`试点+${result.breakdown.signalBonus.pilot}`);
  if (result.breakdown.signalBonus.standards > 0) parts.push(`标准+${result.breakdown.signalBonus.standards}`);
  return parts.join(" · ");
}

const PRIORITY_LEVEL_DESCRIPTIONS: Record<string, string> = {
  "核心": "高优先级，强烈建议优先阅读和处理",
  "重点": "较高优先级，建议重点关注和跟进",
  "关注": "有一定相关性，值得留意观察",
  "普通": "常规监测内容，按需阅读",
};

export function PriorityScoreDisplay({
  score,
  level,
  size = "md",
}: {
  score: number;
  level: string;
  size?: "sm" | "md" | "lg";
}) {
  const meta = PRIORITY_LEVEL_META_FALLBACK[level as keyof typeof PRIORITY_LEVEL_META_FALLBACK] || PRIORITY_LEVEL_META_FALLBACK["普通"];

  const textSize = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  };

  return (
    <div className="text-right">
      <div className="text-xs text-slate-400">优先级</div>
      <div className={`font-bold ${textSize[size]} ${meta.colorClass}`}>
        {Math.round(score)}
        <span className="text-xs font-normal text-slate-400"> 分</span>
      </div>
      <div className="mt-0.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><meta.icon className="h-3 w-3" aria-hidden />{meta.label}</span>
      </div>
    </div>
  );
}

const PRIORITY_LEVEL_META_FALLBACK = {
  "核心": { label: "核心关注", icon: Flame, colorClass: "text-red-600" },
  "重点": { label: "重点关注", icon: Star, colorClass: "text-orange-600" },
  "关注": { label: "值得关注", icon: Pin, colorClass: "text-amber-600" },
  "普通": { label: "普通监测", icon: FileText, colorClass: "text-slate-600" },
};
