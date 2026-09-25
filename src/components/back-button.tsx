"use client";

import { useEffect, useState } from "react";

function saveInboxScroll() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem("inbox-scroll-y", String(window.scrollY));
  } catch {}
}

export function BackButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window === "undefined") return;
        saveInboxScroll();
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = "/inbox";
        }
      }}
      className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-5 text-sm text-slate-700 transition hover:bg-slate-50"
    >
      ← 返回
    </button>
  );
}

export function FloatingBackButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={() => {
        saveInboxScroll();
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = "/inbox";
        }
      }}
      className="fixed bottom-6 left-6 z-50 inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-5 text-sm font-medium text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur transition hover:bg-white"
      aria-label="返回"
    >
      ← 返回
    </button>
  );
}
