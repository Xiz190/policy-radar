"use client";

import type { DailySeriesRow } from "@/lib/monitor/db";

type DailyLike = {
  date: string;
  count: number;
  urgent?: number;
  highlight?: number;
  unread?: number;
  starred?: number;
};

export function DailyLineChart({
  series,
  width = 900,
  height = 260,
}: {
  series: DailyLike[];
  width?: number;
  height?: number;
}) {
  if (!series || series.length === 0) return <EmptyHint text="暂无数据" />;

  const paddingLeft = 44;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 36;
  const innerW = width - paddingLeft - paddingRight;
  const innerH = height - paddingTop - paddingBottom;

  const maxVal = Math.max(
    1,
    ...series.map((s) => Math.max(s.count || 0, s.urgent || 0, s.highlight || 0)),
  );
  const stepX = series.length > 1 ? innerW / (series.length - 1) : innerW;

  function pathFor(key: "count" | "urgent" | "highlight") {
    return series
      .map((s, i) => {
        const x = paddingLeft + i * stepX;
        const y = paddingTop + innerH - ((s[key] || 0) / maxVal) * innerH;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  const areaPath = `${pathFor("count")} L ${paddingLeft + (series.length - 1) * stepX} ${paddingTop + innerH} L ${paddingLeft} ${paddingTop + innerH} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxVal * f));
  const showEveryLabel = Math.max(1, Math.floor(series.length / 10));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {yTicks.map((t, i) => {
        const y = paddingTop + innerH - (t / maxVal) * innerH;
        return (
          <g key={i}>
            <line x1={paddingLeft} x2={paddingLeft + innerW} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
            <text x={paddingLeft - 6} y={y + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: 10 }}>
              {t}
            </text>
          </g>
        );
      })}
      {series.map((s, i) => {
        if (i % showEveryLabel !== 0 && i !== series.length - 1) return null;
        const x = paddingLeft + i * stepX;
        return (
          <text key={i} x={x} y={paddingTop + innerH + 16} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
            {String(s.date).slice(5)}
          </text>
        );
      })}
      <path d={areaPath} fill="#6366f1" fillOpacity={0.08} />
      <path d={pathFor("count")} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <path d={pathFor("urgent")} fill="none" stroke="#ef4444" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <path d={pathFor("highlight")} fill="none" stroke="#f59e0b" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

type BarSegment = { label: string; value: number; color: string };
type BarRow = { label: string; segments: BarSegment[] };

export function StackedBarChart({ rows, width = 900 }: { rows: BarRow[]; width?: number }) {
  if (!rows || rows.length === 0) return <EmptyHint text="暂无数据" />;

  const paddingLeft = 120;
  const paddingRight = 50;
  const paddingTop = 16;
  const paddingBottom = 16;
  const barHeight = 22;
  const gap = 10;
  const innerH = rows.length * (barHeight + gap);
  const height = paddingTop + paddingBottom + innerH;
  const innerW = width - paddingLeft - paddingRight;

  const totals = rows.map((r) => r.segments.reduce((s, v) => s + v.value, 0));
  const maxVal = Math.max(1, ...totals);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {rows.map((r, rowIdx) => {
        const y = paddingTop + rowIdx * (barHeight + gap);
        const laidOut: Array<{ seg: BarSegment; x: number }> = [];
        let cumulative = 0;
        for (const seg of r.segments) {
          const x = paddingLeft + (cumulative / maxVal) * innerW;
          cumulative += seg.value;
          laidOut.push({ seg, x });
        }
        return (
          <g key={rowIdx}>
            <text x={paddingLeft - 8} y={y + barHeight / 2 + 4} textAnchor="end" className="fill-slate-600" style={{ fontSize: 11 }}>
              {String(r.label).length > 14 ? String(r.label).slice(0, 14) + "…" : r.label}
            </text>
            <line x1={paddingLeft} y1={y + barHeight} x2={paddingLeft + innerW} y2={y + barHeight} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth={1} />
            {laidOut.map(({ seg, x }, i) => {
              const barWidth = (seg.value / maxVal) * innerW;
              return (
                <rect key={i} x={x} y={y} width={Math.max(barWidth, 0.5)} height={barHeight} fill={seg.color} fillOpacity={0.9}>
                  <title>{seg.label}: {seg.value}</title>
                </rect>
              );
            })}
            <text x={paddingLeft + innerW + 4} y={y + barHeight / 2 + 4} className="fill-slate-500" style={{ fontSize: 11 }}>
              {totals[rowIdx]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type DonutSegment = { label: string; value: number; color: string };
type LaidOutSegment = DonutSegment & {
  startAngle: number;
  endAngle: number;
  large: 0 | 1;
};

export function DonutChart({
  segments,
  size = 220,
}: {
  segments: DonutSegment[];
  size?: number;
}) {
  if (!segments || segments.length === 0) return <EmptyHint text="暂无数据" />;
  const total = Math.max(1, segments.reduce((s, v) => s + v.value, 0));
  const radius = size / 2 - 20;
  const inner = radius - 24;
  const cx = size / 2;
  const cy = size / 2;

  const laidOut: LaidOutSegment[] = [];
  let cumulative = 0;
  for (const seg of segments) {
    if (seg.value === 0) continue;
    const startAngle = (cumulative / total) * 2 * Math.PI;
    cumulative += seg.value;
    const endAngle = (cumulative / total) * 2 * Math.PI;
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    laidOut.push({ ...seg, startAngle, endAngle, large });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full" style={{ maxWidth: size }}>
        {laidOut.map((seg, idx) => {
          const x1 = cx + radius * Math.sin(seg.startAngle - Math.PI / 2);
          const y1 = cy - radius * Math.cos(seg.startAngle - Math.PI / 2);
          const x2 = cx + radius * Math.sin(seg.endAngle - Math.PI / 2);
          const y2 = cy - radius * Math.cos(seg.endAngle - Math.PI / 2);
          const xi1 = cx + inner * Math.sin(seg.endAngle - Math.PI / 2);
          const yi1 = cy - inner * Math.cos(seg.endAngle - Math.PI / 2);
          const xi2 = cx + inner * Math.sin(seg.startAngle - Math.PI / 2);
          const yi2 = cy - inner * Math.cos(seg.startAngle - Math.PI / 2);
          return (
            <path
              key={idx}
              d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${seg.large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${seg.large} 0 ${xi2} ${yi2} Z`}
              fill={seg.color}
              fillOpacity={0.92}
            >
              <title>{seg.label}: {seg.value}</title>
            </path>
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-700" style={{ fontSize: 20, fontWeight: 600 }}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11 }}>
          条内容
        </text>
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: seg.color }} />
            <span className="text-slate-600">
              {seg.label}: {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
      {text}
    </div>
  );
}

export function rowsToStackedBarRows(
  items: Array<{ departmentName?: string; channelName?: string; count: number; urgent: number; highlight: number }>,
  labelKey: "departmentName" | "channelName",
  topN = 12,
): BarRow[] {
  return items.slice(0, topN).map((row) => {
    const label = row[labelKey] || (labelKey === "departmentName" ? "未分类部委" : "未分类栏目");
    const urgent = row.urgent;
    const highlight = row.highlight;
    const normal = Math.max(0, row.count - urgent - highlight);
    return {
      label,
      segments: [
        { label: "加急", value: urgent, color: "#ef4444" },
        { label: "重点", value: highlight, color: "#f59e0b" },
        { label: "普通", value: normal, color: "#94a3b8" },
      ],
    };
  });
}

export type { DailySeriesRow };
