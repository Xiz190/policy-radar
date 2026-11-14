"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Home, Layers } from "lucide-react";
import { useT } from "@/lib/i18n";
import { COMPANION_TABS, activeTab, type CompanionTabKey } from "@/lib/companion/nav";

const ICONS: Record<CompanionTabKey, typeof Home> = {
  today: Home,
  feed: Layers,
  saved: Bookmark,
};

export function CompanionTabBar() {
  const pathname = usePathname();
  // 政策雷达固定中文（与桌面站一致），伴侣版也用中文。
  const t = useT("zh");

  const current = activeTab(pathname);
  // 详情页有自己底部的 toolbar，不显示 tab bar（见 mockup 的 Detail 屏）
  if (current === null) return null;

  return (
    <nav
      // 固定定位会逃出 layout 的 max-w-[480px]，所以这里自己居中收窄，
      // 桌面浏览器上才不会横跨整屏（见 m/layout.tsx 里的说明）
      className="hide-when-zoomed fixed bottom-0 left-1/2 z-40 flex h-[82px] w-full max-w-[480px] -translate-x-1/2 border-t border-slate-200 bg-slate-50/92 px-2 pb-[22px] pt-2 backdrop-blur-md"
      aria-label={t("companion.brand")}
    >
      {COMPANION_TABS.map((tab) => {
        const Icon = ICONS[tab.key];
        const on = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-[3px] ${
              on ? "text-[var(--brand)]" : "text-slate-500"
            }`}
          >
            <Icon className="h-[21px] w-[21px]" strokeWidth={on ? 2.1 : 1.7} aria-hidden />
            <span className="text-[10.5px] font-semibold">{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
