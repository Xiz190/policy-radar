"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LOCAL_DATA_NOTICE,
  getLocalDataNoticeDismissed,
  setLocalDataNoticeDismissed,
  type LocalDataNoticeVariant,
} from "@/lib/local-data-notice";
import type { LucideIcon } from "lucide-react";
import {
  Package, Save,
} from "lucide-react";

export interface LocalDataNoticeProps {
  variant: LocalDataNoticeVariant;
  dismissible?: boolean;
  showPrimaryAction?: boolean;
  showSecondaryAction?: boolean;
  showGuideEntry?: boolean;
  autoDismissState?: boolean;
  onDismiss?: () => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onShowGuide?: () => void;
  className?: string;
  customText?: string;
  secondaryActionHref?: string;
}

const variantStyles: Record<
  LocalDataNoticeVariant,
  {
    wrapper: string;
    icon: string;
    title: string;
    desc: string;
    closeBtn: string;
    primaryBtn: string;
    secondaryBtn: string;
    scopeTitle: string;
    scopeItem: string;
  }
> = {
  banner: {
    wrapper:
      "flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4",
    icon: "text-lg shrink-0",
    title: "text-sm font-medium text-amber-900",
    desc: "mt-0.5 text-xs text-amber-700",
    closeBtn:
      "shrink-0 text-amber-600 hover:text-amber-800 transition text-sm",
    primaryBtn:
      "inline-flex items-center rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-700",
    secondaryBtn:
      "inline-flex items-center text-xs font-medium text-amber-700 hover:text-amber-800 transition",
    scopeTitle: "",
    scopeItem: "",
  },
  footer: {
    wrapper:
      "flex items-center justify-center gap-2 py-3 text-center",
    icon: "text-xs",
    title: "text-[11px] font-medium text-slate-500",
    desc: "text-[11px] text-slate-400",
    closeBtn: "text-slate-400 hover:text-slate-600 transition text-xs",
    primaryBtn: "",
    secondaryBtn:
      "inline-flex items-center text-[11px] text-slate-500 hover:text-slate-700 transition underline underline-offset-2",
    scopeTitle: "",
    scopeItem: "",
  },
  card: {
    wrapper:
      "rounded-2xl border border-slate-200 bg-white p-6 shadow-lg",
    icon: "text-3xl",
    title: "mt-3 text-base font-semibold text-slate-900",
    desc: "mt-2 text-sm text-slate-600",
    closeBtn:
      "shrink-0 text-slate-400 hover:text-slate-600 transition text-sm",
    primaryBtn:
      "inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800",
    secondaryBtn:
      "inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50",
    scopeTitle: "mt-4 text-xs font-medium text-slate-700",
    scopeItem:
      "flex items-center gap-2 text-xs text-slate-600",
  },
};

export function LocalDataNotice({
  variant,
  dismissible = true,
  showPrimaryAction = true,
  showSecondaryAction = false,
  showGuideEntry = false,
  autoDismissState = false,
  onDismiss,
  onPrimaryAction,
  onSecondaryAction,
  onShowGuide,
  className = "",
  customText,
  secondaryActionHref,
}: LocalDataNoticeProps) {
  const initiallyVisible = useMemo(() => {
    if (autoDismissState && getLocalDataNoticeDismissed()) {
      return false;
    }
    return true;
  }, [autoDismissState]);

  const [visible, setVisible] = useState(initiallyVisible);
  const styles = variantStyles[variant];
  // 大写：小写 icon 在 JSX 里会被当成 HTML 标签
  const Icon = LOCAL_DATA_NOTICE.icon[variant];

  const handleDismiss = () => {
    if (autoDismissState) {
      setLocalDataNoticeDismissed();
    }
    setVisible(false);
    onDismiss?.();
  };

  const handlePrimary = () => {
    if (autoDismissState) {
      setLocalDataNoticeDismissed();
    }
    setVisible(false);
    onPrimaryAction?.();
  };

  if (!visible) {
    if (showGuideEntry && variant === "banner") {
      return (
        <div className={`flex items-center justify-center gap-2 py-2 ${className}`}>
          <button
            type="button"
            onClick={onShowGuide}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition"
          >
            <Save className="h-3.5 w-3.5" aria-hidden />
            <span>{LOCAL_DATA_NOTICE.showGuideLabel}</span>
          </button>
        </div>
      );
    }
    return null;
  }

  if (variant === "banner") {
    return (
      <div className={`${styles.wrapper} ${className}`} role="status">
        <div className={styles.icon}><Icon className="h-5 w-5" aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <div className={styles.title}>{LOCAL_DATA_NOTICE.title}</div>
          <div className={styles.desc}>{LOCAL_DATA_NOTICE.description}</div>
          <div className="mt-3 flex items-center gap-3">
            {showPrimaryAction && (
              <button
                type="button"
                onClick={handlePrimary}
                className={styles.primaryBtn}
              >
                {LOCAL_DATA_NOTICE.primaryActionText}
              </button>
            )}
            {showSecondaryAction && (
              <button
                type="button"
                onClick={onSecondaryAction}
                className={styles.secondaryBtn}
              >
                {LOCAL_DATA_NOTICE.secondaryActionText} →
              </button>
            )}
          </div>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className={styles.closeBtn}
            aria-label={LOCAL_DATA_NOTICE.dismissLabel}
          >
            {LOCAL_DATA_NOTICE.dismissLabel}
          </button>
        )}
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <div className={`${styles.wrapper} ${className}`} role="status">
        <span className={styles.icon}><Icon className="h-5 w-5" aria-hidden /></span>
        <span className={styles.desc}>
          {customText || LOCAL_DATA_NOTICE.title}，
          {showSecondaryAction && (
            secondaryActionHref ? (
              <a
                href={secondaryActionHref}
                className={`ml-1 ${styles.secondaryBtn}`}
              >
                {LOCAL_DATA_NOTICE.secondaryActionText}
              </a>
            ) : (
              <button
                type="button"
                onClick={onSecondaryAction}
                className={`ml-1 ${styles.secondaryBtn}`}
              >
                {LOCAL_DATA_NOTICE.secondaryActionText}
              </button>
            )
          )}
        </span>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className={`ml-2 ${styles.closeBtn}`}
            aria-label="关闭"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // card variant
  return (
    <div className={`${styles.wrapper} ${className}`} role="status">
      <div className="flex items-start justify-between">
        <div className={styles.icon}><Icon className="h-5 w-5" aria-hidden /></div>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            className={styles.closeBtn}
            aria-label="关闭"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.title}>{LOCAL_DATA_NOTICE.title}</div>
      <div className={styles.desc}>{LOCAL_DATA_NOTICE.description}</div>
      <div className={styles.scopeTitle}>{LOCAL_DATA_NOTICE.scopeLabel}</div>
      <ul className="mt-2 space-y-1.5">
        {LOCAL_DATA_NOTICE.scopeItems.map((item, idx) => (
          <li key={idx} className={styles.scopeItem}>
            <span className="text-slate-400">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center gap-3">
        {showPrimaryAction && (
          <button
            type="button"
            onClick={handlePrimary}
            className={styles.primaryBtn}
          >
            {LOCAL_DATA_NOTICE.primaryActionText}
          </button>
        )}
        {showSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className={styles.secondaryBtn}
          >
            {LOCAL_DATA_NOTICE.secondaryActionText}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 首次引导弹窗 - 仅在用户第一次进入产品时展示
// ============================================================================

export interface FirstTimeGuideModalProps {
  onClose?: () => void;
}

export function FirstTimeGuideModal({ onClose }: FirstTimeGuideModalProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem("guide_modal_seen");
      if (!seen) setVisible(true);
    } catch {}
  }, []);

  const handleClose = () => {
    try { localStorage.setItem("guide_modal_seen", "1"); } catch {}
    setVisible(false);
    onClose?.();
  };

  const handlePrimary = () => {
    try { localStorage.setItem("guide_modal_seen", "1"); } catch {}
    setVisible(false);
    onClose?.();
  };

  const handleSecondary = () => {
    try { localStorage.setItem("guide_modal_seen", "1"); } catch {}
    setVisible(false);
    router.push("/subscribe");
  };

  if (!visible) return null;

  const firstTime = LOCAL_DATA_NOTICE.firstTime;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-time-guide-title"
    >
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* 弹窗内容 */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-600"
          aria-label="关闭"
        >
          ×
        </button>

        {/* 头部 */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-3xl">
            <Package className="h-6 w-6 text-amber-600" aria-hidden />
          </div>
          <h2
            id="first-time-guide-title"
            className="mt-4 text-lg font-semibold text-slate-900"
          >
            {firstTime.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{firstTime.subtitle}</p>
        </div>

        {/* 要点列表 */}
        <ul className="mt-6 space-y-4">
          {firstTime.bullets.map((item, idx) => (
            <li key={idx} className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl">
                <item.icon className="h-5 w-5 text-slate-400" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">
                  {item.title}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {item.desc}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* 底部按钮 */}
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={handlePrimary}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {firstTime.primaryActionText}
          </button>
          <button
            type="button"
            onClick={handleSecondary}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {firstTime.secondaryActionText}
          </button>
        </div>
      </div>
    </div>
  );
}
