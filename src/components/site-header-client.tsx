"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNavigation } from "@/hooks/use-navigation";
import {
  getUnreadCount as getNotificationUnreadCount,
  checkNotifications,
} from "@/lib/notifications";
import { AccessibilityPanel } from "@/components/accessibility-panel";
import { usePrefs } from "@/contexts/prefs-context";
import { useT } from "@/lib/i18n";
import { CommandPalette } from "@/components/command-palette";
import { AboutModal } from "@/components/about-modal";
import { AppTour } from "@/components/app-tour";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { FloatingCommandButton } from "@/components/floating-command-button";
import {
  Bell, Info, Map, Settings,
} from "lucide-react";

export function SiteHeaderClient() {
  const { pathname, primaryNav, settingsMenu, isNavActive, isMenuDivider } = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const prefs = usePrefs();
  const T = useT(prefs.language);

  const router = useRouter();
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awaitingGSecond = useRef(false);
  const [gHintOpen, setGHintOpen] = useState(false);

  const openCmd = useCallback(() => setCmdOpen(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
        return;
      }
      if (e.key === "?" && !inInput) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      if (e.key === "f" && e.altKey) {
        e.preventDefault();
        prefs.setFocusMode(!prefs.focusMode);
        return;
      }
      // G+key global navigation: G then I/S/D/H/M within 1s
      if (!inInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (awaitingGSecond.current) {
          awaitingGSecond.current = false;
          setGHintOpen(false);
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          const gMap: Record<string, string> = { i: "/inbox", s: "/signals", d: "/dashboard", h: "/", m: "/monitor" };
          const dest = gMap[e.key.toLowerCase()];
          if (dest) { e.preventDefault(); router.push(dest); }
          return;
        }
        if (e.key === "g") {
          awaitingGSecond.current = true;
          setGHintOpen(true);
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          gTimerRef.current = setTimeout(() => {
            awaitingGSecond.current = false;
            setGHintOpen(false);
          }, 1500);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs, router]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setIsMounted(true);
      setUnreadNotifCount(getNotificationUnreadCount());
    });

    const abortController = new AbortController();
    async function checkNotifs() {
      try {
        await checkNotifications(abortController.signal);
        if (!abortController.signal.aborted) {
          setUnreadNotifCount(getNotificationUnreadCount());
        }
      } catch (e) {
        const err = e as Error;
        if (err.name === "AbortError" || err.message.includes("ERR_ABORTED")) {
          return;
        }
      }
    }

    const timer = setTimeout(checkNotifs, 1000);
    return () => {
      abortController.abort();
      clearTimeout(timer);
    };
  }, []);

  const handleMenuToggle = () => setMenuOpen(!menuOpen);
  const handleMenuClick = (_href: string) => setMenuOpen(false);
  const handleNavClick = () => {};
  const handleLogoClick = () => {};

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const siteTitle = T("site.title");

  if (prefs.focusMode) {
    return (
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-1.5 backdrop-blur">
        <Link href="/" prefetch={false} className="text-xs font-medium text-slate-500">
          <span style={{ color: "var(--brand)" }}>●</span> {siteTitle}
        </Link>
        <button
          type="button"
          onClick={() => prefs.setFocusMode(false)}
          title="退出专注模式 (Alt+F)"
          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
        >
          退出专注 ✕
        </button>
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
        <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-3 py-2 sm:px-6 sm:py-3 lg:flex-row lg:items-center lg:justify-between lg:py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            onClick={handleLogoClick}
            prefetch={false}
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 sm:text-lg"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs text-white sm:h-8 sm:w-8 sm:rounded-xl sm:text-sm" style={{ backgroundColor: "var(--brand)" }}>
              {prefs.language === "en" ? "MP" : "政"}
            </span>
            <span>{siteTitle}</span>
          </Link>
        </div>

        <div className="flex items-center justify-between gap-1.5 sm:gap-2 lg:gap-3">
          <nav className="-mx-3 flex items-center gap-0.5 overflow-x-auto px-3 pb-1 text-sm scrollbar-hide sm:-mx-6 sm:px-6 sm:gap-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:pb-0">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                prefetch={false}
                className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs transition sm:px-3 sm:py-1.5 sm:text-sm ${
                  isNavActive(item.href)
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="sm:hidden"><item.icon className="h-4 w-4" aria-hidden /></span>
                <span>{item.i18nKey ? T(item.i18nKey as never) : item.label}</span>
              </Link>
            ))}
          </nav>

          {/* ⌘K trigger */}
          <button
            type="button"
            onClick={openCmd}
            title="命令面板 (⌘K)"
            className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 transition hover:bg-slate-50 sm:flex"
          >
            <span>⌘K</span>
          </button>

          {/* About */}
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            title="关于本项目"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-500 transition hover:bg-slate-50"
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>

          {/* Accessibility panel */}
          <AccessibilityPanel />

          {/* Notifications */}
          <Link
            href="/notifications"
            prefetch={false}
            className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
            title={T("nav.notifications")}
          >
            <Bell className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{T("nav.notifications")}</span>
            {isMounted && unreadNotifCount > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white">
                {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
              </span>
            )}
          </Link>

          {/* Settings dropdown */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={handleMenuToggle}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 sm:px-3"
            >
              <Settings className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{T("nav.settings")}</span>
              <svg
                className={`h-3 w-3 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setTourOpen(true); }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Map className="h-4 w-4" aria-hidden />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-medium text-slate-900">功能导览</div>
                      <div className="text-xs text-slate-500">6 步了解核心功能</div>
                    </div>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  {settingsMenu.map((item, idx) => {
                    if (isMenuDivider(item)) {
                      return (
                        <div key={idx} className={idx > 0 ? "my-1 border-t border-slate-100" : ""}>
                          <div className="px-4 pt-2 pb-1">
                            <div className="text-xs font-medium text-slate-500">
                              {item.groupLabel || T("nav.settings")}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        onClick={() => handleMenuClick(item.href)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900">{item.label}</div>
                          <div className="truncate text-xs text-slate-500">{item.desc}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <AppTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <FloatingCommandButton onOpen={() => setCmdOpen(true)} />
      {gHintOpen && (
        <div className="fixed bottom-24 right-4 z-[100] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-slate-900/5 sm:bottom-8 sm:right-6">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">G → 导航</div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
            {[
              { key: "I", label: "收件箱" },
              { key: "S", label: "信号雷达" },
              { key: "D", label: "仪表盘" },
              { key: "H", label: "首页" },
              { key: "M", label: "监控" },
            ].map(({ key: k, label }) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">G+{k}</kbd>
                <span className="text-slate-700">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
