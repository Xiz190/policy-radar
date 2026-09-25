"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { categoryMeta } from "@/lib/monitor/content-meta";
import { formatDateShortNoPad } from "@/lib/date-utils";
import {
  ChartColumn, Flame, Key, Landmark, TrendingUp,
} from "lucide-react";

type DashboardData = {
  periodDays: number;
  counts: { total: number; unread: number; starred: number; urgent: number; highlight: number };
  departmentStats: { departmentName: string; total: number; todayCount: number; series: { date: string; count: number }[] }[];
  importanceDistribution: { level: string; label: string; count: number; color: string }[];
  signalTrend: { dates: string[]; series: { key: string; label: string; color: string; values: number[] }[] };
  topKeywords: { keyword: string; category: string; count: number }[];
};

// -------- 条形图：今日各部委更新量 --------
function DepartmentBarChart({
  data,
}: {
  data: { departmentName: string; total: number; todayCount: number; series: { date: string; count: number }[] }[];
}) {
  if (data.length === 0) {
    return <EmptyHint text="近 7 天暂无部委更新数据" />;
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
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all"
                  style={{ width: `${widthPct}%` }}
                />
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-amber-400/80 transition-all"
                  style={{ width: `${Math.min(todayPct, 100)}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="pt-1 text-[11px] text-slate-400">
        <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 align-middle" /> 近 7 日
        <span className="ml-3 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" /> 今日更新
      </div>
    </div>
  );
}

// -------- 饼图：重要性分布 --------
function ImportancePieChart({
  data,
}: {
  data: { level: string; label: string; count: number; color: string }[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const inner = 42;

  if (total === 0) return <EmptyHint text="暂无重要性分布数据" />;

  const arcs: Array<(typeof data)[number] & { start: number; end: number }> = [];
  let acc = 0;
  for (const d of data) {
    if (d.count <= 0) continue;
    const start = acc / total;
    acc += d.count;
    const end = acc / total;
    arcs.push({ ...d, start, end });
  }

  function arcPath(startFrac: number, endFrac: number) {
    const a0 = startFrac * Math.PI * 2 - Math.PI / 2;
    const a1 = endFrac * Math.PI * 2 - Math.PI / 2;
    const large = endFrac - startFrac > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const xi1 = cx + inner * Math.cos(a1);
    const yi1 = cy + inner * Math.sin(a1);
    const xi0 = cx + inner * Math.cos(a0);
    const yi0 = cy + inner * Math.sin(a0);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi0} ${yi0} Z`;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a) => (
          <path key={a.level} d={arcPath(a.start, a.end)} fill={a.color} stroke="#ffffff" strokeWidth={2} />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-700" style={{ fontSize: 22, fontWeight: 600 }}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11 }}>
          近 {data.length > 0 ? "" : ""}总数
        </text>
      </svg>
      <div className="space-y-2 text-xs sm:min-w-[160px]">
        {data.map((d) => {
          const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={d.level} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="font-medium text-slate-700">{d.label}</span>
              </span>
              <span className="text-slate-500">
                {d.count} <span className="text-slate-300">·</span> {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------- 折线图：信号趋势 --------
function SignalLineChart({
  data,
}: {
  data: { dates: string[]; series: { key: string; label: string; color: string; values: number[] }[] };
}) {
  if (!data.dates.length || data.series.every((s) => s.values.every((v) => v === 0))) {
    return <EmptyHint text="近 14 天暂无信号趋势数据" />;
  }

  const width = 560;
  const height = 220;
  const paddingLeft = 36;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 30;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const maxVal = Math.max(1, ...data.series.flatMap((s) => s.values));
  const stepX = data.dates.length > 1 ? chartW / (data.dates.length - 1) : chartW;

  function pointXY(idx: number, value: number) {
    const x = paddingLeft + idx * stepX;
    const y = paddingTop + chartH - (value / maxVal) * chartH;
    return { x, y };
  }

  function buildPath(values: number[]) {
    if (values.length === 0) return "";
    return values
      .map((v, i) => {
        const { x, y } = pointXY(i, v);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  // Y 轴刻度（0, 1/4, 1/2, 3/4, max）
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxVal * f));

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="min-w-[520px]">
        {yTicks.map((t, i) => {
          const y = paddingTop + chartH - (t / maxVal) * chartH;
          return (
            <g key={i}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={paddingLeft - 6} y={y + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: 10 }}>
                {t}
              </text>
            </g>
          );
        })}
        {data.dates.map((d, i) => {
          if (i % 2 !== 0 && i !== data.dates.length - 1) return null;
          const x = paddingLeft + i * stepX;
          return (
            <text key={i} x={x} y={height - 12} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
              {formatDateShortNoPad(d)}
            </text>
          );
        })}
        {data.series.map((s) => {
          const path = buildPath(s.values);
          const areaPath =
            s.values.length > 0
              ? `${path} L ${paddingLeft + (s.values.length - 1) * stepX} ${paddingTop + chartH} L ${paddingLeft} ${paddingTop + chartH} Z`
              : "";
          return (
            <g key={s.key}>
              <path d={areaPath} fill={s.color} fillOpacity={0.08} />
              <path d={path} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => {
                const { x, y } = pointXY(i, v);
                return <circle key={i} cx={x} cy={y} r={2.6} fill="#ffffff" stroke={s.color} strokeWidth={1.5} />;
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs">
        {data.series.map((s) => {
          const total = s.values.reduce((a, b) => a + b, 0);
          return (
            <span key={s.key} className="flex items-center gap-1.5 text-slate-600">
              <span className="inline-block h-1.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.label} ({total})
            </span>
          );
        })}
      </div>
    </div>
  );
}

// -------- 词云：Top 关键词 --------
function KeywordCloud({
  keywords,
}: {
  keywords: { keyword: string; category: string; count: number }[];
}) {
  if (keywords.length === 0) {
    return <EmptyHint text="近 14 天暂无高频关键词" />;
  }
  const top = keywords.slice(0, 15);
  const max = Math.max(1, ...top.map((k) => k.count));
  const min = Math.min(...top.map((k) => k.count));
  return (
    <div className="flex flex-wrap items-end gap-2 leading-tight">
      {top.map((k) => {
        const meta = categoryMeta(k.category);
        const ratio = max === min ? 0.6 : (k.count - min) / (max - min);
        const size = 13 + ratio * 18; // 13px ~ 31px
        const opacity = 0.55 + ratio * 0.45;
        return (
          <span
            key={`${k.keyword}::${k.category}`}
            className="inline-block rounded-full px-2.5 py-1 align-middle transition hover:scale-105"
            style={{
              fontSize: size,
              color: meta.color,
              background: `${meta.color}14`,
              opacity,
              fontWeight: 500 + Math.round(ratio * 300),
            }}
            title={`${k.keyword} · ${meta.label} · ${k.count} 次`}
          >
            {k.keyword}
            <span className="ml-1 text-[10px] text-slate-400" style={{ fontSize: 10 }}>
              {k.count}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-xs text-slate-400">
      {text}
    </div>
  );
}

// ===== 顶层 Dashboard 组件 =====
export function DashboardPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`/api/monitor/dashboard?days=14&topN=20`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DashboardData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message ?? "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const topCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "近 14 天新增", value: data.counts.total, cls: "bg-slate-900 text-white", sub: `未读 ${data.counts.unread}` },
      { label: "核心关注", value: data.counts.urgent, cls: "border border-red-200 bg-red-50 text-red-800", sub: `重点 ${data.counts.highlight}` },
      { label: "⚠ 重点内容", value: data.counts.highlight, cls: "border border-orange-200 bg-orange-50 text-orange-800", sub: `标星 ${data.counts.starred}` },
      { label: "已标星", value: data.counts.starred, cls: "border border-amber-200 bg-amber-50 text-amber-800", sub: `动态资讯` },
    ];
  }, [data]);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900"><ChartColumn className="mr-1 inline h-3.5 w-3.5" aria-hidden />总览面板</h2>
          <p className="mt-1 text-xs text-slate-500">
            近 {data?.periodDays ?? 14} 天各部委更新、重要性分布、信号趋势与高频关键词。
          </p>
        </div>
        <Link
          href="/inbox"
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100"
        >
          进入动态资讯 →
        </Link>
      </header>

      {loading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          总览面板加载失败：{error}
        </div>
      ) : data ? (
        <>
          {/* 顶部计数卡 */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topCards.map((c) => (
              <div key={c.label} className={`rounded-2xl px-4 py-4 ${c.cls}`}>
                <div className="text-[11px] opacity-80">{c.label}</div>
                <div className="mt-1 text-2xl font-semibold">{c.value}</div>
                <div className="mt-1 text-[11px] opacity-70">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* 四宫格图表 */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* ① 今日各部委更新量柱状 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900"><Landmark className="mr-1 inline h-3.5 w-3.5" aria-hidden />各部委更新量（近 7 日 / 今日）</h3>
                <span className="text-[11px] text-slate-400">Top 12</span>
              </div>
              <DepartmentBarChart data={data.departmentStats} />
            </div>

            {/* ② 重要性分布饼图 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900"><Flame className="mr-1 inline h-3.5 w-3.5" aria-hidden />重要性分布</h3>
                <span className="text-[11px] text-slate-400">近 {data.periodDays} 天</span>
              </div>
              <ImportancePieChart data={data.importanceDistribution} />
            </div>

            {/* ③ 信号趋势折线 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900"><TrendingUp className="mr-1 inline h-3.5 w-3.5" aria-hidden />信号趋势（风险 / 机会 / 前置）</h3>
                <span className="text-[11px] text-slate-400">近 {data.periodDays} 天</span>
              </div>
              <SignalLineChart data={data.signalTrend} />
            </div>

            {/* ④ 关键词 Top 词云 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900"><Key className="mr-1 inline h-3.5 w-3.5" aria-hidden />关键词 Top 15 词云</h3>
                <span className="text-[11px] text-slate-400">近 {data.periodDays} 天</span>
              </div>
              <div className="min-h-[120px]">
                <KeywordCloud keywords={data.topKeywords} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
