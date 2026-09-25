"use client";

import { useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

export function RecaptureButton({ sourceId, url, isMock }: { sourceId: string; url: string; isMock?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [showTip, setShowTip] = useState(false);

  if (isMock) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setShowTip((v) => !v)}
          className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-50 px-5 text-sm text-slate-400 cursor-default"
        >
          重新抓取正文
        </button>
        {showTip && (
          <div className="absolute left-0 top-12 z-10 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg text-xs text-slate-600 leading-relaxed">
            <div className="font-semibold text-slate-800 mb-1">演示模式</div>
            当前运行在本地演示模式，内容为预置示例数据。真实部署后，点击此按钮可重新爬取原始网页正文。
            <div className="mt-2 text-slate-400 font-mono break-all">{url}</div>
          </div>
        )}
      </div>
    );
  }

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const resp = await fetchWithAuth("/api/monitor/items/recapture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId, url }),
      });
      const data = await resp.json();
      if (data.ok) {
        window.location.reload();
      } else {
        alert("重新抓取失败：" + (data.error || "unknown"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {loading ? "重新抓取中…" : "重新抓取正文"}
    </button>
  );
}
