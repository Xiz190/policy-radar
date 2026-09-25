"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type PolicyItem = {
  sourceId: string;
  departmentName: string;
  channelName: string;
  displayName: string;
  url: string;
  finalUrl?: string | null;
  title: string;
  listPublishedAt: string;
  firstSeenAt: string;
  isRead: boolean;
  isStarred: boolean;
  keywordScore: number;
  importanceLevel: string;
  categories: Array<{ category: string; score: number; topKeywords?: string[] }>;
  genres: string[];
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  deadlineDate?: string | null;
  matchedKeywordCount?: number;
  signalStrength?: number;
  hasFunding?: boolean;
  hasProcurement?: boolean;
  hasPilot?: boolean;
  hasStandards?: boolean;
};

export type SourceTreeNode = {
  departmentName: string;
  displayName?: string;
  totalCount: number;
  totalUnread?: number;
  unread: number;
  channels: Array<{ sourceId: string; channelName: string; count: number; unread: number }>;
};

export type CategoryCount = { category: string; count: number };
export type GenreCount = { genre: string; count: number };

type UsePolicyListOptions = {
  queryKey: string;
  pageSize?: number;
  buildParams: (page: number, pageSize: number, subscribedDepts: Set<string>, subscribedKws: Set<string>) => URLSearchParams;
  setSourcesTree?: (tree: SourceTreeNode[]) => void;
};

function dedupSourcesTree(tree: SourceTreeNode[]): SourceTreeNode[] {
  const seenDepts = new Set<string>();
  const result: SourceTreeNode[] = [];
  for (const raw of tree) {
    if (!raw?.departmentName) continue;
    if (seenDepts.has(raw.departmentName)) continue;
    seenDepts.add(raw.departmentName);
    const seenChannels = new Set<string>();
    const uniqueChannels: typeof raw.channels = [];
    for (const c of raw.channels || []) {
      if (!c?.channelName) continue;
      if (seenChannels.has(c.channelName)) continue;
      seenChannels.add(c.channelName);
      uniqueChannels.push(c);
    }
    uniqueChannels.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    const totalUnread = uniqueChannels.reduce((s, c) => s + (c.unread ?? 0), 0);
    result.push({
      departmentName: raw.departmentName,
      displayName: raw.displayName || raw.departmentName,
      totalCount: uniqueChannels.reduce((s, c) => s + (c.count ?? 0), 0),
      totalUnread,
      unread: totalUnread,
      channels: uniqueChannels,
    });
  }
  return result;
}

export function usePolicyList({ queryKey, pageSize = 15, buildParams, setSourcesTree }: UsePolicyListOptions) {
  const [items, setItems] = useState<PolicyItem[]>([]);
  const [sourcesTree, setSourcesTreeState] = useState<SourceTreeNode[]>([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryCount[]>([]);
  const [genresWithCounts, setGenresWithCounts] = useState<GenreCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [lastApiError, setLastApiError] = useState<string | null>(null);
  const [lastApiUrl, setLastApiUrl] = useState<string>("");
  const [lastApiReturned, setLastApiReturned] = useState<number | null>(null);
  const [lastApiTotal, setLastApiTotal] = useState<number | null>(null);

  const [subscribedDepartments, setSubscribedDepartments] = useState<Set<string>>(new Set());
  const [subscribedKeywords, setSubscribedKeywords] = useState<Set<string>>(new Set());
  const [subscriptionsLoaded, setSubscriptionsLoaded] = useState(false);

  const sourcesTreeRef = useRef<SourceTreeNode[]>([]);
  const categoriesWithCountsRef = useRef<CategoryCount[]>([]);
  const genresWithCountsRef = useRef<GenreCount[]>([]);
  useLayoutEffect(() => {
    sourcesTreeRef.current = sourcesTree;
    categoriesWithCountsRef.current = categoriesWithCounts;
    genresWithCountsRef.current = genresWithCounts;
    setSourcesTree?.(sourcesTree);
  }, [sourcesTree, categoriesWithCounts, genresWithCounts, setSourcesTree]);

  const dimensionsLoadedRef = useRef(false);
  const dimensionsLoadingRef = useRef(false);
  const dimensionsAbortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pageRef = useRef(page);
  const buildParamsRef = useRef(buildParams);
  const loadItemsRawRef = useRef<(currentPage: number) => Promise<void>>(() => Promise.resolve());

  useLayoutEffect(() => {
    pageRef.current = page;
    buildParamsRef.current = buildParams;
    loadItemsRawRef.current = loadItemsRaw;
  });

  async function loadDimensionsOnce() {
    if (dimensionsLoadedRef.current || dimensionsLoadingRef.current) return;
    dimensionsLoadingRef.current = true;
    if (dimensionsAbortRef.current) {
      try { dimensionsAbortRef.current.abort(); } catch {}
    }
    const ac = new AbortController();
    dimensionsAbortRef.current = ac;
    try {
      const res = await fetch("/api/monitor/items?view=dimensions", {
        cache: "no-store",
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (!res.ok) return;
      const json = await res.json();
      if (ac.signal.aborted) return;

      if (Array.isArray(json.sourcesTree) && sourcesTreeRef.current.length === 0) {
        const deduped = dedupSourcesTree(json.sourcesTree);
        sourcesTreeRef.current = deduped;
        setSourcesTreeState(deduped);
      }
      if (Array.isArray(json.categoriesWithCounts) && categoriesWithCountsRef.current.length === 0) {
        categoriesWithCountsRef.current = json.categoriesWithCounts;
        setCategoriesWithCounts(json.categoriesWithCounts);
      }
      if (Array.isArray(json.genresWithCounts) && genresWithCountsRef.current.length === 0) {
        genresWithCountsRef.current = json.genresWithCounts;
        setGenresWithCounts(json.genresWithCounts);
      }
      dimensionsLoadedRef.current = true;
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        // ignore
      }
    } finally {
      dimensionsLoadingRef.current = false;
      if (dimensionsAbortRef.current === ac) dimensionsAbortRef.current = null;
    }
  }

  async function loadItemsRaw(currentPage: number) {
    setLoading(true);
    setLastApiError(null);
    try {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch {}
      }
      const myController = new AbortController();
      abortControllerRef.current = myController;
      const myRequestId = ++requestIdRef.current;

      const params = buildParamsRef.current(
        currentPage,
        pageSize,
        subscribedDepartments,
        subscribedKeywords,
      );
      const finalUrl = `/api/monitor/items?${params.toString()}`;
      setLastApiUrl(finalUrl);

      const FETCH_TIMEOUT_MS = 10000;
      const timeoutTimer = setTimeout(() => {
        myController.abort();
      }, FETCH_TIMEOUT_MS);

      const dimPromise = Promise.resolve().then(() => {
        if (!dimensionsLoadedRef.current) return loadDimensionsOnce();
        return Promise.resolve();
      });

      let json: {
        items?: unknown[];
        totalCount?: number;
        sourcesTree?: unknown[];
        categoriesWithCounts?: unknown[];
        genresWithCounts?: unknown[];
        detail?: unknown;
        error?: unknown;
        message?: unknown;
      } = { items: [], totalCount: 0 };

      try {
        const res = await fetch(finalUrl, {
          cache: "no-store",
          signal: myController.signal,
        });
        clearTimeout(timeoutTimer);
        if (myController.signal.aborted) return;
        json = (await res.json()) as typeof json;
        if (myController.signal.aborted) return;
        if (!res.ok) {
          const errText =
            (String(json.detail ?? "") || String(json.error ?? "") || String(json.message ?? "")) ||
            `HTTP ${res.status} ${res.statusText}`;
          setLastApiError(errText);
          setItems([]);
          setTotalCount(0);
          return;
        }
      } catch (fetchErr) {
        clearTimeout(timeoutTimer);
        if (myController.signal.aborted) return;
        const errMsg = (fetchErr as Error).message || "fetch failed";
        setLastApiError(errMsg);
        setItems([]);
        setTotalCount(0);
        return;
      }

      try {
        await Promise.race([
          dimPromise,
          new Promise((resolve) => setTimeout(resolve, 300)),
        ]);
      } catch {}

      if (myRequestId !== requestIdRef.current) return;
      if (myController.signal.aborted) return;

      const list: PolicyItem[] = (json.items || []).map((raw) => {
        const r = raw as Record<string, unknown>;
        return {
          sourceId: r.sourceId as string,
          departmentName: r.departmentName as string,
          channelName: r.channelName as string,
          displayName: r.displayName as string,
          url: r.url as string,
          title: r.title as string,
          listPublishedAt: r.listPublishedAt as string,
          firstSeenAt: r.firstSeenAt as string,
          isRead: Boolean(r.isRead),
          isStarred: Boolean(r.isStarred),
          keywordScore: Number(r.keywordScore) || 0,
          importanceLevel: (r.importanceLevel as string) || "普通内容",
          categories: Array.isArray(r.categories) ? (r.categories as PolicyItem["categories"]) : [],
          genres: Array.isArray(r.genres) ? (r.genres as string[]) : [],
          effectiveFrom: (r.effectiveFrom as string | undefined) || null,
          effectiveTo: (r.effectiveTo as string | undefined) || null,
          deadlineDate: (r.deadlineDate as string | undefined) || null,
          matchedKeywordCount: typeof r.matchedKeywordCount === "number" ? r.matchedKeywordCount : undefined,
          signalStrength: typeof r.signalStrength === "number" ? r.signalStrength : undefined,
          hasFunding: typeof r.hasFunding === "boolean" ? r.hasFunding : undefined,
          hasProcurement: typeof r.hasProcurement === "boolean" ? r.hasProcurement : undefined,
          hasPilot: typeof r.hasPilot === "boolean" ? r.hasPilot : undefined,
          hasStandards: typeof r.hasStandards === "boolean" ? r.hasStandards : undefined,
        };
      });
      setItems(list);
      const tc = typeof json.totalCount === "number" ? json.totalCount : null;
      if (tc !== null) setTotalCount(tc);
      setLastApiReturned(list.length);
      setLastApiTotal(tc);

      if (json.sourcesTree && json.sourcesTree.length > 0 && sourcesTreeRef.current.length === 0) {
        const deduped = dedupSourcesTree(json.sourcesTree as SourceTreeNode[]);
        sourcesTreeRef.current = deduped;
        setSourcesTreeState(deduped);
      }
      if (json.categoriesWithCounts && categoriesWithCountsRef.current.length === 0) {
        categoriesWithCountsRef.current = json.categoriesWithCounts as CategoryCount[];
        setCategoriesWithCounts(json.categoriesWithCounts as CategoryCount[]);
      }
      if (json.genresWithCounts && genresWithCountsRef.current.length === 0) {
        genresWithCountsRef.current = json.genresWithCounts as GenreCount[];
        setGenresWithCounts(json.genresWithCounts as GenreCount[]);
      }
    } catch (e) {
      setLastApiError((e as Error).message || "unknown error");
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  const refresh = useCallback(() => {
    loadItemsRawRef.current(pageRef.current);
  }, []);

  useEffect(() => {
    const subController = new AbortController();
    const loadSubscriptions = async () => {
      try {
        const res = await fetch("/api/monitor/subscriptions", { signal: subController.signal });
        if (subController.signal.aborted) return;
        if (res.ok) {
          const json = await res.json();
          if (subController.signal.aborted) return;
          const subList: Array<{ type: string; target: string; enabled: boolean }> =
            Array.isArray(json?.subscriptions) ? json.subscriptions : [];
          const depts = new Set<string>();
          const kws = new Set<string>();
          for (const sub of subList) {
            if (sub.enabled) {
              if (sub.type === "department") depts.add(sub.target);
              if (sub.type === "keyword") kws.add(sub.target);
            }
          }
          setSubscribedDepartments(depts);
          setSubscribedKeywords(kws);
        }
      } catch {
        // ignore
      } finally {
        if (!subController.signal.aborted) {
          setSubscriptionsLoaded(true);
        }
      }
    };
    loadSubscriptions();

    return () => {
      subController.abort();
    };
  }, []);

  useLayoutEffect(() => {
    if (!subscriptionsLoaded) return;
    queueMicrotask(() => loadItemsRaw(page));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, page, subscriptionsLoaded]);

  useLayoutEffect(() => {
    queueMicrotask(() => setPage(1));
  }, [queryKey]);

  const goToPage = useCallback((next: number) => {
    if (typeof window === "undefined") return;
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    items,
    sourcesTree,
    categoriesWithCounts,
    genresWithCounts,
    loading,
    page,
    totalCount,
    totalPages,
    goToPage,
    refresh,
    lastApiError,
    lastApiUrl,
    lastApiReturned,
    lastApiTotal,
    subscribedDepartments,
    subscribedKeywords,
    setItems,
  };
}
