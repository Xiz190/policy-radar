"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { WorkspaceTabs, WorkspaceFollowupBadge, WorkspaceNotificationCard } from "@/components/workspace-tabs";
import { FirstTimeGuideModal } from "@/components/local-data-notice";
import { HomeInsightCarousel } from "@/components/home-insight-carousel";
import { usePrefs } from "@/contexts/prefs-context";
import { useT, type TranslationKey } from "@/lib/i18n";
import {
  ClipboardList, RadioTower,
} from "lucide-react";

function getGreeting(): { key: TranslationKey } {
  const now = new Date();
  const hour = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    hour12: false,
  })
    .format(now)
    .replace(/[^0-9]/g, "");
  const h = parseInt(hour, 10);
  if (h < 6) return { key: "greeting.latenight" };
  if (h < 9) return { key: "greeting.earlymorning" };
  if (h < 12) return { key: "greeting.morning" };
  if (h < 14) return { key: "greeting.noon" };
  if (h < 18) return { key: "greeting.afternoon" };
  if (h < 22) return { key: "greeting.evening" };
  return { key: "greeting.latenight" };
}

function formatDate(date: Date, lang: "zh" | "en"): string {
  if (lang === "en") {
    return date.toLocaleDateString("en-US", {
      timeZone: "Asia/Shanghai",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  return `${year}年${month}月${day}日 ${weekday}`;
}

type FocusItem = {
  sourceId: string;
  departmentName: string;
  channelName: string;
  title: string;
  url: string;
  listPublishedAt: string;
  firstSeenAt?: string;
  importanceLevel: string;
  keywordScore: number;
  categories: Array<{ category: string; score: number; topKeywords?: string[] }>;
  hasFunding?: boolean;
  hasProcurement?: boolean;
  hasPilot?: boolean;
  hasStandards?: boolean;
  isStarred?: boolean;
};

type DailySummaryData = {
  dailySeries: Array<{ date: string; count: number }>;
  urgentCount: number;
  highlightCount: number;
};

type FocusItemApiResponse = {
  sourceId: string;
  departmentName: string;
  channelName: string;
  title: string;
  url: string;
  listPublishedAt: string;
  firstSeenAt?: string;
  importanceLevel: string;
  keywordScore: number;
  categories: Array<{ category: string; score: number; topKeywords?: string[] }>;
  hasFunding?: boolean;
  hasProcurement?: boolean;
  hasPilot?: boolean;
  hasStandards?: boolean;
  isStarred?: boolean;
};

type ItemsApiResponse = {
  items: FocusItemApiResponse[];
};

// 首页图/列表口径：最近 N 天"已发布"（list_published_at）的政策。改这一个数即可（7/10/15）。
const RECENT_WINDOW_DAYS = 10;
// 首页自动轮询间隔：每 5 分钟静默拉一次最新数据，用户不用手动刷新（爬虫每 30 分钟入库，5 分钟足够"感觉实时"）。
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function Home() {
  const { language } = usePrefs();
  const T = useT(language);

  // 真实数据在 mount 后拉取；初始为空 + loading 骨架，服务端/客户端首帧一致，避免水合失配。
  const [loading, setLoading] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(true);
  const [todayItems, setTodayItems] = useState<FocusItem[]>([]);
  const [starredItems, setStarredItems] = useState<FocusItem[]>([]);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefCopied, setBriefCopied] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<{ title: string; url: string; departmentName: string; listPublishedAt?: string; viewedAt: string }[]>([]);

  // 拉取真实数据：近 RECENT_WINDOW_DAYS 天"已发布"的政策 + 收藏项
  useEffect(() => {
    const ac = new AbortController();
    async function loadFeed() {
      try {
        const from = new Date();
        from.setDate(from.getDate() - RECENT_WINDOW_DAYS);
        const fromDate = from.toISOString().slice(0, 10);
        const [recentRes, starredRes] = await Promise.all([
          fetch(`/api/monitor/items?dateField=list_published_at&fromDate=${fromDate}&sort=published_at&limit=200`, { signal: ac.signal, cache: "no-store" }),
          fetch(`/api/monitor/items?onlyStarred=1&sort=first_seen_at&limit=20`, { signal: ac.signal, cache: "no-store" }),
        ]);
        const recent = (await recentRes.json()) as ItemsApiResponse;
        const starred = (await starredRes.json()) as ItemsApiResponse;
        if (ac.signal.aborted) return;
        setTodayItems((recent.items ?? []) as FocusItem[]);
        setStarredItems(((starred.items ?? []) as FocusItem[]).map((m) => ({ ...m, isStarred: true })));
        setDbAvailable(true);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setDbAvailable(false);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }
    loadFeed();
    // 自动轮询：每 REFRESH_INTERVAL_MS 静默拉一次，用户无需手动刷新（不显骨架、后台更新）
    const timer = setInterval(loadFeed, REFRESH_INTERVAL_MS);
    return () => {
      ac.abort();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("inbox_recent_items") ?? "[]") as typeof recentlyViewed;
      if (stored.length > 0) setRecentlyViewed(stored.slice(0, 5));
    } catch {}
  }, []);

  const todayNewCount = todayItems.length;
  const highPriorityCount = todayItems.filter(
    (i) => i.importanceLevel === "核心关注" || i.importanceLevel === "加急" || i.importanceLevel === "重点内容"
  ).length;

  const mustReadItems = todayItems
    .filter((i) => i.importanceLevel === "核心关注" || i.importanceLevel === "加急" || i.importanceLevel === "重点内容")
    .slice(0, 3);

  function generateBriefText(): string {
    const dateStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    const lines: string[] = [`今日情报简报 · ${dateStr}`, ""];
    todayItems.forEach((item, i) => {
      const priority = item.importanceLevel === "核心关注" || item.importanceLevel === "加急"
        ? "【核心】"
        : item.importanceLevel === "重点内容"
        ? "【⚠ 重点】"
        : "【·】";
      lines.push(`${i + 1}. ${priority} ${item.title}`);
      if (item.departmentName) lines.push(`   来源：${item.departmentName}`);
      if (item.listPublishedAt) lines.push(`   时间：${item.listPublishedAt.slice(0, 10)}`);
      lines.push("");
    });
    lines.push("— 由政策雷达生成");
    return lines.join("\n");
  }

  const greeting = getGreeting();
  const todayStr = formatDate(new Date(), language);


  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <SiteHeader />
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[var(--brand)]/15 blur-3xl" />
            </div>
            <div className="relative px-6 py-8 sm:px-8 sm:py-10">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    <span className="mr-1 h-1.5 w-1.5 rounded-full bg-slate-500 animate-pulse" />
                    <span className="animate-pulse">{todayStr}</span>
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)] opacity-70">
                    <RadioTower className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <div className="text-sm font-semibold tracking-wide text-white/90">{T("site.title")}</div>
                    <div className="text-[11px] text-slate-500">{language === "en" ? "Public Policy Intelligence Hub" : "公共政策情报追踪平台"}</div>
                  </div>
                </div>
                <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                  <span className="animate-pulse">{T(greeting.key)}</span>
                  <span className="text-slate-500">，</span>
                  <span className="text-slate-300 animate-pulse">
                    {T("home.loading.title")}
                  </span>
                </h1>
                <p className="mt-2 text-sm text-slate-500 animate-pulse">
                  {T("home.loading.sub")}
                </p>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm">
                    <div className="h-3 w-16 bg-slate-700/50 rounded animate-pulse" />
                    <div className="mt-1.5 h-8 w-12 bg-slate-700/50 rounded animate-pulse" />
                    <div className="mt-0.5 h-3 w-20 bg-slate-700/30 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-1 border-b border-slate-200 pb-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 opacity-60"
                >
                  <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
                  <div className="h-5 w-5 rounded-full bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-16 bg-slate-100 rounded" />
                    <div className="h-3 w-12 bg-slate-100 rounded" />
                    <div className="h-3 w-20 bg-slate-50 rounded" />
                  </div>
                  <div className="mt-2 h-5 w-full bg-slate-100 rounded" />
                  <div className="mt-1 h-4 w-2/3 bg-slate-50 rounded" />
                  <div className="mt-3 flex items-center justify-between">
                    <div className="h-5 w-20 bg-slate-100 rounded" />
                    <div className="h-5 w-16 bg-slate-50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      {!dbAvailable && (
        <div className="border-b border-sky-200 bg-sky-50 px-6 py-3 text-sm text-sky-800">
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-2">
            <span className="font-medium">{T("site.demo-banner")}</span>
            <span>{T("site.demo-desc")}</span>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl sm:rounded-3xl">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[var(--brand)]/15 blur-3xl" />
          </div>
          <div className="relative px-5 py-6 sm:px-8 sm:py-10">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/75">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {todayStr}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60">
                  {language === "en" ? "Auto-updating" : "自动更新"}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)]">
                  <RadioTower className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-wide text-white/90">{T("site.title")}</div>
                  <div className="text-[11px] text-white/55">{language === "en" ? "Public Policy Intelligence Hub" : "公共政策情报追踪平台"}</div>
                </div>
              </div>
              <h1 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                {T(greeting.key)}
                <span className="text-white/70">，</span>
                <span className="text-white">
                  {T("home.today-updates", { n: todayNewCount })}
                </span>
              </h1>
              <p className="mt-2 text-xs text-white/75 sm:text-sm">
                {T("home.priority-note", { n: highPriorityCount })}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-7 sm:gap-3">
              <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.07] sm:rounded-2xl sm:px-4 sm:py-4">
                <div className="text-[10px] uppercase tracking-wider text-white/65 sm:text-[11px]">{T("home.stat.new-label")}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-white sm:mt-1.5 sm:text-3xl">{todayNewCount}</div>
                <div className="mt-0.5 text-[10px] text-white/60 sm:text-[11px]">{T("home.stat.new-unit")}</div>
              </div>
              <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.07] sm:rounded-2xl sm:px-4 sm:py-4">
                <div className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--brand)] opacity-70 transition group-hover:opacity-100 sm:right-3 sm:top-3" />
                <div className="text-[10px] uppercase tracking-wider text-white/65 sm:text-[11px]">{T("home.stat.priority-label")}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-white sm:mt-1.5 sm:text-3xl">{highPriorityCount}</div>
                <div className="mt-0.5 text-[10px] text-white/60 sm:text-[11px]">{T("home.stat.priority-unit")}</div>
              </div>
              <WorkspaceFollowupBadge />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <WorkspaceNotificationCard />
        </section>

        {/* 主内容两栏：左=必读+速览+工作台，右=快捷入口+最近浏览 */}
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">

        {/* 今日必读推荐 */}
        {mustReadItems.length > 0 && (
          <section className="mt-4">
            <div className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-tint)]/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">今日必读</span>
                  <span className="rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand)]">{mustReadItems.length} 条高优先级</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBriefOpen(true)}
                    className="rounded-full border border-rose-200 bg-white/70 px-2.5 py-1 text-[11px] text-rose-600 transition hover:bg-white"
                  >
                    生成简报
                  </button>
                  <Link href="/inbox?importanceLevels=%E6%A0%B8%E5%BF%83%E5%85%B3%E6%B3%A8,%E9%87%8D%E7%82%B9%E5%86%85%E5%AE%B9" prefetch={false} className="text-xs text-rose-600 hover:underline">
                    查看全部 →
                  </Link>
                </div>
              </div>
              <ul className="space-y-2">
                {mustReadItems.map((item) => (
                  <li key={item.url}>
                    <Link
                      href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                      prefetch={false}
                      className="flex items-start gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm transition hover:bg-white"
                    >
                      <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        item.importanceLevel === "核心关注" || item.importanceLevel === "加急"
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {item.importanceLevel === "核心关注" || item.importanceLevel === "加急" ? "核心" : "重点"}
                      </span>
                      <span className="min-w-0 flex-1 text-xs text-slate-800 line-clamp-1">{item.title}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">{item.departmentName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="mt-8">
          <WorkspaceTabs todayItems={todayItems} starredItems={starredItems} />
        </section>
          </div>

          {/* 右辅栏：快捷入口（竖排）+ 最近浏览 */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {[
                { label: "今日未读", href: "/inbox?onlyUnread=1&sort=first_seen_at" },
                { label: "高优先级", href: "/inbox?importanceLevels=%E6%A0%B8%E5%BF%83%E5%85%B3%E6%B3%A8,%E9%87%8D%E7%82%B9%E5%86%85%E5%AE%B9" },
              ].map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  prefetch={false}
                  className="flex items-center gap-2.5 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-tint)]/40 px-3 py-3 transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand-tint)]/70"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                  <span className="text-sm font-medium text-slate-800">{card.label}</span>
                  <span className="ml-auto text-xs text-slate-400">→</span>
                </Link>
              ))}
            </div>

            {todayItems.length > 0 && (
              <HomeInsightCarousel items={todayItems} />
            )}
          </div>
        </div>

        {recentlyViewed.length > 0 && (
          <section className="mt-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-sm font-semibold text-slate-900">最近浏览</span>
                </div>
                <Link href="/inbox" className="text-[11px] text-slate-400 hover:text-slate-600 transition">全部 →</Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {recentlyViewed.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition hover:bg-slate-50"
                  >
                    <span className="mt-0.5 shrink-0 text-sm text-slate-300 group-hover:text-slate-400">↗</span>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-xs font-medium text-slate-800 group-hover:text-sky-700">{item.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span>{item.departmentName}</span>
                        {item.listPublishedAt && <span>· {item.listPublishedAt.slice(0, 10)}</span>}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/signals"
              prefetch={false}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-violet-300 hover:shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 transition group-hover:bg-violet-100">
                <RadioTower className="h-6 w-6 text-violet-600" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900 group-hover:text-violet-700 transition">
                  {T("home.link.signals")}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {T("home.link.signals-desc")}
                </div>
              </div>
              <div className="text-slate-400 group-hover:text-violet-500 transition">→</div>
            </Link>

            <Link
              href="/research"
              prefetch={false}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 transition group-hover:bg-sky-100">
                <ClipboardList className="h-6 w-6 text-sky-600" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900 group-hover:text-sky-700 transition">
                  {T("home.link.research")}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {T("home.link.research-desc")}
                </div>
              </div>
              <div className="text-slate-400 group-hover:text-sky-500 transition">→</div>
            </Link>
          </div>
        </section>

        <footer className="mt-12 border-t border-slate-200 pt-6 pb-4 text-center text-xs text-slate-400">
          {T("site.footer")}
        </footer>
      </div>

      <FirstTimeGuideModal />

      {/* 今日简报弹窗 */}
      {briefOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={() => setBriefOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">今日情报简报</h2>
                <button type="button" onClick={() => setBriefOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="p-5">
                <textarea
                  readOnly
                  value={generateBriefText()}
                  rows={12}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-700 outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-3">
                <button
                  type="button"
                  onClick={() => setBriefOpen(false)}
                  className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  关闭
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generateBriefText()).then(() => {
                      setBriefCopied(true);
                      setTimeout(() => setBriefCopied(false), 2000);
                    });
                  }}
                  className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700"
                >
                  {briefCopied ? "✓ 已复制" : "复制文本"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
