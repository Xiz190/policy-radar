"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DepartmentCardData } from "@/components/department-directory";

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

/**
 * 单个部委卡片。在保持原有业务内容（柱图、数字四栏、栏目 chips、最新一条标题）不变的基础上，
 * 叠加了：标星按钮、命中高亮、「相关部委」推荐标签。
 */
export function DepartmentCard({
  d,
  query,
  isRecommended,
  matchedText,
  starred,
  onToggleStar,
}: {
  d: DepartmentCardData;
  /** 当前搜索关键词；空串表示未搜索。 */
  query?: string;
  /** true = 该卡片是"相关推荐"而不是完全匹配，需要在右上角显示标签。 */
  isRecommended?: boolean;
  /** 用于高亮的命中文本（部委名 / 栏目名 / 别名）。 */
  matchedText?: string;
  starred?: boolean;
  onToggleStar?: (departmentName: string) => void;
}) {
  const inboxHref = `/inbox?departmentName=${encodeURIComponent(d.departmentName)}`;
  const detailHref = `/departments/${encodeURIComponent(d.departmentName)}`;
  // 保险：对 channelNames 去重，避免数据库重复条目导致 React key 冲突
  const dedupedChannels = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of d.channelNames) {
      const k = (c || "").trim();
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out;
  }, [d.channelNames]);
  const channelsPreview = dedupedChannels.slice(0, 4);
  const extraChannels = Math.max(0, dedupedChannels.length - channelsPreview.length);
  const dailySeries = d.dailySeries ?? [];
  const maxDaily = Math.max(1, ...dailySeries.map((s) => s.count));
  // todayInShanghai 用 Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" })
  // 在 SSR 和客户端都产生同样的 YYYY-MM-DD 字符串，因此这里直接 useMemo 即可，
  // 不需要 useEffect，也不会有 hydration mismatch。
  const today = useMemo(() => todayInShanghai(), []);

  // 用于"中文关键字高亮"：对标题文本按 query 做一次不区分大小写的切分
  const highlightParts = useMemo(() => {
    const text = d.departmentName;
    const q = (query ?? "").trim();
    if (!q) return [{ text, highlight: false }];
    const lower = text.toLowerCase();
    const qLower = q.toLowerCase();
    const idx = lower.indexOf(qLower);
    if (idx === -1) return [{ text, highlight: false }];
    return [
      { text: text.slice(0, idx), highlight: false },
      { text: text.slice(idx, idx + q.length), highlight: true },
      { text: text.slice(idx + q.length), highlight: false },
    ].filter((p) => p.text.length > 0);
  }, [d.departmentName, query]);

  return (
    <div
      suppressHydrationWarning
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow"
    >
      {/* 顶部：部委名 + 标星按钮 + 今日更新 */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {onToggleStar ? (
              <button
                type="button"
                onClick={() => onToggleStar(d.departmentName)}
                aria-label={starred ? "取消关注" : "标为关注"}
                title={starred ? "取消关注" : "标为关注"}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition ${
                  starred
                    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-amber-600"
                }`}
              >
                {starred ? "★" : "☆"}
              </button>
            ) : null}
            <h3
              className="truncate text-base font-semibold text-slate-900"
              title={d.departmentName}
            >
              {query && query.trim() ? (
                <>
                  {highlightParts.map((p, i) =>
                    p.highlight ? (
                      <mark
                        key={i}
                        className="rounded bg-amber-200/80 px-0.5 text-slate-900"
                      >
                        {p.text}
                      </mark>
                    ) : (
                      <span key={i}>{p.text}</span>
                    ),
                  )}
                </>
              ) : (
                d.departmentName
              )}
            </h3>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {d.channelCount} 个栏目 · 共 {d.totalCount} 条
            {matchedText && matchedText !== d.departmentName ? (
              <span className="ml-2 text-slate-400">（命中：{matchedText}）</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isRecommended ? (
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
              相关部委
            </span>
          ) : null}
          {d.todayCount > 0 ? (
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              今日 +{d.todayCount}
            </span>
          ) : null}
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
            近 7 日 {d.last7DaysCount}
          </span>
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
                <div
                  key={s.date}
                  title={`${s.date}：${s.count} 条`}
                  className={`flex-1 rounded transition ${isToday ? "bg-amber-400" : "bg-indigo-400"} group-hover:opacity-90`}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 数字四栏 */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <NumberCell
          label="加急"
          value={d.urgentCount}
          cls={d.urgentCount > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-500"}
        />
        <NumberCell
          label="⚠ 重点"
          value={d.highlightCount}
          cls={d.highlightCount > 0 ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 bg-slate-50 text-slate-500"}
        />
        <NumberCell
          label="未读"
          value={d.unreadCount}
          cls={d.unreadCount > 0 ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-500"}
        />
        <NumberCell
          label="标星"
          value={d.starredCount}
          cls="border-slate-200 bg-slate-50 text-slate-500"
        />
      </div>

      {/* 栏目预览 chips */}
      {channelsPreview.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {channelsPreview.map((c) => {
            const isMatch =
              !!query &&
              query.trim().length > 0 &&
              c.toLowerCase().includes(query.trim().toLowerCase());
            return (
              <span
                key={c}
                className={
                  isMatch
                    ? "inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800"
                    : "inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600"
                }
                title={c}
              >
                {truncate(c, 18)}
              </span>
            );
          })}
          {extraChannels > 0 ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
              +{extraChannels}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* 最新一条标题 */}
      {d.latestTitle ? (
        <div className="mt-3 flex-1 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="text-[11px] text-slate-400">
            最新 {d.latestPublishedAt ? String(d.latestPublishedAt).slice(0, 10) : "-"}
          </div>
          {d.latestUrl ? (
            <Link
              href={inboxHref}
              className="mt-1 block text-sm font-medium text-slate-800 underline decoration-slate-200 underline-offset-2 hover:text-slate-900"
              title={d.latestTitle}
            >
              <span className="line-clamp-2">{d.latestTitle}</span>
            </Link>
          ) : (
            <div className="mt-1 text-sm text-slate-600" title={d.latestTitle}>
              <span className="line-clamp-2">{d.latestTitle}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex-1 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-3 text-[11px] text-slate-400">
          暂无入库内容
        </div>
      )}

      {/* 底部快捷按钮 */}
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
