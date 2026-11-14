"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  DEFAULT_FILTERS,
  buildFeedParams,
  type FeedCategory,
  type FeedFilters,
  type FeedView,
} from "@/lib/companion/feed";

/**
 * 底部筛选 sheet。结构照创作者雷达的 Feed·filters 屏。
 *
 * ⚠️ 刻意**不**用 createPortal。本项目既有的弹层都 portal 到 document.body，
 * 但伴侣版的 --brand-ink 与 .kw 高亮定义在 [data-companion] 子树作用域内
 * （见 globals.css 的「手机伴侣版作用域」一节）。portal 到 body 会跳出该子树，
 * var(--brand-ink) 变未定义 → 颜色静默退回继承值。
 * 这里直接在子树内用 fixed 定位渲染，行为等价且没有这个坑。
 */
export function FilterSheet({
  open,
  view,
  filters,
  subscriptions,
  onApply,
  onClose,
}: {
  open: boolean;
  view: FeedView;
  filters: FeedFilters;
  subscriptions?: { departments: string[]; keywords: string[] };
  onApply: (f: FeedFilters) => void;
  onClose: () => void;
}) {
  const t = useT("zh");
  const [draft, setDraft] = useState<FeedFilters>(filters);
  const [count, setCount] = useState<number | null>(null);

  // 每次打开都以当前生效的筛选为草稿起点（取消后不留残影）；渲染中对比上一次的 open，不放进 effect
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(filters);
      setCount(null);
    }
  }

  // “查看 N 条结果”里的 N：用 limit=1 问一次总数，只为拿 totalCount。
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const timer = setTimeout(() => {
      const p = buildFeedParams({ view, filters: draft, subscriptions, limit: 1, offset: 0 });
      fetch(`/api/monitor/items?${p.toString()}`, { cache: "no-store", signal: ac.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { totalCount?: number }) =>
          setCount(typeof d.totalCount === "number" ? d.totalCount : null),
        )
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === "AbortError") return;
          setCount(null);
        });
    }, 250); // 防抖：连着点几个 chip 只发一次
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [open, view, draft, subscriptions]);

  if (!open) return null;

  const set = <K extends keyof FeedFilters>(k: K, v: FeedFilters[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const chip = (on: boolean) =>
    `rounded-[9px] border px-[12px] py-[7px] text-[12.5px] font-semibold ${
      on
        ? "border-[var(--brand-border)] bg-[var(--brand-tint)] text-[var(--brand-ink)]"
        : "border-slate-200 text-slate-700"
    }`;

  const rowLabel = "mb-2 text-[11.5px] font-bold text-slate-900";

  // 政策雷达的信号类型就是领域本身（2.7「不要照搬创作者版」）
  const CATEGORY_OPTS: ReadonlyArray<[FeedCategory, string]> = [
    ["all", "全部"],
    ["exec", "强执行"],
    ["support", "强支持"],
    ["risk", "风险预警"],
    ["explore", "试点探索"],
  ];

  const SORT_OPTS: ReadonlyArray<[FeedFilters["sort"], string]> = [
    ["latest", t("companion.opt.sort.latest")],
    ["relevance", t("companion.opt.sort.relevance")],
    ["first_seen", t("companion.opt.sort.firstSeen")],
  ];

  // ⚠️ z-index 必须高于底部 tab bar（它是 z-40）。曾经用 z-30/z-31，
  // 结果 tab bar 压在 sheet 上面、把最底下 82px 盖住——而那正是 Apply 的位置。
  // 症状极具迷惑性：按钮明明渲染了、sheet 也能滚，但往下滚到哪儿都被挡住。
  return (
    <>
      <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.42)]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("companion.filters.title")}
        // 同 tab bar：固定定位逃出 layout 的宽度约束，这里自己居中收窄
        //
        // ⚠️ 这里**故意不用 flex-col + 固定底栏**那种结构。试过，按钮会消失：
        // 内容高时底栏被顶出 sheet 底部，而 sheet 是 bottom-0 定位、溢出方向朝下，
        // 于是按钮跑到屏幕外——更糟的是看起来一切正常（sheet 下缘仍贴着屏幕底）。
        // 改成整个 sheet 自己滚动、Apply 作为最后一个元素：内容多高都滚得到，
        // 没有 flex 收缩与否那套不确定性。
        className="fixed bottom-0 left-1/2 z-[51] max-h-[88vh] w-full max-w-[480px] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-t-[24px] bg-white px-5 pb-[26px] pt-2 shadow-[0_-14px_44px_-14px_rgba(15,23,42,0.35)]"
      >
        <div className="mx-auto mb-[14px] mt-[6px] h-1 w-[38px] rounded-[3px] bg-slate-200" />

        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-[21px] font-medium text-slate-900">
            {t("companion.filters.title")}
          </h3>
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_FILTERS })}
            className="text-[12.5px] font-semibold text-[var(--brand-ink)]"
          >
            {t("companion.filters.reset")}
          </button>
        </div>

        <div className="mb-4">
          <div className={rowLabel}>{t("companion.filters.show")}</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={chip(draft.unreadOnly)}
              onClick={() => set("unreadOnly", !draft.unreadOnly)}
            >
              {t("companion.opt.unreadOnly")}
            </button>
            <button
              type="button"
              className={chip(draft.starredOnly)}
              onClick={() => set("starredOnly", !draft.starredOnly)}
            >
              仅收藏
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className={rowLabel}>{t("companion.filters.category")}</div>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={chip(draft.category === v)}
                onClick={() => set("category", v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className={rowLabel}>{t("companion.filters.dateRange")}</div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={draft.fromDate ?? ""}
              onChange={(e) => set("fromDate", e.target.value || undefined)}
              aria-label={t("companion.filters.startDate")}
              className="flex-1 rounded-[10px] border border-slate-200 px-[11px] py-[10px] text-[12.5px] text-slate-700"
            />
            <input
              type="date"
              value={draft.toDate ?? ""}
              onChange={(e) => set("toDate", e.target.value || undefined)}
              aria-label={t("companion.filters.endDate")}
              className="flex-1 rounded-[10px] border border-slate-200 px-[11px] py-[10px] text-[12.5px] text-slate-700"
            />
          </div>
        </div>

        <div className="mb-4">
          <div className={rowLabel}>{t("companion.filters.sort")}</div>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTS.map(([v, label]) => (
              <button key={v} type="button" className={chip(draft.sort === v)} onClick={() => set("sort", v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onApply(draft)}
          className="mt-3 w-full rounded-[13px] bg-[var(--brand)] py-[14px] text-[14px] font-semibold text-white"
        >
          {count === null ? t("companion.filters.apply") : t("companion.filters.applyN", { n: count })}
        </button>
      </div>
    </>
  );
}
