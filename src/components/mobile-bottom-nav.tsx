"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrefs } from "@/contexts/prefs-context";
import { useT, type TranslationKey } from "@/lib/i18n";
import {
  House, Inbox, RadioTower, Settings,
} from "lucide-react";

const TABS: { href: string; labelKey: TranslationKey; icon: typeof House }[] = [
  { href: "/", labelKey: "nav.tab.workspace", icon: House },
  { href: "/inbox", labelKey: "nav.tab.inbox", icon: Inbox },
  { href: "/signals", labelKey: "nav.tab.signals", icon: RadioTower },
  { href: "/monitor", labelKey: "nav.tab.monitor", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { focusMode, language } = usePrefs();
  const t = useT(language);
  if (focusMode) return null;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-sm sm:hidden">
      <div className="grid grid-cols-4 safe-area-inset-bottom">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-col items-center gap-0.5 px-1 py-2 text-center transition-colors ${
                active ? "text-violet-700" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {active && (
                <span className="absolute top-0 inset-x-4 h-0.5 rounded-full" style={{ backgroundColor: "var(--brand)" }} />
              )}
              <tab.icon className="h-5 w-5" aria-hidden />
              <span className={`text-[10px] font-medium leading-tight ${active ? "text-violet-700" : "text-slate-500"}`}>
                {t(tab.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
