"use client";

import { useState, useEffect, useRef } from "react";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";

const BACKUP_KEYS = [
  "creator-intel-prefs",
  "inbox_notes",
  "inbox_item_tags",
  "inbox_view_prefs",
  "inbox_search_history",
  "signals_search_history",
  "signals_guide_seen",
] as const;

type BackupData = Record<string, unknown>;

function readLocalData(): BackupData {
  const out: BackupData = {};
  for (const key of BACKUP_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) out[key] = JSON.parse(raw);
    } catch {}
  }
  return out;
}

function countEntries(data: BackupData) {
  const notes = (data["inbox_notes"] as Record<string, string> | undefined) ?? {};
  const tags = (data["inbox_item_tags"] as Record<string, string[]> | undefined) ?? {};
  const history = (data["inbox_search_history"] as string[] | undefined) ?? [];
  return {
    notes: Object.keys(notes).length,
    tags: Object.keys(tags).length,
    searchHistory: history.length,
    hasPrefs: !!data["creator-intel-prefs"],
  };
}

export default function DataBackupPage() {
  const [data, setData] = useState<BackupData>({});
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [importMsg, setImportMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setData(readLocalData());
  }, []);

  const counts = countEntries(data);

  function handleExport() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `creator-intel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as { version?: number; data?: BackupData };
        if (!parsed.data || typeof parsed.data !== "object") throw new Error("格式错误");
        let restored = 0;
        for (const key of BACKUP_KEYS) {
          if (key in parsed.data) {
            try {
              localStorage.setItem(key, JSON.stringify(parsed.data[key]));
              restored++;
            } catch {}
          }
        }
        setData(readLocalData());
        setImportStatus("success");
        setImportMsg(`已恢复 ${restored} 项本地数据，刷新页面后生效`);
      } catch (err) {
        setImportStatus("error");
        setImportMsg(`导入失败：${(err as Error).message}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  }

  function handleClearAll() {
    if (!confirm("确认清除所有本地数据？此操作不可撤销。")) return;
    for (const key of BACKUP_KEYS) {
      try { localStorage.removeItem(key); } catch {}
    }
    setData({});
    setImportStatus("success");
    setImportMsg("已清除全部本地数据");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-6">
          <Link href="/" prefetch={false} className="text-xs text-slate-500 hover:text-slate-700">← 返回首页</Link>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">本地数据备份 / 恢复</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            便签、标签、偏好等数据存储于浏览器 localStorage。导出备份可在换设备或清除缓存后恢复。
          </p>
        </div>

        {/* 当前数据概况 */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">当前本地数据</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "条目便签", value: counts.notes },
              { label: "自定义标签", value: counts.tags },
              { label: "搜索历史", value: counts.searchHistory },
              { label: "偏好设置", value: counts.hasPrefs ? "已存储" : "默认" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-lg font-bold text-slate-900">{item.value}</div>
                <div className="text-[11px] text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 操作区 */}
        <div className="space-y-4">
          {/* 导出 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">导出备份</h3>
                <p className="mt-1 text-xs text-slate-500">将所有本地数据导出为 JSON 文件，保存到本地。</p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-700"
              >
                ↓ 导出 JSON
              </button>
            </div>
          </div>

          {/* 导入 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">从备份恢复</h3>
                <p className="mt-1 text-xs text-slate-500">选择之前导出的 JSON 文件，覆盖当前本地数据。</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                ↑ 选择文件
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            {importStatus !== "idle" && (
              <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${importStatus === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {importMsg}
              </div>
            )}
          </div>

          {/* 清除 */}
          <div className="rounded-2xl border border-red-100 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">清除全部本地数据</h3>
                <p className="mt-1 text-xs text-slate-500">删除所有便签、标签、搜索历史和偏好设置。建议先导出备份。</p>
              </div>
              <button
                type="button"
                onClick={handleClearAll}
                className="shrink-0 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
              >
                清除数据
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
