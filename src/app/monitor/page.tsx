import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MonitorRunner } from "@/components/monitor-runner";
import { BulkActions } from "@/components/bulk-actions";
import { RunHistoryPanel } from "@/components/run-history-panel";
import { getMonitorSources, getSourceItemStats, ensureMonitorSchema, getLatestRun, getInboxSourceCounts } from "@/lib/monitor/db-wrapper";
import {
  ChartColumn, Clock, Footprints, Landmark, Languages, Package, RadioTower, Settings, Stethoscope, Trophy, Wrench, Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  await ensureMonitorSchema();
  const [rawSources, latestRun, itemCounts, sourceStats] = await Promise.all([
    getMonitorSources(),
    getLatestRun(),
    getInboxSourceCounts(),
    getSourceItemStats(),
  ]);

  // getMonitorStatus() 内部就是 getLatestRun()——同一次查询没必要跑两遍。
  // 统一走 wrapper 版本：它带 DB 降级路径，裸调 db 层的版本会直接抛异常。
  const status = latestRun;

  // 健康概览要用 itemStats（最近入库时间）判断活跃度，
  // getMonitorSources 不带这个字段，必须在这里并进来——否则每个来源都会被判成"无数据"。
  const sources = rawSources.map((s) => ({
    ...s,
    itemStats: sourceStats[s.id] ?? { totalCount: 0, lastSeenAt: null },
  }));

  const grouped: Array<{ departmentName: string; sources: typeof sources }> = [];
  {
    const map = new Map<string, typeof sources>();
    for (const s of sources) {
      const key = s.departmentName || "未分类来源";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    for (const key of Array.from(map.keys()).sort()) {
      grouped.push({ departmentName: key, sources: map.get(key)! });
    }
  }

  const totalSources = sources.length;
  const autoSources = sources.filter((s) => s.enabled && s.autoMonitor).length;
  const keySources = sources.filter((s) => s.isKey).length;
  const totalItems = itemCounts.reduce((s, c) => s + c.count, 0);
  const totalDepartments = grouped.length;

  const runSummary =
    latestRun && latestRun.status === "success"
      ? `最近一次监测成功，${
          latestRun.finishedAt
            ? (() => {
                const parts = new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Shanghai",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).formatToParts(new Date(String(latestRun.finishedAt)));
                const y = parts.find((p) => p.type === "year")?.value ?? "0000";
                const m = parts.find((p) => p.type === "month")?.value ?? "00";
                const d = parts.find((p) => p.type === "day")?.value ?? "00";
                const h = parts.find((p) => p.type === "hour")?.value ?? "00";
                const min = parts.find((p) => p.type === "minute")?.value ?? "00";
                return `${y}-${m}-${d} ${h}:${min}`;
              })()
            : ""
        }`
      : latestRun && latestRun.status === "error"
        ? `最近一次监测失败：${latestRun.errorMessage ?? ""}`
        : "暂未运行过监测任务，可在下方手动启动。";

  const isRunning = status?.status === "running";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-10">
        {/* 顶部标题 + 状态总览 */}
        <section className="rounded-[28px] bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-8 text-white shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm">系统设置</span>
              <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">监测与数据管理</h1>
              <p className="text-base leading-7 text-slate-300">
                配置监测来源、管理关键词库、运行监测任务、诊断数据质量。仅管理员使用，普通用户请前往动态资讯浏览。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <div className="text-xs text-slate-300">纳管来源</div>
                <div className="mt-1 text-xl font-semibold">{totalSources}</div>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <div className="text-xs text-slate-300">来源数量</div>
                <div className="mt-1 text-xl font-semibold">{totalDepartments}</div>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <div className="text-xs text-slate-300">自动监测</div>
                <div className="mt-1 text-xl font-semibold">{autoSources}</div>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <div className="text-xs text-slate-300">累计入库</div>
                <div className="mt-1 text-xl font-semibold">{totalItems}</div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-200">
            <span className={`inline-block h-2 w-2 rounded-full ${isRunning ? "animate-pulse bg-emerald-400" : latestRun?.status === "success" ? "bg-emerald-400" : latestRun?.status === "error" ? "bg-rose-400" : "bg-slate-400"}`} />
            {runSummary}
          </div>
        </section>

        {/* 功能分组 1：监测与任务 */}
        <section>
          <div className="mb-3 flex items-center gap-2 px-1">
            <Zap className="h-5 w-5" aria-hidden />
            <h2 className="text-base font-semibold text-slate-900">监测与任务</h2>
            <span className="text-xs text-slate-500">启动 / 状态 / 历史</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="#runner" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-400">
              <div className="flex items-center gap-2">
                <Footprints className="h-6 w-6" aria-hidden />
                <div className="text-sm text-slate-500">手动运行</div>
              </div>
              <div className="mt-2 text-lg font-semibold">启动监测任务</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                选择来源或栏目手动抓取最新内容。日常自动监测已在后台定时运行。
              </p>
              <div className="mt-4 inline-flex h-9 items-center text-sm font-medium text-slate-900">
                展开运行面板 →
              </div>
            </Link>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <ChartColumn className="h-6 w-6" aria-hidden />
                <div className="text-sm text-slate-500">运行状态</div>
              </div>
              <div className="mt-2 text-lg font-semibold">
                {isRunning ? "监测运行中…" : latestRun?.status === "success" ? "运行正常" : "空闲"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {isRunning
                  ? "当前正在执行监测任务，请稍候…"
                  : latestRun?.status === "success"
                    ? "上一次运行成功，数据是最新的。"
                    : "暂无运行记录。"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  isRunning ? "bg-emerald-100 text-emerald-700"
                  : latestRun?.status === "success" ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    isRunning ? "animate-pulse bg-emerald-500"
                    : latestRun?.status === "success" ? "bg-emerald-500"
                    : "bg-slate-400"
                  }`} />
                  {isRunning ? "运行中" : latestRun?.status === "success" ? "正常" : "空闲"}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  自动监测 {autoSources} 个
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 运行历史 */}
        <section>
          <div className="mb-3 flex items-center gap-2 px-1">
            <Clock className="h-5 w-5" aria-hidden />
            <h2 className="text-base font-semibold text-slate-900">最近运行记录</h2>
            <span className="text-xs text-slate-500">最近 12 次监测</span>
          </div>
          <RunHistoryPanel />
        </section>

        {/* 来源活跃度排名 */}
        {itemCounts.length > 0 && (() => {
          const now = Date.now();
          function healthDot(lastSeenAt: string | null | undefined) {
            if (!lastSeenAt) return { color: "#94a3b8", label: "无数据" };
            const diff = now - new Date(lastSeenAt).getTime();
            const h = diff / (1000 * 60 * 60);
            if (h <= 24) return { color: "#22c55e", label: "24h内更新" };
            if (h <= 72) return { color: "#f59e0b", label: "3天内更新" };
            return { color: "#ef4444", label: `${Math.floor(h / 24)} 天未更新` };
          }
          const top5 = itemCounts.slice(0, 5).map((ic) => {
            const src = sources.find((s) => s.id === ic.sourceId);
            const health = healthDot(src?.itemStats?.lastSeenAt);
            return { ...ic, name: src?.displayName ?? src?.channelName ?? ic.sourceId, dept: src?.departmentName ?? "", health };
          });
          const maxCount = Math.max(1, top5[0]?.count ?? 1);
          return (
            <section>
              <div className="mb-3 flex items-center gap-2 px-1">
                <Trophy className="h-5 w-5" aria-hidden />
                <h2 className="text-base font-semibold text-slate-900">来源活跃度排名</h2>
                <span className="text-xs text-slate-500">按累计入库条目数</span>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="space-y-3">
                  {top5.map((src, i) => (
                    <div key={src.sourceId} className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? "bg-amber-100 text-amber-700"
                        : i === 1 ? "bg-slate-100 text-slate-600"
                        : i === 2 ? "bg-orange-50 text-orange-600"
                        : "bg-slate-50 text-slate-400"
                      }`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 truncate font-medium text-slate-800" title={src.name}>
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: src.health.color }}
                              title={src.health.label}
                            />
                            {src.name}
                          </span>
                          <span className="ml-2 shrink-0 text-slate-500">{src.count} 条</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[var(--brand)] transition-all"
                            style={{ width: `${(src.count / maxCount) * 100}%` }}
                          />
                        </div>
                        {src.dept && (
                          <div className="mt-0.5 truncate text-[10px] text-slate-400">{src.dept}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })()}

        {/* 来源健康概览 */}
        {sources.length > 0 && (() => {
          const now2 = Date.now();
          // 只统计启用的来源：停用的（储备源）不是"超期/无数据"，
          // 是被主动关掉的，算进来会把概览变成噪音。
          const withHealth = sources.filter((s) => s.enabled).map((s) => {
            const diff = s.itemStats?.lastSeenAt ? (now2 - new Date(s.itemStats.lastSeenAt).getTime()) / (1000 * 60 * 60) : Infinity;
            const status2 = diff <= 24 ? "green" : diff <= 72 ? "yellow" : "red";
            return { s, status2, diff };
          });
          const green = withHealth.filter((x) => x.status2 === "green");
          const yellow = withHealth.filter((x) => x.status2 === "yellow");
          const red = withHealth.filter((x) => x.status2 === "red");
          return (
            <section>
              <div className="mb-3 flex items-center gap-2 px-1">
                <Stethoscope className="h-5 w-5" aria-hidden />
                <h2 className="text-base font-semibold text-slate-900">来源健康概览</h2>
                <span className="text-xs text-slate-500">按最近条目入库时间</span>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-700">24h 内活跃</span>
                    <span className="font-semibold text-slate-900">{green.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="text-slate-700">3 天内更新</span>
                    <span className="font-semibold text-slate-900">{yellow.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="text-slate-700">超期 / 无数据</span>
                    <span className="font-semibold text-slate-900">{red.length}</span>
                  </div>
                </div>
                {red.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-medium text-slate-500">需关注来源</div>
                    <div className="flex flex-wrap gap-1.5">
                      {red.slice(0, 12).map(({ s }) => (
                        <span key={s.id} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-700" title={s.departmentName}>
                          {s.displayName || s.channelName}
                        </span>
                      ))}
                      {red.length > 12 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">+{red.length - 12} 个</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* 功能分组 2：来源与关键词 */}
        <section>
          <div className="mb-3 flex items-center gap-2 px-1">
            <RadioTower className="h-5 w-5" aria-hidden />
            <h2 className="text-base font-semibold text-slate-900">来源与关键词</h2>
            <span className="text-xs text-slate-500">配置采集范围和识别规则</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/monitor/sources" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-400">
              <div className="flex items-center gap-2">
                <Landmark className="h-6 w-6" aria-hidden />
                <div className="text-sm text-slate-500">来源管理</div>
              </div>
              <div className="mt-2 text-lg font-semibold">来源与栏目配置</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                录入来源平台、栏目、原始网址。支持批量导入、启停控制、重点标记。
              </p>
              <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                <span>{totalSources} 个来源</span>
                <span>·</span>
                <span>{autoSources} 个自动监测</span>
                <span>·</span>
                <span>{keySources} 个重点</span>
              </div>
              <div className="mt-4 inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-sm text-white">
                去配置 →
              </div>
            </Link>

            <Link href="/keywords" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-400">
              <div className="flex items-center gap-2">
                <Languages className="h-6 w-6" aria-hidden />
                <div className="text-sm text-slate-500">关键词库维护</div>
              </div>
              <div className="mt-2 text-lg font-semibold">全局关键词库</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                配置全局和来源级关键词库，用于系统信号识别、分类匹配和优先级计算。管理员维护，用户侧不可见。
              </p>
              <div className="mt-4 inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-sm text-white">
                去维护 →
              </div>
            </Link>
          </div>
        </section>

        {/* 功能分组 3：诊断与工具 */}
        <section>
          <div className="mb-3 flex items-center gap-2 px-1">
            <Wrench className="h-5 w-5" aria-hidden />
            <h2 className="text-base font-semibold text-slate-900">诊断与工具</h2>
            <span className="text-xs text-slate-500">数据健康检查与批量操作</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/monitor/diagnose" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-400">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-6 w-6" aria-hidden />
                <div className="text-sm text-slate-500">数据诊断</div>
              </div>
              <div className="mt-2 text-lg font-semibold">诊断与清理</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                检查旧分类残留、抓取失败条目、分类分布。排查数据质量问题。
              </p>
              <div className="mt-4 inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-sm text-white">
                打开诊断 →
              </div>
            </Link>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6" aria-hidden />
                <div className="text-sm text-slate-500">批量操作</div>
              </div>
              <div className="mt-2 text-lg font-semibold">批量维护工具</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                种子数据、重新计算优先级、批量重抓、清理测试数据等。
              </p>
              <div className="mt-4 text-xs text-slate-500">
                操作入口在下方折叠区
              </div>
            </div>
          </div>
        </section>

        {/* 折叠：任务运行器 + 批量操作（高级功能，默认收起） */}
        <section id="runner" className="pt-2">
          <details className="group rounded-3xl border border-slate-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 select-none">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5" aria-hidden />
                <div>
                  <div className="font-semibold text-slate-900">高级操作区</div>
                  <div className="text-xs text-slate-500">任务运行器与批量维护工具</div>
                </div>
              </div>
              <span className="text-sm text-slate-500 transition group-open:rotate-180">▾</span>
            </summary>
            <div className="space-y-6 border-t border-slate-100 px-6 py-6">
              <BulkActions />
              <MonitorRunner
                initialStatus={status}
                groupedSources={grouped.map((g) => ({
                  departmentName: g.departmentName,
                  sources: g.sources.map((s) => ({
                    id: s.id,
                    displayName: s.displayName,
                    channelName: s.channelName ?? "栏目",
                    listUrl: s.listUrl,
                    enabled: s.enabled,
                    autoMonitor: s.autoMonitor ?? false,
                  })),
                }))}
              />
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
