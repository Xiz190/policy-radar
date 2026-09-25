"use client";

import { useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  BookOpen, Search, Star,
} from "lucide-react";

type ActionResult = {
  ok: boolean;
  action?: string;
  message?: string;
  updated?: number;
  deleted?: number;
  scanned?: number;
  total?: number;
  avgScore?: number;
  topCategories?: Array<{ category: string; count: number }>;
  error?: string;
};

export function BulkActions() {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [keywordDays, setKeywordDays] = useState(1000);

  async function runAction(action: string, body: Record<string, unknown> = {}) {
    setBusy(action);
    setResult(null);
    try {
      const res = await fetchWithAuth("/api/monitor/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = (await res.json().catch(() => ({ ok: false, error: "请求失败" }))) as ActionResult;
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">批量维护</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">一键操作 · 数据清理</h2>
          <p className="mt-1 text-sm text-slate-600">快速标记未读、清理旧数据、重扫关键词分类。</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => runAction("mark-all-read")}
          disabled={busy !== null}
          className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
        >
          <div className="text-13 font-semibold text-slate-900"><BookOpen className="mr-1 inline h-3.5 w-3.5" aria-hidden />全标已读</div>
          <div className="mt-1 text-xs text-slate-500">把所有未读条目标记为已读</div>
        </button>

        <button
          type="button"
          onClick={() => runAction("unstar-old", { days: 14 })}
          disabled={busy !== null}
          className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
        >
          <div className="text-13 font-semibold text-slate-900"><Star className="mr-1 inline h-3.5 w-3.5" aria-hidden />取消 14 天前重点</div>
          <div className="mt-1 text-xs text-slate-500">清理较早重点，避免列表过长</div>
        </button>

        <button
          type="button"
          onClick={() => runAction("clean-old", { days: 90 })}
          disabled={busy !== null}
          className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
        >
          <div className="text-13 font-semibold text-slate-900">删除 90 天前条目</div>
          <div className="mt-1 text-xs text-slate-500">删除早期内容，释放数据库空间</div>
        </button>

        <div className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-13 font-semibold text-slate-900"><Search className="mr-1 inline h-3.5 w-3.5" aria-hidden />重扫关键词</div>
          <div className="mt-1 text-xs text-slate-500">
            更新最近 {keywordDays} 条的分类结果
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              min={100}
              max={10000}
              value={keywordDays}
              onChange={(e) => setKeywordDays(Number(e.target.value) || 1000)}
              className="h-8 w-24 rounded-lg border border-slate-200 px-2 text-xs"
            />
            <button
              onClick={() => runAction("rescan-keywords", { limit: keywordDays })}
              disabled={busy !== null}
              className="h-8 rounded-full bg-slate-900 px-3 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
            >
              执行
            </button>
          </div>
        </div>
      </div>

      {/* 执行结果 */}
      {busy && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          正在执行… ({busy})
        </div>
      )}
      {result && !busy && (
        <div
          className={`mt-5 rounded-2xl border p-4 text-sm ${
            result.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="font-semibold">
            {result.ok ? "完成" : "失败"}
          </div>
          {result.message && <div className="mt-1">{result.message}</div>}
          {typeof result.updated === "number" && (
            <div className="mt-1">更新了 {result.updated} 条记录</div>
          )}
          {typeof result.deleted === "number" && (
            <div className="mt-1">删除了 {result.deleted} 条记录</div>
          )}
          {typeof result.scanned === "number" && (
            <div className="mt-1">扫描了 {result.scanned} / {result.total} 条记录</div>
          )}
          {typeof result.avgScore === "number" && (
            <div className="mt-1">平均关键词得分：{result.avgScore}</div>
          )}
          {result.topCategories && result.topCategories.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium mb-2">分类命中情况：</div>
              <div className="flex flex-wrap gap-2">
                {result.topCategories.map((c) => (
                  <span
                    key={c.category}
                    className="rounded-full bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200"
                  >
                    {c.category} ({c.count})
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.error && <div className="mt-1">{result.error}</div>}
        </div>
      )}
    </section>
  );
}
