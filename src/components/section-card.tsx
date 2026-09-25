"use client";

import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";

type SectionCardProps = {
  title?: ReactNode;
  subtitle?: string;
  rightSlot?: ReactNode;
  className?: string;
  bodyClassName?: string;
  ariaLabel?: string;
  collapsible?: boolean;
  storageKey?: string;
  forceCollapsed?: boolean;
  children: ReactNode;
};

export function SectionCard({
  title,
  subtitle,
  rightSlot,
  className,
  bodyClassName,
  ariaLabel,
  collapsible,
  storageKey,
  forceCollapsed,
  children,
}: SectionCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const prevForceRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (!collapsible || !storageKey) return;
    try {
      const v = localStorage.getItem(`widget-collapsed-${storageKey}`);
      if (v === "1") setCollapsed(true);
    } catch {}
  }, [collapsible, storageKey]);

  useEffect(() => {
    // forceCollapsed 从 true→undefined 也应触发（=全部展开）。
    // 首帧 prev 与当前同为 undefined 时跳过，避免覆盖 localStorage 记忆的折叠。
    if (forceCollapsed === prevForceRef.current) return;
    prevForceRef.current = forceCollapsed;
    setCollapsed(forceCollapsed === true);
    if (storageKey) {
      try { localStorage.setItem(`widget-collapsed-${storageKey}`, forceCollapsed ? "1" : "0"); } catch {}
    }
  }, [forceCollapsed, storageKey]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    if (storageKey) {
      try { localStorage.setItem(`widget-collapsed-${storageKey}`, next ? "1" : "0"); } catch {}
    }
  }

  const hasHeader = title || rightSlot || collapsible;

  return (
    <section
      aria-label={ariaLabel}
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className ?? ""}`}
    >
      {hasHeader ? (
        <div className="flex items-center justify-between border-b border-slate-200 p-4 sm:p-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {collapsible && (
              <button
                type="button"
                onClick={toggle}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label={collapsed ? "展开" : "收起"}
              >
                <span className={`text-[10px] transition-transform ${collapsed ? "-rotate-90" : ""}`}>▾</span>
              </button>
            )}
            <div className="min-w-0">
              {title ? (
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              ) : null}
              {subtitle ? (
                <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        </div>
      ) : null}
      {!collapsed && <div className={bodyClassName ?? "p-4 sm:p-6"}>{children}</div>}
    </section>
  );
}
