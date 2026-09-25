"use client";

import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  subLabel?: string;
  variant?: "default" | "primary" | "danger" | "warning" | "success" | "info" | "violet";
  className?: string;
  children?: ReactNode;
};

const VARIANT_CLASSES: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "border border-slate-200 bg-white text-slate-900",
  primary: "bg-slate-900 text-white",
  danger: "border border-rose-200 bg-rose-50/50 text-rose-600",
  warning: "border border-amber-200 bg-amber-50/50 text-amber-600",
  success: "border border-emerald-200 bg-emerald-50/50 text-emerald-600",
  info: "border border-sky-200 bg-sky-50/50 text-sky-600",
  violet: "border border-violet-200 bg-violet-50/50 text-violet-600",
};

export function StatCard({
  label,
  value,
  subLabel,
  variant = "default",
  className,
  children,
}: StatCardProps) {
  return (
    <article
      aria-label={`${label}: ${value}`}
      className={`rounded-2xl p-4 ${VARIANT_CLASSES[variant]} ${className ?? ""}`}
    >
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {subLabel ? (
        <div className="mt-1 text-[11px] opacity-70">{subLabel}</div>
      ) : null}
      {children}
    </article>
  );
}
