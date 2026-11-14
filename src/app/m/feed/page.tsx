"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { ContentItem } from "@/hooks/use-item-list";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  buildFeedParams,
  groupByDay,
  type FeedFilters,
  type FeedView,
} from "@/lib/companion/feed";
import { CompanionHeader } from "@/components/companion/companion-header";
import { FeedRow } from "@/components/companion/feed-row";
import { Segmented } from "@/components/companion/segmented";
import { FilterSheet } from "@/components/companion/filter-sheet";

const PAGE_SIZE = 30;

export default function CompanionFeedPage() {
  // 政策雷达固定中文界面
  const t = useT("zh");

  const [view, setView] = useState<FeedView>("all");
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [subscriptions, setSubscriptions] = useState<{ departments: string[]; keywords: string[] }>({
    departments: [],
    keywords: [],
  });

  // ⚠️ now 必须挂载后才算。"今天 / 昨天"分组标签若在渲染期取 new Date()，
  // 会被烤成**构建当天**的日期，之后每天访问客户端算出的分组标签
  // 都跟服务端发来的对不上 → 水合不一致。（同 /m 页 dateLabel 的坑。）
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后才能读浏览器数据（本地存储/窗口/当前时间），服务端读不到；放进渲染会造成水合不一致
    setNow(new Date());
  }, []);

  // 订阅只在「关注」段用得上；先取好，切过去时不用等。
  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/monitor/subscriptions?userId=default", { cache: "no-store", signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { subscriptions?: Array<{ type: string; target: string; enabled?: boolean }> }) => {
        const on = (d.subscriptions ?? []).filter((s) => s.enabled !== false);
        setSubscriptions({
          departments: on.filter((s) => s.type === "department").map((s) => s.target),
          keywords: on.filter((s) => s.type === "keyword").map((s) => s.target),
        });
      })
      .catch(() => {
        // 订阅取不到不该让整屏失败——退化为空订阅，「关注」段自然为空。
        setSubscriptions({ departments: [], keywords: [] });
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 开始请求时重置加载状态：这是和网络请求同步，属于 effect 的正当用途
    setState("loading");
    const p = buildFeedParams({ view, filters, subscriptions, q, limit: PAGE_SIZE, offset: 0 });
    fetch(`/api/monitor/items?${p.toString()}`, { cache: "no-store", signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { items?: ContentItem[]; totalCount?: number }) => {
        setItems(d.items ?? []);
        setTotal(typeof d.totalCount === "number" ? d.totalCount : (d.items ?? []).length);
        setState("ready");
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setState("error");
      });
    return () => ac.abort();
  }, [view, filters, q, subscriptions]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const p = buildFeedParams({
        view,
        filters,
        subscriptions,
        q,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      const r = await fetch(`/api/monitor/items?${p.toString()}`, { cache: "no-store" });
      if (r.ok) {
        const d: { items?: ContentItem[] } = await r.json();
        setItems((prev) => [...prev, ...(d.items ?? [])]);
      }
    } catch {
      // 加载更多失败就停在这儿，不打断已渲染的内容
    } finally {
      setLoadingMore(false);
    }
  }

  const groups = useMemo(() => (now ? groupByDay(items, now) : []), [items, now]);
  const filterCount = activeFilterCount(filters);

  return (
    <main>
      <CompanionHeader
        title={t("companion.feed.title")}
        right={
          <button
            type="button"
            aria-label={t("companion.feed.search")}
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setQ("");
            }}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-slate-200"
          >
            {searchOpen ? (
              <X className="h-4 w-4 text-slate-700" aria-hidden />
            ) : (
              <Search className="h-4 w-4 text-slate-700" aria-hidden />
            )}
          </button>
        }
      />

      {searchOpen ? (
        <div className="px-5 pb-1">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("companion.feed.search")}
            className="w-full rounded-[10px] border border-slate-200 px-3 py-[9px] text-[13px] text-slate-900 outline-none"
          />
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-5 pb-2 pt-3">
        <Segmented
          value={view}
          onChange={setView}
          ariaLabel={t("companion.feed.title")}
          options={[
            { value: "all", label: t("companion.feed.all") },
            { value: "following", label: t("companion.feed.following") },
            { value: "signals", label: t("companion.feed.signals") },
          ]}
        />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="ml-auto inline-flex items-center gap-[6px] rounded-[11px] border border-slate-200 bg-white px-3 py-[7px] text-[13px] font-semibold text-slate-700"
        >
          <SlidersHorizontal className="h-[15px] w-[15px]" aria-hidden />
          {t("companion.filters.title")}
          {filterCount > 0 ? (
            <span className="rounded-[20px] bg-[var(--brand)] px-[6px] py-[1px] font-mono text-[10px] font-bold text-white">
              {filterCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="px-5 pb-24">
        {state === "loading" ? (
          <p className="pt-6 text-[13.5px] text-slate-500">{t("companion.loading")}</p>
        ) : state === "error" ? (
          <p className="pt-6 text-[13.5px] text-slate-500">{t("companion.error")}</p>
        ) : groups.length === 0 ? (
          <p className="pt-6 text-[13.5px] text-slate-500">{t("companion.empty")}</p>
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.key}>
                <div className="mb-[6px] mt-[26px] flex items-baseline gap-2 text-[12.5px] font-semibold text-slate-900">
                  {g.label}
                  <time className="font-normal text-[11.5px] text-slate-500">{g.date}</time>
                </div>
                {g.items.map((item) => (
                  // now 一定非空：groups 为空时走不到这里（groups 依赖 now，now 为 null 时是空数组）
                  <FeedRow key={`${item.sourceId}::${item.url}`} item={item} now={now as Date} />
                ))}
              </section>
            ))}

            {items.length < total ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-5 w-full rounded-[11px] border border-slate-200 py-[11px] text-[13px] font-semibold text-slate-700 disabled:opacity-60"
              >
                {loadingMore
                  ? t("companion.loading")
                  : t("companion.feed.loadMoreN", { n: items.length, total })}
              </button>
            ) : null}
          </>
        )}
      </div>

      <FilterSheet
        open={sheetOpen}
        view={view}
        filters={filters}
        subscriptions={subscriptions}
        onApply={(f) => {
          setFilters(f);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </main>
  );
}
