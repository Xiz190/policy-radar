"use client";

import type { MatchedSubscription } from "@/lib/subscription-utils";

// 关注/收藏标记图标（内联 SVG，与 Chevron 同一套描边风格）
function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

type SubscriptionBadgeProps = {
  matches: MatchedSubscription[];
  totalCount?: number;
  compact?: boolean;
};

// 关注匹配=有语义的正向信号 → 用领域色 --brand 的极淡底，而非随机 sky 蓝
const CHIP = "inline-flex items-center gap-1 rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]";

export function SubscriptionBadge({
  matches,
  totalCount,
  compact = false,
}: SubscriptionBadgeProps) {
  if (matches.length === 0) return null;

  const displayText = matches.map((m) => m.displayName).join("、");
  const extraCount = totalCount && totalCount > matches.length ? totalCount - matches.length : 0;
  const title = `来自你的关注：${displayText}${extraCount > 0 ? ` 等 ${totalCount} 项` : ""}`;

  if (compact) {
    return (
      <span className={CHIP} title={title}>
        <BookmarkIcon />
        关注匹配
      </span>
    );
  }

  return (
    <span className={CHIP} title={title}>
      <BookmarkIcon />
      <span className="truncate">
        来自关注：{displayText}
        {extraCount > 0 && ` +${extraCount}`}
      </span>
    </span>
  );
}

export function SubscriptionBadgeList({
  matches,
  totalCount,
}: {
  matches: MatchedSubscription[];
  totalCount?: number;
}) {
  if (matches.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {matches.map((m, idx) => (
        <span key={`${m.type}-${m.target}-${idx}`} className={CHIP}>
          <BookmarkIcon />
          {m.displayName}
        </span>
      ))}
      {totalCount && totalCount > matches.length && (
        <span className="rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[11px] text-[var(--brand)]">
          +{totalCount - matches.length}
        </span>
      )}
    </div>
  );
}
