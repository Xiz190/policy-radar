"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Step = {
  title: string;
  desc: string;
  tour?: string;     // data-tour 值：要高亮的元素（不用 title 选，title 会随语言变）
  hint?: string;     // keyboard shortcut or badge text
};

const STEPS: Step[] = [
  {
    title: "搜索与 ⌘K",
    desc: "点「搜索」或按 ⌘K（Windows 上是 Ctrl+K）。输入页面名可以直接跳过去，输入其他词就搜全部条目。",
    tour: "palette",
    hint: "⌘K",
  },
  {
    title: "信号雷达",
    desc: "不是所有动态都值得关注。信号雷达自动识别高价值内容：强执行、强支持、濒危预警、行业研究。",
  },
  {
    title: "收件箱键盘导航",
    desc: "在收件箱页面，用 J/K 上下切换条目，R 标记已读，S 收藏重点。不需要鼠标，读完一批只需几秒。",
    hint: "J · K · R · S",
  },
  {
    title: "周报生成器",
    desc: "在信号雷达页面，筛选好当前关注的信号后，点击「生成周报」即可一键生成 Markdown 格式的情报周报，可直接复制到 Notion / 飞书 / 备忘录。",
    hint: "信号页 → 生成周报",
  },
  {
    title: "辅助功能面板",
    desc: "在「设置 → 辅助功能」里可以调字号、切深色模式、开高对比度、减少动画，也能切换中英文。",
    tour: "settings",
  },
  {
    title: "关于这个项目",
    desc: "「设置 → 关于这个项目」里写了技术栈、数据来源和设计取舍。这是一个面向政策研究与行业情报的监测平台（当前实例聚焦 AI／数字经济政策），也是研究生申请作品集里的一个案例。",
    tour: "settings",
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
  const selector = current.tour ? `[data-tour="${current.tour}"]` : null;

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

    if (selector) {
      const el = document.querySelector(selector);
      if (el) {
        (el as HTMLElement).style.outline = "3px solid var(--brand)";
        (el as HTMLElement).style.outlineOffset = "3px";
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 测量 DOM 位置只能在挂载后做
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
  }, [open, step, selector]);

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

  // 每次打开都从第 1 步开始（渲染中对比上一次的 open，不放进 effect）
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStep(0);
  }

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
