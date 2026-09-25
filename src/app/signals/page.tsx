"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Highlight } from "@/components/highlight";
import { WeeklyDigestModal } from "@/components/weekly-digest-modal";
import { ImportanceBadge } from "@/components/importance-badge";
import { SubscriptionBadge } from "@/components/subscription-badge";
import { SignalsSkeleton } from "@/components/signals-skeleton";
import {
  SIGNAL_CATEGORIES,
  TOPIC_CATEGORIES,
  categoryDisplayLabel,
  categoryTooltip,
  getCategoryStyle,
  isSignalCategory,
  isTopicCategory,
} from "@/lib/monitor/content-meta";
import { getPriorityMeta, normalizePriorityLevel } from "@/lib/monitor/priority-levels";
import { generateMockItems } from "@/lib/monitor/mock";
import {
  fetchSubscriptions,
  groupSubscriptions,
  matchItemSubscriptions,
  type SubscriptionRecord,
  type MatchedSubscription,
} from "@/lib/subscription-utils";
import {
  Clock, Hand, Newspaper, Printer, RadioTower, RefreshCw, Search, Target,
} from "lucide-react";

type SignalItem = {
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
  isRead?: boolean;
};

const SIGNAL_ORDER = [
  "A·强执行信号",
  "B·强支持信号",
  "C·风险信号",
  "D·探索信号",
  "通用启动/落地",
];

const SIGNAL_VALUE_DESC: Record<string, string> = {
  "A·强执行信号": "工信部 / 网信办 / 发改委 等发布的正式通知、方案、截止要求",
  "B·强支持信号": "资金、补贴、专项、算力券、政府采购等利好政策",
  "C·风险信号": "监管、合规、安全审查、数据出境与备案等风险信号",
  "D·探索信号": "试点、示范、征求意见、前沿研究等探索性动态",
  "通用启动/落地": "重大项目启动、平台落地、行动方案推进等",
};

type SortMode = "signalStrength" | "firstSeen" | "priority";

function summarizeTitle(title: string, maxLen = 56): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen) + "…";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

function isToday(iso: string): boolean {
  if (!iso) return false;
  const dateStr = iso.split("T")[0];
  const today = new Date().toISOString().split("T")[0];
  return dateStr === today;
}

function getTopSignalCategory(
  categories: Array<{ category: string; score: number }>,
): string | null {
  const signalCats = categories.filter((c) => isSignalCategory(c.category));
  if (signalCats.length === 0) return null;
  return signalCats.sort((a, b) => b.score - a.score)[0].category;
}

function getTopicCategories(
  categories: Array<{ category: string; score: number }>,
): Array<{ category: string; score: number }> {
  return categories.filter((c) => isTopicCategory(c.category));
}

function useSignalItems(region: "all" | "domestic" | "global") {
  const [items, setItems] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [dbAvailable, setDbAvailable] = useState(true);
  const hasLoaded = useRef(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function load() {
      if (hasLoaded.current) {
        setIsFetching(true);
      }
      try {
        if (abortController.signal.aborted) return;

        const params = new URLSearchParams();
        params.set("view", "list");
        params.set("limit", "100");
        params.set("offset", "0");
        params.set("sort", "relevance");
        params.set("categories", [...SIGNAL_CATEGORIES].join(","));
        if (region !== "all") params.set("region", region);

        const res = await fetch(`/api/monitor/items?${params.toString()}`, {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) return;

        if (res.ok) {
          const json = await res.json();
          if (abortController.signal.aborted) return;
          const list: SignalItem[] = (json.items || []).map((raw: Record<string, unknown>) => ({
            sourceId: raw.sourceId as string,
            departmentName: raw.departmentName as string,
            channelName: raw.channelName as string,
            title: raw.title as string,
            url: raw.url as string,
            listPublishedAt: raw.listPublishedAt as string,
            firstSeenAt: raw.firstSeenAt as string | undefined,
            importanceLevel: (raw.importanceLevel as string) || "普通内容",
            keywordScore: Number(raw.keywordScore) || 0,
            categories: Array.isArray(raw.categories) ? (raw.categories as SignalItem["categories"]) : [],
            hasFunding: Boolean(raw.hasFunding),
            hasProcurement: Boolean(raw.hasProcurement),
            hasPilot: Boolean(raw.hasPilot),
            hasStandards: Boolean(raw.hasStandards),
            isStarred: Boolean(raw.isStarred),
            isRead: Boolean(raw.isRead),
          }));
          setItems(list);
          setDbAvailable(true);
        } else {
          throw new Error("API not available");
        }
      } catch (e) {
        const err = e as Error;
        if (err.name === "AbortError" || err.message.includes("ERR_ABORTED")) {
          return;
        }
        const mockItems = generateMockItems(50);
        const list: SignalItem[] = mockItems.map((m) => ({
          sourceId: m.sourceId,
          departmentName: m.departmentName,
          channelName: m.channelName,
          title: m.title,
          url: m.url,
          listPublishedAt: m.listPublishedAt,
          firstSeenAt: m.firstSeenAt,
          importanceLevel: m.importanceLevel,
          keywordScore: m.keywordScore,
          categories: m.categories || [],
          hasFunding: m.hasFunding,
          hasProcurement: m.hasProcurement,
          hasPilot: m.hasPilot,
          hasStandards: m.hasStandards,
          isStarred: m.isStarred,
          isRead: m.isRead,
        }));
        setItems(list);
        setDbAvailable(false);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
          setIsFetching(false);
          hasLoaded.current = true;
        }
      }
    }
    load();
    return () => {
      abortController.abort();
    };
  }, [region]);

  return { items, loading, isFetching, dbAvailable };
}

export default function SignalsPage() {
  const [region, setRegion] = useState<"all" | "domestic" | "global">("all");
  const [signalQ, setSignalQ] = useState("");
  const { items, loading, isFetching, dbAvailable } = useSignalItems(region);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [newBanner, setNewBanner] = useState(0);
  const lastCountRef = useRef(0);

  // 自动静默刷新
  useEffect(() => {
    if (!autoRefresh) return;
    const INTERVAL = 5 * 60 * 1000; // 5 分钟
    const timer = setInterval(async () => {
      try {
        const params = new URLSearchParams();
        params.set("view", "list");
        params.set("limit", "100");
        params.set("offset", "0");
        params.set("sort", "relevance");
        params.set("categories", [...SIGNAL_CATEGORIES].join(","));
        if (region !== "all") params.set("region", region);
        const res = await fetch(`/api/monitor/items?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const count = (json.items ?? []).length;
        if (lastCountRef.current > 0 && count > lastCountRef.current) {
          setNewBanner(count - lastCountRef.current);
        }
        lastCountRef.current = count;
      } catch {}
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [autoRefresh, region]);
  const [sortMode, setSortMode] = useState<SortMode>("signalStrength");
  type QuickDateFilter = "all" | "today" | "week" | "month";
  const [quickDate, setQuickDate] = useState<QuickDateFilter>("all");
  const [selectedSignalTypes, setSelectedSignalTypes] = useState<Set<string>>(new Set());
  const [selectedTopicTypes, setSelectedTopicTypes] = useState<Set<string>>(new Set());
  const [digestOpen, setDigestOpen] = useState(false);
  const [signalSearchHistory, setSignalSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("signals_search_history") ?? "[]"); } catch { return []; }
  });
  const [showSignalHistory, setShowSignalHistory] = useState(false);

  function addSignalHistory(term: string) {
    const t = term.trim();
    if (!t || t.length < 2) return;
    setSignalSearchHistory((prev) => {
      const next = [t, ...prev.filter((h) => h !== t)].slice(0, 8);
      try { localStorage.setItem("signals_search_history", JSON.stringify(next)); } catch {}
      return next;
    });
  }
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(() => {
    const hasSeenGuide = typeof window !== "undefined" ? localStorage.getItem("signals_guide_seen") : null;
    if (!hasSeenGuide) {
      setTimeout(() => {
        localStorage.setItem("signals_guide_seen", "true");
      }, 3000);
      return true;
    }
    return false;
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const subs = await fetchSubscriptions();
      if (!cancelled) {
        setSubscriptions(subs);
        setSubscriptionsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribedGroups = useMemo(() => groupSubscriptions(subscriptions), [subscriptions]);

  const getItemMatches = useCallback(
    (item: SignalItem): MatchedSubscription[] => {
      return matchItemSubscriptions({
        departmentName: item.departmentName,
        matchedKeywords: [],
        subscribedDepartments: subscribedGroups.departments,
        subscribedKeywords: subscribedGroups.keywords,
        maxDisplay: 2,
      });
    },
    [subscribedGroups],
  );

  const subscribedItems = useMemo(() => {
    if (subscribedGroups.departments.length === 0 && subscribedGroups.keywords.length === 0) {
      return [];
    }
    return items.filter((item) => getItemMatches(item).length > 0).slice(0, 6);
  }, [items, subscribedGroups, getItemMatches]);

  const stats = useMemo(() => {
    const todayCount = items.filter((i) => isToday(i.firstSeenAt || i.listPublishedAt)).length;
    const coreCount = items.filter(
      (i) => normalizePriorityLevel(i.importanceLevel) === "核心关注",
    ).length;
    const highlightCount = items.filter(
      (i) => normalizePriorityLevel(i.importanceLevel) === "重点内容",
    ).length;
    const totalCount = items.length;

    return { todayCount, coreCount, highlightCount, totalCount };
  }, [items]);

  const signalDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of SIGNAL_ORDER) counts[cat] = 0;
    for (const item of items) {
      const topSignal = getTopSignalCategory(item.categories);
      if (topSignal && counts[topSignal] !== undefined) {
        counts[topSignal]++;
      }
    }
    return SIGNAL_ORDER.map((cat) => ({
      category: cat,
      displayLabel: categoryDisplayLabel(cat),
      tooltip: categoryTooltip(cat),
      valueDesc: SIGNAL_VALUE_DESC[cat] || "",
      count: counts[cat],
    }));
  }, [items]);

  const topicDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of TOPIC_CATEGORIES) counts[cat] = 0;
    for (const item of items) {
      const topics = getTopicCategories(item.categories);
      for (const t of topics) {
        if (counts[t.category] !== undefined) {
          counts[t.category]++;
        }
      }
    }
    return [...TOPIC_CATEGORIES]
      .map((cat) => ({
        category: cat,
        displayLabel: categoryDisplayLabel(cat),
        tooltip: categoryTooltip(cat),
        count: counts[cat],
      }))
      .sort((a, b) => b.count - a.count)
      .filter((c) => c.count > 0);
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = [...items];

    if (signalQ.trim()) {
      const q = signalQ.trim().toLowerCase();
      list = list.filter((item) => item.title.toLowerCase().includes(q) || (item.departmentName || "").toLowerCase().includes(q));
    }

    if (quickDate !== "all") {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const cutoff = new Date(now);
      if (quickDate === "week") cutoff.setDate(cutoff.getDate() - 7);
      else if (quickDate === "month") cutoff.setMonth(cutoff.getMonth() - 1);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      list = list.filter((item) => {
        const d = (item.firstSeenAt || item.listPublishedAt || "").split("T")[0];
        if (!d) return false;
        return quickDate === "today" ? d === todayStr : d >= cutoffStr;
      });
    }

    if (selectedSignalTypes.size > 0) {
      list = list.filter((item) => {
        const topSignal = getTopSignalCategory(item.categories);
        return topSignal !== null && selectedSignalTypes.has(topSignal);
      });
    }

    if (selectedTopicTypes.size > 0) {
      list = list.filter((item) => {
        const topics = getTopicCategories(item.categories);
        return topics.some((t) => selectedTopicTypes.has(t.category));
      });
    }

    if (sortMode === "signalStrength") {
      list.sort((a, b) => b.keywordScore - a.keywordScore);
    } else if (sortMode === "firstSeen") {
      list.sort((a, b) => {
        const av = a.firstSeenAt || a.listPublishedAt;
        const bv = b.firstSeenAt || b.listPublishedAt;
        return bv.localeCompare(av);
      });
    } else if (sortMode === "priority") {
      const priorityOrder: Record<string, number> = {
        "核心关注": 0,
        "重点内容": 1,
        "中等重点": 2,
        "普通内容": 3,
      };
      list.sort((a, b) => {
        const al = normalizePriorityLevel(a.importanceLevel);
        const bl = normalizePriorityLevel(b.importanceLevel);
        const diff = (priorityOrder[al] ?? 99) - (priorityOrder[bl] ?? 99);
        if (diff !== 0) return diff;
        return b.keywordScore - a.keywordScore;
      });
    }

    return list;
  }, [items, sortMode, signalQ, quickDate, selectedSignalTypes, selectedTopicTypes]);

  function toggleSignalType(cat: string) {
    setSelectedSignalTypes((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function toggleTopicType(cat: string) {
    setSelectedTopicTypes((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function clearFilters() {
    setSelectedSignalTypes(new Set());
    setSelectedTopicTypes(new Set());
    setRegion("all");
    setSignalQ("");
  }

  const hasAnyFilter = selectedSignalTypes.size > 0 || selectedTopicTypes.size > 0 || region !== "all" || signalQ.trim() !== "" || quickDate !== "all";

  if (loading) {
    return <SignalsSkeleton />;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      {!dbAvailable && (
        <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-6 py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-3">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            <span className="text-sm font-medium text-amber-800">演示模式</span>
            <span className="hidden text-sm text-amber-700 sm:inline">· 当前数据为示例内容，连接数据库后将显示真实情报</span>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 页头 */}
        <section className="mb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <RadioTower className="h-4 w-4" aria-hidden />
                <span>信号雷达</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                发现动态中的高价值信号
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                自动识别内容中的强执行、强支持、濒危预警、行业研究等关键信号，帮你快速判断政策价值
              </p>
            </div>
            <Link
              href="/inbox"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              去动态资讯
              <span className="text-slate-400">→</span>
            </Link>
          </div>

          {showGuide && (
          <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Hand className="h-6 w-6" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-amber-800">欢迎来到信号雷达</div>
                  <p className="mt-1 text-xs text-amber-700">
                    这里帮你快速发现高价值情报信号。关注来源或关键词后，匹配的内容会优先展示。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowGuide(false);
                    localStorage.setItem("signals_guide_seen", "true");
                  }}
                  className="shrink-0 text-amber-600 hover:text-amber-800 transition"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 核心数字概览 */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500">今日新增信号</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.todayCount}
              </div>
              <div className="mt-0.5 text-xs text-emerald-600">条新动态</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500">核心关注</div>
              <div className="mt-1 text-2xl font-semibold text-red-600">
                {stats.coreCount}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">条最高优先级</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500">重点内容</div>
              <div className="mt-1 text-2xl font-semibold text-orange-600">
                {stats.highlightCount}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">条高优先级</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs text-slate-500">情报总数</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.totalCount}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">条带信号内容</div>
            </div>
          </div>
        </section>

        {/* 你的关注信号 */}
        {(subscribedGroups.departments.length > 0 || subscribedGroups.keywords.length > 0) && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  <Target className="mr-1 inline h-3.5 w-3.5" aria-hidden />你的关注信号
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  来自你关注的来源和关键词的情报信号
                </p>
              </div>
              <Link
                href="/subscribe"
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                管理关注 →
              </Link>
            </div>
            {subscriptionsLoading || loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="h-4 w-32 bg-slate-100 rounded" />
                    <div className="mt-2 h-5 w-full bg-slate-100 rounded" />
                    <div className="mt-1 h-4 w-2/3 bg-slate-50 rounded" />
                  </div>
                ))}
              </div>
            ) : subscribedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                <Search className="mx-auto mb-2 h-7 w-7 text-slate-300" aria-hidden />
                <p className="text-sm text-slate-600">
                  暂无匹配的信号内容
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  你关注的来源和关键词暂未出现高信号强度的内容
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {subscribedItems.map((item) => {
                  const topSignal = getTopSignalCategory(item.categories);
                  const signalStyle = topSignal ? getCategoryStyle(topSignal) : null;
                  const matches = getItemMatches(item);
                  return (
                    <Link
                      key={`sub-${item.sourceId}-${item.url}`}
                      href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                      className="group block rounded-2xl border border-sky-100 bg-sky-50/30 p-4 transition hover:border-sky-200 hover:shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <ImportanceBadge
                              level={item.importanceLevel}
                              keywordScore={item.keywordScore}
                            />
                            {topSignal && signalStyle && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${signalStyle.chip}`}
                                title={signalStyle.tooltip}
                              >
                                {signalStyle.displayLabel}
                              </span>
                            )}
                            <SubscriptionBadge matches={matches} compact />
                            <span className="text-xs text-slate-500">
                              {item.departmentName}
                            </span>
                          </div>
                          <h3 className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-slate-700">
                            <Highlight text={summarizeTitle(item.title)} query={signalQ} />
                          </h3>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 信号类型分布 */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">信号类型分布</h2>
            {selectedSignalTypes.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSignalTypes(new Set())}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                清空筛选
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {signalDistribution.map((sg) => {
              const style = getCategoryStyle(sg.category);
              const isSelected = selectedSignalTypes.has(sg.category);
              return (
                <button
                  key={sg.category}
                  type="button"
                  onClick={() => toggleSignalType(sg.category)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? `${style.chip} border-2 shadow-sm`
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="text-2xl font-semibold">{sg.count}</div>
                  <div className={`mt-1 text-sm font-medium ${isSelected ? "" : "text-slate-800"}`}>
                    {sg.displayLabel}
                  </div>
                  <div className={`mt-0.5 text-xs ${isSelected ? "opacity-80" : "text-slate-500"}`}>
                    {sg.valueDesc}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 热门领域信号 */}
        {topicDistribution.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">哪些领域信号密集</h2>
              {selectedTopicTypes.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTopicTypes(new Set())}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  清空筛选
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {topicDistribution.map((tg) => {
                const style = getCategoryStyle(tg.category);
                const isSelected = selectedTopicTypes.has(tg.category);
                const maxCount = Math.max(...topicDistribution.map((t) => t.count), 1);
                const intensity = Math.min(1, tg.count / maxCount);
                return (
                  <button
                    key={tg.category}
                    type="button"
                    onClick={() => toggleTopicType(tg.category)}
                    className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                      isSelected
                        ? `${style.chip} border-2`
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                    title={tg.tooltip}
                  >
                    <span className="font-medium">{tg.displayLabel}</span>
                    <span
                      className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] ${
                        isSelected ? "bg-white/50" : style.chip
                      }`}
                      style={{ opacity: 0.5 + intensity * 0.5 }}
                    >
                      {tg.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 信号列表 */}
        <section className={`transition-opacity duration-200 ${isFetching ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          {/* 搜索框 + 控制栏（吸顶） */}
          <div className="sticky top-0 z-10 -mx-4 bg-slate-50/95 px-4 pb-3 pt-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="relative mb-2">
              <input
                type="search"
                value={signalQ}
                onChange={(e) => setSignalQ(e.target.value)}
                onFocus={() => setShowSignalHistory(true)}
                onBlur={() => setTimeout(() => setShowSignalHistory(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && signalQ.trim()) {
                    addSignalHistory(signalQ);
                    setShowSignalHistory(false);
                  }
                }}
                placeholder="搜索标题或机构…"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-0"
              />
              {showSignalHistory && signalSearchHistory.length > 0 && !signalQ && (
                <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-slate-400">最近搜索</div>
                  {signalSearchHistory.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onMouseDown={() => { setSignalQ(h); setShowSignalHistory(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <Clock className="h-4 w-4 text-slate-400" aria-hidden />
                      {h}
                    </button>
                  ))}
                  <button
                    type="button"
                    onMouseDown={() => {
                      setSignalSearchHistory([]);
                      try { localStorage.removeItem("signals_search_history"); } catch {}
                      setShowSignalHistory(false);
                    }}
                    className="w-full border-t border-slate-100 px-3 py-2 text-center text-[11px] text-slate-400 transition hover:bg-slate-50"
                  >
                    清除历史记录
                  </button>
                </div>
              )}
            </div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">信号列表</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {filteredItems.length} 条
              </span>
              {isFetching && (
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              )}
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  清空筛选
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* 国内 / 全球 切换 */}
              <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white">
                {(["all", "domestic", "global"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegion(r)}
                    className={`px-3 py-1 text-xs transition ${
                      region === r
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {r === "all" ? "全部" : r === "domestic" ? "国内" : "全球"}
                  </button>
                ))}
              </div>
              {/* 快速日期过滤 */}
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
                {([
                  { v: "all" as QuickDateFilter, label: "全部" },
                  { v: "today" as QuickDateFilter, label: "今日" },
                  { v: "week" as QuickDateFilter, label: "近 7 天" },
                  { v: "month" as QuickDateFilter, label: "近 30 天" },
                ]).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setQuickDate(opt.v)}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${
                      quickDate === opt.v
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* 排序切换 */}
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
              {([
                { v: "signalStrength" as SortMode, label: "按信号强度" },
                { v: "firstSeen" as SortMode, label: "按最新发现" },
                { v: "priority" as SortMode, label: "按优先级" },
              ]).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setSortMode(opt.v)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    sortMode === opt.v
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              </div>
              {/* 自动刷新 */}
              <button
                type="button"
                onClick={() => { setAutoRefresh((v) => !v); lastCountRef.current = items.length; setNewBanner(0); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  autoRefresh
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                title={autoRefresh ? "自动刷新已开启（每 5 分钟）" : "开启自动刷新"}
              >
                <span className={autoRefresh ? "animate-spin" : ""} style={autoRefresh ? { animationDuration: "3s" } : {}}><RefreshCw className="h-4 w-4" aria-hidden /></span>
                {autoRefresh ? "自动刷新中" : "自动刷新"}
              </button>
              {/* 生成周报 */}
              {filteredItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDigestOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100"
                >
                  <Newspaper className="mr-1 inline h-3.5 w-3.5" aria-hidden />生成周报
                </button>
              )}
              {filteredItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const headers = ["标题", "机构", "栏目", "发布时间", "发现时间", "信号类别", "信号强度", "链接"];
                    const csvRows = [
                      headers.map((h) => `"${h}"`).join(","),
                      ...filteredItems.map((item) => {
                        const topCat = getTopSignalCategory(item.categories);
                        return [
                          item.title,
                          item.departmentName,
                          item.channelName || "",
                          item.listPublishedAt,
                          item.firstSeenAt || "",
                          topCat ? categoryDisplayLabel(topCat) : "",
                          String(item.keywordScore),
                          item.url,
                        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
                      }),
                    ].join("\n");
                    const blob = new Blob(["﻿" + csvRows], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `signals-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-50"
                >
                  ↓ CSV
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                data-print-hide
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-50"
              >
                <Printer className="mr-1 inline h-3.5 w-3.5" aria-hidden />打印
              </button>
            </div>
          </div>
          </div> {/* end sticky toolbar */}

          {newBanner > 0 && (
            <button
              type="button"
              onClick={() => { setNewBanner(0); window.location.reload(); }}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
            >
              <span className="animate-bounce">⬆</span>
              发现 {newBanner} 条新内容，点击刷新
            </button>
          )}

          {filteredItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              当前筛选下没有信号。
              {hasAnyFilter ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-2 underline decoration-slate-300 underline-offset-2"
                >
                  清空筛选
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const priorityMeta = getPriorityMeta(item.importanceLevel);
                const normalizedLevel = normalizePriorityLevel(item.importanceLevel);
                const topSignal = getTopSignalCategory(item.categories);
                const topicCats = getTopicCategories(item.categories).slice(0, 3);
                const signalStyle = topSignal ? getCategoryStyle(topSignal) : null;
                const itemMatches = !subscriptionsLoading ? getItemMatches(item) : [];

                return (
                  <Link
                    key={`${item.sourceId}-${item.url}`}
                    href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                    className="group block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <ImportanceBadge
                            level={item.importanceLevel}
                            keywordScore={item.keywordScore}
                          />
                          {topSignal && signalStyle && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${signalStyle.chip}`}
                              title={signalStyle.tooltip}
                            >
                              {signalStyle.displayLabel}
                            </span>
                          )}
                          {!subscriptionsLoading && itemMatches.length > 0 && (
                            <SubscriptionBadge matches={itemMatches} compact />
                          )}
                          <span className="text-xs text-slate-400">
                            {item.departmentName}
                          </span>
                          {topicCats.map((tc) => (
                            <span
                              key={tc.category}
                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600"
                              title={categoryTooltip(tc.category)}
                            >
                              {categoryDisplayLabel(tc.category)}
                            </span>
                          ))}
                        </div>
                        <h3 className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-slate-600">
                          <Highlight text={summarizeTitle(item.title)} query={signalQ} />
                        </h3>
                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                          <span>{item.channelName}</span>
                          {item.listPublishedAt && (
                            <span className="flex items-center gap-1">
                              {formatDate(item.listPublishedAt)}
                            </span>
                          )}
                          {item.keywordScore > 0 && (
                            <span
                              className="flex items-center gap-1 text-violet-600"
                              title={[
                                `信号强度拆解`,
                                `优先级：${item.importanceLevel}`,
                                `关键词得分：${item.keywordScore} pts`,
                                `匹配类别：${item.categories.length} 个`,
                              ].join("\n")}
                            >
                              信号强度 {item.keywordScore}
                              <span className="text-[10px] text-violet-400 select-none">ⓘ</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div
                          className={`text-xs font-medium ${
                            normalizedLevel === "核心关注"
                              ? "text-red-600"
                              : normalizedLevel === "重点内容"
                                ? "text-orange-600"
                                : "text-slate-500"
                          }`}
                        >
                          {priorityMeta.shortLabel}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* 底部说明 */}
        <footer className="mt-12 border-t border-slate-200 pt-6 pb-4 text-center text-xs text-slate-400">
          信号雷达 · 基于关键词匹配的情报信号自动识别
        </footer>
      </div>

      <WeeklyDigestModal
        open={digestOpen}
        onClose={() => setDigestOpen(false)}
        items={filteredItems}
      />
    </main>
  );
}
