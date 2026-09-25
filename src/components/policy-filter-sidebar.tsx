"use client";

import { categoryDisplayLabel, categoryTooltip, CATEGORY_GROUP_LABELS, getCategoryGroup } from "@/lib/monitor/content-meta";
import type { SourceTreeNode, CategoryCount, GenreCount } from "@/hooks/use-policy-list";
import type { ViewMode, SignalFilterType } from "@/hooks/use-policy-filter";
import { SIGNAL_FILTER_LABELS } from "@/hooks/use-policy-filter";

type PolicyFilterSidebarProps = {
  view: ViewMode;
  sourcesTree: SourceTreeNode[];
  selectedDepts: Set<string>;
  selectedChannels: Set<string>;
  expandedDepts: Set<string>;
  importanceLevels: Set<string>;
  selectedCategories: Set<string>;
  selectedGenres: Set<string>;
  selectedChannelGroups: Set<string>;
  categoriesWithCounts: CategoryCount[];
  genresWithCounts: GenreCount[];
  genreList: string[];
  channelGroups: Array<{ key: string; label: string; description: string }>;
  classifyChannelGroup: (name: string) => string;
  hasAnyFilter: boolean;
  signalFilter: SignalFilterType;
  onToggleDepartment: (deptName: string) => void;
  onToggleChannel: (deptName: string, channelName: string) => void;
  onToggleExpandedDept: (deptName: string) => void;
  onToggleImportanceLevel: (level: string) => void;
  onToggleCategory: (category: string) => void;
  onToggleGenre: (genre: string) => void;
  onToggleChannelGroup: (key: string) => void;
  onSignalFilterChange: (filter: SignalFilterType) => void;
  q?: string;
  onlyUnread?: boolean;
  onlyStarred?: boolean;
  fromDate?: string;
  toDate?: string;
  dateField?: string;
};

export function PolicyFilterSidebar({
  view,
  sourcesTree,
  selectedDepts,
  selectedChannels,
  expandedDepts,
  importanceLevels,
  selectedCategories,
  selectedGenres,
  selectedChannelGroups,
  categoriesWithCounts,
  genresWithCounts,
  genreList,
  channelGroups,
  classifyChannelGroup,
  hasAnyFilter,
  signalFilter,
  onToggleDepartment,
  onToggleChannel,
  onToggleExpandedDept,
  onToggleImportanceLevel,
  onToggleCategory,
  onToggleGenre,
  onToggleChannelGroup,
  onSignalFilterChange,
  q,
  onlyUnread,
  onlyStarred,
  fromDate,
  toDate,
  dateField,
}: PolicyFilterSidebarProps) {
  const uniqueChannelsPerName = (() => {
    const map = new Map<string, { count: number; unread: number }>();
    for (const node of sourcesTree) {
      for (const c of node.channels) {
        const prev = map.get(c.channelName) ?? { count: 0, unread: 0 };
        prev.count += c.count;
        prev.unread += c.unread;
        map.set(c.channelName, prev);
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ channelName: name, count: v.count, unread: v.unread }))
      .sort((a, b) => b.count - a.count);
  })();

  const groupedCounts = (() => {
    const counts = new Map<string, number>();
    const unreads = new Map<string, number>();
    for (const row of uniqueChannelsPerName) {
      const g = classifyChannelGroup(row.channelName);
      counts.set(g, (counts.get(g) ?? 0) + row.count);
      unreads.set(g, (unreads.get(g) ?? 0) + row.unread);
    }
    return channelGroups.map((g) => ({
      key: g.key,
      label: g.label,
      description: g.description,
      count: counts.get(g.key) ?? 0,
      unread: unreads.get(g.key) ?? 0,
    }));
  })();

  const showDeptFilter = view !== "byDepartment";
  const showSignalFilter = view === "signals";

  return (
    <aside className="space-y-4">
      {showSignalFilter && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">信号类型</h2>
            <p className="mt-0.5 text-xs text-slate-500">按信号维度快速筛选。</p>
          </header>
          <div className="p-3">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(Object.keys(SIGNAL_FILTER_LABELS) as SignalFilterType[]).map((f) => {
                const on = signalFilter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onSignalFilterChange(f)}
                    className={`rounded-full border px-2.5 py-1 transition ${
                      on
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {SIGNAL_FILTER_LABELS[f]}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {showDeptFilter && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">部委 / 栏目</h2>
            <p className="mt-0.5 text-xs text-slate-500">展开部委查看原始栏目，可多选联动。</p>
          </header>

          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-3 text-xs">
            <span className="text-slate-500">重要性：</span>
            {[
              { k: "核心关注", label: "核心关注", cls: "text-red-700 bg-red-50" },
              { k: "重点内容", label: "⚠ 重点", cls: "text-orange-700 bg-orange-50" },
              { k: "中等重点", label: "中等重点", cls: "text-amber-700 bg-amber-50" },
              { k: "普通内容", label: "普通", cls: "text-slate-700 bg-slate-50" },
            ].map((lvl) => {
              const on = importanceLevels.has(lvl.k);
              return (
                <button
                  key={lvl.k}
                  type="button"
                  onClick={() => onToggleImportanceLevel(lvl.k)}
                  className={`rounded-full border px-2.5 py-1 transition ${
                    on
                      ? `border-transparent ${lvl.cls}`
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {lvl.label}
                </button>
              );
            })}
          </div>

          <div className="max-h-[520px] overflow-auto">
            {sourcesTree.length === 0 ? (
              <div className="px-4 py-6 text-xs text-slate-500">暂无数据</div>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {sourcesTree.map((node) => {
                  const expanded = expandedDepts.has(node.departmentName);
                  const deptOn = selectedDepts.has(node.departmentName);
                  return (
                    <li key={node.departmentName}>
                      <div className="flex items-start gap-2 px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => onToggleExpandedDept(node.departmentName)}
                          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                          aria-label="展开/收起"
                        >
                          {expanded ? "−" : "+"}
                        </button>
                        <label className="flex flex-1 cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
                            checked={deptOn}
                            onChange={() => onToggleDepartment(node.departmentName)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-slate-800">
                                {node.departmentName}
                              </span>
                              <span className="shrink-0 text-xs text-slate-500">
                                {node.totalCount}
                                {node.unread > 0 ? (
                                  <span className="ml-1 text-slate-400">(未读{node.unread})</span>
                                ) : null}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {node.channels.length} 个栏目
                            </div>
                          </div>
                        </label>
                      </div>
                      {expanded ? (
                        <ul className="space-y-0.5 border-t border-slate-100 bg-slate-50/60 px-4 py-2 pl-11 text-xs">
                          {node.channels.map((c) => {
                            const chOn = selectedChannels.has(c.channelName);
                            return (
                              <li key={c.sourceId} className="flex items-start gap-2 py-1">
                                <label className="flex flex-1 cursor-pointer items-start gap-2">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-slate-900"
                                    checked={chOn}
                                    onChange={() =>
                                      onToggleChannel(node.departmentName, c.channelName)
                                    }
                                  />
                                  <span className="min-w-0 flex-1 text-slate-700">
                                    <span className="truncate">{c.channelName}</span>
                                  </span>
                                  <span className="shrink-0 text-slate-500">
                                    {c.count}
                                    {c.unread > 0 ? (
                                      <span className="ml-1 text-slate-400">/{c.unread}未读</span>
                                    ) : null}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {showDeptFilter && groupedCounts.some((g) => g.count > 0) ? (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">内容类型</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              把不同部委里意思相近的栏目归并为大类；点击后将跨部委匹配所有对应栏目。
            </p>
          </header>
          <div className="p-3">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {groupedCounts
                .filter((g) => g.count > 0)
                .map((g) => {
                  const on = selectedChannelGroups.has(g.key);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      title={g.description}
                      onClick={() => onToggleChannelGroup(g.key)}
                      className={`rounded-full border px-2.5 py-1 transition ${
                        on
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {g.label}
                      <span className={`ml-1 ${on ? "text-slate-300" : "text-slate-400"}`}>
                        {g.count}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">标签筛选</h2>
          <p className="mt-0.5 text-xs text-slate-500">按政策信号和涉及领域快速筛选。</p>
        </header>
        <div className="max-h-[320px] overflow-auto p-3">
          {categoriesWithCounts.length === 0 ? (
            <span className="text-slate-500 text-xs">暂无分类数据</span>
          ) : (
            <div className="space-y-3">
              {(["signal", "topic", "region"] as const).map((groupKey) => {
                const groupItems = categoriesWithCounts.filter(
                  (cc) => getCategoryGroup(cc.category) === groupKey
                );
                if (groupItems.length === 0) return null;
                return (
                  <div key={groupKey}>
                    <div className="mb-1.5 text-[11px] font-medium text-slate-500">
                      {CATEGORY_GROUP_LABELS[groupKey]}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {groupItems.map((cc) => {
                        const on = selectedCategories.has(cc.category);
                        const tooltip = categoryTooltip(cc.category);
                        return (
                          <button
                            key={cc.category}
                            type="button"
                            title={tooltip}
                            onClick={() => onToggleCategory(cc.category)}
                            className={`rounded-full border px-2.5 py-1 text-xs transition ${
                              on
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {categoryDisplayLabel(cc.category)}
                            <span className={`ml-1 ${on ? "text-slate-300" : "text-slate-400"}`}>
                              {cc.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <GenreFilterSection
        selectedGenres={selectedGenres}
        genresWithCounts={genresWithCounts}
        genreList={genreList}
        onToggleGenre={onToggleGenre}
      />

      {hasAnyFilter ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 text-xs shadow-sm">
          <div className="mb-2 font-semibold text-slate-900">当前筛选</div>
          <ul className="space-y-1 text-slate-600">
            {q?.trim() ? <li>搜索：{q.trim()}</li> : null}
            {onlyUnread ? <li>仅看未读</li> : null}
            {onlyStarred ? <li>仅看重点</li> : null}
            {selectedDepts.size > 0 ? (
              <li>部委：{Array.from(selectedDepts).join("、")}</li>
            ) : null}
            {selectedChannels.size > 0 ? (
              <li>栏目：{Array.from(selectedChannels).join("、")}</li>
            ) : null}
            {importanceLevels.size > 0 ? (
              <li>重要性：{Array.from(importanceLevels).join("、")}</li>
            ) : null}
            {selectedCategories.size > 0 ? (
              <li>
                标签：
                {Array.from(selectedCategories).map((c) => categoryDisplayLabel(c)).join("、")}
              </li>
            ) : null}
            {selectedGenres.size > 0 ? (
              <li>体裁：{Array.from(selectedGenres).join("、")}</li>
            ) : null}
            {fromDate || toDate ? (
              <li>
                日期范围：{dateField === "list_published_at" ? "按发布日期" : "按发现日期"}：
                {fromDate || "不限"} — {toDate || "不限"}
              </li>
            ) : null}
            {signalFilter !== "all" && view === "signals" ? (
              <li>信号类型：{SIGNAL_FILTER_LABELS[signalFilter]}</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

function GenreFilterSection({
  selectedGenres,
  genresWithCounts,
  genreList,
  onToggleGenre,
}: {
  selectedGenres: Set<string>;
  genresWithCounts: GenreCount[];
  genreList: string[];
  onToggleGenre: (genre: string) => void;
}) {
  const [genreOpen, setGenreOpen] = useStateWithLocalStorage("policy-genre-open", false);

  const countMap = new Map<string, number>();
  for (const gc of genresWithCounts) countMap.set(gc.genre, gc.count);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setGenreOpen(!genreOpen)}
        className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <div>
          <div className="text-sm font-semibold text-slate-900">体裁分类</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {selectedGenres.size > 0
              ? `已选 ${selectedGenres.size} 项：${Array.from(selectedGenres).join("、")}`
              : "按公文体裁筛选，点击展开。"}
          </div>
        </div>
        <span
          className={`ml-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-500 transition ${
            genreOpen ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>
      {genreOpen ? (
        <div className="p-3">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {genreList.map((genre) => {
              const on = selectedGenres.has(genre);
              const count = countMap.get(genre) ?? 0;
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => onToggleGenre(genre)}
                  className={`rounded-full border px-2.5 py-1 transition ${
                    on
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {genre}
                  <span className={`ml-1 ${on ? "text-slate-300" : "text-slate-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

import { useState, useEffect } from "react";

function useStateWithLocalStorage(key: string, defaultValue: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (stored !== null) {
        return stored === "true";
      }
    } catch {
      // ignore
    }
    return defaultValue;
  });

  const setValueAndStore = (newValue: boolean) => {
    setValue(newValue);
    try {
      window.localStorage.setItem(key, String(newValue));
    } catch {
      // ignore
    }
  };

  return [value, setValueAndStore] as const;
}
