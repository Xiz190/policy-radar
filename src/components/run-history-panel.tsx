"use client";

import { useEffect, useState } from "react";
import type { MonitorRunRecord, MonitorSourceRunResult } from "@/lib/monitor/types";

function fmtShanghai(iso: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(iso));
    const mo = parts.find((p) => p.type === "month")?.value ?? "??";
    const d = parts.find((p) => p.type === "day")?.value ?? "??";
    const h = parts.find((p) => p.type === "hour")?.value ?? "??";
    const min = parts.find((p) => p.type === "minute")?.value ?? "??";
    return `${mo}-${d} ${h}:${min}`;
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

function durationSec(start: string, end?: string): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  return `${(ms / 1000).toFixed(0)}s`;
}

function countNew(results?: MonitorSourceRunResult[]): number {
  if (!results) return 0;
  return results.reduce((s, r) => s + (r.newCount ?? 0), 0);
}

export function RunHistoryPanel() {
  const [runs, setRuns] = useState<MonitorRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/monitor/runs?limit=12", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: unknown) => { if (Array.isArray(data)) setRuns(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-50 px-5 py-6 text-center text-sm text-slate-400">
        暂无运行记录
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const newCount = countNew(run.results);
        const isOpen = expanded === run.id;
        return (
          <div key={run.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : run.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50"
            >
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                  run.status === "success"
                    ? "bg-emerald-400"
                    : run.status === "error"
                    ? "bg-rose-400"
                    : "animate-pulse bg-amber-400"
                }`}
              />
              <span className="w-28 shrink-0 text-slate-500 tabular-nums">{fmtShanghai(run.startedAt)}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                run.status === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : run.status === "error"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                {run.status === "success" ? "成功" : run.status === "error" ? "失败" : "运行中"}
              </span>
              <span className="text-slate-500">耗时 {durationSec(run.startedAt, run.finishedAt)}</span>
              {newCount > 0 && (
                <span className="ml-auto shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                  +{newCount} 新条目
                </span>
              )}
              {run.status === "error" && (
                <span className="ml-auto shrink-0 text-xs text-rose-500">{run.errorMessage?.slice(0, 40)}</span>
              )}
              <span className="ml-auto shrink-0 text-slate-400">{isOpen ? "▴" : "▾"}</span>
            </button>

            {isOpen && run.results && run.results.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-3">
                <table className="w-full text-xs text-slate-600">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="pb-1.5 font-medium">来源</th>
                      <th className="pb-1.5 font-medium">状态</th>
                      <th className="pb-1.5 font-medium">扫描</th>
                      <th className="pb-1.5 font-medium">新增</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {run.results.map((r) => (
                      <tr key={r.sourceId} className="hover:bg-slate-50">
                        <td className="py-1 pr-3 max-w-[160px] truncate" title={r.displayName}>{r.displayName}</td>
                        <td className="py-1 pr-3">
                          <span className={r.status === "success" ? "text-emerald-600" : "text-rose-600"}>
                            {r.status === "success" ? "✓" : "✗"}
                          </span>
                        </td>
                        <td className="py-1 pr-3 tabular-nums text-slate-400">{r.scannedCount}</td>
                        <td className="py-1 tabular-nums font-medium">
                          {r.newCount > 0 ? (
                            <span className="text-sky-600">+{r.newCount}</span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
