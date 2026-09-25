"use client";

import { useEffect, useState } from "react";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title="回到顶部"
      className="fixed bottom-20 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 sm:bottom-6 sm:right-6"
      aria-label="回到顶部"
    >
      ↑
    </button>
  );
}
