"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function FloatingCommandButton({ onOpen }: { onOpen: () => void }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem("cmd-btn-pos") ?? "null"); } catch { return null; }
    })();
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
      setPos(clamp(saved.x, saved.y));
    } else {
      setPos({ x: window.innerWidth - 68, y: window.innerHeight - 120 });
    }
    setMounted(true);
  }, []);

  function clamp(x: number, y: number) {
    const W = window.innerWidth, H = window.innerHeight, S = 48;
    return { x: Math.max(8, Math.min(x, W - S - 8)), y: Math.max(8, Math.min(y, H - S - 8)) };
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    didDrag.current = false;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    setDragging(true);

    function onMove(ev: MouseEvent) {
      didDrag.current = true;
      setPos(clamp(ev.clientX - dragOffset.current.x, ev.clientY - dragOffset.current.y));
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDragging(false);
      const final = clamp(ev.clientX - dragOffset.current.x, ev.clientY - dragOffset.current.y);
      setPos(final);
      try { localStorage.setItem("cmd-btn-pos", JSON.stringify(final)); } catch {}
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    didDrag.current = false;
    dragOffset.current = { x: t.clientX - pos.x, y: t.clientY - pos.y };

    function onMove(ev: TouchEvent) {
      ev.preventDefault();
      didDrag.current = true;
      const touch = ev.touches[0];
      setPos(clamp(touch.clientX - dragOffset.current.x, touch.clientY - dragOffset.current.y));
    }
    function onEnd(ev: TouchEvent) {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      const touch = ev.changedTouches[0];
      const final = clamp(touch.clientX - dragOffset.current.x, touch.clientY - dragOffset.current.y);
      setPos(final);
      try { localStorage.setItem("cmd-btn-pos", JSON.stringify(final)); } catch {}
    }
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }

  function handleClick() {
    if (!didDrag.current) onOpen();
  }

  if (!mounted) return null;

  return createPortal(
    <button
      ref={btnRef}
      type="button"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={handleClick}
      title="命令面板（⌘K）"
      style={{ left: pos.x, top: pos.y }}
      className={`fixed z-[50] hidden h-12 w-12 select-none items-center justify-center rounded-full bg-slate-900/85 text-white shadow-lg backdrop-blur transition-shadow hover:shadow-xl sm:flex ${dragging ? "cursor-grabbing opacity-80" : "cursor-grab"}`}
    >
      <span className="text-[11px] font-semibold tracking-tight">⌘K</span>
    </button>,
    document.body
  );
}
