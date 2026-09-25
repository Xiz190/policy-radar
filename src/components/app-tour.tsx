"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Step = {
  title: string;
  desc: string;
  selector?: string; // CSS selector of element to highlight
  hint?: string;     // keyboard shortcut or badge text
};

const STEPS: Step[] = [
  {
    title: "⌘K 命令面板",
    desc: "按 ⌘K（Mac）或 Ctrl+K（Windows）随时弹出命令面板，快速跳转任意页面或功能，无需鼠标。",
    selector: "button[title='命令面板 (⌘K)']",
    hint: "⌘K",
  },
  {
    title: "信号雷达",
    desc: "不是所有动态都值得关注。信号雷达自动识别高价值内容：强执行、强支持、濒危预警、行业研究。",
    selector: "a[href='/signals']",
  },
  {
    title: "收件箱键盘导航",
    desc: "在收件箱页面，用 J/K 上下切换条目，R 标记已读，S 收藏重点。不需要鼠标，读完一批只需几秒。",
    hint: "J · K · R · S",
  },
  {
    title: "周报生成器",
    desc: "在信号雷达页面，筛选好当前关注的信号后，点击「生成周报」即可一键生成 Markdown 格式的情报周报，可直接复制到 Notion / 飞书 / 备忘录。",
    selector: "button",
    hint: "信号页 → 生成周报",
  },
  {
    title: "辅助功能面板",
    desc: "点击 A 图标可调整字体大小、切换深色模式、开启高对比度和减少动画，同时支持中英文界面切换。",
    selector: "button[title='辅助功能 / Accessibility']",
  },
  {
    title: "关于本项目",
    desc: "点击「关于」按钮可查看技术栈、数据来源与设计决策说明——这是一个面向政策研究与行业情报的通用监测平台（当前实例聚焦 AI／数字经济政策），作为研究生申请作品集案例。",
    selector: "button[title='关于本项目']",
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AppTour({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const prevHighlightEl = useRef<Element | null>(null);

  const current = STEPS[step];

  // Highlight target element
  useEffect(() => {
    if (!open) {
      if (prevHighlightEl.current) {
        (prevHighlightEl.current as HTMLElement).style.outline = "";
        (prevHighlightEl.current as HTMLElement).style.outlineOffset = "";
        prevHighlightEl.current = null;
      }
      return;
    }

    if (prevHighlightEl.current) {
      (prevHighlightEl.current as HTMLElement).style.outline = "";
      (prevHighlightEl.current as HTMLElement).style.outlineOffset = "";
    }

    if (current.selector) {
      const el = document.querySelector(current.selector);
      if (el) {
        (el as HTMLElement).style.outline = "3px solid #7c3aed";
        (el as HTMLElement).style.outlineOffset = "3px";
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setHighlightRect(el.getBoundingClientRect());
        prevHighlightEl.current = el;
      } else {
        setHighlightRect(null);
        prevHighlightEl.current = null;
      }
    } else {
      setHighlightRect(null);
      prevHighlightEl.current = null;
    }
  }, [open, step, current.selector]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (step < STEPS.length - 1) setStep((s) => s + 1);
        else onClose();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, onClose]);

  // Reset on open
  useEffect(() => { if (open) setStep(0); }, [open]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (prevHighlightEl.current) {
      (prevHighlightEl.current as HTMLElement).style.outline = "";
    }
  }, []);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const isLast = step === STEPS.length - 1;

  return createPortal(
    <>
      {/* dim overlay — click to close */}
      <div
        className="fixed inset-0 z-[60] bg-slate-900/30"
        onClick={onClose}
      />

      {/* Tour card — fixed bottom center */}
      <div className="fixed bottom-6 left-1/2 z-[70] w-full max-w-md -translate-x-1/2 px-4">
        <div className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-2xl">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-violet-500 transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{current.title}</h3>
                  {current.hint && (
                    <kbd className="rounded bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                      {current.hint}
                    </kbd>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{current.desc}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStep(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step ? "w-6 bg-violet-500" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                    }`}
                    aria-label={`步骤 ${i + 1}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    ← 上一步
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
                  className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                >
                  {isLast ? "完成 ✓" : "下一步 →"}
                </button>
              </div>
            </div>
            <div className="mt-2 text-right text-[11px] text-slate-400">
              {step + 1} / {STEPS.length} · 按 ← → 导航，ESC 关闭
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
