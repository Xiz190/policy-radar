"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Bell, BookOpen, ClipboardList, Flame, Hourglass, Inbox, MailOpen, NotebookPen, Star, Target, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getAllPersonalResearch,
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_STATUS_ICONS,
  FOLLOW_UP_STATUS_OPTIONS,
  type PersonalResearchItem,
  type FollowUpStatus,
  setFollowUpStatus as setFollowUpStatusStorage,
  getTagColor,
} from "@/lib/personal-research";
import { SubscriptionBadge } from "@/components/subscription-badge";
import {
  fetchSubscriptions,
  groupSubscriptions,
  matchItemSubscriptions,
  calculateFollowScore,
  sortByFollowPriority,
  type SubscriptionRecord,
  type MatchedSubscription,
  type FollowMatchResult,
} from "@/lib/subscription-utils";
import {
  getAllNotifications,
  checkNotifications,
  type NotificationItem,
} from "@/lib/notifications";
import { usePrefs } from "@/contexts/prefs-context";
import { useT, type TranslationKey } from "@/lib/i18n";
import { StatusIcon } from "@/components/status-icon";

const ACTIVE_STATUSES: FollowUpStatus[] = ["to_read", "reading", "to_act"];

export function WorkspaceFollowupBadge() {
  const { language } = usePrefs();
  const T = useT(language);

  // 与服务端一致地从 0 起步，mount 后再从 localStorage 读入，避免水合失配。
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const all = getAllPersonalResearch();
    setCount(all.filter((item) => ACTIVE_STATUSES.includes(item.followUpStatus)).length);
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-4">
        <div className="h-3 w-12 bg-emerald-500/30 rounded animate-pulse" />
        <div className="mt-1 h-7 w-10 bg-emerald-500/30 rounded animate-pulse sm:mt-2" />
        <div className="mt-1 h-3 w-16 bg-emerald-500/20 rounded animate-pulse sm:mt-2" />
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-4">
      <div className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--brand)] opacity-70 sm:right-3 sm:top-3" />
      <div className="text-[10px] text-white/65 sm:text-xs">{T("home.stat.followup-label")}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-white sm:mt-1.5 sm:text-3xl sm:font-semibold">{count}</div>
      <div className="mt-0.5 text-[10px] text-white/60 sm:mt-1 sm:text-xs">
        {count > 0 ? T("home.stat.followup-unit") : T("home.stat.followup-done")}
      </div>
    </div>
  );
}

export function WorkspaceNotificationCard() {
  const router = useRouter();
  const { language } = usePrefs();
  const T = useT(language);

  // 初始状态必须与服务端一致（服务端无 localStorage → 空），否则首帧就水合失配。
  // 真实通知在 mount 后的 effect 里从 localStorage 读入，读入前显示骨架屏。
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function refresh() {
      try {
        await checkNotifications(abortController.signal);
      } catch (e) {
        const err = e as Error;
        if (err.name === "AbortError" || err.message.includes("ERR_ABORTED")) {
          return;
        }
      }

      if (!abortController.signal.aborted) {
        const all = getAllNotifications();
        setNotifications(all.slice(0, 3));
        setUnreadCount(all.filter((n) => !n.read).length);
        setLoaded(true);
      }
    }

    refresh();
    return () => {
      abortController.abort();
    };
  }, []);

  if (!loaded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />
        </div>
        <div className="mt-4 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (unreadCount === 0 && notifications.length === 0) {
    return (
      <div
        onClick={() => router.push("/notifications")}
        className="block w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-sky-200 hover:shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[var(--brand)]" />
            <span className="text-sm font-medium text-slate-900">{T("notif.title")}</span>
          </div>
          <span className="text-xs text-slate-400">{T("notif.empty")} →</span>
        </div>
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-center">
          <div className="text-xs text-slate-500">
            {T("tabs.followup.hint")}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push("/subscribe#notify");
            }}
            className="mt-2 inline-flex items-center gap-0.5 text-xs text-sky-600 hover:text-sky-700"
          >
            {T("notif.setup")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/notifications"
      className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-sky-200 hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-[var(--brand)]" />
          <span className="text-sm font-medium text-slate-900">{T("notif.title")}</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-medium text-white">
              {unreadCount > 99 ? "99+" : unreadCount} {T("notif.unread")}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">{T("notif.viewall")}</span>
      </div>

      <div className="mt-4 space-y-2">
        {notifications.slice(0, 2).map((notif) => (
          <div
            key={notif.id}
            className={`flex items-start gap-2 rounded-xl p-3 ${
              notif.read ? "bg-slate-50" : "bg-sky-50/50"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {notif.read ? (
                <MailOpen className="h-4 w-4 text-slate-400" />
              ) : (
                <Bell className="h-4 w-4 text-[var(--brand)]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">{notif.departmentName}</span>
              </div>
              <div className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-800">
                {notif.policyTitle}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}

type WorkspaceItem = {
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
  isStarred?: boolean;
  isRead?: boolean;
  hasFunding?: boolean;
  hasProcurement?: boolean;
  hasPilot?: boolean;
  hasStandards?: boolean;
};

type WorkspaceTabKey = "followup" | "today" | "starred";

const TAB_CONFIG: Array<{ key: WorkspaceTabKey; i18nKey: TranslationKey; Icon: LucideIcon }> = [
  { key: "followup", i18nKey: "tabs.followup", Icon: ClipboardList },
  { key: "today",    i18nKey: "tabs.today",    Icon: Flame },
  { key: "starred",  i18nKey: "tabs.starred",  Icon: Star },
];

function summarizeTitle(title: string, maxLen = 56): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen) + "…";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

export function WorkspaceTabs({
  todayItems,
  starredItems,
}: {
  todayItems: WorkspaceItem[];
  starredItems: WorkspaceItem[];
}) {
  const { language } = usePrefs();
  const T = useT(language);

  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>("followup");
  // 从 localStorage 读取的关注列表在 mount 后再填充（见下方 effect），
  // 初始与服务端一致为空，避免水合失配。
  const [followupItems, setFollowupItems] = useState<PersonalResearchItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [subsLoaded, setSubsLoaded] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();
    async function loadSubs() {
      const subs = await fetchSubscriptions(abortController.signal);
      if (!abortController.signal.aborted) {
        setSubscriptions(subs);
        setSubsLoaded(true);
      }
    }
    loadSubs();
    return () => {
      abortController.abort();
    };
  }, []);

  const subscribedGroups = useMemo(() => groupSubscriptions(subscriptions), [subscriptions]);

  const getFollowInfo = useCallback(
    (item: WorkspaceItem): FollowMatchResult => {
      return calculateFollowScore({
        departmentName: item.departmentName,
        categories: item.categories,
        title: item.title,
        subscribedDepartments: subscribedGroups.departments,
        subscribedKeywords: subscribedGroups.keywords,
      });
    },
    [subscribedGroups],
  );

  const matchItem = useCallback(
    (item: WorkspaceItem): MatchedSubscription[] => {
      return getFollowInfo(item).allMatches.slice(0, 2);
    },
    [getFollowInfo],
  );

  const todayItemsWithFollow = useMemo(() => {
    if (!subsLoaded) return todayItems;
    return sortByFollowPriority(
      todayItems,
      (item) => getFollowInfo(item),
      (item) => item.keywordScore,
    );
  }, [todayItems, subsLoaded, getFollowInfo]);

  const followedTodayItems = useMemo(() => {
    if (!subsLoaded) return [];
    return todayItems.filter((item) => getFollowInfo(item).isFollowed).slice(0, 5);
  }, [todayItems, subsLoaded, getFollowInfo]);

  const followCount = useMemo(() => {
    if (!subsLoaded) return 0;
    return todayItems.filter((item) => getFollowInfo(item).isFollowed).length;
  }, [todayItems, subsLoaded, getFollowInfo]);

  const refreshFollowups = useCallback(() => {
    const all = getAllPersonalResearch();
    const active = all
      .filter((item) => ACTIVE_STATUSES.includes(item.followUpStatus))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8);
    setFollowupItems(active);
  }, []);

  useEffect(() => {
    refreshFollowups();
    setLoaded(true);
  }, [refreshFollowups]);

  function handleStatusChange(
    sourceId: string,
    url: string,
    title: string,
    status: FollowUpStatus,
  ) {
    setFollowUpStatusStorage(sourceId, url, title, status);
    refreshFollowups();
  }

  const tabCounts = {
    followup: followupItems.length,
    today: todayItems.length,
    starred: starredItems.length,
  };

  const hasSubscriptions = subsLoaded && (subscribedGroups.departments.length > 0 || subscribedGroups.keywords.length > 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {hasSubscriptions && followCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white px-4 py-3">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 shrink-0 text-[var(--brand)]" />
            <div>
              <div className="text-sm font-medium text-slate-900">
                {T("tabs.today.count", { n: followCount })}
              </div>
              <div className="text-xs text-slate-500">
                {T("tabs.today.sources", { d: subscribedGroups.departments.length, k: subscribedGroups.keywords.length })}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className="shrink-0 rounded-full bg-sky-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700"
          >
            {T("tabs.today.view-btn")}
          </button>
        </div>
      )}

      {!hasSubscriptions && subsLoaded && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <div className="text-sm font-medium text-slate-700">
                {T("tabs.today.setup")}
              </div>
              <div className="text-xs text-slate-500">
                {T("tabs.today.setup-sub")}
              </div>
            </div>
          </div>
          <Link
            href="/subscribe"
            className="shrink-0 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {T("tabs.subscribe.btn")}
          </Link>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-slate-200 pb-3 overflow-x-auto -mx-1 px-1 scrollbar-hide sm:overflow-visible sm:mx-0 sm:px-0">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-sm ${
              activeTab === tab.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <tab.Icon className="h-4 w-4" />
            <span>{T(tab.i18nKey)}</span>
            <span
              className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                activeTab === tab.key
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Follow-ups tab */}
      {activeTab === "followup" && (
        <div className="mt-4">
          {!loaded ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-slate-100 p-4"
                >
                  <div className="h-4 w-24 bg-slate-100 rounded" />
                  <div className="mt-2 h-5 w-full bg-slate-100 rounded" />
                  <div className="mt-1 h-4 w-2/3 bg-slate-50 rounded" />
                </div>
              ))}
            </div>
          ) : followupItems.length === 0 ? (
            <div className="py-10 text-center">
              <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-600">
                {T("tabs.empty.followup")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {T("tabs.empty.followup-sub")}
              </p>
              <Link
                href="/inbox"
                className="inline-flex items-center gap-1 mt-4 text-sm text-slate-700 hover:text-slate-900"
              >
                {T("tabs.goto.inbox")}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {ACTIVE_STATUSES.map((status) => {
                const items = followupItems.filter((item) => item.followUpStatus === status);
                if (items.length === 0) return null;
                return (
                  <div key={status}>
                    <div className="mb-2 flex items-center gap-2">
                      <StatusIcon status={status} className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium text-slate-500">
                        {FOLLOW_UP_STATUS_LABELS[status]}
                      </span>
                      <span className="text-[10px] text-slate-400">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={`${item.sourceId}::${item.url}`}
                          className="group rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-slate-400">
                                  {T("tabs.item.updated")} {formatDate(item.updatedAt)}
                                </span>
                              </div>
                              <Link
                                href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                                className="mt-1 block line-clamp-2 text-sm font-medium text-slate-900 hover:text-slate-700"
                              >
                                {summarizeTitle(item.title)}
                              </Link>
                              {item.note && (
                                <p className="mt-1.5 text-xs text-slate-500 line-clamp-1">
                                  <NotebookPen className="mr-1 inline h-3 w-3" aria-hidden />{item.note}
                                </p>
                              )}
                              {item.tags && item.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {item.tags.slice(0, 3).map((tag) => {
                                    const color = getTagColor(tag);
                                    return (
                                      <span
                                        key={tag}
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${color} border`}
                                      >
                                        {tag}
                                      </span>
                                    );
                                  })}
                                  {item.tags.length > 3 && (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                                      +{item.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {[
                              { status: "reading" as const, label: "在读", icon: Hourglass },
                              { status: "to_act" as const, label: "待行动", icon: Target },
                              { status: "done" as const, label: "已完成", icon: "✓" },
                            ].map((opt) => (
                              <button
                                key={opt.status}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(item.sourceId, item.url, item.title, opt.status);
                                }}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                                  item.followUpStatus === opt.status
                                    ? "bg-slate-900 text-white"
                                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <opt.icon className="h-3.5 w-3.5" aria-hidden />
                                <span>{opt.label}</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(item.sourceId, item.url, item.title, "none");
                              }}
                              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-slate-400 transition hover:text-slate-600"
                            >
                              {T("tabs.item.clear")}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {followupItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-center">
              <Link
                href="/research"
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                {T("tabs.viewall.followup")}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Today tab */}
      {activeTab === "today" && (
        <div className="mt-4">
          {todayItemsWithFollow.length === 0 ? (
            <div className="py-10 text-center">
              <MailOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden />
              <p className="text-sm text-slate-600">
                {T("tabs.empty.today")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {T("tabs.empty.today-sub")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayItemsWithFollow.slice(0, 8).map((item) => {
                const itemMatches = subsLoaded ? matchItem(item) : [];
                const followInfo = subsLoaded ? getFollowInfo(item) : null;
                const isInResearch = loaded && followupItems.some(
                  (f) => f.sourceId === item.sourceId && f.url === item.url
                );
                const isFollowed = followInfo?.isFollowed ?? false;
                return (
                  <div
                    key={`${item.sourceId}-${item.url}`}
                    className={`group rounded-2xl border p-4 transition hover:shadow-sm ${
                      isFollowed
                        ? "border-sky-200 bg-sky-50/30 hover:border-sky-300 hover:bg-sky-50/50"
                        : "border-slate-100 bg-slate-50/40 hover:border-slate-200 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-400">
                            {item.departmentName}
                          </span>
                          {subsLoaded && itemMatches.length > 0 && (
                            <SubscriptionBadge matches={itemMatches} compact />
                          )}
                          {item.keywordScore >= 40 && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              信号强度 {item.keywordScore}
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                          className="mt-1 block line-clamp-2 text-sm font-medium text-slate-900 hover:text-slate-700"
                        >
                          {summarizeTitle(item.title)}
                        </Link>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(item.sourceId, item.url, item.title, isInResearch ? "none" : "to_read");
                        }}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                          isInResearch
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <BookOpen className="h-3.5 w-3.5" aria-hidden />
                        <span>{isInResearch ? T("tabs.item.added-read") : T("tabs.item.add-read")}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {todayItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-center">
              <Link
                href="/signals"
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                {T("tabs.viewall.today")}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Starred tab */}
      {activeTab === "starred" && (
        <div className="mt-4">
          {starredItems.length === 0 ? (
            <div className="py-10 text-center">
              <Star className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-600">
                {T("tabs.empty.starred")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {T("tabs.empty.starred-sub")}
              </p>
              <Link
                href="/inbox"
                className="inline-flex items-center gap-1 mt-4 text-sm text-slate-700 hover:text-slate-900"
              >
                {T("tabs.goto.inbox")}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {starredItems.slice(0, 8).map((item) => {
                const itemMatches = subsLoaded ? matchItem(item) : [];
                const isInResearch = loaded && followupItems.some(
                  (f) => f.sourceId === item.sourceId && f.url === item.url
                );
                return (
                  <div
                    key={`${item.sourceId}-${item.url}`}
                    className="group rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition hover:border-slate-200 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 text-amber-500 text-lg">
                        ★
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-400">
                            {item.departmentName}
                          </span>
                          {subsLoaded && itemMatches.length > 0 && (
                            <SubscriptionBadge matches={itemMatches} compact />
                          )}
                        </div>
                        <Link
                          href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                          className="mt-1 block line-clamp-2 text-sm font-medium text-slate-900 hover:text-slate-700"
                        >
                          {summarizeTitle(item.title)}
                        </Link>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(item.sourceId, item.url, item.title, isInResearch ? "none" : "to_read");
                        }}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                          isInResearch
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <BookOpen className="h-3.5 w-3.5" aria-hidden />
                        <span>{isInResearch ? T("tabs.item.added-read") : T("tabs.item.add-read")}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {starredItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-center">
              <Link
                href="/research?tab=starred"
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                {T("tabs.viewall.starred")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
