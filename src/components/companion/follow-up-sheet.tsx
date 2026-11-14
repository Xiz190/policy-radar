"use client";

import { useT } from "@/lib/i18n";
import {
  FOLLOW_UP_STATUS_OPTIONS,
  type FollowUpStatus,
} from "@/lib/personal-research";

/**
 * 「待跟进」底部 sheet：政策雷达的保存概念是 收藏（数据库）+ 待跟进（本地）。
 * 伴侣版沿用同一套状态，避免手机上出现桌面没有的第五种状态。
 *
 * 状态存在浏览器本地，与桌面端的跟进下拉是同一份数据（同一个 localStorage 键）。
 *
 * ⚠️ z-index 与 note-sheet 一致：遮罩 z-50 / sheet z-[51]，压在 tab bar（z-40）之上。
 */
export function FollowUpSheet({
  open,
  title,
  sourceAbbr,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  sourceAbbr: string;
  current: FollowUpStatus;
  onPick: (status: FollowUpStatus) => void;
  onClose: () => void;
}) {
  const t = useT("zh");
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.42)]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="设置跟进状态"
        className="fixed bottom-0 left-1/2 z-[51] max-h-[88vh] w-full max-w-[480px] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-t-[24px] bg-white px-5 pb-[26px] pt-2 shadow-[0_-14px_44px_-14px_rgba(15,23,42,0.35)]"
      >
        <div className="mx-auto mb-[14px] mt-[6px] h-1 w-[38px] rounded-[3px] bg-slate-200" />

        <h3 className="mb-4 font-serif text-[21px] font-medium text-slate-900">待跟进</h3>

        <div className="mb-[14px] flex items-center gap-[9px] rounded-[11px] border border-slate-200 bg-slate-50 px-[11px] py-[10px]">
          <span className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[8px] bg-slate-200 text-[10px] font-bold tracking-[0.02em] text-slate-600">
            {sourceAbbr}
          </span>
          <span className="line-clamp-2 text-[13px] font-semibold leading-[1.3] text-slate-900">
            {title}
          </span>
        </div>

        <div className="divide-y divide-slate-100 rounded-[12px] border border-slate-200">
          {FOLLOW_UP_STATUS_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const on = opt.value === current;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPick(opt.value)}
                className={`flex w-full items-center gap-3 px-4 py-[13px] text-left ${
                  on ? "bg-[var(--brand-tint)]" : "bg-white"
                }`}
              >
                <Icon
                  className={`h-[17px] w-[17px] flex-none ${
                    on ? "text-[var(--brand)]" : "text-slate-400"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[13.5px] font-semibold ${
                      on ? "text-[var(--brand-ink)]" : "text-slate-800"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-slate-500">{opt.desc}</span>
                </span>
                {on ? <span className="text-[11px] font-semibold text-[var(--brand)]">当前</span> : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-[12px] border border-slate-200 bg-white py-[13px] text-center text-[13.5px] font-semibold text-slate-700"
        >
          {t("companion.note.cancel")}
        </button>
      </div>
    </>
  );
}
