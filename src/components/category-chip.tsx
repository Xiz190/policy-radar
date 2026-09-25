"use client";

import { getCategoryStyle } from "@/lib/monitor/content-meta";
import { RichTooltip } from "@/components/rich-tooltip";

type CategoryChipProps = {
  category: string;
  score?: number | string;
  className?: string;
};

export function CategoryChip({ category, score, className }: CategoryChipProps) {
  const style = getCategoryStyle(category);
  return (
    <RichTooltip style={style}>
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${style.chip} ${className ?? ""}`}
      >
        <span className="font-medium">{style.displayLabel}</span>
        {score != null && <span className="ml-1 text-[11px] opacity-75">({typeof score === "number" ? score.toFixed(1) : score})</span>}
      </span>
    </RichTooltip>
  );
}