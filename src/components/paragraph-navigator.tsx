"use client";

import { useEffect, useRef } from "react";

export default function ParagraphNavigator() {
  // 上一次高亮的段落，便于在新的高亮时清除旧高亮
  const lastHighlightRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function onJump(e: Event) {
      const custom = e as CustomEvent<{ index?: unknown }>;
      const rawIndex = custom.detail?.index;
      if (rawIndex === undefined || rawIndex === null) return;
      const idx = Number(rawIndex);
      if (!Number.isFinite(idx)) return;

      const target = document.querySelector<HTMLElement>(
        `#document-paragraphs [data-para-index="${idx}"]`,
      );
      if (!target) return;

      // 清除上一次高亮
      if (lastHighlightRef.current && lastHighlightRef.current !== target) {
        const el = lastHighlightRef.current;
        el.classList.remove("border-indigo-400", "bg-indigo-50", "ring-2", "ring-indigo-200");
        el.classList.add("border-slate-200");
      }
      lastHighlightRef.current = target;

      // 平滑滚动到目标（居中）
      target.scrollIntoView({ behavior: "smooth", block: "center" });

      // 高亮 3 秒
      target.classList.remove("border-slate-200");
      target.classList.add("border-indigo-400", "bg-indigo-50", "ring-2", "ring-indigo-200");
      window.setTimeout(() => {
        if (lastHighlightRef.current === target) {
          target.classList.remove("border-indigo-400", "bg-indigo-50", "ring-2", "ring-indigo-200");
          target.classList.add("border-slate-200");
          lastHighlightRef.current = null;
        }
      }, 3000);
    }

    window.addEventListener("chat:jump-paragraph", onJump as EventListener);
    return () => {
      window.removeEventListener("chat:jump-paragraph", onJump as EventListener);
    };
  }, []);

  // 这是一个"零 UI"的客户端组件，只做全局事件监听
  return null;
}
