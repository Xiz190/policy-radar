// 订阅匹配工具函数
// 用于判断政策是否匹配用户关注的部委/关键词，并生成展示标签

export type SubscriptionRecord = {
  id: string;
  userId: string;
  type: "department" | "keyword" | "category";
  target: string;
  targetName: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MatchedSubscription = {
  type: "department" | "keyword";
  target: string;
  displayName: string;
};

const DEBUG = process.env.SUBSCRIPTION_DEBUG === "1";

function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log("[SubscriptionUtils]", ...args);
  }
}

export function groupSubscriptions(subscriptions: SubscriptionRecord[]) {
  const departments: Array<{ target: string; displayName: string }> = [];
  const keywords: Array<{ target: string; displayName: string }> = [];
  const categories: Array<{ target: string; displayName: string }> = [];

  for (const sub of subscriptions) {
    if (!sub.enabled) continue;
    const displayName = sub.targetName || sub.target;
    if (sub.type === "department") {
      departments.push({ target: sub.target, displayName });
    } else if (sub.type === "keyword") {
      keywords.push({ target: sub.target, displayName });
    } else if (sub.type === "category") {
      categories.push({ target: sub.target, displayName });
    }
  }

  debugLog(`分组结果: 部委=${departments.length}, 关键词=${keywords.length}, 分类=${categories.length}`);
  return { departments, keywords, categories };
}

export function matchItemSubscriptions(params: {
  departmentName: string;
  matchedKeywords: string[];
  subscribedDepartments: Array<{ target: string; displayName: string }>;
  subscribedKeywords: Array<{ target: string; displayName: string }>;
  maxDisplay?: number;
}): MatchedSubscription[] {
  const {
    departmentName,
    matchedKeywords,
    subscribedDepartments,
    subscribedKeywords,
    maxDisplay = 2,
  } = params;

  const results: MatchedSubscription[] = [];

  for (const dept of subscribedDepartments) {
    if (departmentName === dept.target || departmentName.includes(dept.target)) {
      results.push({
        type: "department",
        target: dept.target,
        displayName: dept.displayName,
      });
      break;
    }
  }

  const keywordSet = new Set(matchedKeywords.map((k) => k.toLowerCase()));
  for (const kw of subscribedKeywords) {
    if (keywordSet.has(kw.target.toLowerCase())) {
      results.push({
        type: "keyword",
        target: kw.target,
        displayName: kw.displayName,
      });
    }
  }

  debugLog(
    `匹配结果: 政策=${departmentName}, 命中关键词=${matchedKeywords.length}, 匹配订阅=${results.length}`,
  );

  return results.slice(0, maxDisplay);
}

export function hasAnySubscription(subscriptions: SubscriptionRecord[]): boolean {
  return subscriptions.some((s) => s.enabled);
}

export function getSubscriptionCount(subscriptions: SubscriptionRecord[]): {
  departments: number;
  keywords: number;
  categories: number;
} {
  const { departments, keywords, categories } = groupSubscriptions(subscriptions);
  return {
    departments: departments.length,
    keywords: keywords.length,
    categories: categories.length,
  };
}

let cachedSubscriptions: SubscriptionRecord[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000;

let inflightPromise: Promise<SubscriptionRecord[]> | null = null;

export async function fetchSubscriptions(forceOrSignal: boolean | AbortSignal = false): Promise<SubscriptionRecord[]> {
  if (typeof window === "undefined") {
    debugLog("SSR 环境，跳过订阅数据获取");
    return [];
  }

  const force = typeof forceOrSignal === "boolean" ? forceOrSignal : false;
  const signal = typeof forceOrSignal === "object" ? forceOrSignal : undefined;

  const now = Date.now();
  if (!force && cachedSubscriptions && now - cacheTime < CACHE_TTL) {
    debugLog(`使用缓存的订阅数据，数量=${cachedSubscriptions.length}`);
    return cachedSubscriptions;
  }

  if (inflightPromise && !force) {
    debugLog("订阅请求正在进行中，共享该请求");
    try {
      const result = await inflightPromise;
      if (signal?.aborted) return cachedSubscriptions || result;
      return result;
    } catch {
      return cachedSubscriptions || [];
    }
  }

  inflightPromise = (async () => {
    try {
      const res = await fetch("/api/monitor/subscriptions", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        debugLog(`订阅数据获取失败: status=${res.status}`);
        return cachedSubscriptions || [];
      }
      const json = await res.json();
      const list: SubscriptionRecord[] = Array.isArray(json?.subscriptions)
        ? json.subscriptions
        : [];
      cachedSubscriptions = list;
      cacheTime = Date.now();
      debugLog(`订阅数据获取成功: 数量=${list.length}`);
      return list;
    } catch (e) {
      const err = e as Error;
      debugLog(`订阅数据获取异常: ${err.message}`);
      return cachedSubscriptions || [];
    }
  })();

  try {
    const result = await inflightPromise;
    if (signal?.aborted) return cachedSubscriptions || result;
    return result;
  } finally {
    inflightPromise = null;
  }
}

export function clearSubscriptionCache() {
  cachedSubscriptions = null;
  cacheTime = 0;
  debugLog("订阅缓存已清除");
}

export type FollowMatchResult = {
  isFollowed: boolean;
  score: number;
  matchedDepartments: Array<{ target: string; displayName: string }>;
  matchedKeywords: Array<{ target: string; displayName: string }>;
  allMatches: MatchedSubscription[];
};

export function calculateFollowScore(params: {
  departmentName: string;
  categories?: Array<{ category: string; score: number; topKeywords?: string[] }>;
  title?: string;
  subscribedDepartments: Array<{ target: string; displayName: string }>;
  subscribedKeywords: Array<{ target: string; displayName: string }>;
}): FollowMatchResult {
  const {
    departmentName,
    categories = [],
    title = "",
    subscribedDepartments,
    subscribedKeywords,
  } = params;

  let score = 0;
  const matchedDepartments: Array<{ target: string; displayName: string }> = [];
  const matchedKeywords: Array<{ target: string; displayName: string }> = [];

  for (const dept of subscribedDepartments) {
    if (departmentName === dept.target || departmentName.includes(dept.target) || dept.target.includes(departmentName)) {
      matchedDepartments.push(dept);
      score += 10;
      break;
    }
  }

  const allTopKeywords = new Set<string>();
  for (const cat of categories) {
    if (cat.topKeywords) {
      for (const kw of cat.topKeywords) {
        allTopKeywords.add(kw.toLowerCase());
      }
    }
  }

  const titleLower = title.toLowerCase();

  for (const kw of subscribedKeywords) {
    const kwLower = kw.target.toLowerCase();
    let hit = false;

    if (allTopKeywords.has(kwLower)) {
      hit = true;
    }

    if (!hit && titleLower && titleLower.includes(kwLower)) {
      hit = true;
    }

    if (hit) {
      matchedKeywords.push(kw);
      score += 5;
    }
  }

  const allMatches: MatchedSubscription[] = [
    ...matchedDepartments.map((d) => ({ type: "department" as const, target: d.target, displayName: d.displayName })),
    ...matchedKeywords.map((k) => ({ type: "keyword" as const, target: k.target, displayName: k.displayName })),
  ];

  return {
    isFollowed: matchedDepartments.length > 0 || matchedKeywords.length > 0,
    score,
    matchedDepartments,
    matchedKeywords,
    allMatches,
  };
}

export function sortByFollowPriority<T>(
  items: T[],
  getFollowInfo: (item: T) => FollowMatchResult,
  getSecondaryScore: (item: T) => number = () => 0,
): T[] {
  return [...items].sort((a, b) => {
    const aInfo = getFollowInfo(a);
    const bInfo = getFollowInfo(b);

    if (bInfo.score !== aInfo.score) {
      return bInfo.score - aInfo.score;
    }

    return getSecondaryScore(b) - getSecondaryScore(a);
  });
}
