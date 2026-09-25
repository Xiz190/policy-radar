"use client";

import { useRef, useState, useEffect, useLayoutEffect } from "react";

export function FloatingPagination({
  page,
  pageSize,
  totalCount,
  onChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onChange: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(totalCount, safePage * pageSize);

  const pageNums: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  } else {
    pageNums.push(1);
    const left = Math.max(2, safePage - 1);
    const right = Math.min(totalPages - 1, safePage + 1);
    if (left > 2) pageNums.push("...");
    for (let i = left; i <= right; i++) pageNums.push(i);
    if (right < totalPages - 1) pageNums.push("...");
    pageNums.push(totalPages);
  }

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );
  const [mounted] = useState<boolean>(true);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const posRef = useRef(pos);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    let startPos: { x: number; y: number } | null = null;
    try {
      const raw = window.localStorage.getItem("inbox-float-pos");
      if (raw) {
        const v = JSON.parse(raw);
        if (typeof v.x === "number" && typeof v.y === "number") startPos = v;
      }
    } catch {}
    if (!startPos) {
      const w = el.offsetWidth || 520;
      const h = el.offsetHeight || 64;
      startPos = {
        x: Math.max(8, (window.innerWidth - w) / 2),
        y: Math.max(8, window.innerHeight - h - (window.innerWidth < 640 ? 88 : 16)),
      };
    }
    el.style.left = `${startPos.x}px`;
    el.style.top = `${startPos.y}px`;
    posRef.current = startPos;
    setPos(startPos);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = panelRef.current;
    if (!el) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let curX = 0;
    let curY = 0;
    let moved = false;
    let w = el.offsetWidth || 320;
    let h = el.offsetHeight || 64;

    const clampX = (x: number) => Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8));
    const clampY = (y: number) => Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h - 8));

    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("button,a,input,textarea,select,label,[role='button']")) return;
      w = el.offsetWidth || 320;
      h = el.offsetHeight || 64;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      curX = posRef.current.x;
      curY = posRef.current.y;
      el.style.transition = "none";
      try {
        (el as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
      } catch {}
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      startX = e.clientX;
      startY = e.clientY;
      curX = clampX(curX + dx);
      curY = clampY(curY + dy);
      el.style.left = `${curX}px`;
      el.style.top = `${curY}px`;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      el.style.transition = "";
      if (moved) {
        posRef.current = { x: curX, y: curY };
        setPos({ x: curX, y: curY });
        try {
          window.localStorage.setItem("inbox-float-pos", JSON.stringify({ x: curX, y: curY }));
        } catch {}
      }
    };
    const onResize = () => {
      w = el.offsetWidth || 320;
      h = el.offsetHeight || 64;
      const next = { x: clampX(posRef.current.x), y: clampY(posRef.current.y) };
      posRef.current = next;
      setPos(next);
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      suppressHydrationWarning
      style={{ visibility: mounted ? "visible" : "hidden" }}
      className="fixed z-50 pointer-events-auto select-none rounded-full border border-slate-200 bg-white/90 px-3 py-2 shadow-lg shadow-slate-300/50 backdrop-blur will-change-transform"
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex h-12 w-12 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100"
          title={`共 ${totalCount} 条 · 第 ${safePage}/${totalPages} 页 · 点击展开`}
        >
          <div className="flex flex-col items-center leading-none">
            <span className="text-[11px] text-slate-500">{totalCount}</span>
            <span className="text-sm font-semibold">{safePage}/{totalPages}</span>
          </div>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-600 transition hover:bg-slate-100"
            title="收为浮球"
          >
            ◣
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.history.back();
            }}
            className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 transition hover:border-slate-400"
          >
            ← 返回
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 transition hover:border-slate-400"
          >
            ↑ 顶部
          </button>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <div className="whitespace-nowrap text-[11px] text-slate-500">
            共 <span className="font-semibold text-slate-900">{totalCount}</span> ·{" "}
            <span className="font-semibold text-slate-900">{start}-{end}</span> · 第{" "}
            <span className="font-semibold text-slate-900">{safePage}</span> / {totalPages} 页
          </div>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => onChange(safePage - 1)}
            disabled={safePage <= 1}
            className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ←
          </button>
          <div className="flex flex-wrap items-center gap-1">
            {pageNums.map((p, i) =>
              p === "..." ? (
                <span key={`e-${i}`} className="px-1 text-[11px] text-slate-400">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange(p)}
                  className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border px-1.5 text-[11px] transition ${
                    p === safePage
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
