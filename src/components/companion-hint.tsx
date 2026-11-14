"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { usePrefs } from "@/contexts/prefs-context";
import { isCompanionPath } from "@/lib/companion/nav";

const DISMISS_KEY = "companion-hint-dismissed-v1";

/**
 * 手机打开桌面站时，提示有专为手机设计的伴侣版（/m）。不强制跳转：两边都能用，用户自己选。
 * 关掉后这台设备不再出现。桌面宽度、伴侣版内部、专注模式下都不显示。
 *
 * 政策雷达固定中文，所以文案直接写死，不走 i18n。
 */
export function CompanionHint() {
  const pathname = usePathname();
  const { focusMode } = usePrefs();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后才能读浏览器数据（本地存储/窗口/当前时间），服务端读不到；放进渲染会造成水合不一致
    if (isCompanionPath(pathname)) return setShow(false);
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    setShow(!dismissed && window.matchMedia("(max-width: 639px)").matches);
  }, [pathname]);

  if (!show || focusMode) return null;

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--brand-border)] bg-[var(--brand-tint)] px-4 py-2 text-xs text-slate-700 sm:hidden">
      <span>手机上更顺手：试试专为手机设计的伴侣版</span>
      <span className="flex shrink-0 items-center gap-1">
        <Link href="/m" className="rounded-full bg-[var(--brand)] px-3 py-1 font-medium text-white">
          打开
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="关闭提示"
          className="flex h-8 w-8 items-center justify-center text-slate-500"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </span>
    </div>
  );
}
