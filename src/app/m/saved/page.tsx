"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { ContentItem } from "@/hooks/use-item-list";
import { primaryCategory } from "@/lib/companion/feed";
import { shortAgo, sourceAbbr } from "@/lib/companion/format";
import { getNote, setNote } from "@/lib/personal-research";
import { CompanionHeader } from "@/components/companion/companion-header";
import { NoteMark, NoteSheet } from "@/components/companion/note-sheet";

const noteKey = (item: { sourceId: string; url: string }) => `${item.sourceId}::${item.url}`;

/**
 * 收藏屏。**这一屏的身份是「收藏 + 你自己写的话」**——
 * 没有备注时显示「加备注」按钮，不拿摘要顶替：摘要是系统生成的，
 * 跟"你自己写的"混在一起就分不清谁说的了。
 *
 * 政策雷达的备注存在浏览器 localStorage（个人研究库，和桌面端同一份），
 * 不走数据库——政策库没有 user_note 列，也不打算加。
 */
export default function CompanionSavedPage() {
  const t = useT("zh");

  const [items, setItems] = useState<ContentItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [editing, setEditing] = useState<ContentItem | null>(null);
  // 备注在浏览器里：拉回收藏列表后再逐条读（服务端读不到 localStorage）
  const [notes, setNotes] = useState<Record<string, string>>({});

  // 同 Feed：now 必须挂载后才算，否则"1天"这类相对时间会被烤进预渲染产物
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后才能读浏览器数据（本地存储/窗口/当前时间），服务端读不到；放进渲染会造成水合不一致
    setNow(new Date());
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/monitor/items?view=list&limit=100&onlyStarred=1&sort=published_at", {
      cache: "no-store",
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { items?: ContentItem[] }) => {
        setItems(d.items ?? []);
        setState("ready");
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setState("error");
      });
    return () => ac.abort();
  }, []);

  // 收藏列表到手后，一次读齐每条的本机备注
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const it of items) {
      const n = getNote(it.sourceId, it.url).trim();
      if (n) map[noteKey(it)] = n;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后才能读浏览器数据（localStorage），服务端读不到
    setNotes(map);
  }, [items]);

  function saveNote(item: ContentItem, note: string) {
    const trimmed = note.trim();
    setNote(item.sourceId, item.url, item.title, trimmed);
    setNotes((prev) => {
      const next = { ...prev };
      if (trimmed) next[noteKey(item)] = trimmed;
      else delete next[noteKey(item)];
      return next;
    });
    setEditing(null);
  }

  const withNoteCount = useMemo(() => Object.keys(notes).length, [notes]);

  return (
    <main>
      <CompanionHeader title={t("companion.tab.saved")} />

      <div className="px-5 pb-24 pt-1.5">
        {state === "loading" ? (
          <p className="pt-6 text-[13.5px] text-slate-500">{t("companion.loading")}</p>
        ) : state === "error" ? (
          <p className="pt-6 text-[13.5px] text-slate-500">{t("companion.error")}</p>
        ) : items.length === 0 ? (
          <p className="pt-6 text-[13.5px] text-slate-500">{t("companion.empty")}</p>
        ) : (
          <>
            <div className="mt-2 font-mono text-[12px] text-slate-500">
              {items.length} 条收藏 · {withNoteCount} 条有备注
            </div>

            {items.map((item) => {
              const note = notes[noteKey(item)] ?? "";
              const cat = primaryCategory(item);
              return (
                <article key={noteKey(item)} className="border-b border-slate-100 py-[19px]">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[11px] font-semibold tracking-[0.01em] text-slate-500">
                      {cat}
                    </span>
                  </div>

                  <Link
                    href={`/m/item/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                  >
                    <h2 className="text-[15.5px] font-semibold leading-[1.4] tracking-[-0.006em] text-slate-900">
                      {item.title}
                    </h2>
                  </Link>

                  {note ? (
                    <button
                      data-owner-only
                      type="button"
                      onClick={() => setEditing(item)}
                      className="mt-[11px] flex w-full gap-2 rounded-[11px] bg-slate-100 px-[11px] py-[9px] text-left"
                    >
                      <span className="mt-px flex-none text-slate-500">
                        <NoteMark />
                      </span>
                      <p className="text-[12.5px] leading-[1.46] text-slate-700">{note}</p>
                    </button>
                  ) : (
                    <button
                      data-owner-only
                      type="button"
                      onClick={() => setEditing(item)}
                      className="mt-[9px] -ml-1 inline-flex min-h-[44px] items-center gap-[5px] px-1 text-[12.5px] font-medium text-slate-500"
                    >
                      <Plus className="h-[13px] w-[13px]" aria-hidden />
                      {t("companion.note.add")}
                    </button>
                  )}

                  <div className="mt-[13px] flex items-center gap-[7px] text-[12px] text-slate-500">
                    <span className="font-semibold text-slate-700">{item.departmentName}</span>
                    <span className="h-[3px] w-[3px] flex-none rounded-full bg-slate-200" aria-hidden />
                    <time className="font-mono text-[11px]">
                      {now ? shortAgo(item.listPublishedAt, now) : ""}
                    </time>
                  </div>
                </article>
              );
            })}
          </>
        )}
      </div>

      <NoteSheet
        open={editing !== null}
        title={editing?.title ?? ""}
        sourceAbbr={sourceAbbr(editing?.departmentName)}
        initialNote={editing ? (notes[noteKey(editing)] ?? "") : ""}
        onSave={(note) => {
          if (editing) saveNote(editing, note);
        }}
        onClose={() => setEditing(null)}
      />
    </main>
  );
}
