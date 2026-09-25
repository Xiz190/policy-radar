"use client";

import { useState } from "react";
import {
  Lightbulb, type LucideIcon,
} from "lucide-react";

export type HelpContentItem =
  | {
      type: "paragraph";
      title?: string;
      icon?: LucideIcon;
      text: string;
    }
  | {
      type: "list";
      title?: string;
      icon?: LucideIcon;
      items: Array<{ label: string; desc?: string; strong?: boolean }>;
    }
  | {
      type: "steps";
      title?: string;
      icon?: LucideIcon;
      steps: string[];
      highlightIndex?: number;
    };

interface HelpPopoverProps {
  triggerLabel?: string;
  triggerIcon?: LucideIcon;
  title?: string;
  content: HelpContentItem[];
  theme?: "amber" | "sky" | "slate";
  className?: string;
}

const themeMap = {
  amber: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    title: "text-amber-900",
    subtitle: "text-slate-800",
    text: "text-slate-600",
    stepBg: "bg-slate-200",
    stepHighlight: "bg-amber-200 text-amber-900",
  },
  sky: {
    border: "border-sky-200",
    bg: "bg-sky-50",
    title: "text-sky-900",
    subtitle: "text-slate-800",
    text: "text-slate-600",
    stepBg: "bg-slate-200",
    stepHighlight: "bg-sky-200 text-sky-900",
  },
  slate: {
    border: "border-slate-200",
    bg: "bg-slate-50",
    title: "text-slate-900",
    subtitle: "text-slate-800",
    text: "text-slate-600",
    stepBg: "bg-slate-200",
    stepHighlight: "bg-slate-300 text-slate-900",
  },
};

export function HelpPopover({
  triggerLabel = "使用说明",
  triggerIcon: TriggerIcon = Lightbulb,
  title = "使用说明",
  content,
  theme = "amber",
  className = "",
}: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const t = themeMap[theme];

  const renderItem = (item: HelpContentItem, idx: number) => {
    if (item.type === "paragraph") {
      return (
        <div key={idx}>
          {item.title && (
            <h4 className={`mb-1 font-medium ${t.subtitle}`}>
              {item.icon && <item.icon className="mr-1 inline h-3.5 w-3.5" aria-hidden />}
              {item.title}
            </h4>
          )}
          <p
            className={t.text}
            dangerouslySetInnerHTML={{ __html: item.text }}
          />
        </div>
      );
    }

    if (item.type === "list") {
      return (
        <div key={idx}>
          {item.title && (
            <h4 className={`mb-1 font-medium ${t.subtitle}`}>
              {item.icon && <item.icon className="mr-1 inline h-3.5 w-3.5" aria-hidden />}
              {item.title}
            </h4>
          )}
          <ul className={`list-disc space-y-1 pl-5 ${t.text}`}>
            {item.items.map((li, i) => (
              <li key={i}>
                {li.strong ? <strong>{li.label}</strong> : <span>{li.label}</span>}
                {li.desc && <span>：{li.desc}</span>}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (item.type === "steps") {
      return (
        <div key={idx}>
          {item.title && (
            <h4 className={`mb-2 font-medium ${t.subtitle}`}>
              {item.icon && <item.icon className="mr-1 inline h-3.5 w-3.5" aria-hidden />}
              {item.title}
            </h4>
          )}
          <div className={`flex flex-wrap items-center gap-2 ${t.text}`}>
            {item.steps.map((step, i) => (
              <span key={i} className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs ${
                    i === item.highlightIndex ? `${t.stepHighlight} font-medium` : t.stepBg
                  }`}
                >
                  {step}
                </span>
                {i < item.steps.length - 1 && (
                  <span className="text-slate-400">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
      >
        {TriggerIcon && <TriggerIcon className="h-3.5 w-3.5" aria-hidden />}
        <span>{open ? `收起${triggerLabel.replace("说明", "").replace("帮助", "")}` : triggerLabel}</span>
      </button>

      {open && (
        <div
          className={`mt-3 rounded-2xl border ${t.border} ${t.bg} p-5 text-sm`}
        >
          {title && <h3 className={`mb-3 font-semibold ${t.title}`}>{title}</h3>}
          <div className="space-y-4">
            {content.map((item, idx) => renderItem(item, idx))}
          </div>
        </div>
      )}
    </div>
  );
}
