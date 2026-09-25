"use client";

import { useState } from "react";

export function RecomputePriorityButton({
  sourceId,
  url,
  variant = "inline",
}: {
  sourceId: string;
  url: string;
  variant?: "inline" | "banner";
}) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState<string>("");

  async function onClick() {
    if (!confirm("确认用最新关键词体系重新计算此条的优先级吗？")) return;
    setStatus("running");
    setMsg("重新计算中…");
    try {
      const res = await fetch("/api/monitor/items/debug-priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, url }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("done");
        setMsg(
          `完成：得分 ${data.before?.keyword_score ?? "?"} → ${data.after?.keyword_score ?? "?"}，等级 ${data.before?.importance_level ?? "?"} → ${data.after?.importance_level ?? "?"}`,
        );
        setTimeout(() => {
          window.location.reload();
        }, 1800);
      } else {
        setStatus("error");
        setMsg(`失败：${data.error ?? "unknown error"}`);
      }
    } catch (e) {
      setStatus("error");
      setMsg(`错误：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const baseCls =
    variant === "banner"
      ? "rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
      : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50";

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        className={baseCls}
        disabled={status === "running"}
      >
        {status === "running" ? "⟳ 正在重算…" : variant === "banner" ? "⟳ 立即重算这一条" : "⟳ 重算优先级"}
      </button>
      {msg ? (
        <span
          className={
            status === "error"
              ? "text-xs text-rose-600"
              : status === "done"
                ? "text-xs text-emerald-600"
                : "text-xs text-slate-500"
          }
        >
          {msg}
        </span>
      ) : null}
    </span>
  );
}
