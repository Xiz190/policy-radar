"use client";

import { useEffect, useState } from "react";
import { SEARCH_HINT } from "@/lib/monitor/source-meta";

export type DepartmentFilterState = {
  /** 搜索关键词；空字符串表示不筛选。 */
  q: string;
  /** 只看有更新的部委（今日或近 7 日有内容）。 */
  onlyActive: boolean;
  /** 只看含加急内容的部委。 */
  onlyWithUrgent: boolean;
  /** 只看已标星的部委。 */
  onlyStarred: boolean;
};

/**
 * 部委目录顶部搜索 & 筛选工具条。
 * 负责：搜索框、快捷筛选项、标星过滤、清空按钮、实时提示。
 * 当前部委总数与标星部委数由父组件传入，不与具体数据耦合。
 */
export function SourceSearchBar({
  totalDepartments,
  starredCount,
  filter,
  onChange,
}: {
  totalDepartments: number;
  starredCount: number;
  filter: DepartmentFilterState;
  onChange: (next: DepartmentFilterState) => void;
}) {
  // 用一个本地状态做"受控输入框"，让文本框即时响应；再用 onChange 把值向上抛。
  const [localQ, setLocalQ] = useState(filter.q);
  useEffect(() => {
    // 父组件的 filter.q 变化（比如被外部重置）
    if (filter.q !== localQ) queueMicrotask(() => setLocalQ(filter.q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.q]);

  const hasAnyFilter =
    filter.q.trim().length > 0 || filter.onlyActive || filter.onlyWithUrgent || filter.onlyStarred;

  return (
    <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-start gap-2">
          <input
            type="search"
            value={localQ}
            onChange={(e) => {
              const v = e.target.value;
              setLocalQ(v);
              onChange({ ...filter, q: v });
            }}
            placeholder="搜索部委、拼音、简称…（例：财政部 / caizhengbu / czb / 财政局）"
            className="h-10 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-slate-500 focus:bg-white"
          />
          {filter.q.trim() ? (
            <button
              type="button"
              onClick={() => {
                setLocalQ("");
                onChange({ ...filter, q: "" });
              }}
              className="inline-flex h-10 shrink-0 items-center rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-500 transition hover:bg-slate-50"
            >
              清空
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          共 <span className="font-semibold text-slate-800">{totalDepartments}</span> 个部委
          {starredCount > 0 ? (
            <>
              {" "}
              · 已标星 <span className="font-semibold text-amber-700">{starredCount}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <ChipToggle
          label="只看有更新"
          sublabel="今日或近 7 日有新内容"
          active={filter.onlyActive}
          onClick={() => onChange({ ...filter, onlyActive: !filter.onlyActive })}
        />
        <ChipToggle
          label="只看含加急"
          sublabel="命中关键词的加急条目"
          active={filter.onlyWithUrgent}
          onClick={() => onChange({ ...filter, onlyWithUrgent: !filter.onlyWithUrgent })}
        />
        <ChipToggle
          label="只看已标星"
          sublabel={`${starredCount} 个关注的部委`}
          active={filter.onlyStarred}
          onClick={() => onChange({ ...filter, onlyStarred: !filter.onlyStarred })}
          disabled={starredCount === 0}
        />
        {hasAnyFilter ? (
          <button
            type="button"
            onClick={() =>
              onChange({ q: "", onlyActive: false, onlyWithUrgent: false, onlyStarred: false })
            }
            className="ml-1 inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-slate-600 transition hover:bg-slate-50"
          >
            重置所有筛选
          </button>
        ) : null}
      </div>

      <div className="text-xs text-slate-400">{SEARCH_HINT}</div>
    </div>
  );
}

function ChipToggle({
  label,
  sublabel,
  active,
  onClick,
  disabled,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex h-8 items-center rounded-full border px-3 transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : disabled
            ? "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      title={sublabel}
    >
      {label}
    </button>
  );
}
