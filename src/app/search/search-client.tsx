"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePrefs } from "@/contexts/prefs-context";
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

type Tab = "content" | "inbox" | "signals";

type ContentHit = {
  sourceId: string;
  url: string;
  title: string;
  departmentName?: string;
  channelName?: string;
  listPublishedAt?: string;
  matchedQueryTerms?: string[];
  hitParagraphs?: Array<{ idx: number; snippet: string }>;
};

const PAGE_SIZE = 15;
const CONTENT_LIMIT = 20;

function detailHref(sourceId: string, url: string) {
  return `/items/${encodeURIComponent(sourceId)}?sourceId=${encodeURIComponent(sourceId)}&url=${encodeURIComponent(url)}`;
}

function highlight(text: string, q: string): string {
  if (!q.trim()) return text;
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark class=\"bg-amber-100 rounded px-0.5\">$1</mark>");
}

function ItemCard({ item, q }: { item: SearchItem; q: string }) {
  const en = usePrefs().language === "en";
  const pub = item.listPublishedAt ? new Date(item.listPublishedAt).toLocaleDateString(en ? "en-US" : "zh-CN") : "";
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <p
        className="text-sm font-medium leading-snug text-slate-900 line-clamp-2"
        dangerouslySetInnerHTML={{ __html: highlight(item.title || (en ? "(untitled)" : "（无标题）"), q) }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {item.sourceName && <span>{item.sourceName}</span>}
        {item.channelName && <span>· {item.channelName}</span>}
        {pub && <span>· {pub}</span>}
        {item.importanceLevel != null && item.importanceLevel >= 4 && (
          <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-600">{en ? "High priority" : "高优先"}</span>
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

function ContentCard({ item, q }: { item: ContentHit; q: string }) {
  const en = usePrefs().language === "en";
  const pub = item.listPublishedAt ? new Date(item.listPublishedAt).toLocaleDateString(en ? "en-US" : "zh-CN") : "";
  return (
    <Link
      href={detailHref(item.sourceId, item.url)}
      className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <p
        className="text-sm font-medium leading-snug text-slate-900 line-clamp-2"
        dangerouslySetInnerHTML={{ __html: highlight(item.title || (en ? "(untitled)" : "（无标题）"), q) }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {item.departmentName && <span>{item.departmentName}</span>}
        {item.channelName && item.channelName !== item.departmentName && <span>· {item.channelName}</span>}
        {pub && <span>· {pub}</span>}
      </div>
      {/* 命中的正文段落 —— 这是「站内正文检索」相对标题搜索的核心价值 */}
      {item.hitParagraphs && item.hitParagraphs.length > 0 && (
        <div className="mt-3 space-y-1.5 border-l-2 border-slate-200 pl-3">
          {item.hitParagraphs.map((p) => (
            <p
              key={p.idx}
              className="text-[12px] leading-relaxed text-slate-600 line-clamp-2"
              dangerouslySetInnerHTML={{ __html: highlight(p.snippet, q) }}
            />
          ))}
        </div>
      )}
    </Link>
  );
}

// 初始关键词由服务端页面（page.tsx）从网址读出后传入；之后的变化由本组件自己写回网址
export function SearchClient({ initialQ }: { initialQ: string }) {
  const en = usePrefs().language === "en";

  const [q, setQ] = useState(initialQ);
  const [committed, setCommitted] = useState(initialQ);
  const [tab, setTab] = useState<Tab>("content");
  const [inboxItems, setInboxItems] = useState<SearchItem[]>([]);
  const [signalItems, setSignalItems] = useState<SearchItem[]>([]);
  const [contentItems, setContentItems] = useState<ContentHit[]>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [signalTotal, setSignalTotal] = useState(0);
  const [contentTotal, setContentTotal] = useState(0);
  // 带着 ?q= 进来时首屏就是「搜索中」，别先闪一下「未找到」
  const [loading, setLoading] = useState(() => initialQ.trim() !== "");
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (query: string, currentPage: number, currentTab: Tab) => {
    if (!query.trim()) {
      setInboxItems([]);
      setSignalItems([]);
      setContentItems([]);
      setInboxTotal(0);
      setSignalTotal(0);
      setContentTotal(0);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    try {
      if (currentTab === "content") {
        const res = await fetch(`/api/chat/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim(), topItems: CONTENT_LIMIT }),
          signal: ctrl.signal,
          cache: "no-store",
        });
        const json = (await res.json()) as { ok?: boolean; items?: ContentHit[]; total?: number };
        if (!ctrl.signal.aborted) {
          setContentItems(json.ok && json.items ? json.items : []);
          setContentTotal(json.total ?? (json.items?.length ?? 0));
        }
        return;
      }

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

  // 三个标签页的数量一起查（每个只取 1 条），否则没点开的标签页一直显示初始值 0，
  // 看起来像「动态资讯里没有相关内容」。完整结果仍在切到该标签页时再加载。
  useEffect(() => {
    const query = committed.trim();
    if (!query) return;
    const ctrl = new AbortController();
    const one = new URLSearchParams({ view: "list", q: query, limit: "1", offset: "0" });
    const sig = new URLSearchParams(one);
    sig.set("categories", [...SIGNAL_CATEGORIES].join(","));
    const count = (url: string) =>
      fetch(url, { signal: ctrl.signal, cache: "no-store" })
        .then((r) => r.json() as Promise<{ totalCount?: number }>)
        .then((j) => j.totalCount ?? 0);
    Promise.all([
      count(`/api/monitor/items?${one}`),
      count(`/api/monitor/items?${sig}`),
      fetch(`/api/chat/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, topItems: 1 }),
        signal: ctrl.signal,
        cache: "no-store",
      })
        .then((r) => r.json() as Promise<{ total?: number; items?: unknown[] }>)
        .then((j) => j.total ?? j.items?.length ?? 0),
    ])
      .then(([inbox, signals, content]) => {
        setInboxTotal(inbox);
        setSignalTotal(signals);
        setContentTotal(content);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [committed]);

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
  const total = tab === "content" ? contentTotal : tab === "inbox" ? inboxTotal : signalTotal;
  const totalPages = tab === "content" ? 1 : Math.ceil(total / PAGE_SIZE);
  const resultCount = tab === "content" ? contentItems.length : items.length;

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
            placeholder={tab === "content" ? "搜正文，如「人工智能 专项资金」「数据要素」…" : "搜索标题、摘要、关键词…"}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-24 text-sm shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="button"
            onClick={commit}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-4 py-1.5 text-sm font-medium text-white transition"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {en ? "Search" : "搜索"}
          </button>
        </div>

        {/* Tabs */}
        {committed && (
          <div className="mb-4 flex gap-1 border-b border-slate-200">
            {(["content", "inbox", "signals"] as Tab[]).map((t) => {
              const label = t === "content"
                ? (en ? "Full text" : "正文检索")
                : t === "inbox"
                  ? (en ? "News Feed" : "动态资讯")
                  : (en ? "Signals" : "信号雷达");
              const count = t === "content" ? contentTotal : t === "inbox" ? inboxTotal : signalTotal;
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
            <p>{en ? "Type a keyword and press Enter or click Search" : "输入关键词后按 Enter 或点击「搜索」"}</p>
            <p className="mt-1 text-xs">{en ? "Full text searches article bodies and highlights the matching paragraphs; the other tabs search titles and summaries" : "「正文检索」直接搜文章正文并高亮命中段落；也可按标题/摘要搜"}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/inbox" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 hover:bg-slate-50">{en ? "→ News Feed" : "→ 动态资讯"}</Link>
              <Link href="/signals" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 hover:bg-slate-50">{en ? "→ Signals" : "→ 信号雷达"}</Link>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" aria-hidden /> {en ? "Searching…" : "搜索中…"}
          </div>
        ) : resultCount === 0 ? (
          <div className="mt-10 text-center text-sm text-slate-400">
            <CircleHelp className="mx-auto mb-2 h-7 w-7 text-slate-300" aria-hidden />
            <p>{en ? `Nothing found for "${committed}"` : `未找到与「${committed}」相关的内容`}</p>
            <p className="mt-1 text-xs">
              {tab === "content" ? "正文检索更适合具体的政策主题词，试试换更短的关键词或切换标签页" : "尝试更换关键词或切换标签页"}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              {tab === "content"
                ? (en
                    ? `${total} articles match; showing the top ${Math.min(contentItems.length, CONTENT_LIMIT)}`
                    : `匹配到 ${total} 篇正文，显示最相关 ${Math.min(contentItems.length, CONTENT_LIMIT)} 篇`)
                : (en
                    ? `${total} results, showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}`
                    : `共 ${total} 条结果，显示第 ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} 条`)}
            </p>
            <div className="space-y-3">
              {tab === "content"
                ? contentItems.map((item) => (
                    <ContentCard key={`${item.sourceId}__${item.url}`} item={item} q={committed} />
                  ))
                : items.map((item) => (
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
                  {en ? "← Prev" : "← 上页"}
                </button>
                <span className="text-slate-500">{page} / {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  {en ? "Next →" : "下页 →"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
