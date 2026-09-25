// 站内通知核心逻辑
// - 通知生成：基于订阅和最新政策生成通知
// - 通知存储：localStorage 持久化
// - 通知管理：标记已读、全部标记已读、清理过期

import { fetchSubscriptions } from "@/lib/subscription-utils";

export type NotificationItem = {
  id: string;
  type: "new_policy_from_department" | "new_policy_from_keyword" | "high_priority" | "strong_signal";
  title: string;
  content: string;
  policySourceId: string;
  policyUrl: string;
  policyTitle: string;
  departmentName: string;
  matchedSubscriptions: Array<{
    type: "department" | "keyword";
    target: string;
    displayName: string;
  }>;
  publishedAt: string;
  createdAt: string;
  read: boolean;
  priorityLevel?: string;
  signalTypes?: string[];
};

const STORAGE_KEY = "monitor_notifications_v1";
const LAST_CHECK_KEY = "monitor_notifications_last_check";
const PREFS_KEY = "monitor_notification_prefs_v1";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟检查一次
const MAX_AGE_DAYS = 7; // 只保留 7 天内的通知

const DEBUG = process.env.NOTIFICATION_DEBUG === "1";

export type NotificationPrefs = {
  inAppEnabled: boolean;
  notifyOnDepartment: boolean;
  notifyOnKeyword: boolean;
  notifyOnHighPriority: boolean;
  notifyOnStrongSignal: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  inAppEnabled: true,
  notifyOnDepartment: true,
  notifyOnKeyword: true,
  notifyOnHighPriority: false,
  notifyOnStrongSignal: false,
};

export function getNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setNotificationPrefs(prefs: Partial<NotificationPrefs>): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  const current = getNotificationPrefs();
  const updated = { ...current, ...prefs };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  } catch {
    // 静默失败
  }
  return updated;
}

function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log("[Notifications]", ...args);
  }
}

function getAllFromStorage(): Record<string, NotificationItem> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    debugLog("读取通知失败:", e);
    return {};
  }
}

function saveAllToStorage(all: Record<string, NotificationItem>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    debugLog("保存通知失败:", e);
  }
}

function makeId(sourceId: string, url: string): string {
  return `${sourceId}::${url}`;
}

function cleanupExpired(all: Record<string, NotificationItem>): Record<string, NotificationItem> {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const result: Record<string, NotificationItem> = {};
  for (const [id, item] of Object.entries(all)) {
    if (new Date(item.createdAt).getTime() > cutoff) {
      result[id] = item;
    }
  }
  return result;
}

export function getAllNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  const all = cleanupExpired(getAllFromStorage());
  saveAllToStorage(all);
  return Object.values(all).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getUnreadCount(): number {
  if (typeof window === "undefined") return 0;
  const all = getAllFromStorage();
  return Object.values(all).filter((item) => !item.read).length;
}

export function markAsRead(id: string): void {
  if (typeof window === "undefined") return;
  const all = getAllFromStorage();
  if (all[id]) {
    all[id].read = true;
    saveAllToStorage(all);
  }
}

export function markAllAsRead(): void {
  if (typeof window === "undefined") return;
  const all = getAllFromStorage();
  for (const id of Object.keys(all)) {
    all[id].read = true;
  }
  saveAllToStorage(all);
}

export function clearAllNotifications(): void {
  if (typeof window === "undefined") return;
  saveAllToStorage({});
  debugLog("已清空所有通知");
}

export type SubscriptionRecord = {
  id: string;
  type: "department" | "keyword" | "category";
  target: string;
  targetName: string | null;
  enabled: boolean;
};

export type ContentItem = {
  sourceId: string;
  url: string;
  title: string;
  departmentName: string;
  listPublishedAt: string;
  matchedKeywords?: string[];
  importanceLevel?: string;
  matchedCategories?: string[];
  hasFunding?: boolean;
  hasProcurement?: boolean;
  hasPilot?: boolean;
  hasStandards?: boolean;
};

const HIGH_PRIORITY_LEVELS = ["核心关注", "重点内容"];
const STRONG_SIGNAL_CATEGORIES = ["A·强执行信号", "B·强支持信号"];

function getSignalTypes(policy: ContentItem): string[] {
  const types: string[] = [];
  if (policy.hasFunding) types.push("资金");
  if (policy.hasProcurement) types.push("采购");
  if (policy.hasPilot) types.push("试点");
  if (policy.hasStandards) types.push("标准");
  
  const categories = policy.matchedCategories || [];
  for (const cat of categories) {
    if (STRONG_SIGNAL_CATEGORIES.includes(cat)) {
      types.push(cat);
    }
  }
  
  return types;
}

function isHighPriority(policy: ContentItem): boolean {
  return HIGH_PRIORITY_LEVELS.includes(policy.importanceLevel || "");
}

function hasStrongSignal(policy: ContentItem): boolean {
  const signalTypes = getSignalTypes(policy);
  return signalTypes.length > 0;
}

export function generateNotifications(params: {
  subscriptions: SubscriptionRecord[];
  recentPolicies: ContentItem[];
  lastCheckTime?: number;
  prefs?: NotificationPrefs;
}): NotificationItem[] {
  const { subscriptions, recentPolicies, lastCheckTime, prefs } = params;

  const effectivePrefs = prefs ?? {
    inAppEnabled: true,
    notifyOnDepartment: true,
    notifyOnKeyword: true,
    notifyOnHighPriority: false,
    notifyOnStrongSignal: false,
  };

  if (!effectivePrefs.inAppEnabled) {
    debugLog("站内提醒已关闭，跳过通知生成");
    return [];
  }

  const enabledSubs = subscriptions.filter((s) => s.enabled);
  const deptSubs = effectivePrefs.notifyOnDepartment
    ? enabledSubs.filter((s) => s.type === "department")
    : [];
  const kwSubs = effectivePrefs.notifyOnKeyword
    ? enabledSubs.filter((s) => s.type === "keyword")
    : [];

  const notifications: NotificationItem[] = [];
  const seen = new Set<string>();

  for (const policy of recentPolicies) {
    if (lastCheckTime) {
      const pubTime = new Date(policy.listPublishedAt).getTime();
      if (pubTime < lastCheckTime) continue;
    }

    const matches: Array<{
      type: "department" | "keyword";
      target: string;
      displayName: string;
    }> = [];

    for (const dept of deptSubs) {
      if (
        policy.departmentName === dept.target ||
        policy.departmentName.includes(dept.target)
      ) {
        matches.push({
          type: "department",
          target: dept.target,
          displayName: dept.targetName || dept.target,
        });
        break;
      }
    }

    const policyKeywords = new Set(
      (policy.matchedKeywords || []).map((k) => k.toLowerCase()),
    );
    for (const kw of kwSubs) {
      if (policyKeywords.has(kw.target.toLowerCase())) {
        matches.push({
          type: "keyword",
          target: kw.target,
          displayName: kw.targetName || kw.target,
        });
      }
    }

    const isSubscribed = matches.length > 0;
    const priority = isHighPriority(policy);
    const strongSignal = hasStrongSignal(policy);
    const signalTypes = getSignalTypes(policy);

    if (!isSubscribed && !priority && !strongSignal) continue;

    const id = makeId(policy.sourceId, policy.url);
    if (seen.has(id)) continue;
    seen.add(id);

    let notificationType: NotificationItem["type"];
    let notificationTitle: string;

    if (priority && effectivePrefs.notifyOnHighPriority) {
      notificationType = "high_priority";
      notificationTitle = "高优先级政策";
    } else if (strongSignal && effectivePrefs.notifyOnStrongSignal) {
      notificationType = "strong_signal";
      notificationTitle = "强信号政策";
    } else if (isSubscribed) {
      const primaryType = matches[0].type;
      notificationType = primaryType === "department" ? "new_policy_from_department" : "new_policy_from_keyword";
      notificationTitle = `${policy.departmentName} 发布新政策`;
    } else {
      continue;
    }

    notifications.push({
      id,
      type: notificationType,
      title: notificationTitle,
      content: policy.title,
      policySourceId: policy.sourceId,
      policyUrl: policy.url,
      policyTitle: policy.title,
      departmentName: policy.departmentName,
      matchedSubscriptions: matches,
      publishedAt: policy.listPublishedAt,
      createdAt: new Date().toISOString(),
      read: false,
      priorityLevel: policy.importanceLevel,
      signalTypes: signalTypes.length > 0 ? signalTypes : undefined,
    });
  }

  debugLog(`生成 ${notifications.length} 条新通知`);
  return notifications;
}

export function mergeNotifications(
  existing: Record<string, NotificationItem>,
  newItems: NotificationItem[],
): Record<string, NotificationItem> {
  const merged = { ...existing };
  for (const item of newItems) {
    if (!merged[item.id]) {
      merged[item.id] = item;
    }
  }
  return cleanupExpired(merged);
}

export async function checkAndGenerateNotifications(
  fetchPolicies: () => Promise<ContentItem[]>,
  fetchSubscriptions: () => Promise<SubscriptionRecord[]>,
  force = false,
): Promise<{ newCount: number; totalCount: number; unreadCount: number }> {
  if (typeof window === "undefined") {
    return { newCount: 0, totalCount: 0, unreadCount: 0 };
  }

  const now = Date.now();
  const lastCheckRaw = window.localStorage.getItem(LAST_CHECK_KEY);
  const lastCheckTime = lastCheckRaw ? parseInt(lastCheckRaw, 10) : 0;

  if (!force && lastCheckTime > 0 && now - lastCheckTime < CHECK_INTERVAL) {
    debugLog("距离上次检查不足 5 分钟，跳过");
    const all = getAllFromStorage();
    return {
      newCount: 0,
      totalCount: Object.keys(all).length,
      unreadCount: Object.values(all).filter((i) => !i.read).length,
    };
  }

  try {
    const [subscriptions, recentPolicies, prefs] = await Promise.all([
      fetchSubscriptions(),
      fetchPolicies(),
      Promise.resolve(getNotificationPrefs()),
    ]);

    const existing = getAllFromStorage();
    const newNotifications = generateNotifications({
      subscriptions,
      recentPolicies,
      lastCheckTime: lastCheckTime > 0 ? lastCheckTime : undefined,
      prefs,
    });

    const merged = mergeNotifications(existing, newNotifications);
    saveAllToStorage(merged);
    window.localStorage.setItem(LAST_CHECK_KEY, String(now));

    const result = {
      newCount: newNotifications.length,
      totalCount: Object.keys(merged).length,
      unreadCount: Object.values(merged).filter((i) => !i.read).length,
    };
    debugLog("检查完成:", result);
    return result;
  } catch (e) {
    debugLog("检查通知失败:", e);
    const all = getAllFromStorage();
    return {
      newCount: 0,
      totalCount: Object.keys(all).length,
      unreadCount: Object.values(all).filter((i) => !i.read).length,
    };
  }
}

export function getLastCheckTime(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(LAST_CHECK_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

export function resetLastCheckTime(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LAST_CHECK_KEY);
  debugLog("已重置上次检查时间");
}

let inboxCache: ContentItem[] | null = null;
let inboxCacheTime = 0;
const INBOX_CACHE_TTL = 60 * 1000;
let inboxInflight: Promise<ContentItem[]> | null = null;

export async function fetchRecentPolicies(
  signal?: AbortSignal,
  limit = 30,
): Promise<ContentItem[]> {
  if (typeof window === "undefined") return [];

  const now = Date.now();
  if (inboxCache && now - inboxCacheTime < INBOX_CACHE_TTL) {
    return inboxCache;
  }

  if (inboxInflight) {
    try {
      const result = await inboxInflight;
      if (signal?.aborted) return inboxCache || result;
      return result;
    } catch {
      return inboxCache || [];
    }
  }

  inboxInflight = (async () => {
    try {
      const res = await fetch(`/api/inbox?sort=first_seen_at&limit=${limit}&offset=0`, {
        credentials: "same-origin",
      });
      if (!res.ok) return inboxCache || [];
      const json = await res.json();
      const items: ContentItem[] = Array.isArray(json?.items)
        ? json.items.map((item: Record<string, unknown>) => ({
            sourceId: item.sourceId,
            url: item.url,
            title: item.title,
            departmentName: item.departmentName,
            listPublishedAt: item.listPublishedAt || item.firstSeenAt,
            matchedKeywords: item.matchedKeywords || [],
            importanceLevel: item.importanceLevel,
            matchedCategories: item.matchedCategories || [],
            hasFunding: item.hasFunding,
            hasProcurement: item.hasProcurement,
            hasPilot: item.hasPilot,
            hasStandards: item.hasStandards,
          }))
        : [];
      inboxCache = items;
      inboxCacheTime = Date.now();
      return items;
    } catch {
      return inboxCache || [];
    }
  })();

  try {
    const result = await inboxInflight;
    if (signal?.aborted) return inboxCache || result;
    return result;
  } finally {
    inboxInflight = null;
  }
}

export function clearInboxCache() {
  inboxCache = null;
  inboxCacheTime = 0;
}

let checkInflight: Promise<{ newCount: number; totalCount: number; unreadCount: number }> | null = null;

export async function checkNotifications(
  signal?: AbortSignal,
  force = false,
): Promise<{ newCount: number; totalCount: number; unreadCount: number }> {
  if (typeof window === "undefined") {
    return { newCount: 0, totalCount: 0, unreadCount: 0 };
  }

  const now = Date.now();
  const lastCheckRaw = window.localStorage.getItem(LAST_CHECK_KEY);
  const lastCheckTime = lastCheckRaw ? parseInt(lastCheckRaw, 10) : 0;

  if (!force && lastCheckTime > 0 && now - lastCheckTime < CHECK_INTERVAL) {
    const all = getAllFromStorage();
    return {
      newCount: 0,
      totalCount: Object.keys(all).length,
      unreadCount: Object.values(all).filter((i) => !i.read).length,
    };
  }

  if (checkInflight && !force) {
    try {
      return await checkInflight;
    } catch {
      const all = getAllFromStorage();
      return {
        newCount: 0,
        totalCount: Object.keys(all).length,
        unreadCount: Object.values(all).filter((i) => !i.read).length,
      };
    }
  }

  checkInflight = (async () => {
    try {
      const [subscriptions, recentPolicies, prefs] = await Promise.all([
        fetchSubscriptions(signal),
        fetchRecentPolicies(signal, 30),
        Promise.resolve(getNotificationPrefs()),
      ]);

      const existing = getAllFromStorage();
      const newNotifications = generateNotifications({
        subscriptions,
        recentPolicies,
        lastCheckTime: lastCheckTime > 0 ? lastCheckTime : undefined,
        prefs,
      });

      const merged = mergeNotifications(existing, newNotifications);
      saveAllToStorage(merged);
      window.localStorage.setItem(LAST_CHECK_KEY, String(now));

      const result = {
        newCount: newNotifications.length,
        totalCount: Object.keys(merged).length,
        unreadCount: Object.values(merged).filter((i) => !i.read).length,
      };
      debugLog("检查完成:", result);
      return result;
    } catch (e) {
      debugLog("检查通知失败:", e);
      const all = getAllFromStorage();
      return {
        newCount: 0,
        totalCount: Object.keys(all).length,
        unreadCount: Object.values(all).filter((i) => !i.read).length,
      };
    }
  })();

  try {
    return await checkInflight;
  } finally {
    checkInflight = null;
  }
}
