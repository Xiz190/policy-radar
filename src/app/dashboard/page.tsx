"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SectionCard } from "@/components/section-card";
import { categoryMeta, TOPIC_CATEGORIES, filterTopicCategories } from "@/lib/monitor/content-meta";
import { formatDateShortNoPad } from "@/lib/date-utils";
import {
  fetchSubscriptions,
  groupSubscriptions,
  type SubscriptionRecord,
} from "@/lib/subscription-utils";

type DashboardData = {
  periodDays: number;
  counts: { total: number; unread: number; starred: number; urgent: number; highlight: number };
  departmentStats: { departmentName: string; total: number; todayCount: number; series: { date: string; count: number }[] }[];
  importanceDistribution: { level: string; label: string; count: number; color: string }[];
  signalTrend: { dates: string[]; series: { key: string; label: string; color: string; values: number[] }[] };
  topKeywords: { keyword: string; category: string; count: number }[];
  topHighlights?: { title: string; url: string; sourceId: string; lens: string; source: string; date: string; score: number; level: string }[];
  hotTopics?: { keyword: string; important: number; normal: number; total: number }[];
  heatmapDaily?: { date: string; count: number }[];
};

function computeWeekOverWeek(series: { date: string; count: number }[]) {
  const n = series.length;
  const last7 = series.slice(-7).reduce((s, d) => s + d.count, 0);
  const prev7 = series.slice(Math.max(0, n - 14), n - 7).reduce((s, d) => s + d.count, 0);
  const change = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : 0;
  return { last7, prev7, change };
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-xs text-slate-400">
      {text}
    </div>
  );
}

function HeatmapCalendar({ data }: { data: { date: string; count: number }[] }) {
  // 每日入库总量（来自独立的 170 天 heatmapDaily，覆盖 15 周网格）
  const byDate: Record<string, number> = {};
  for (const d of data) byDate[d.date] = (byDate[d.date] ?? 0) + d.count;

  // Build a 15-week grid ending today
  const WEEKS = 15;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // align to Sunday
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - today.getDay() - (WEEKS - 1) * 7);

  const cells: { date: string; count: number; label: string }[] = [];
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const cell = new Date(startDay);
      cell.setDate(startDay.getDate() + w * 7 + d);
      const key = cell.toISOString().slice(0, 10);
      const count = byDate[key] ?? 0;
      if (d === 0 && cell.getMonth() !== lastMonth) {
        monthLabels.push({ label: `${cell.getMonth() + 1}月`, col: w });
        lastMonth = cell.getMonth();
      }
      cells.push({ date: key, count, label: `${key} · ${count} 条` });
    }
  }

  const maxCount = Math.max(1, ...cells.map((c) => c.count));
  function cellColor(count: number) {
    if (count === 0) return "#f1f5f9"; // slate-100
    const intensity = count / maxCount;
    if (intensity < 0.25) return "#bbf7d0"; // emerald-200
    if (intensity < 0.5) return "#4ade80"; // emerald-400
    if (intensity < 0.75) return "#16a34a"; // emerald-600
    return "#14532d"; // emerald-900
  }

  const GAP = 3;
  const CELL = 16;
  const W = WEEKS * (CELL + GAP);
  const H = 7 * (CELL + GAP) + 18;

  if (cells.length === 0) return <EmptyHint text="暂无历史数据" />;

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        {monthLabels.map((m) => (
          <text key={m.label + m.col} x={m.col * (CELL + GAP)} y={10} className="fill-slate-400" style={{ fontSize: 9 }}>
            {m.label}
          </text>
        ))}
        {cells.map((c, i) => {
          const col = Math.floor(i / 7);
          const row = i % 7;
          return (
            <rect
              key={c.date}
              x={col * (CELL + GAP)}
              y={14 + row * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={2}
              fill={cellColor(c.count)}
            >
              <title>{c.label}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
        <span>少</span>
        {["#f1f5f9", "#bbf7d0", "#4ade80", "#16a34a", "#14532d"].map((c) => (
          <span key={c} className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: c }} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

function DepartmentBarChart({
  data,
}: {
  data: { departmentName: string; total: number; todayCount: number; series: { date: string; count: number }[] }[];
}) {
  if (data.length === 0) {
    return <EmptyHint text="近 7 天暂无机构更新数据" />;
  }
  const top = data.slice(0, 12);
  const max = Math.max(1, ...top.map((d) => d.total));
  const todayMax = Math.max(1, ...top.map((d) => d.todayCount));

  return (
    <div className="space-y-2">
      {top.map((d) => {
        const widthPct = (d.total / max) * 100;
        const todayPct = (d.todayCount / todayMax) * 100;
        return (
          <div key={d.departmentName} className="group">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate font-medium text-slate-700" title={d.departmentName}>
                {d.departmentName}
              </span>
              <span className="shrink-0 text-slate-500">
                近 7 日 {d.total} <span className="text-slate-300">·</span> 今日 {d.todayCount}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                {/* 总量：淡暖赭石底（大面积不压页） */}
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${widthPct}%`, background: "color-mix(in srgb, var(--brand) 22%, white)" }}
                />
                {/* 今日：深赭石只留这一小段作强调 */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(todayPct, 100)}%`, background: "var(--brand)" }}
                />
              </div>
              {(() => {
                const pts = d.series.slice(-7);
                if (pts.length < 2) return null;
                const maxV = Math.max(1, ...pts.map((s) => s.count));
                const W = 40, H = 14;
                const coords = pts.map((s, i) => {
                  const x = ((i / (pts.length - 1)) * W).toFixed(1);
                  const y = (H - (s.count / maxV) * H).toFixed(1);
                  return `${x},${y}`;
                }).join(" ");
                const last = pts[pts.length - 1].count;
                const prev = pts[pts.length - 2].count;
                const color = last > prev ? "#f59e0b" : last < prev ? "#64748b" : "#94a3b8";
                return (
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 opacity-70">
                    <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                );
              })()}
            </div>
          </div>
        );
      })}
      <div className="pt-1 text-[11px] text-slate-400">
        <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: "color-mix(in srgb, var(--brand) 22%, white)" }} /> 近 7 日
        <span className="ml-3 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "var(--brand)" }} /> 今日更新
      </div>
    </div>
  );
}

function InsightLabel({ text, tone = "info" }: { text: string; tone?: "success" | "warning" | "danger" | "info" }) {
  const styles: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    info: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}>
      {text}
    </span>
  );
}

// 「近期最重点」头条：直接呈现最重点的真实条目（标题 + 创作者视角一句话），
// 是"可视化实质"而非"计数"——用户扫一眼就知道近期什么最值得看。
// 站内详情页链接（能看到创作者视角 + 相关动态 = 展示产品价值，把人留在站内）
function detailHref(it: { sourceId: string; url: string }) {
  return `/items/${it.sourceId}?sourceId=${it.sourceId}&url=${encodeURIComponent(it.url)}`;
}

function SourceLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 text-[11px] text-slate-400 transition hover:text-[var(--brand)]"
      title="查看原文（站外）"
    >
      原文 ↗
    </a>
  );
}

function TopHighlights({ items }: { items: NonNullable<DashboardData["topHighlights"]> }) {
  if (items.length === 0) return null;
  const lead = items[0];
  const rest = items.slice(1);
  const hasLens = items.some((i) => i.lens);
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3.5 w-1 rounded-sm bg-[var(--brand)]" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-900">近期最重点</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{items.length} 条 · {hasLens ? "已解读" : "按信号评分"}</span>
        <span className="ml-auto text-[11px] text-slate-400">{hasLens ? "点标题看完整解读 · 原文 ↗ 跳来源" : "点标题看原文详情 · 原文 ↗ 跳来源"}</span>
      </div>

      {/* 头条大卡：主体点进站内详情页（完整解读），右上「原文↗」跳站外 */}
      <div className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/[0.04] p-5 transition hover:border-[var(--brand)]/45">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {lead.level && <InsightLabel text={lead.level} tone="warning" />}
          <span>{lead.source}</span>
          <span className="text-slate-300">·</span>
          <span>{lead.date}</span>
          <span className="ml-auto"><SourceLink url={lead.url} /></span>
        </div>
        <Link href={detailHref(lead)} className="group mt-1.5 block">
          <h3 className="font-serif text-base font-semibold leading-snug text-slate-900 group-hover:underline">{lead.title}</h3>
          {lead.lens ? (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{lead.lens}</p>
          ) : (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-slate-100/70 px-2 py-1 text-[11px] text-slate-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden />
              一句话摘要开发中 · 点标题查看原文详情
            </span>
          )}
          <span className="mt-2 inline-flex items-center text-xs font-medium text-[var(--brand)] group-hover:underline">{lead.lens ? "查看完整解读" : "查看原文详情"} →</span>
        </Link>
      </div>

      {/* 其余条目：紧凑列表，标题→详情页，行尾「原文↗」→站外 */}
      {rest.length > 0 && (
        <div className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {rest.map((it) => (
            <div key={it.url} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
              <Link href={detailHref(it)} className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium text-slate-800 hover:underline">{it.title}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-slate-400">{it.source} · {it.date}</span>
                </div>
                {it.lens && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{it.lens}</p>}
              </Link>
              <SourceLink url={it.url} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 「热点话题」：具名的工具/品牌话题（可点→筛选收件箱），每行一条 重点↔普通 堆叠条，
// 直接可视化"这个话题在重点内容和普通内容里各占多少 = 有没有衔接"。
function HotTopics({ items }: { items: NonNullable<DashboardData["hotTopics"]> }) {
  if (items.length === 0) return null;
  const max = Math.max(1, ...items.map((t) => t.total));
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3.5 w-1 rounded-sm bg-[var(--brand)]" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-900">热点话题</h2>
        <span className="text-[11px] text-slate-400">· 点击进入相关动态</span>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--brand)" }} />重点</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-200" />普通</span>
        </span>
      </div>
      <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-5">
        {items.map((t) => {
          const impPct = (t.important / max) * 100;
          const norPct = (t.normal / max) * 100;
          const bridged = t.important > 0 && t.normal > 0;
          return (
            <Link key={t.keyword} href={`/inbox?q=${encodeURIComponent(t.keyword)}`} className="group flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-700 group-hover:text-slate-900" title={t.keyword}>
                {t.keyword}
              </span>
              <div className="flex h-4 flex-1 overflow-hidden rounded-md bg-slate-50">
                <div className="h-full transition-all" style={{ width: `${impPct}%`, background: "var(--brand)" }} />
                <div className="h-full bg-slate-200 transition-all" style={{ width: `${norPct}%` }} />
              </div>
              <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                {t.important > 0 && <span className="font-semibold text-[var(--brand)]">{t.important} 重点</span>}
                {bridged && <span className="text-slate-300"> · </span>}
                <span>{t.normal} 普通</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forceCollapsed, setForceCollapsed] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [days, setDays] = useState(14);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    setLoading(true);
    setError(null);
    async function fetchData() {
      try {
        const res = await fetch(`/api/monitor/dashboard?days=${days}&topN=20`, { cache: "no-store", signal: abortController.signal });
        if (abortController.signal.aborted) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DashboardData;
        if (abortController.signal.aborted) return;
        setData(json);
        setLastRefreshedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      } catch (e) {
        const err = e as Error;
        if (err.name === "AbortError" || err.message.includes("ERR_ABORTED")) {
          return;
        }
        setError(err.message ?? "加载失败");
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      abortController.abort();
    };
  }, [days, refreshKey]);

  useEffect(() => {
    const abortController = new AbortController();
    async function fetchSubs() {
      const subs = await fetchSubscriptions(abortController.signal);
      if (!abortController.signal.aborted) {
        setSubscriptions(subs);
        setHasSubscription(subs.some((s) => s.enabled));
      }
    }
    fetchSubs();
    return () => {
      abortController.abort();
    };
  }, []);

  const departmentInsight = useMemo(() => {
    if (!data || data.departmentStats.length === 0) return null;
    const withGrowth = data.departmentStats
      .filter((d) => Array.isArray(d.series) && d.series.length >= 10)
      .map((d) => ({ ...d, growth: computeWeekOverWeek(d.series || []) }));
    const fastest = [...withGrowth].sort((a, b) => b.growth.change - a.growth.change)[0];
    if (fastest && fastest.growth.change > 10) {
      return {
        text: `增速最快：${fastest.departmentName} 环比 ${fastest.growth.change > 0 ? "+" : ""}${Math.round(fastest.growth.change)}%`,
        tone: "warning" as const,
      };
    }
    const top = data.departmentStats[0];
    return { text: `最活跃：${top.departmentName}（近 7 日 ${top.total} 条）`, tone: "info" as const };
  }, [data]);


  const personalizedTrends = useMemo(() => {
    if (!data || !hasSubscription) return null;

    const { departments, keywords, categories } = groupSubscriptions(subscriptions);
    const result: {
      followedDepartmentStats: typeof data.departmentStats;
      followedKeywordStats: typeof data.topKeywords;
      followedCategoryStats: { category: string; label: string; count: number; color: string }[];
    } = {
      followedDepartmentStats: [],
      followedKeywordStats: [],
      followedCategoryStats: [],
    };

    if (departments.length > 0 && data.departmentStats.length > 0) {
      const deptNames = new Set(departments.map((d) => d.target));
      result.followedDepartmentStats = data.departmentStats.filter((d) =>
        deptNames.has(d.departmentName) || Array.from(deptNames).some((name) => d.departmentName.includes(name))
      );
    }

    if (keywords.length > 0 && data.topKeywords.length > 0) {
      const kwNames = new Set(keywords.map((k) => k.target.toLowerCase()));
      result.followedKeywordStats = data.topKeywords.filter((k) =>
        kwNames.has(k.keyword.toLowerCase())
      );
    }

    if (categories.length > 0 && data.topKeywords.length > 0) {
      const catSet = new Set(categories.map((c) => c.target));
      const catCounts = new Map<string, number>();
      for (const kw of data.topKeywords) {
        if (catSet.has(kw.category)) {
          catCounts.set(kw.category, (catCounts.get(kw.category) || 0) + kw.count);
        }
      }
      result.followedCategoryStats = Array.from(catCounts.entries()).map(([category, count]) => ({
        category,
        label: categoryMeta(category)?.label || category,
        count,
        color: categoryMeta(category)?.color || "#64748b",
      })).sort((a, b) => b.count - a.count);
    }

    return result;
  }, [data, subscriptions, hasSubscription]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">数据洞察</h1>
            <p className="mt-2 text-sm text-slate-600">
              近 {data?.periodDays ?? days} 天动态趋势分析、关键变化与值得关注的发现
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {lastRefreshedAt && (
                <span className="text-[11px] text-slate-400">上次 {lastRefreshedAt}</span>
              )}
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
                title="刷新数据"
              >
                <span className={loading ? "animate-spin inline-block" : ""}>⟳</span>
              </button>
              {data && (
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob(
                      [JSON.stringify({ exportedAt: new Date().toISOString(), days, ...data }, null, 2)],
                      { type: "application/json" }
                    );
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `dashboard-${new Date().toISOString().split("T")[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  title="导出数据快照 JSON"
                >
                  ↓
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setForceCollapsed((v) => (v === true ? undefined : true))}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              title={forceCollapsed === true ? "各区块已折叠" : "全部折叠"}
            >
              {forceCollapsed === true ? "↓ 全部展开" : "↑ 全部折叠"}
            </button>
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    days === d
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {d} 天
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div>
              <div className="mb-3 h-5 w-32 bg-slate-100 rounded animate-pulse" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                    <div className="mt-1.5 h-7 w-12 bg-slate-100 rounded animate-pulse" />
                    <div className="mt-0.5 h-3 w-20 bg-slate-50 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 h-5 w-40 bg-slate-100 rounded animate-pulse" />
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
                    <div className="mt-1.5 h-8 w-14 bg-slate-100 rounded animate-pulse" />
                    <div className="mt-0.5 h-3 w-24 bg-slate-50 rounded animate-pulse" />
                    <div className="mt-3 h-16 bg-slate-50 rounded-xl animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-5 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="mt-4 space-y-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                      <div className="flex-1 h-3 bg-slate-50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-100 rounded-full animate-pulse"
                          style={{ width: `${30 + i * 12}%` }}
                        />
                      </div>
                      <div className="h-3 w-8 bg-slate-50 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
                <div className="mt-4 h-48 bg-slate-50 rounded-xl animate-pulse" />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            数据加载失败：{error}
          </div>
        ) : data ? (
          <>
            {data.topHighlights && <TopHighlights items={data.topHighlights} />}

            {data.hotTopics && <HotTopics items={data.hotTopics} />}

            {/* 活动带：记账指标（收录量/未读/星标/本周新增/热力图）统一并入这一张卡 */}
            <SectionCard
              title="入库活动"
              collapsible storageKey="ingest-activity"
              forceCollapsed={forceCollapsed}
              rightSlot={<span className="text-[11px] text-slate-400">近 15 周</span>}
              bodyClassName="p-5"
              className="mt-6"
            >
              {(() => {
                const dateMap = new Map<string, number>();
                for (const dept of data.departmentStats) {
                  for (const s of dept.series ?? []) dateMap.set(s.date, (dateMap.get(s.date) ?? 0) + s.count);
                }
                const values = Array.from(dateMap.entries())
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([, v]) => v);
                const thisWeek = values.slice(-7).reduce((s, v) => s + v, 0);
                const lastWeek = values.slice(-14, -7).reduce((s, v) => s + v, 0);
                const pct = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;
                const up = thisWeek - lastWeek >= 0;
                const topSource = data.departmentStats[0];
                const highPct = data.counts.total > 0 ? ((data.counts.urgent + data.counts.highlight) / data.counts.total) * 100 : 0;
                return (
                  <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
                    {/* 左：热力图（上）+ 统计数字（下，3 列） */}
                    <div className="shrink-0">
                      <div className="overflow-x-auto">
                        <HeatmapCalendar data={data.heatmapDaily ?? []} />
                      </div>
                      <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-4">
                        <div>
                          <div className="text-[11px] text-slate-400">收录总量</div>
                          <div className="mt-0.5 font-serif text-lg font-bold tabular-nums text-slate-900">{data.counts.total}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">未读 / 已标星</div>
                          <div className="mt-0.5 font-semibold tabular-nums text-slate-600">{data.counts.unread} / {data.counts.starred}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">本周新增</div>
                          <div className="mt-0.5 flex items-baseline gap-2">
                            <span className="font-semibold tabular-nums text-slate-900">{thisWeek}</span>
                            {lastWeek > 0 && (
                              <span className={`text-[11px] font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>{up ? "↑" : "↓"}{Math.abs(pct)}%</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-400">日均本周</div>
                          <div className="mt-0.5 font-semibold tabular-nums text-slate-700">{(thisWeek / 7).toFixed(1)}</div>
                        </div>
                        {topSource && (
                          <div className="min-w-0">
                            <div className="text-[11px] text-slate-400">内容最多</div>
                            <div className="mt-0.5 truncate font-semibold text-slate-800" title={topSource.departmentName}>
                              {topSource.departmentName} <span className="font-normal text-slate-400">{topSource.total}</span>
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-[11px] text-slate-400">高优先级占比</div>
                          <div className="mt-0.5 font-semibold tabular-nums text-[var(--brand)]">{highPct.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                    {/* 右：各机构更新量（填满剩余宽度，原独立卡并入此处） */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">各机构更新量</span>
                        {departmentInsight && <InsightLabel text={departmentInsight.text} tone={departmentInsight.tone} />}
                        <span className="ml-auto text-[11px] text-slate-400">Top 12</span>
                      </div>
                      <DepartmentBarChart data={data.departmentStats} />
                    </div>
                  </div>
                );
              })()}
            </SectionCard>

            <SectionCard
              title="与我相关的趋势"
              collapsible storageKey="personalized-trends"
              forceCollapsed={forceCollapsed}
              rightSlot={
                <a
                  href="/subscribe"
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 transition hover:text-slate-700"
                >
                  {hasSubscription ? "管理关注" : "去设置"} →
                </a>
              }
              bodyClassName="p-5"
            >
              {!hasSubscription ? (
                <EmptyHint text="还没有设置关注，添加你关注的机构和关键词后，这里将展示个性化趋势" />
              ) : !personalizedTrends || (
                personalizedTrends.followedDepartmentStats.length === 0 &&
                personalizedTrends.followedKeywordStats.length === 0 &&
                personalizedTrends.followedCategoryStats.length === 0
              ) ? (
                <EmptyHint text="暂无与你关注项匹配的数据，建议调整关注范围" />
              ) : (
                <div className="space-y-6">
                  {/* 命中概览 + 查看相关动态（原「我的关注今日命中」卡并入此处） */}
                  {(() => {
                    const todayHits = personalizedTrends.followedDepartmentStats.reduce((s, d) => s + (d.todayCount ?? 0), 0);
                    const weekHits = personalizedTrends.followedDepartmentStats.reduce((s, d) => s + (d.total ?? 0), 0);
                    const kwHits = personalizedTrends.followedKeywordStats.length;
                    return (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm">
                        <span className="text-slate-700">今日命中 <strong className="text-[var(--brand)]">{todayHits}</strong> 条</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-700">近 7 日 <strong className="text-slate-800">{weekHits}</strong> 条</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-700">关键词命中 <strong className="text-slate-800">{kwHits}</strong> 个</span>
                        <a href="/inbox?view=followup" className="ml-auto text-xs font-medium text-[var(--brand)] hover:underline">查看相关动态 →</a>
                      </div>
                    );
                  })()}
                  {personalizedTrends.followedDepartmentStats.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-sm"></span>
                        <span className="text-xs font-semibold text-slate-900">我关注的机构更新</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          {personalizedTrends.followedDepartmentStats.length} 个
                        </span>
                      </div>
                      <div className="space-y-2">
                        {personalizedTrends.followedDepartmentStats.slice(0, 5).map((d) => {
                          const widthPct = d.total > 0 ? Math.min(100, (d.total / 50) * 100) : 0;
                          return (
                            <div key={d.departmentName} className="group">
                              <div className="flex items-center justify-between text-xs">
                                <span className="truncate font-medium text-slate-700" title={d.departmentName}>
                                  {d.departmentName}
                                </span>
                                <span className="shrink-0 text-slate-500">
                                  近 7 日 {d.total} <span className="text-slate-300">·</span> 今日 {d.todayCount}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${widthPct}%`, background: "color-mix(in srgb, var(--brand) 22%, white)" }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {personalizedTrends.followedKeywordStats.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-sm"></span>
                        <span className="text-xs font-semibold text-slate-900">我关注的关键词命中</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          {personalizedTrends.followedKeywordStats.length} 个
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {personalizedTrends.followedKeywordStats.slice(0, 10).map((k) => {
                          const meta = categoryMeta(k.category);
                          return (
                            <span
                              key={`${k.keyword}::${k.category}`}
                              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs transition hover:scale-105"
                              style={{
                                color: meta.color,
                                background: `${meta.color}14`,
                              }}
                              title={`${k.keyword} · ${meta.label} · ${k.count} 次`}
                            >
                              {k.keyword}
                              <span className="ml-1 text-[10px] text-slate-400">{k.count}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {personalizedTrends.followedCategoryStats.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-sm"></span>
                        <span className="text-xs font-semibold text-slate-900">我关注的分类热度</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          {personalizedTrends.followedCategoryStats.length} 个
                        </span>
                      </div>
                      <div className="space-y-2">
                        {personalizedTrends.followedCategoryStats.slice(0, 5).map((c) => {
                          const maxCount = Math.max(1, ...personalizedTrends.followedCategoryStats.map((x) => x.count));
                          const widthPct = (c.count / maxCount) * 100;
                          return (
                            <div key={c.category} className="flex items-center gap-3">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ background: c.color }}
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-700">{c.label}</span>
                                  <span className="text-slate-500">{c.count} 次</span>
                                </div>
                                <div className="mt-0.5 h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${widthPct}%`, background: c.color }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
    </main>
  );
}
