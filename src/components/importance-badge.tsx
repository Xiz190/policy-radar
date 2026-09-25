"use client";

import { getImportanceBadgeMeta } from "@/lib/monitor/priority-levels";

type ImportanceBadgeProps = {
  level: string | null | undefined;
  keywordScore?: number | string | null;
  showLegacyTag?: boolean;
  className?: string;
};

export function ImportanceBadge({
  level,
  keywordScore,
  showLegacyTag = false,
  className,
}: ImportanceBadgeProps) {
  const meta = getImportanceBadgeMeta(level, keywordScore);
  if (!meta) return null;

  const isLegacy = level === "加急推荐";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 ${meta.className} ${className ?? ""}`}
      title={meta.description}
    >
      <span>{meta.label}</span>
      {showLegacyTag && isLegacy ? (
        <span className="ml-1 text-[9px] text-rose-600">(旧)</span>
      ) : null}
    </span>
  );
}
