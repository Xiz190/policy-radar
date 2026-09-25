"use client";

export type ForecastFilter =
  | "all"
  | "forecast"
  | "signal"
  | "funding"
  | "procurement"
  | "pilot"
  | "standards";

const FILTER_LABELS: Record<ForecastFilter, string> = {
  all: "全部",
  forecast: "已有预估",
  signal: "有信号待处理",
  funding: "资金信号",
  procurement: "采购信号",
  pilot: "试点/示范",
  standards: "标准/规范",
};

export function ForecastFilterBar({
  currentFilter,
  totalByFilter,
  onFilterChange,
}: {
  currentFilter: ForecastFilter;
  totalByFilter: Record<ForecastFilter, number>;
  onFilterChange: (f: ForecastFilter) => void;
}) {
  const filters: ForecastFilter[] = [
    "all",
    "forecast",
    "signal",
    "funding",
    "procurement",
    "pilot",
    "standards",
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onFilterChange(f)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            currentFilter === f
              ? "bg-slate-900 text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
          }`}
        >
          {FILTER_LABELS[f]}
          {totalByFilter[f] !== undefined ? (
            <span className="ml-1 text-xs opacity-75">({totalByFilter[f]})</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
