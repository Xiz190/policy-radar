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
  ChevronRight, ClipboardList, RadioTower,
} from "lucide-react";

function getGreeting(): { key: TranslationKey } {
  const now = new Date();
  // 问候语用访客当地时间（写死北京时间的话，海外用户晚上会看到「早上好」）
  const hour = new Intl.DateTimeFormat("zh-CN", {
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
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const parts = new Intl.DateTimeFormat("zh-CN", {
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
// 顶部"今天新增"的口径：近 24 小时新入库（first_seen_at），与创作者雷达一致。
// 一次最多取这么多条；达到上限时显示 "200+"，不把上限冒充成真实数量。
const RECENT_FETCH_LIMIT = 200;
// 首页自动轮询间隔：每 5 分钟静默拉一次最新数据，用户不用手动刷新（爬虫每 30 分钟入库，5 分钟足够"感觉实时"）。
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function Home() {
  const { language } = usePrefs();
  const T = useT(language);

  // 真实数据在 mount 后拉取；初始为空 + loading 骨架，服务端/客户端首帧一致，避免水合失配。
  const [loading, setLoading] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(true);
  const [todayItems, setTodayItems] = useState<FocusItem[]>([]);
  const [newlySeenItems, setNewlySeenItems] = useState<FocusItem[]>([]);
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
        const [recentRes, starredRes, newlySeenRes] = await Promise.all([
          fetch(`/api/monitor/items?dateField=list_published_at&fromDate=${fromDate}&sort=published_at&limit=200`, { signal: ac.signal, cache: "no-store" }),
          fetch(`/api/monitor/items?onlyStarred=1&sort=first_seen_at&limit=20`, { signal: ac.signal, cache: "no-store" }),
          // 按收录日期先粗筛（接口只收 YYYY-MM-DD；默认排序先看优先级，只取前 N 条会漏掉新条目），
          // 精确的 24 小时在下面 last24h 再筛
          fetch(`/api/monitor/items?dateField=first_seen_at&fromDate=${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}&limit=${RECENT_FETCH_LIMIT}`, { signal: ac.signal, cache: "no-store" }),
        ]);
        const recent = (await recentRes.json()) as ItemsApiResponse;
        const starred = (await starredRes.json()) as ItemsApiResponse;
        const newlySeen = (await newlySeenRes.json()) as ItemsApiResponse;
        if (ac.signal.aborted) return;
        setTodayItems((recent.items ?? []) as FocusItem[]);
        setNewlySeenItems((newlySeen.items ?? []) as FocusItem[]);
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后才能读浏览器数据（本地存储/窗口/当前时间），服务端读不到；放进渲染会造成水合不一致
      if (stored.length > 0) setRecentlyViewed(stored.slice(0, 5));
    } catch {}
  }, []);

  // 原先直接用"近 10 天已发布、最多 200 条"的列表长度当"今天有 N 条"，数字是查询上限不是真实量
  // 时间戳首帧取一次：渲染里直接调 Date.now() 每次渲染都变，服务端/客户端也会不一致
  const [now] = useState(() => Date.now());
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const last24h = newlySeenItems.filter((i) => i.firstSeenAt && new Date(i.firstSeenAt).getTime() >= dayAgo);
  const todayNewCount = last24h.length >= RECENT_FETCH_LIMIT ? `${RECENT_FETCH_LIMIT}+` : String(last24h.length);
  const highPriorityCount = last24h.filter(
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
          <section className="border-b border-slate-200 pb-5 sm:pb-6">
            {/* 加载态会被服务端渲染：这里不放日期和问候语（服务端是 UTC，访客是当地时间，放了会水合不一致） */}
            <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
            <h1 className="mt-2 text-2xl leading-tight text-slate-500 sm:text-3xl">{T("home.loading.title")}</h1>
            <div className="mt-3 h-4 w-64 max-w-full rounded bg-slate-100 animate-pulse" />
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
        {/* 报头：直接落在纸底上，不用深色板/光晕/毛玻璃数字块——数字已在标题句里，不再重复成三块 */}
        <section className="border-b border-slate-200 pb-5 sm:pb-6">
          <time className="text-xs text-slate-500">{todayStr}</time>
          <h1 className="mt-2 text-2xl leading-tight text-slate-900 sm:text-3xl lg:text-[2.125rem]">
            {T(greeting.key)}{T("common.comma")}{T("home.today-updates", { n: todayNewCount })}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {T("home.priority-note", { n: highPriorityCount })}
            <span className="mx-1.5 text-slate-300" aria-hidden>·</span>
            <WorkspaceFollowupBadge />
          </p>
        </section>

        <section className="mt-6">
          <WorkspaceNotificationCard />
        </section>

        {/* 第一行：左=今日必读，右=两个快捷入口（并排）+ 速览图表；两边高度大致对齐 */}
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2 lg:flex lg:flex-col">

        {/* 今日必读推荐 */}
        {mustReadItems.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white lg:flex-1">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-base font-semibold text-slate-900">{T("home.mustread.title")}</h2>
                <span className="text-xs text-slate-500">{T("home.mustread.count", { n: mustReadItems.length })}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setBriefOpen(true)}
                  className="text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline"
                >
                  {T("home.mustread.brief")}
                </button>
                <Link
                  href="/inbox?importanceLevels=%E6%A0%B8%E5%BF%83%E5%85%B3%E6%B3%A8,%E9%87%8D%E7%82%B9%E5%86%85%E5%AE%B9"
                  prefetch={false}
                  className="inline-flex items-center gap-0.5 font-medium text-[var(--brand)] underline-offset-4 hover:underline"
                >
                  {T("home.mustread.viewall")}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </div>
            <ul className="divide-y divide-slate-200">
              {mustReadItems.map((item) => (
                <li key={item.url}>
                  <Link
                    href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                    prefetch={false}
                    className="group block px-5 py-3.5 transition hover:bg-slate-50"
                  >
                    <p className="text-sm font-medium leading-snug text-slate-900 line-clamp-2">{item.title}</p>
                    <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                      {item.importanceLevel === "核心关注" || item.importanceLevel === "加急" ? (
                        <span className="shrink-0 font-medium text-red-700">核心</span>
                      ) : (
                        <span className="shrink-0 font-medium text-slate-500">重点</span>
                      )}
                      <span className="shrink-0 font-medium text-slate-700">{item.departmentName}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
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
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-400" aria-hidden />
                </Link>
              ))}
            </div>

            {todayItems.length > 0 && (
              <HomeInsightCarousel items={todayItems} />
            )}
          </div>
        </div>

        {/* 第二行：工作台占满整行，不再挤在左栏里把右边拉出一大片空白 */}
        <section className="mt-5">
          <WorkspaceTabs
            todayItems={todayItems}
            starredItems={starredItems}
            excludeUrls={mustReadItems.map((i) => i.url)}
          />
        </section>

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
