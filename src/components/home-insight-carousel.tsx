"use client";

import { useRef, useState } from "react";
import { RadarChart, DonutChart, StatGrid } from "@/components/insight-charts";

// 结构化入参：字段全可选，两个项目的 todayItems 都能直接传进来
type InsightItem = {
  departmentName?: string;
  importanceLevel?: string;
  categories?: Array<{ category: string; topKeywords?: string[] }>;
};

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {dir === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

/**
 * 首页右栏「情报速览」滑动卡：一个槽里收多张真·可视化情报图，
 * 箭头 / 圆点 / 左右滑 / 键盘 ←→ 切换，切换时淡入。
 * 所有数据都用传入的 items 现算，不额外请求。
 */
export function HomeInsightCarousel({ items }: { items: InsightItem[] }) {
  const total = items.length;

  // 各主题信号数 → 雷达轴（取 Top 6）
  const radarAxes = (() => {
    const m = new Map<string, number>();
    for (const it of items)
      for (const c of it.categories ?? []) m.set(c.category, (m.get(c.category) ?? 0) + 1);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label: label.length > 5 ? label.slice(0, 5) : label, value }));
  })();

  // 重要性分布 → 环形图
  let core = 0, key = 0, normal = 0;
  for (const it of items) {
    const lv = it.importanceLevel;
    if (lv === "核心关注" || lv === "加急") core++;
    else if (lv === "重点内容") key++;
    else normal++;
  }
  const importance = [
    { label: "核心 / 加急", value: core, color: "var(--brand)" },
    { label: "重点", value: key, color: "color-mix(in srgb, var(--brand) 55%, white)" },
    { label: "一般", value: normal, color: "#e2ddd3" },
  ];

  // 概览四宫格
  const distinctSources = new Set(items.map((it) => it.departmentName || "其他")).size;
  const topKeyword = (() => {
    const m = new Map<string, number>();
    for (const it of items)
      for (const c of it.categories ?? [])
        for (const kw of c.topKeywords ?? []) m.set(kw, (m.get(kw) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  })();
  const cells = [
    { label: "今日新增", value: total },
    { label: "核心关注", value: core },
    { label: "来源数", value: distinctSources },
    { label: "高频词", value: topKeyword },
  ];

  const slides: Array<{ title: string; body: React.ReactNode }> = [];
  if (radarAxes.length >= 3) slides.push({ title: "信号雷达", body: <RadarChart axes={radarAxes} size={210} /> });
  slides.push({ title: "重要性分布", body: <DonutChart segments={importance} centerValue={total} centerLabel="今日" /> });
  slides.push({ title: "今日概览", body: <StatGrid cells={cells} /> });

  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const go = (d: number) => setIdx((p) => (p + d + n) % n);

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5"
      tabIndex={0}
      role="group"
      aria-roledescription="情报图轮播"
      aria-label="情报速览"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-3.5 w-1 rounded-sm bg-[var(--brand)]" aria-hidden />
          <span className="font-serif text-sm font-semibold text-slate-900">情报速览</span>
          <span className="truncate text-[11px] text-slate-400">· {slides[idx].title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => go(-1)} aria-label="上一张" className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <Chevron dir="left" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="下一张" className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <Chevron dir="right" />
          </button>
        </div>
      </div>

      <div key={idx} className="radar-fade flex min-h-[210px] items-center justify-center">
        {slides[idx].body}
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={s.title}
            aria-current={i === idx}
            className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-[var(--brand)]" : "w-1.5 bg-slate-200 hover:bg-slate-300"}`}
          />
        ))}
      </div>
    </section>
  );
}
