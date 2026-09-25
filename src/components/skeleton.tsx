"use client";

import { SiteHeader } from "@/components/site-header";

export function SkeletonLine({
  width = "w-full",
  height = "h-4",
  className = "",
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-100 ${height} ${width} ${className}`}
    />
  );
}

export function SkeletonCircle({
  size = "w-8 h-8",
  className = "",
}: {
  size?: string;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-full bg-slate-100 ${size} ${className}`}
    />
  );
}

export function SkeletonBadge({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse h-6 w-16 rounded-full bg-slate-100 ${className}`}
    />
  );
}

export function SkeletonCard({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-slate-200 bg-white p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function SkeletonItemCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SkeletonLine width="w-16" height="h-3" />
            {!compact && <SkeletonLine width="w-20" height="h-3" />}
            <SkeletonLine width="w-12" height="h-3" />
          </div>
          <div className="mt-1.5 h-5 w-full bg-slate-100 rounded" />
          {!compact && (
            <div className="mt-1 h-4 w-3/4 bg-slate-50 rounded" />
          )}
          {!compact && (
            <div className="mt-2 flex items-center gap-2">
              <SkeletonLine width="w-16" height="h-3" />
              <SkeletonLine width="w-20" height="h-3" />
              <SkeletonLine width="w-12" height="h-3" />
            </div>
          )}
        </div>
      </div>
      {!compact && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <SkeletonLine width="w-16" height="h-5" />
          </div>
          <SkeletonLine width="w-20" height="h-5" />
        </div>
      )}
    </div>
  );
}

export function SkeletonStatCard({
  labelWidth = "w-16",
  valueWidth = "w-10",
  descWidth = "w-12",
  tone = "default",
}: {
  labelWidth?: string;
  valueWidth?: string;
  descWidth?: string;
  tone?: "default" | "amber" | "emerald";
}) {
  const toneStyles = {
    default: "border-white/10 bg-white/5",
    amber: "border-amber-500/20 bg-amber-500/10",
    emerald: "border-emerald-500/20 bg-emerald-500/10",
  };

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneStyles[tone]}`}>
      <div className={`h-3 ${labelWidth} rounded bg-slate-400/30 animate-pulse`} />
      <div className={`mt-1.5 h-7 ${valueWidth} rounded bg-slate-300/40 animate-pulse`} />
      <div className={`mt-0.5 h-3 ${descWidth} rounded bg-slate-400/20 animate-pulse`} />
    </div>
  );
}

export function PageShell({
  children,
  maxWidth = "max-w-6xl",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className={`mx-auto w-full ${maxWidth} px-4 py-8 sm:px-6 lg:px-8`}>
        {children}
      </div>
    </main>
  );
}

export function PageHeaderSkeleton({
  subtitle = true,
  actionButton = true,
}: {
  subtitle?: boolean;
  actionButton?: boolean;
}) {
  return (
    <section className="mb-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <SkeletonCircle size="w-4 h-4" />
            <SkeletonLine width="w-20" height="h-4" />
          </div>
          <SkeletonLine width="w-64" height="h-8" className="mt-2" />
          {subtitle && (
            <SkeletonLine width="w-80" height="h-4" className="mt-2" />
          )}
        </div>
        {actionButton && (
          <SkeletonLine width="w-24" height="h-9" />
        )}
      </div>
    </section>
  );
}

export function SectionHeaderSkeleton({
  subtitle = true,
  actionWidth = "w-16",
}: {
  subtitle?: boolean;
  actionWidth?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        <SkeletonLine width="w-32" height="h-5" />
        {subtitle && (
          <SkeletonLine width="w-48" height="h-3" className="mt-0.5" />
        )}
      </div>
      <SkeletonLine width={actionWidth} height="h-4" />
    </div>
  );
}

export function SkeletonTabs({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-1 border-b border-slate-200 pb-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 rounded-xl px-3.5 py-2"
        >
          <SkeletonCircle size="w-4 h-4" />
          <SkeletonLine width="w-16" height="h-4" />
          <SkeletonCircle size="w-5 h-5" />
        </div>
      ))}
    </div>
  );
}

export function InboxPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <div className="flex gap-6">
        <div className="hidden w-64 shrink-0 lg:block">
          <SkeletonLine width="w-24" height="h-4" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonLine key={i} width={`w-${60 + i * 5}`} height="h-4" />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between">
            <SkeletonLine width="w-32" height="h-5" />
            <div className="flex gap-2">
              <SkeletonLine width="w-20" height="h-6" />
              <SkeletonLine width="w-16" height="h-6" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonItemCard key={i} />
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <SkeletonLine width="w-48" height="h-8" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function ResearchPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <SkeletonLine width="w-20" height="h-3" />
            <SkeletonLine width="w-10" height="h-7" className="mt-1" />
            <SkeletonLine width="w-16" height="h-3" className="mt-0.5" />
          </SkeletonCard>
        ))}
      </div>
      <div className="mt-8">
        <SkeletonTabs count={4} />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonItemCard key={i} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

export function ForecastPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonBadge key={i} className="!w-24" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center gap-2">
              <SkeletonCircle size="w-8 h-8" />
              <div className="flex-1">
                <SkeletonLine width="w-20" height="h-3" />
                <SkeletonLine width="w-24" height="h-4" className="mt-0.5" />
              </div>
            </div>
            <SkeletonLine width="w-full" height="h-5" className="mt-3" />
            <SkeletonLine width="w-2/3" height="h-4" className="mt-1" />
            <div className="mt-3 flex items-center justify-between">
              <SkeletonLine width="w-16" height="h-5" />
              <SkeletonLine width="w-20" height="h-5" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </PageShell>
  );
}

export function DashboardPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i}>
            <SkeletonLine width="w-20" height="h-3" />
            <SkeletonLine width="w-12" height="h-8" className="mt-1" />
            <SkeletonLine width="w-24" height="h-3" className="mt-0.5" />
          </SkeletonCard>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SkeletonCard className="!p-6">
          <SkeletonLine width="w-32" height="h-5" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonLine width="w-24" height="h-4" />
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-200 rounded-full"
                    style={{ width: `${40 + i * 10}%` }}
                  />
                </div>
                <SkeletonLine width="w-8" height="h-3" />
              </div>
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard className="!p-6">
          <SkeletonLine width="w-40" height="h-5" />
          <div className="mt-4 h-48 bg-slate-50 rounded-xl animate-pulse" />
        </SkeletonCard>
      </div>
    </PageShell>
  );
}
