"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * 「加备注」底部 sheet（mockup 的 Detail · save + note 屏：
 * 把手 / Add note / 条目引用卡 / 输入框 / Cancel + Save note）。
 *
 * ⚠️ z-index 必须高于底部 tab bar（z-40）——它和筛选 sheet 一样是覆盖层。
 * 曾经用 z-[31] 被 tab bar 的 z-40 压住，按钮明明渲染了却看不见。
 * 所以这里同样用 遮罩 z-50 / sheet z-[51]。
 */
export function NoteSheet({
  open,
  title,
  sourceAbbr,
  initialNote,
  onSave,
  onClose,
}: {
  open: boolean;
  /** 被备注条目的标题（引用卡里显示） */
  title: string;
  /** 来源缩写（引用卡左侧方块） */
  sourceAbbr: string;
  initialNote: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const t = useT("zh");
  const [draft, setDraft] = useState(initialNote);

  // 每次打开都以当前备注为草稿起点（取消后不留残影）；渲染中对比上一次的 open，不放进 effect
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(initialNote);
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.42)]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initialNote ? t("companion.note.edit") : t("companion.note.add")}
        className="fixed bottom-0 left-1/2 z-[51] max-h-[88vh] w-full max-w-[480px] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-t-[24px] bg-white px-5 pb-[26px] pt-2 shadow-[0_-14px_44px_-14px_rgba(15,23,42,0.35)]"
      >
        <div className="mx-auto mb-[14px] mt-[6px] h-1 w-[38px] rounded-[3px] bg-slate-200" />

        <div className="mb-4">
          <h3 className="font-serif text-[21px] font-medium text-slate-900">
            {initialNote ? t("companion.note.edit") : t("companion.note.add")}
          </h3>
        </div>

        {/* 引用卡：让你确认在给哪一条写备注 */}
        <div className="mb-[14px] flex items-center gap-[9px] rounded-[11px] border border-slate-200 bg-slate-50 px-[11px] py-[10px]">
          <span className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[8px] bg-slate-200 text-[10px] font-bold tracking-[0.02em] text-slate-600">
            {sourceAbbr}
          </span>
          <span className="line-clamp-2 text-[13px] font-semibold leading-[1.3] text-slate-900">
            {title}
          </span>
        </div>

        <textarea
          autoFocus
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("companion.note.placeholder")}
          className="w-full resize-none rounded-[12px] border border-slate-200 p-3 text-[13.5px] leading-[1.5] text-slate-900 outline-none"
        />

        <div className="mt-4 flex gap-[10px]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[12px] border border-slate-200 bg-white py-[13px] text-center text-[13.5px] font-semibold text-slate-700"
          >
            {t("companion.note.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex-1 rounded-[12px] bg-[var(--brand)] py-[13px] text-center text-[13.5px] font-semibold text-white"
          >
            {t("companion.note.save")}
          </button>
        </div>
      </div>
    </>
  );
}

/** mockup 里备注块左侧的小铅笔。被 Saved 屏与详情页共用。 */
export function NoteMark() {
  return <Pencil className="h-[13px] w-[13px]" aria-hidden />;
}
