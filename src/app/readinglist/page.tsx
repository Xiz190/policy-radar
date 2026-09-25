"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import {
  ClipboardList,
} from "lucide-react";

type ReadingItem = {
  key: string;
  sourceId: string;
  url: string;
  title?: string;
  sourceName?: string;
  listPublishedAt?: string;
};

export default function ReadingListPage() {
  const [keys, setKeys] = useState<string[]>([]);
  const [items, setItems] = useState<ReadingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("inbox_reading_list");
      const parsed: string[] = raw ? JSON.parse(raw) : [];
      setKeys(parsed);
      // Try to fetch details for each key (sourceId__url format)
      const parsed_items: ReadingItem[] = parsed.map((k) => {
        const idx = k.indexOf("__");
        const sourceId = idx >= 0 ? k.slice(0, idx) : k;
        const url = idx >= 0 ? k.slice(idx + 2) : k;
        return { key: k, sourceId, url };
      });
      setItems(parsed_items);
    } catch {}
    setLoading(false);
  }, []);

  // Fetch titles lazily from API
  useEffect(() => {
    if (items.length === 0) return;
    const unresolved = items.filter((i) => !i.title);
    if (unresolved.length === 0) return;

    async function fetchDetails() {
      const updated = [...items];
      for (const item of unresolved) {
        try {
          const res = await fetch(
            `/api/monitor/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`,
            { cache: "no-store" }
          );
          if (!res.ok) continue;
          const json = await res.json() as { title?: string; sourceName?: string; listPublishedAt?: string };
          const idx = updated.findIndex((u) => u.key === item.key);
          if (idx >= 0) updated[idx] = { ...updated[idx], title: json.title, sourceName: json.sourceName, listPublishedAt: json.listPublishedAt };
        } catch {}
      }
      setItems([...updated]);
    }
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  function remove(key: string) {
    const next = keys.filter((k) => k !== key);
    setKeys(next);
    setItems((prev) => prev.filter((i) => i.key !== key));
    try { localStorage.setItem("inbox_reading_list", JSON.stringify(next)); } catch {}
  }

  function clearAll() {
    setKeys([]);
    setItems([]);
    try { localStorage.removeItem("inbox_reading_list"); } catch {}
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link href="/inbox" className="hover:text-slate-800">收件箱</Link>
              <span>/</span>
              <span>稍后读</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">稍后读清单</h1>
            <p className="mt-1 text-sm text-slate-500">{items.length} 条待读内容 · 仅本地保存</p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-500 transition hover:bg-rose-50"
            >
              清空全部
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
                <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-16 text-center">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-300" aria-hidden />
            <p className="text-sm text-slate-500">清单为空</p>
            <p className="mt-1 text-xs text-slate-400">在收件箱展开条目后点击「稍后读」添加</p>
            <Link
              href="/inbox"
              className="mt-4 inline-block rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--brand)" }}
            >
              去收件箱
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.key}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm font-medium text-slate-900 hover:underline line-clamp-2"
                  >
                    {item.title ?? item.url}
                  </a>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                    {item.sourceName && <span>{item.sourceName}</span>}
                    {item.listPublishedAt && (
                      <span>· {new Date(item.listPublishedAt).toLocaleDateString("zh-CN")}</span>
                    )}
                    {!item.title && <span className="text-slate-300">加载中…</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.key)}
                  className="shrink-0 rounded-full p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
                  title="从清单移除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
