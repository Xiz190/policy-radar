"use client";

import { useTransition, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

export function ItemDetailActions({
  sourceId,
  url,
  initialRead,
  initialStarred,
}: {
  sourceId: string;
  url: string;
  initialRead: boolean;
  initialStarred: boolean;
}) {
  const [isRead, setIsRead] = useState(initialRead);
  const [isStarred, setIsStarred] = useState(initialStarred);
  const [isPending, startTransition] = useTransition();

  async function toggle(field: "read" | "starred") {
    startTransition(async () => {
      const next = field === "read" ? !isRead : !isStarred;
      const prevRead = isRead;
      const prevStarred = isStarred;
      if (field === "read") setIsRead(next);
      else setIsStarred(next);
      try {
        const res = await fetchWithAuth("/api/monitor/items/batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceId,
            url,
            isRead: field === "read" ? next : undefined,
            isStarred: field === "starred" ? next : undefined,
          }),
        });
        await res.json();
      } catch {
        if (field === "read") setIsRead(prevRead);
        else setIsStarred(prevStarred);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => toggle("read")}
        disabled={isPending}
        className={`inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium transition disabled:opacity-60 ${
          isRead
            ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            : "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
        }`}
      >
        {isRead ? "已读 · 点击取消" : "标为已读"}
      </button>
      <button
        type="button"
        onClick={() => toggle("starred")}
        disabled={isPending}
        className={`inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium transition disabled:opacity-60 ${
          isStarred
            ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        {isStarred ? "★ 已标重点 · 点击取消" : "☆ 标为重点"}
      </button>
    </div>
  );
}
