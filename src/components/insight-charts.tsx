"use client";

// 一组纯 SVG 情报可视化图，无第三方依赖，配色走 --brand（各台自动暖/冷）。
// 预览用；选定后接进首页右栏。

// ── ① 信号雷达图（蜘蛛网）─────────────────────────────
export function RadarChart({
  axes,
  size = 220,
}: {
  axes: Array<{ label: string; value: number }>;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = axes.length;
  const max = Math.max(1, ...axes.map((a) => a.value));
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, radius: number) => [
    cx + radius * Math.cos(angle(i)),
    cy + radius * Math.sin(angle(i)),
  ];
  const rings = [0.25, 0.5, 0.75, 1];
  const poly = axes
    .map((a, i) => pt(i, (a.value / max) * r).join(","))
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={axes.map((_, i) => pt(i, r * ring).join(",")).join(" ")}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, r);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth={1} />;
      })}
      <polygon points={poly} fill="var(--brand)" fillOpacity={0.16} stroke="var(--brand)" strokeWidth={1.75} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, (a.value / max) * r);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--brand)" />;
      })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, r + 16);
        return (
          <text
            key={i}
            x={x}
            y={y}
            fontSize={10.5}
            textAnchor={Math.abs(x - cx) < 6 ? "middle" : x > cx ? "start" : "end"}
            dominantBaseline="middle"
            fill="#6b675f"
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── ② 环形图（占比）────────────────────────────────────
export function DonutChart({
  segments,
  size = 132,
  centerLabel,
  centerValue,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  centerLabel?: string;
  centerValue?: number;
}) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
          {segments.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc}
              />
            );
            acc += len;
            return el;
          })}
        </g>
        {centerValue !== undefined && (
          <text x={size / 2} y={size / 2 - 4} fontSize={22} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#1b1a17">
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={size / 2} y={size / 2 + 14} fontSize={10} textAnchor="middle" fill="#6b675f">
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[11px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="tabular-nums text-slate-400">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── ③ 迷你趋势线（走势）────────────────────────────────
export function Sparkline({
  data,
  width = 260,
  height = 60,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const span = Math.max(1, max - min);
  const stepX = width / Math.max(1, data.length - 1);
  const y = (v: number) => height - 6 - ((v - min) / span) * (height - 12);
  const pts = data.map((v, i) => [i * stepX, y(v)]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      <path d={area} fill="var(--brand)" fillOpacity={0.08} />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={2.75} fill="var(--brand)" />}
    </svg>
  );
}

// ── ④ 四宫格数据卡 ─────────────────────────────────────
export function StatGrid({
  cells,
}: {
  cells: Array<{ label: string; value: string | number; spark?: number[] }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">{cell.label}</div>
          <div className="mt-0.5 font-serif text-2xl font-bold tabular-nums text-slate-900">{cell.value}</div>
          {cell.spark && (
            <div className="mt-1">
              <Sparkline data={cell.spark} width={110} height={22} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
