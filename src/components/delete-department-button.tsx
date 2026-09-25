"use client";

import { useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

export function DeleteDepartmentButton({ departmentName }: { departmentName: string }) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    const msg = `确认删除部委「${departmentName}」下的所有配置？\n\n这将删除该部委下的所有来源配置与自定义关键词（已入库的历史监测结果不会删除。`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      const res = await fetchWithAuth(
        `/api/monitor/sources/departments?departmentName=${encodeURIComponent(departmentName)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`删除失败：${res.status}`);
      alert(`已删除部委「${departmentName}」的配置。`);
      location.href = "/departments";
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-10 items-center rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
    >
      {busy ? "删除中…" : " 删除整个部委"}
    </button>
  );
}
