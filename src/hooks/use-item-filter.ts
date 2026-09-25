"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHANNEL_GROUPS,
  classifyChannelGroup,
  type ChannelGroupKey,
} from "@/lib/monitor/channel-group";

export type ViewMode = "all" | "unread" | "starred" | "signals" | "byDepartment" | "byCategory";

export type DateField = "list_published_at" | "first_seen_at";
export type SortField = "relevance" | "first_seen_at" | "published_at";

export type PolicyFilterState = {
  q: string;
  onlyUnread: boolean;
  onlyStarred: boolean;
  onlyUrgent: boolean;
  selectedDepts: Set<string>;
  selectedChannels: Set<string>;
  expandedDepts: Set<string>;
  importanceLevels: Set<string>;
  selectedCategories: Set<string>;
  selectedGenres: Set<string>;
  selectedChannelGroups: Set<ChannelGroupKey>;
  fromDate: string;
  toDate: string;
  dateField: DateField;
  sort: SortField;
  view: ViewMode;
  signalFilter: SignalFilterType;
};

export type SignalFilterType =
  | "all"
  | "forecast"
  | "signal"
  | "funding"
  | "procurement"
  | "pilot"
  | "standards";

export const SIGNAL_FILTER_LABELS: Record<SignalFilterType, string> = {
  all: "全部信号",
  forecast: "已有预估",
  signal: "有信号待处理",
  funding: "资金信号",
  procurement: "采购信号",
  pilot: "试点示范",
  standards: "标准规范",
};

const GENRE_LIST = [
  "公告",
  "公报",
  "其他",
  "决议决定",
  "函",
  "意见",
  "批复",
  "报告",
  "通告",
  "通报",
  "通知",
  "部令",
];

function makeEmptyState(): PolicyFilterState {
  return {
    q: "",
    onlyUnread: false,
    onlyStarred: false,
    onlyUrgent: false,
    selectedDepts: new Set<string>(),
    selectedChannels: new Set<string>(),
    expandedDepts: new Set<string>(),
    importanceLevels: new Set<string>(),
    selectedCategories: new Set<string>(),
    selectedGenres: new Set<string>(),
    selectedChannelGroups: new Set<ChannelGroupKey>(),
    fromDate: "",
    toDate: "",
    dateField: "list_published_at",
    sort: "first_seen_at",
    view: "all",
    signalFilter: "all",
  };
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function parseUrlStateFromLocation(): PolicyFilterState | null {
  if (typeof window === "undefined") return null;
  try {
    const sp = new URLSearchParams(window.location.search);
    const deptParam = sp.get("departmentName");
    const chParam = sp.get("channelNames");
    const onlyUnreadParam = sp.get("onlyUnread");
    const onlyStarredParam = sp.get("onlyStarred");
    const onlyUrgentParam = sp.get("onlyUrgent");
    const qParam = sp.get("q");
    const categoriesParam = sp.get("categories");
    const genresParam = sp.get("genres");
    const fromParam = sp.get("fromDate");
    const toParam = sp.get("toDate");
    const dateFieldParam = sp.get("dateField");
    const sortParam = sp.get("sort");
    const viewParam = sp.get("view");
    const channelGroupsParam = sp.get("channelGroups");
    const signalFilterParam = sp.get("signalFilter");

    const deptNames = deptParam ? deptParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const chNames = chParam ? chParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const catNames = categoriesParam ? categoriesParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const genreNames = genresParam ? genresParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const cgNames = channelGroupsParam
      ? channelGroupsParam.split(",").map((s) => s.trim()).filter(Boolean) as ChannelGroupKey[]
      : [];

    const dateField: DateField =
      dateFieldParam === "list_published_at" || dateFieldParam === "first_seen_at"
        ? dateFieldParam
        : "list_published_at";
    const sort: SortField =
      sortParam === "relevance" || sortParam === "first_seen_at" || sortParam === "published_at"
        ? sortParam
        : "first_seen_at";

    let view: ViewMode = "all";
    if (viewParam === "all" || viewParam === "unread" || viewParam === "starred" ||
        viewParam === "signals" || viewParam === "byDepartment" || viewParam === "byCategory") {
      view = viewParam;
    } else if (onlyStarredParam === "1" || onlyStarredParam === "true") {
      view = "starred";
    }

    let signalFilter: SignalFilterType = "all";
    if (signalFilterParam && ["all", "forecast", "signal", "funding", "procurement", "pilot", "standards"].includes(signalFilterParam)) {
      signalFilter = signalFilterParam as SignalFilterType;
    }

    return {
      q: qParam || "",
      onlyUnread: onlyUnreadParam === "1" || onlyUnreadParam === "true",
      onlyStarred: onlyStarredParam === "1" || onlyStarredParam === "true",
      onlyUrgent: onlyUrgentParam === "1" || onlyUrgentParam === "true",
      selectedDepts: new Set(deptNames),
      selectedChannels: new Set(chNames),
      expandedDepts: new Set(deptNames),
      importanceLevels:
        onlyUrgentParam === "1" || onlyUrgentParam === "true"
          ? new Set(["核心关注"])
          : new Set<string>(),
      selectedCategories: new Set(catNames),
      selectedGenres: new Set(genreNames),
      selectedChannelGroups: new Set(cgNames),
      fromDate: fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : "",
      toDate: toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : "",
      dateField,
      sort,
      view,
      signalFilter,
    };
  } catch {
    return null;
  }
}

type SourceTreeNode = {
  departmentName: string;
  channels: Array<{ sourceId: string; channelName: string; count: number; unread: number }>;
};

function collectSourceIds(
  tree: SourceTreeNode[],
  depts: Set<string>,
  channels: Set<string> | null,
): string[] {
  const ids: string[] = [];
  for (const node of tree) {
    if (depts.size > 0 && !depts.has(node.departmentName)) continue;
    for (const c of node.channels) {
      if (channels && !channels.has(c.channelName)) continue;
      ids.push(c.sourceId);
    }
  }
  return ids;
}

export function useItemFilter() {
  const [state, setState] = useState<PolicyFilterState>(() => makeEmptyState());
  const initializedRef = useRef(false);
  const sourcesTreeRef = useRef<SourceTreeNode[]>([]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const fromUrl = parseUrlStateFromLocation();
    if (!fromUrl) return;
    queueMicrotask(() => {
      setState(fromUrl);
    });
  }, []);

  const setQ = useCallback((q: string) => {
    setState((s) => ({ ...s, q }));
  }, []);

  const setOnlyUnread = useCallback((onlyUnread: boolean) => {
    setState((s) => ({ ...s, onlyUnread }));
  }, []);

  const setOnlyStarred = useCallback((onlyStarred: boolean) => {
    setState((s) => ({ ...s, onlyStarred }));
  }, []);

  const setFromDate = useCallback((fromDate: string) => {
    setState((s) => ({ ...s, fromDate }));
  }, []);

  const setToDate = useCallback((toDate: string) => {
    setState((s) => ({ ...s, toDate }));
  }, []);

  const setDateField = useCallback((dateField: DateField) => {
    setState((s) => ({ ...s, dateField }));
  }, []);

  const setSort = useCallback((sort: SortField) => {
    setState((s) => ({ ...s, sort }));
  }, []);

  const setView = useCallback((view: ViewMode) => {
    setState((s) => {
      const next: PolicyFilterState = { ...s, view };
      if (view === "all") {
        next.onlyStarred = false;
        next.onlyUnread = false;
      } else if (view === "unread") {
        next.onlyUnread = true;
        next.onlyStarred = false;
      } else if (view === "starred") {
        next.onlyStarred = true;
        next.onlyUnread = false;
      } else if (view === "signals") {
        next.onlyStarred = false;
        next.onlyUnread = false;
        if (next.selectedCategories.size === 0) {
          next.selectedCategories = new Set([
            "A·强执行信号",
            "B·强支持信号",
            "C·风险信号",
            "D·探索信号",
            "通用启动/落地",
          ]);
        }
      }
      return next;
    });
  }, []);

  const setSignalFilter = useCallback((signalFilter: SignalFilterType) => {
    setState((s) => ({ ...s, signalFilter }));
  }, []);

  const toggleDepartment = useCallback((deptName: string) => {
    setState((s) => {
      const had = s.selectedDepts.has(deptName);
      const nextDepts = toggleInSet(s.selectedDepts, deptName);
      let nextChannels = s.selectedChannels;
      if (had) {
        const deptChannels = sourcesTreeRef.current.find((d) => d.departmentName === deptName)?.channels ?? [];
        const next = new Set(s.selectedChannels);
        deptChannels.forEach((c) => next.delete(c.channelName));
        nextChannels = next;
      }
      return { ...s, selectedDepts: nextDepts, selectedChannels: nextChannels };
    });
  }, []);

  const toggleChannel = useCallback((deptName: string, channelName: string) => {
    setState((s) => {
      const nextDepts = new Set(s.selectedDepts);
      nextDepts.add(deptName);
      return {
        ...s,
        selectedDepts: nextDepts,
        selectedChannels: toggleInSet(s.selectedChannels, channelName),
      };
    });
  }, []);

  const toggleExpandedDept = useCallback((deptName: string) => {
    setState((s) => ({
      ...s,
      expandedDepts: toggleInSet(s.expandedDepts, deptName),
    }));
  }, []);

  const toggleImportanceLevel = useCallback((level: string) => {
    setState((s) => ({
      ...s,
      importanceLevels: toggleInSet(s.importanceLevels, level),
    }));
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setState((s) => ({
      ...s,
      selectedCategories: toggleInSet(s.selectedCategories, category),
    }));
  }, []);

  const toggleGenre = useCallback((genre: string) => {
    setState((s) => ({
      ...s,
      selectedGenres: toggleInSet(s.selectedGenres, genre),
    }));
  }, []);

  const toggleChannelGroup = useCallback((key: ChannelGroupKey) => {
    setState((s) => ({
      ...s,
      selectedChannelGroups: toggleInSet(s.selectedChannelGroups, key),
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setState((s) => ({
      ...makeEmptyState(),
      view: s.view,
    }));
  }, []);

  const setSourcesTree = useCallback((tree: SourceTreeNode[]) => {
    sourcesTreeRef.current = tree;
  }, []);

  const hasAnyFilter = useMemo(() => {
    return (
      state.q.trim().length > 0 ||
      state.onlyUnread ||
      state.onlyStarred ||
      state.selectedDepts.size > 0 ||
      state.selectedChannels.size > 0 ||
      state.selectedChannelGroups.size > 0 ||
      state.importanceLevels.size > 0 ||
      state.selectedCategories.size > 0 ||
      state.selectedGenres.size > 0 ||
      state.fromDate.length > 0 ||
      state.toDate.length > 0 ||
      state.signalFilter !== "all"
    );
  }, [state]);

  const queryKey = useMemo(() => {
    return [
      state.q.trim(),
      state.onlyUnread ? "1" : "0",
      state.onlyStarred ? "1" : "0",
      Array.from(state.selectedDepts).sort().join("|"),
      Array.from(state.selectedChannels).sort().join("|"),
      Array.from(state.selectedChannelGroups).sort().join("|"),
      Array.from(state.importanceLevels).sort().join("|"),
      Array.from(state.selectedCategories).sort().join("|"),
      Array.from(state.selectedGenres).sort().join("|"),
      state.fromDate,
      state.toDate,
      state.dateField,
      state.sort,
      state.view,
      state.signalFilter,
    ].join("§");
  }, [state]);

  const buildParams = useCallback(
    (currentPage: number, pageSize: number, subscribedDepartments: Set<string>, subscribedKeywords: Set<string>): URLSearchParams => {
      const params = new URLSearchParams();
      params.set("view", "list");
      params.set("limit", String(pageSize));
      params.set("offset", String(Math.max(0, (currentPage - 1) * pageSize)));
      if (state.q.trim()) params.set("q", state.q.trim());
      if (state.onlyUnread) params.set("onlyUnread", "1");
      if (state.onlyStarred) params.set("onlyStarred", "1");

      const currentTree = sourcesTreeRef.current;
      const allChannelInTree = new Set<string>();
      for (const node of currentTree) for (const c of node.channels) allChannelInTree.add(c.channelName);

      const mergedChannelNames = new Set<string>(state.selectedChannels);
      if (state.selectedChannelGroups.size > 0) {
        for (const name of allChannelInTree) {
          if (state.selectedChannelGroups.has(classifyChannelGroup(name))) mergedChannelNames.add(name);
        }
      }

      if (mergedChannelNames.size > 0) {
        if (state.selectedDepts.size > 0) {
          const ids = collectSourceIds(currentTree, state.selectedDepts, mergedChannelNames);
          if (ids.length > 0) params.set("sourceIds", ids.join(","));
        } else {
          params.set("channelNames", Array.from(mergedChannelNames).join(","));
        }
      } else if (state.selectedDepts.size > 0) {
        const ids = collectSourceIds(currentTree, state.selectedDepts, null);
        if (ids.length > 0) params.set("sourceIds", ids.join(","));
      }

      if (state.selectedChannelGroups.size > 0) {
        params.set("channelGroups", Array.from(state.selectedChannelGroups).join(","));
      }

      if (state.importanceLevels.size > 0) params.set("importanceLevels", Array.from(state.importanceLevels).join(","));
      if (state.selectedCategories.size > 0) params.set("categories", Array.from(state.selectedCategories).join(","));
      if (state.selectedGenres.size > 0) params.set("genres", Array.from(state.selectedGenres).join(","));
      if (state.fromDate) params.set("fromDate", state.fromDate);
      if (state.toDate) params.set("toDate", state.toDate);
      if (state.dateField) params.set("dateField", state.dateField);
      if (state.sort) params.set("sort", state.sort);

      const subscribedDepts = Array.from(subscribedDepartments);
      const subscribedKws = Array.from(subscribedKeywords);
      if (subscribedDepts.length > 0) params.set("subscribedDepartments", subscribedDepts.join(","));
      if (subscribedKws.length > 0) params.set("subscribedKeywords", subscribedKws.join(","));

      return params;
    },
    [state],
  );

  const syncToUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (state.view !== "all") params.set("view", state.view);
    if (state.q.trim()) params.set("q", state.q.trim());
    if (state.onlyUnread) params.set("onlyUnread", "1");
    if (state.onlyStarred) params.set("onlyStarred", "1");
    if (state.selectedDepts.size > 0) params.set("departmentName", Array.from(state.selectedDepts).join(","));
    if (state.selectedChannels.size > 0) params.set("channelNames", Array.from(state.selectedChannels).join(","));
    if (state.selectedChannelGroups.size > 0) params.set("channelGroups", Array.from(state.selectedChannelGroups).join(","));
    if (state.importanceLevels.size > 0) params.set("importanceLevels", Array.from(state.importanceLevels).join(","));
    if (state.selectedCategories.size > 0) params.set("categories", Array.from(state.selectedCategories).join(","));
    if (state.selectedGenres.size > 0) params.set("genres", Array.from(state.selectedGenres).join(","));
    if (state.fromDate) params.set("fromDate", state.fromDate);
    if (state.toDate) params.set("toDate", state.toDate);
    if (state.dateField !== "list_published_at") params.set("dateField", state.dateField);
    if (state.sort !== "first_seen_at") params.set("sort", state.sort);
    if (state.signalFilter !== "all") params.set("signalFilter", state.signalFilter);

    const url = params.toString() ? `/inbox?${params.toString()}` : "/inbox";
    window.history.replaceState(null, "", url);
  }, [state]);

  return {
    state,
    setState,
    setQ,
    setOnlyUnread,
    setOnlyStarred,
    setFromDate,
    setToDate,
    setDateField,
    setSort,
    setView,
    setSignalFilter,
    toggleDepartment,
    toggleChannel,
    toggleExpandedDept,
    toggleImportanceLevel,
    toggleCategory,
    toggleGenre,
    toggleChannelGroup,
    clearFilters,
    setSourcesTree,
    hasAnyFilter,
    queryKey,
    buildParams,
    syncToUrl,
    GENRE_LIST,
    CHANNEL_GROUPS,
    classifyChannelGroup,
  };
}
