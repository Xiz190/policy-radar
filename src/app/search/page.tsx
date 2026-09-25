"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SIGNAL_CATEGORIES } from "@/lib/monitor/content-meta";
import {
  CircleHelp, LoaderCircle, Search,
} from "lucide-react";

type SearchItem = {
  sourceId: string;
  url: string;
  title: string;
  sourceName?: string;
  channelName?: string;
  listPublishedAt?: string;
  importanceLevel?: number;
  categories?: Array<{ category: string }>;
  summary?: string;
};

type Tab = "inbox" | "signals";

const PAGE_SIZE = 15;

function highlight(text: string, q: string): string {
  if (!q.trim()) return text;
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark class=\"bg-amber-100 rounded px-0.5\">$1</mark>");
}

function ItemCard({ item, q }: { item: SearchItem; q: string }) {
  const pub = item.listPublishedAt ? new Date(item.listPublishedAt).toLocaleDateString("zh-CN") : "";
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <p
        className="text-sm font-medium leading-snug text-slate-900 line-clamp-2"
        dangerouslySetInnerHTML={{ __html: highlight(item.title || "（无标题）", q) }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {item.sourceName && <span>{item.sourceName}</span>}
        {item.channelName && <span>· {item.channelName}</span>}
        {pub && <span>· {pub}</span>}
        {item.importanceLevel != null && item.importanceLevel >= 4 && (
          <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-600">高优先</span>
        )}
      </div>
      {item.summary && (
        <p
          className="mt-2 text-[11px] leading-relaxed text-slate-500 line-clamp-2"
          dangerouslySetInnerHTML={{ __html: highlight(item.summary, q) }}
        />
      )}
    </a>
  );
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [q, setQ] = useState(initialQ);
  const [committed, setCommitted] = useState(initialQ);
  const [tab, setTab] = useState<Tab>("inbox");
  const [inboxItems, setInboxItems] = useState<SearchItem[]>([]);
  const [signalItems, setSignalItems] = useState<SearchItem[]>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [signalTotal, setSignalTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (query: string, currentPage: number, currentTab: Tab) => {
    if (!query.trim()) {
      setInboxItems([]);
      setSignalItems([]);
      setInboxTotal(0);
      setSignalTotal(0);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    try {
      const base = new URLSearchParams({
        view: "list",
        q: query.trim(),
        limit: String(PAGE_SIZE),
        offset: String((currentPage - 1) * PAGE_SIZE),
      });

      if (currentTab === "inbox") {
        const res = await fetch(`/api/monitor/items?${base}`, { signal: ctrl.signal, cache: "no-store" });
        const json = (await res.json()) as { items?: SearchItem[]; totalCount?: number };
        if (!ctrl.signal.aborted) {
          setInboxItems(json.items ?? []);
          setInboxTotal(json.totalCount ?? 0);
        }
      } else {
        const sigParams = new URLSearchParams(base);
        sigParams.set("categories", [...SIGNAL_CATEGORIES].join(","));
        const res = await fetch(`/api/monitor/items?${sigParams}`, { signal: ctrl.signal, cache: "no-store" });
        const json = (await res.json()) as { items?: SearchItem[]; totalCount?: number };
        if (!ctrl.signal.aborted) {
          setSignalItems(json.items ?? []);
          setSignalTotal(json.totalCount ?? 0);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error(e);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (committed) search(committed, page, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed, page, tab]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function commit() {
    setPage(1);
    setCommitted(q);
    // sync URL without navigation
    const url = new URL(window.location.href);
    if (q.trim()) url.searchParams.set("q", q.trim());
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());
  }

  const items = tab === "inbox" ? inboxItems : signalItems;
  const total = tab === "inbox" ? inboxTotal : signalTotal;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">

        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            placeholder="搜索标题、摘要、关键词…"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-24 text-sm shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="button"
            onClick={commit}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-4 py-1.5 text-sm font-medium text-white transition"
            style={{ backgroundColor: "var(--brand)" }}
          >
            搜索
          </button>
        </div>

        {/* Tabs */}
        {committed && (
          <div className="mb-4 flex gap-1 border-b border-slate-200">
            {(["inbox", "signals"] as Tab[]).map((t) => {
              const label = t === "inbox" ? "收件箱" : "信号雷达";
              const count = t === "inbox" ? inboxTotal : signalTotal;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setPage(1); }}
                  className={`pb-2.5 px-3 text-sm font-medium transition border-b-2 ${tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                  style={tab === t ? { borderColor: "var(--brand)", color: "var(--brand)" } : undefined}
                >
                  {label}
                  {committed && !loading && (
                    <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Results */}
        {!committed ? (
          <div className="mt-16 text-center text-sm text-slate-400">
            <Search className="mx-auto mb-3 h-8 w-8 text-slate-300" aria-hidden />
            <p>输入关键词后按 Enter 或点击「搜索」</p>
            <p className="mt-1 text-xs">支持标题、摘要、机构名称搜索</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/inbox" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 hover:bg-slate-50">→ 收件箱</Link>
              <Link href="/signals" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 hover:bg-slate-50">→ 信号雷达</Link>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" aria-hidden /> 搜索中…
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 text-center text-sm text-slate-400">
            <CircleHelp className="mx-auto mb-2 h-7 w-7 text-slate-300" aria-hidden />
            <p>未找到与「{committed}」相关的内容</p>
            <p className="mt-1 text-xs">尝试更换关键词或切换标签页</p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              共 {total} 条结果，显示第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} 条
            </p>
            <div className="space-y-3">
              {items.map((item) => (
                <ItemCard key={`${item.sourceId}__${item.url}`} item={item} q={committed} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2 text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  ← 上页
                </button>
                <span className="text-slate-500">{page} / {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  下页 →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
