"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ForecastItemCard } from "@/components/forecast-item-card";
import { ForecastFilterBar, type ForecastFilter } from "@/components/forecast-filter-bar";
import type { ForecastItem } from "@/lib/monitor/types";

const PAGE_SIZE = 20;

type ForecastStats = {
  forecast: number;
  signal: number;
  funding: number;
  procurement: number;
  pilot: number;
  standards: number;
};

function localFilter(items: ForecastItem[], filter: ForecastFilter): ForecastItem[] {
  if (filter === "all") return items;
  if (filter === "forecast") {
    return items.filter(
      (it) =>
        it.forecastHigh || it.forecastMidHigh || it.forecastMid || it.forecastLow,
    );
  }
  if (filter === "signal") {
    return items.filter((it) => {
      const hasAny = it.hasFunding || it.hasProcurement || it.hasPilot || it.hasStandards;
      const hasForecast =
        it.forecastHigh || it.forecastMidHigh || it.forecastMid || it.forecastLow;
      return hasAny && !hasForecast;
    });
  }
  if (filter === "funding") return items.filter((it) => it.hasFunding);
  if (filter === "procurement") return items.filter((it) => it.hasProcurement);
  if (filter === "pilot") return items.filter((it) => it.hasPilot);
  if (filter === "standards") return items.filter((it) => it.hasStandards);
  return items;
}

export function ForecastList({
  items,
  stats,
}: {
  items: ForecastItem[];
  stats: ForecastStats;
}) {
  const [filter, setFilter] = useState<ForecastFilter>("all");
  const [page, setPage] = useState(1);

  const totalByFilter = useMemo<Record<ForecastFilter, number>>(
    () => ({
      all: items.length,
      forecast: stats.forecast,
      signal: stats.signal,
      funding: stats.funding,
      procurement: stats.procurement,
      pilot: stats.pilot,
      standards: stats.standards,
    }),
    [items.length, stats],
  );

  const filtered = useMemo(
    () =>
      localFilter(items, filter).sort((a, b) =>
        String(b.firstSeenAt || "").localeCompare(String(a.firstSeenAt || "")),
      ),
    [items, filter],
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const displayed = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 切换筛选时重置页码
  const handleFilterChange = (newFilter: ForecastFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  return (
    <>
      <section className="mt-6">
        <ForecastFilterBar
          currentFilter={filter}
          totalByFilter={totalByFilter}
          onFilterChange={handleFilterChange}
        />
      </section>

      <section className="mt-6 space-y-4">
        {displayed.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="text-base font-medium text-slate-700">暂无数据</div>
            <p className="mt-2 text-sm text-slate-500">
              当前筛选条件下没有条目。请尝试其他筛选，或到动态资讯中查看更多政策。
            </p>
            <Link
              href="/inbox"
              className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm text-white transition hover:bg-slate-800"
            >
              去动态资讯查看
            </Link>
          </div>
        ) : (
          displayed.map((item) => (
            <ForecastItemCard key={`${item.sourceId}-${item.url}`} item={item} />
          ))
        )}
      </section>

      {/* 分页控件 */}
      {totalPages > 1 && (
        <section className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  p === page
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>

          <span className="ml-4 text-xs text-slate-500">
            共 {filtered.length} 条 · 第 {page}/{totalPages} 页
          </span>
        </section>
      )}
    </>
  );
}
