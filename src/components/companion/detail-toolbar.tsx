"use client";

import { useEffect, useState } from "react";
import { Check, Flag, Pencil, Star } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  FOLLOW_UP_STATUS_LABELS,
  getFollowUpStatus,
  getNote,
  setFollowUpStatus,
  setNote,
  type FollowUpStatus,
} from "@/lib/personal-research";
import { NoteSheet } from "@/components/companion/note-sheet";
import { FollowUpSheet } from "@/components/companion/follow-up-sheet";
import { COMPANION_RESEARCH_EVENT } from "@/lib/companion/research";

/**
 * 详情页底部工具栏 + 备注 / 待跟进 sheet。
 *
 * 政策雷达的保存概念是「收藏（数据库）+ 待跟进（本地）」，与桌面端一致；
 * 不照搬创作者雷达的"发到桌面"（政策雷达没有 handoff 接口，点下去没反应比没有更糟）。
 *
 * 备注与跟进状态走 localStorage（个人研究库），和桌面端是同一份数据。
 */
export function DetailToolbar({
  sourceId,
  url,
  title,
  sourceAbbrText,
  initialStarred,
  initialRead,
}: {
  sourceId: string;
  url: string;
  title: string;
  sourceAbbrText: string;
  initialStarred: boolean;
  initialRead: boolean;
}) {
  const t = useT("zh");
  const [starred, setStarred] = useState(initialStarred);
  const [read, setRead] = useState(initialRead);
  const [noteOpen, setNoteOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [status, setStatus] = useState<FollowUpStatus>("none");

  // 挂载后读本地研究数据，让「待跟进 / 备注」按钮如实显示是否已有内容
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后才能读浏览器数据（localStorage），服务端读不到
    setNoteDraft(getNote(sourceId, url));
    setStatus(getFollowUpStatus(sourceId, url));
  }, [sourceId, url]);

  // 乐观更新 + 失败回滚。桌面站的收件箱有同样的做法，这里保持一致。
  async function patch(body: Record<string, unknown>, rollback: () => void) {
    try {
      const res = await fetch(`/api/monitor/items/${encodeURIComponent(sourceId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, ...body }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "failed");
      return true;
    } catch {
      rollback();
      return false;
    }
  }

  function openNote() {
    // 打开时才读本地数据：服务端渲染时读不到 localStorage
    setNoteDraft(getNote(sourceId, url));
    setNoteOpen(true);
  }

  function openFollow() {
    setStatus(getFollowUpStatus(sourceId, url));
    setFollowOpen(true);
  }

  const btn = "flex flex-1 flex-col items-center gap-1 text-[11px] font-semibold";

  return (
    <>
      <div className="hide-when-zoomed fixed bottom-0 left-1/2 z-40 flex h-[78px] w-full max-w-[480px] -translate-x-1/2 gap-1 border-t border-slate-200 bg-slate-50/94 px-2.5 pb-[24px] pt-2.5 backdrop-blur-md">
        <button data-owner-only
          type="button"
          aria-pressed={starred}
          onClick={() => {
            const next = !starred;
            setStarred(next);
            void patch({ isStarred: next }, () => setStarred(!next));
          }}
          className={`${btn} ${starred ? "text-[var(--brand)]" : "text-slate-700"}`}
        >
          <Star className="h-5 w-5" fill={starred ? "currentColor" : "none"} aria-hidden />
          {starred ? t("companion.detail.saved") : t("companion.detail.save")}
        </button>

        <button data-owner-only
          type="button"
          aria-pressed={read}
          onClick={() => {
            const next = !read;
            setRead(next);
            void patch({ isRead: next }, () => setRead(!next));
          }}
          className={`${btn} ${read ? "text-[var(--brand)]" : "text-slate-700"}`}
        >
          <Check className="h-5 w-5" aria-hidden />
          {read ? t("companion.detail.markUnread") : t("companion.detail.markRead")}
        </button>

        <button data-owner-only
          type="button"
          onClick={openFollow}
          className={`${btn} ${status !== "none" ? "text-[var(--brand)]" : "text-slate-700"}`}
        >
          <Flag className="h-5 w-5" fill={status !== "none" ? "currentColor" : "none"} aria-hidden />
          {status !== "none" ? FOLLOW_UP_STATUS_LABELS[status] : "待跟进"}
        </button>

        <button data-owner-only
          type="button"
          onClick={openNote}
          className={`${btn} ${noteDraft.trim() ? "text-[var(--brand)]" : "text-slate-700"}`}
        >
          <Pencil className="h-5 w-5" aria-hidden />
          {t("companion.note.add")}
        </button>
      </div>

      <NoteSheet
        open={noteOpen}
        title={title}
        sourceAbbr={sourceAbbrText}
        initialNote={noteDraft}
        onSave={(note) => {
          setNoteOpen(false);
          setNote(sourceId, url, title, note.trim());
          setNoteDraft(note.trim());
          window.dispatchEvent(new Event(COMPANION_RESEARCH_EVENT));
        }}
        onClose={() => setNoteOpen(false)}
      />

      <FollowUpSheet
        open={followOpen}
        title={title}
        sourceAbbr={sourceAbbrText}
        current={status}
        onPick={(next) => {
          setFollowOpen(false);
          setStatus(next);
          setFollowUpStatus(sourceId, url, title, next);
          window.dispatchEvent(new Event(COMPANION_RESEARCH_EVENT));
        }}
        onClose={() => setFollowOpen(false)}
      />
    </>
  );
}
