"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// 使用 Asia/Shanghai 时区生成今日 YYYY-MM-DD，保证 SSR 与客户端一致
function todayInShanghai(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  const d = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${y}-${m}-${d}`;
}

const CATEGORY_LABEL: Record<string, string> = {
  ai_tools: "AI工具",
  performance: "演出机会",
  competition: "赛事申报",
  policy: "版权政策",
  general: "综合",
};

export type SourceCardData = {
  departmentName: string;
  channelCount: number;
  channelNames: string[];
  last7DaysCount: number;
  todayCount: number;
  urgentCount: number;
  highlightCount: number;
  unreadCount: number;
  starredCount: number;
  totalCount: number;
  latestPublishedAt: string | null;
  latestTitle: string | null;
  latestUrl: string | null;
  dailySeries?: { date: string; count: number }[];
  regions?: string[];
  contentCategories?: string[];
};

type SortKey =
  | "totalDesc"
  | "totalAsc"
  | "todayDesc"
  | "urgentDesc"
  | "highlightDesc"
  | "unreadDesc"
  | "nameAsc";

export function SourceDirectoryBrowser({
  departments,
  summary,
}: {
  departments: SourceCardData[];
  summary: { totalDepartments: number; withUpdates: number };
}) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalDesc");
  const [onlyActive, setOnlyActive] = useState(false);
  const [onlyWithUrgent, setOnlyWithUrgent] = useState(false);

  const filtered = useMemo(() => {
    let list = departments.slice();
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.departmentName.toLowerCase().includes(needle) ||
          d.channelNames.some((c) => c.toLowerCase().includes(needle)),
      );
    }
    if (onlyActive) list = list.filter((d) => d.todayCount > 0 || d.last7DaysCount > 0);
    if (onlyWithUrgent) list = list.filter((d) => d.urgentCount > 0);
    switch (sortKey) {
      case "totalAsc":
        list.sort((a, b) => a.totalCount - b.totalCount);
        break;
      case "todayDesc":
        list.sort((a, b) => b.todayCount - a.todayCount);
        break;
      case "urgentDesc":
        list.sort((a, b) => b.urgentCount - a.urgentCount);
        break;
      case "highlightDesc":
        list.sort((a, b) => b.highlightCount - a.highlightCount);
        break;
      case "unreadDesc":
        list.sort((a, b) => b.unreadCount - a.unreadCount);
        break;
      case "nameAsc":
        list.sort((a, b) => a.departmentName.localeCompare(b.departmentName, "zh-CN"));
        break;
      default:
        list.sort((a, b) => b.totalCount - a.totalCount);
    }
    return list;
  }, [departments, q, sortKey, onlyActive, onlyWithUrgent]);

  const todayTotal = departments.reduce((s, d) => s + d.todayCount, 0);
  const weekTotal = departments.reduce((s, d) => s + d.last7DaysCount, 0);
  // todayInShanghai 用 Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" })
  // 在 SSR 和客户端都产生同样的 YYYY-MM-DD 字符串，因此这里直接 useMemo 即可，
  // 不需要 useEffect，也不会有 hydration mismatch。
  const today = useMemo(() => todayInShanghai(), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-1 items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索部委或栏目…"
            className="h-10 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm outline-none ring-0 transition focus:border-slate-500 focus:bg-white sm:w-80"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <ToggleChip label="只看有更新的部委（近 7 日）" checked={onlyActive} onChange={setOnlyActive} />
          <ToggleChip label="只看含加急的部委" checked={onlyWithUrgent} onChange={setOnlyWithUrgent} />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700"
          >
            <option value="totalDesc">按总数降序</option>
            <option value="totalAsc">按总数升序</option>
            <option value="todayDesc">按今日更新</option>
            <option value="urgentDesc">按加急数</option>
            <option value="highlightDesc">按重点数</option>
            <option value="unreadDesc">按未读数</option>
            <option value="nameAsc">按部委名</option>
          </select>
        </div>
        <div className="text-xs text-slate-500">
          显示 <span className="font-semibold text-slate-900">{filtered.length}</span> / {summary.totalDepartments} · 今日更新{" "}
          <span className="font-semibold text-slate-900">{todayTotal}</span> 条 · 近 7 日{" "}
          <span className="font-semibold text-slate-900">{weekTotal}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          没有符合条件的部委。试试清空搜索或过滤器。
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <SourceCard key={d.departmentName} d={d} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex h-9 items-center rounded-full border px-3 text-xs transition ${
        checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function SourceCard({ d, today }: { d: SourceCardData; today: string }) {
  const inboxHref = `/inbox?departmentName=${encodeURIComponent(d.departmentName)}`;
  const detailHref = `/departments/${encodeURIComponent(d.departmentName)}`;
  const channelsPreview = d.channelNames.slice(0, 4);
  const extraChannels = Math.max(0, d.channelNames.length - channelsPreview.length);
  const dailySeries = d.dailySeries ?? [];
  const maxDaily = Math.max(1, ...dailySeries.map((s) => s.count));

  return (
    <div className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900" title={d.departmentName}>
            <Link href={detailHref} className="hover:text-slate-700">
              {d.departmentName}
            </Link>
          </h3>
          <div className="mt-1 text-xs text-slate-500">
            {d.channelCount} 个栏目 · 共 {d.totalCount} 条
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {d.todayCount > 0 ? (
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              今日 +{d.todayCount}
            </span>
          ) : null}
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
            近 7 日 {d.last7DaysCount}
          </span>
          {(d.regions ?? []).length > 0 && (
            <div className="flex flex-wrap justify-end gap-1">
              {(d.regions ?? []).map((r) => (
                <span key={r} className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700">
                  {r === "domestic" ? "国内" : "全球"}
                </span>
              ))}
              {(d.contentCategories ?? []).filter(c => c !== "general").map((c) => (
                <span key={c} className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-700">
                  {CATEGORY_LABEL[c] ?? c}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* 7 日迷你柱图 */}
      {dailySeries.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>近 7 日更新分布</span>
            <span>峰值 {maxDaily}</span>
          </div>
          <div className="flex h-12 items-end gap-1.5">
            {dailySeries.map((s) => {
              const isToday = s.date === today;
              const h = Math.max(3, (s.count / maxDaily) * 100);
              return (
                <div key={s.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t ${
                      isToday ? "bg-amber-400" : "bg-indigo-400"
                    } transition group-hover:opacity-90`}
                    style={{ height: `${h}%` }}
                    title={`${s.date}：${s.count}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 数字三栏 */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <NumberCell label="加急" value={d.urgentCount} cls={d.urgentCount > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-500"} />
        <NumberCell label="⚠ 重点" value={d.highlightCount} cls={d.highlightCount > 0 ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 bg-slate-50 text-slate-500"} />
        <NumberCell label="未读" value={d.unreadCount} cls={d.unreadCount > 0 ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-500"} />
        <NumberCell label="标星" value={d.starredCount} cls="border-slate-200 bg-slate-50 text-slate-500" />
      </div>

      {/* 栏目预览 */}
      {channelsPreview.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {channelsPreview.map((c) => (
            <span
              key={c}
              className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600"
              title={c}
            >
              {truncate(c, 18)}
            </span>
          ))}
          {extraChannels > 0 ? (
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
              +{extraChannels}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 最新一条 */}
      {d.latestTitle ? (
        <div className="mt-3 flex-1 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="text-[11px] text-slate-400">
            最新 {d.latestPublishedAt ? String(d.latestPublishedAt).slice(0, 10) : "-"}
          </div>
          {d.latestUrl ? (
            <Link
              href={inboxHref}
              className="mt-1 line-clamp-2 text-sm font-medium text-slate-800 hover:text-slate-900 hover:underline decoration-slate-300 underline-offset-2"
              title={d.latestTitle}
            >
              {d.latestTitle}
            </Link>
          ) : (
            <div className="mt-1 line-clamp-2 text-sm text-slate-600" title={d.latestTitle}>
              {d.latestTitle}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex-1 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-3 text-[11px] text-slate-400">
          暂无入库内容
        </div>
      )}

      {/* 底部操作 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={detailHref}
          className="inline-flex h-8 items-center rounded-full bg-slate-900 px-3 text-xs text-white transition hover:bg-slate-700"
        >
          部委详细 →
        </Link>
        <Link
          href={inboxHref}
          className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50"
        >
          打开收件箱
        </Link>
        {d.totalCount > 0 ? (
          <Link
            href={`${inboxHref}&onlyUnread=1`}
            className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50"
          >
            只看未读
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function NumberCell({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-2xl border px-2 py-2 ${cls}`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}
