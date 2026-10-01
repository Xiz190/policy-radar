"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePrefs } from "@/contexts/prefs-context";
import { useT } from "@/lib/i18n";
import { useDemoVisitor } from "@/hooks/use-demo-visitor";
import { DEMO_READONLY_EVENT } from "@/lib/demo-readonly";

// 公开演示站的前端配合（服务端闸门在 src/proxy.ts）：
// - 访客顶部一条细提示「演示站 · 只读」+ 作者登录入口
// - 访客点了写操作被挡时（403 + x-demo-readonly），弹一句说明，而不是静默失败
// 本地开发 / 作者已登录时什么都不渲染。
export function DemoModeGate() {
  const { language, focusMode } = usePrefs();
  const t = useT(language);
  const visitor = useDemoVisitor();
  const [toast, setToast] = useState(false);
  const lastToastAt = useRef(0);

  const showToast = useRef<() => void>(() => {});
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    showToast.current = () => {
      const now = Date.now();
      if (now - lastToastAt.current < 1500) return;
      lastToastAt.current = now;
      setToast(true);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(false), 2600);
    };
    return () => clearTimeout(timer);
  }, []);

  // 作者专用按钮（标了 data-owner-only 的收藏、已读、Save、AI 分析等）：
  // 访客模式下统一变灰（globals.css），点击/提交在捕获阶段就拦下——按钮自己的处理函数根本不会跑，
  // 所以不会出现「先显示已收藏、再提示只读、刷新又没了」这种自相矛盾的界面。悬停时补一句说明。
  useEffect(() => {
    if (!visitor) return;
    const root = document.documentElement;
    root.dataset.visitor = "";
    const ownerOnly = (e: Event) => (e.target instanceof Element ? e.target.closest("[data-owner-only]") : null);
    const block = (e: Event) => {
      if (!ownerOnly(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      showToast.current();
    };
    const explain = (e: Event) => {
      const el = ownerOnly(e);
      if (el && !el.hasAttribute("data-owner-titled")) {
        el.setAttribute("title", tRef.current("demo.ownerOnlyTitle"));
        el.setAttribute("aria-disabled", "true");
        el.setAttribute("data-owner-titled", "");
      }
    };
    const onNotify = () => showToast.current();
    window.addEventListener(DEMO_READONLY_EVENT, onNotify);
    document.addEventListener("click", block, true);
    document.addEventListener("submit", block, true);
    document.addEventListener("pointerover", explain, true);
    document.addEventListener("focusin", explain, true);
    return () => {
      delete root.dataset.visitor;
      window.removeEventListener(DEMO_READONLY_EVENT, onNotify);
      document.removeEventListener("click", block, true);
      document.removeEventListener("submit", block, true);
      document.removeEventListener("pointerover", explain, true);
      document.removeEventListener("focusin", explain, true);
    };
  }, [visitor]);

  // 兜底：没标记到的写操作被服务端闸门挡下时（403 + x-demo-readonly），也弹同一句说明，而不是静默失败
  useEffect(() => {
    if (!visitor) return;
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 403 && res.headers.get("x-demo-readonly") === "1") showToast.current();
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, [visitor]);

  if (!visitor) return null;

  return (
    <>
      {!focusMode && (
        <div className="flex items-center justify-center gap-3 border-b border-[var(--border)] bg-[var(--muted)] px-4 py-1.5 text-[11px] text-[var(--muted-foreground)]">
          <span>{t("demo.banner")}</span>
          <Link href="/unlock" className="font-medium text-[var(--foreground)] underline-offset-2 hover:underline">
            {t("demo.ownerLogin")}
          </Link>
        </div>
      )}
      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed left-1/2 top-4 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {t("demo.readonlyToast")}
        </div>
      )}
    </>
  );
}
