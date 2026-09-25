"use client";

import { useState } from "react";
import type { CategoryStyle } from "@/lib/monitor/content-meta";
import {
  Lightbulb,
} from "lucide-react";

type RichTooltipProps = {
  style: CategoryStyle;
  children: React.ReactNode;
};

export function RichTooltip({ style, children }: RichTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (!style.description && !style.value) {
    return <span title={style.tooltip || style.displayLabel}>{children}</span>;
  }

  return (
    <span className="relative inline-block cursor-help">
      {children}
      {isVisible && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsVisible(false)}
          />
          <div className="absolute left-1/2 z-50 -translate-x-1/2 -top-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className={`border-b border-slate-100 ${style.chip} px-3 py-2`}>
              <div className="flex items-center gap-2">
                <style.icon className="h-3.5 w-3.5" aria-hidden />
                <span className="font-medium">{style.displayLabel}</span>
              </div>
            </div>
            <div className="p-3 text-xs">
              {style.description && (
                <p className="leading-relaxed text-slate-700">{style.description}</p>
              )}
              {style.value && (
                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-slate-600">
                  <span className="inline-flex items-center gap-1 font-medium"><Lightbulb className="h-3.5 w-3.5" aria-hidden />对你的意义：</span>
                  {style.value}
                </p>
              )}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full h-2 w-2 rotate-45 border-r border-b border-slate-200 bg-white" />
          </div>
        </>
      )}
      <span
        className="absolute -top-6 left-1/2 -translate-x-1/2 h-6 w-6"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      />
    </span>
  );
}