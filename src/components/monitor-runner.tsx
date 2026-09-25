"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import type { MonitorRunRecord, MonitorSourceRunResult } from "@/lib/monitor/types";
type AutoStatusState = {
  running: boolean;
  intervalMs: number;
  scheduler: {
    startedAt: string;
    intervalMs: number;
    lastRunAt: string | null;
    lastRunId: string | null;
    nextRunAt: string;
    runningNow: boolean;
  } | null;
};

type SourceSummary = {
  id: string;
  displayName: string;
  channelName: string;
  listUrl: string;
  enabled: boolean;
  autoMonitor: boolean;
};

type GroupedSources = Array<{ departmentName: string; sources: SourceSummary[] }>;

function formatTime(iso?: string) {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatInterval(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${hours} 小时`;
  return `${hours} 小时 ${remainder} 分钟`;
}

export function MonitorRunner({
  initialStatus,
  groupedSources,
}: {
  initialStatus: MonitorRunRecord | null;
  groupedSources: GroupedSources;
}) {
  const [status, setStatus] = useState<MonitorRunRecord | null>(initialStatus);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<AutoStatusState | null>(null);
  const [autoActionBusy, setAutoActionBusy] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  // 部委板块折叠/展开状态：默认全部收起
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(() => new Set());

  const hasResults = Array.isArray(status?.results);
  const results: MonitorSourceRunResult[] = useMemo(
    () => (hasResults ? (status!.results ?? []) : []),
    [hasResults, status],
  );
  // "最近一次运行结果"每个栏目的折叠/展开状态：默认全部收起
  const [expandedResults, setExpandedResults] = useState<Set<string>>(() => new Set());
  const totalNew = useMemo(
    () => results.reduce((sum: number, r) => sum + (r.newCount ?? 0), 0),
    [results],
  );
  const totalEnabled = useMemo(
    () => groupedSources.reduce((s, g) => s + g.sources.filter((x) => x.enabled).length, 0),
    [groupedSources],
  );

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/monitor/status", { cache: "no-store" });
    const json = await res.json();
    setStatus(json);
  }, []);

  const refreshAutoStatus = useCallback(async () => {
    const res = await fetch("/api/monitor/auto-status", { cache: "no-store" });
    const json = await res.json();
    setAutoStatus(json);
  }, []);

  const runScoped = useCallback(
    async (scope?: { departmentNames?: string[]; sourceIds?: string[] }) => {
      setRunning(true);
      setError(null);
      try {
        const res = await fetchWithAuth("/api/monitor/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: scope ? JSON.stringify(scope) : undefined,
        });
        const json = await res.json();
        setStatus(json);
        refreshAutoStatus().catch(() => void 0);
      } catch (e) {
        setError((e as Error).message ?? String(e));
      } finally {
        setRunning(false);
      }
    },
    [refreshAutoStatus],
  );

  const runSelectedDepartments = useCallback(() => {
    const names = Array.from(selectedDepartments);
    if (names.length === 0) return;
    runScoped({ departmentNames: names });
  }, [runScoped, selectedDepartments]);

  const startAuto = useCallback(async () => {
    setAutoActionBusy(true);
    try {
      const res = await fetchWithAuth("/api/monitor/auto-status", { method: "POST" });
      const json = await res.json();
      setAutoStatus(json);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setAutoActionBusy(false);
    }
  }, []);

  const stopAuto = useCallback(async () => {
    setAutoActionBusy(true);
    try {
      const res = await fetchWithAuth("/api/monitor/auto-status", { method: "DELETE" });
      const json = await res.json();
      setAutoStatus(json);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setAutoActionBusy(false);
    }
  }, []);

  const toggleDepartment = useCallback((name: string) => {
    setSelectedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((name: string) => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleExpandedResult = useCallback((id: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllEnabledDepartments = useCallback(() => {
    setSelectedDepartments(
      new Set(groupedSources.map((g) => g.departmentName)),
    );
  }, [groupedSources]);

  const clearSelection = useCallback(() => {
    setSelectedDepartments(new Set());
  }, []);

  useEffect(() => {
    queueMicrotask(() => refreshStatus().catch(() => void 0));
    queueMicrotask(() => refreshAutoStatus().catch(() => void 0));
    const ticker = setInterval(() => {
      refreshAutoStatus().catch(() => void 0);
    }, 30 * 1000);
    return () => clearInterval(ticker);
  }, [refreshStatus, refreshAutoStatus]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">监测任务层</h2>
          <p className="mt-1 text-sm text-slate-500">
            按部委分组运行，可逐个部委独立运行，也可多选后一键监测。当前共纳管 {groupedSources.reduce((s, g) => s + g.sources.length, 0)} 个来源（启用 {totalEnabled}）。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => runScoped()}
            disabled={running}
            className="inline-flex h-10 items-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? "运行中…" : "运行全部自动监测来源"}
          </button>
          <button
            type="button"
            onClick={refreshStatus}
            className="inline-flex h-10 items-center rounded-full border border-slate-300 px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            刷新状态
          </button>
        </div>
      </div>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">自动定时运行</div>
            <div className="mt-1 text-xs text-slate-500">
              {autoStatus?.running
                ? `每 ${formatInterval(autoStatus.intervalMs ?? 0)} 自动跑一次，抓取来源配置中勾选"自动监测"的栏目。`
                : "自动运行未启动，可点击右侧按钮开启。"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                autoStatus?.running ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${autoStatus?.running ? "bg-emerald-500" : "bg-slate-500"}`} />
              {autoStatus?.running ? "自动运行中" : "未启动"}
            </span>
            {autoStatus?.running ? (
              <button
                type="button"
                onClick={stopAuto}
                disabled={autoActionBusy}
                className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                停止自动
              </button>
            ) : (
              <button
                type="button"
                onClick={startAuto}
                disabled={autoActionBusy}
                className="inline-flex h-9 items-center rounded-full bg-emerald-600 px-4 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                开启自动
              </button>
            )}
          </div>
        </div>
        {autoStatus?.scheduler?.nextRunAt ? (
          <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-3">
              <div className="text-slate-500">下次运行时间</div>
              <div className="mt-1 font-semibold text-slate-900">{formatTime(autoStatus.scheduler.nextRunAt)}</div>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <div className="text-slate-500">上次自动运行</div>
              <div className="mt-1 font-semibold text-slate-900">{formatTime(autoStatus.scheduler.lastRunAt ?? undefined)}</div>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <div className="text-slate-500">调度状态</div>
              <div className="mt-1 font-semibold text-slate-900">{autoStatus.scheduler.runningNow ? "正在运行中…" : "等待中"}</div>
            </div>
          </div>
        ) : null}
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-sm text-slate-500">最后运行状态</div>
          <div className="mt-1 text-lg font-semibold">{status?.status ?? "-"}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-sm text-slate-500">开始时间</div>
          <div className="mt-1 text-sm font-semibold">{formatTime(status?.startedAt)}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-sm text-slate-500">结束时间</div>
          <div className="mt-1 text-sm font-semibold">{formatTime(status?.finishedAt)}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-sm text-slate-500">本次新增</div>
          <div className="mt-1 text-lg font-semibold">{hasResults ? totalNew : "-"}</div>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {status?.errorMessage ? (
        <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>{status.errorMessage}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetchWithAuth("/api/monitor/run", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ force: true }),
                    });
                    const json = await res.json();
                    setStatus(json);
                    refreshAutoStatus().catch(() => void 0);
                  } catch (e) {
                    setError((e as Error).message ?? String(e));
                  }
                }}
                disabled={running}
                className="inline-flex h-9 items-center rounded-full bg-rose-600 px-4 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? "运行中…" : "清理锁并强制运行全部"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const names = Array.from(selectedDepartments);
                  if (names.length > 0) {
                    await runScoped({ departmentNames: names });
                  } else {
                    setError("请先在下方勾选至少一个部委，然后点击页面中的「监测该部委」或「一键监测选中」。");
                  }
                }}
                disabled={running}
                className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                改跑已选部委（会绕过锁）
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">按部委多选监测</div>
          <div className="mt-1 text-xs text-slate-500">
            已选 {selectedDepartments.size} / {groupedSources.length} 个部委。点击下方&quot;一键监测选中&quot;，将仅运行这些部委下的启用来源。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExpandedDepartments(new Set(groupedSources.map((g) => g.departmentName)))}
            className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            全部展开
          </button>
          <button
            type="button"
            onClick={() => setExpandedDepartments(new Set())}
            className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            全部收起
          </button>
          <button
            type="button"
            onClick={selectAllEnabledDepartments}
            className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            全选部委
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            清空
          </button>
          <button
            type="button"
            onClick={runSelectedDepartments}
            disabled={running || selectedDepartments.size === 0}
            className="inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? "运行中…" : `一键监测选中（${selectedDepartments.size}）`}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {groupedSources.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
            还没有任何来源配置。去来源配置里新增第一个部委与栏目。
          </div>
        ) : (
          groupedSources.map((group) => {
            const isSelected = selectedDepartments.has(group.departmentName);
            const expanded = expandedDepartments.has(group.departmentName);
            const enabledCount = group.sources.filter((s) => s.enabled).length;
            return (
              <div key={group.departmentName} className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5">
                <div
                  className="flex cursor-pointer select-none flex-col gap-3 md:flex-row md:items-center md:justify-between"
                  onClick={() => toggleExpanded(group.departmentName)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpanded(group.departmentName);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDepartment(group.departmentName)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`选择 ${group.departmentName}`}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300"
                    />
                    <div>
                      <h3 className="text-lg font-semibold">{group.departmentName}</h3>
                      <div className="mt-1 text-xs text-slate-500">
                        {group.sources.length} 个栏目 · 已启用 {enabledCount} · 自动监测 {group.sources.filter((s) => s.autoMonitor).length}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        runScoped({ departmentNames: [group.departmentName] });
                      }}
                      disabled={running || enabledCount === 0}
                      className="inline-flex h-9 items-center rounded-full bg-emerald-600 px-4 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {running ? "运行中…" : `监测该部委（${enabledCount}）`}
                    </button>
                    <span
                      className={`ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-300 ${
                        expanded ? "rotate-180 bg-slate-50 text-slate-700" : "bg-white"
                      }`}
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                  </div>
                </div>

                {/* 内容区：使用 CSS Grid 实现从 0 到 auto 的平滑过渡 */}
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                    expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                  aria-hidden={!expanded}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {group.sources.map((s) => (
                        <div key={s.id} className="flex items-start justify-between rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">{s.channelName}</div>
                            <div className="mt-1 text-xs text-slate-500">{s.displayName}</div>
                            <a
                              href={s.listUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block truncate text-xs text-slate-600 underline decoration-slate-300 underline-offset-4"
                            >
                              {s.listUrl}
                            </a>
                          </div>
                          <div className="ml-3 shrink-0 text-right text-xs">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 ${
                                s.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {s.enabled ? "启用" : "停用"}
                            </span>
                            {s.autoMonitor ? (
                              <span className="ml-1 inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">自动</span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">最近一次运行结果</h3>
          {hasResults ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setExpandedResults(new Set(results.map((r) => r.sourceId)))}
                className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                全部展开
              </button>
              <button
                type="button"
                onClick={() => setExpandedResults(new Set())}
                className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                全部收起
              </button>
            </div>
          ) : null}
        </div>
        {hasResults ? (
          results.map((r) => {
            const expanded = expandedResults.has(r.sourceId);
            return (
              <div key={r.sourceId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5">
                <div
                  className="flex cursor-pointer select-none flex-col gap-2 md:flex-row md:items-center md:justify-between"
                  onClick={() => toggleExpandedResult(r.sourceId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpandedResult(r.sourceId);
                    }
                  }}
                >
                  <div>
                    <div className="text-xs text-slate-500">{r.sourceId}</div>
                    <div className="mt-1 text-lg font-semibold">{r.displayName}</div>
                    <a
                      href={r.listUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 block break-all text-xs text-slate-600 underline decoration-slate-300 underline-offset-4"
                    >
                      {r.listUrl}
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">状态：{r.status}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">扫描：{r.scannedCount}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">可见：{r.visibleCount}</span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">新增：{r.newCount}</span>
                    <span
                      className={`ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-300 ${
                        expanded ? "rotate-180 bg-slate-50 text-slate-700" : "bg-white"
                      }`}
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                  </div>
                </div>

                {/* 内容区：CSS Grid 0fr/1fr 平滑过渡 */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                    expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                  aria-hidden={!expanded}
                >
                  <div className="min-h-0 overflow-hidden">
                    {r.errorMessage ? (
                      <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{r.errorMessage}</div>
                    ) : null}

                    {Array.isArray(r.newItems) && r.newItems.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        <div className="text-sm font-medium text-slate-700">新增条目（按 URL 去重）</div>
                        {r.newItems.map((item) => (
                          <div key={item.url} className="rounded-2xl bg-slate-50 px-4 py-3">
                            <div className="text-xs text-slate-500">
                              {item.listPublishedAt} · 首次发现 {formatTime(item.firstSeenAt)}
                            </div>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
                            >
                              {item.title}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 text-sm text-slate-500">本栏目本次无新增。</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
            还没有运行记录。点击上方按钮开始第一轮监测。
          </div>
        )}
      </div>
      {/* 诊断与清理：旧分类关键词/正文抓取失败 */}
      <section className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">诊断与清理</h3>
            <p className="mt-1 text-xs text-slate-500">
              检查是否还残留旧分类标签（regulations/innovation/region_bjj 等），并一键清理、重扫条目关键词。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DiagnosePanel />
          </div>
        </div>
      </section>
    </section>
  );
}

async function safeFetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      bodyText = "(无法读取响应体)";
    }
    const isHtml = contentType.includes("text/html");
    const summary = bodyText.length > 200 ? bodyText.slice(0, 200) + "…" : bodyText;

    if (res.status === 404) {
      throw new Error(`接口不存在（404）：${url}`);
    }
    if (isHtml) {
      throw new Error(`服务端异常（${res.status}），返回 HTML 而非 JSON：${summary}`);
    }
    if (contentType.includes("application/json")) {
      try {
        const data = JSON.parse(bodyText);
        throw new Error(`接口错误（${res.status}）：${data?.error || data?.message || summary}`);
      } catch {
        throw new Error(`接口错误（${res.status}）：${summary}`);
      }
    }
    throw new Error(`接口错误（${res.status}）：${summary || "无响应体"}`);
  }

  if (!contentType.includes("application/json")) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      bodyText = "";
    }
    if (!bodyText) {
      throw new Error("接口返回空响应");
    }
    const summary = bodyText.length > 200 ? bodyText.slice(0, 200) + "…" : bodyText;
    throw new Error(`接口返回非 JSON（content-type: ${contentType || "未设置"}）：${summary}`);
  }

  try {
    return await res.json();
  } catch (e) {
    throw new Error(`JSON 解析失败：${(e as Error).message}`);
  }
}

function DiagnosePanel() {
  const [diagnoseJson, setDiagnoseJson] = useState<{
    summary?: { oldCategoryKeywordCount?: number; itemsWithOldCatsCount?: number };
    [key: string]: unknown;
  } | null>(null);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [cleanLoading, setCleanLoading] = useState(false);
  const [cleanResult, setCleanResult] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runDiagnose = async () => {
    setDiagnoseLoading(true);
    setMessage(null);
    try {
      const json = await safeFetchJson("/api/monitor/diagnose", { cache: "no-store" });
      setDiagnoseJson(json as Record<string, unknown>);
    } catch (e) {
      setMessage((e as Error).message ?? String(e));
    } finally {
      setDiagnoseLoading(false);
    }
  };

  const runClean = async () => {
    if (!confirm("确定清理旧分类关键词并重扫所有条目的关键词标签？")) return;
    setCleanLoading(true);
    setMessage(null);
    try {
      const res = await fetchWithAuth("/api/monitor/keywords/clean", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cleanKeywords: true, rescanItems: true }),
      });
      const json = await res.json();
      setCleanResult(json);
    } catch (e) {
      setMessage((e as Error).message ?? String(e));
    } finally {
      setCleanLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">关键词与分类标签诊断</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runDiagnose}
            disabled={diagnoseLoading}
            className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {diagnoseLoading ? "诊断中…" : "运行诊断"}
          </button>
          <button
            type="button"
            onClick={runClean}
            disabled={cleanLoading}
            className="inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cleanLoading ? "清理中…" : "清理旧分类 + 重扫条目"}
          </button>
        </div>
      </div>

      {message ? <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div> : null}

      {diagnoseJson ? (
        <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
            <span>诊断结果</span>
            {diagnoseJson.summary ? (
              <span className="text-xs text-slate-500">
                还有 {diagnoseJson.summary.oldCategoryKeywordCount || 0} 个关键词是旧分类；{diagnoseJson.summary.itemsWithOldCatsCount || 0} 条条目标签需更新
              </span>
            ) : null}
          </div>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-slate-600">
            {JSON.stringify(diagnoseJson, null, 2)}
          </pre>
        </div>
      ) : null}

      {cleanResult ? (
        <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-xs text-emerald-800">
          <div className="text-sm font-semibold text-emerald-900">清理完成</div>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed">
            {JSON.stringify(cleanResult, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

