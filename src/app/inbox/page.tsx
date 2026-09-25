"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePrefs } from "@/contexts/prefs-context";
import { useT } from "@/lib/i18n";
import { categoryDisplayLabel, categoryTooltip } from "@/lib/monitor/content-meta";
import {
  Circle, ClipboardList, Clock, Dices, Flame, Landmark, Library, Lightbulb, Link as LinkIcon, MapPin, RadioTower, Save, Star, Tag, Target, Timer, TriangleAlert,
} from "lucide-react";
import { getPriorityMeta } from "@/lib/monitor/priority-levels";
import { formatDateTimeFull } from "@/lib/date-utils";
import { ImportanceBadge } from "@/components/importance-badge";
import { SubscriptionBadge } from "@/components/subscription-badge";
import {
  calculateFollowScore,
  sortByFollowPriority,
  type FollowMatchResult,
  fetchSubscriptions,
} from "@/lib/subscription-utils";
import { cachedFetch } from "@/lib/fetch-cache";
import {
  CHANNEL_GROUPS,
  classifyChannelGroup,
  type ChannelGroupKey,
} from "@/lib/monitor/channel-group";
import { SiteHeader } from "@/components/site-header";
import { Highlight } from "@/components/highlight";
import { BatchToolbar } from "@/components/inbox-batch-tools";
import { SourceGridView } from "@/components/source-grid-view";
import { CategoryGroupView } from "@/components/category-group-view";
import { SignalDrawer } from "@/components/signal-drawer";
import { FloatingPagination } from "@/components/floating-pagination";
import {
  type ViewMode,
  VALID_VIEWS,
  deriveViewFromUrlParams,
  getViewPresetState,
  syncViewToUrl,
} from "@/lib/inbox-view-utils";
import {
  type CategoryCount,
  type GenreCount,
  GENRE_LIST,
  extractDateKey,
  getShanghaiDateKeys,
  formatDateLabel,
  type UrlInitialState,
  makeEmptyUrlState,
  readInitialUrlState,
  parseUrlStateFromLocation,
} from "@/lib/inbox-page-utils";
import { generateShareCard, downloadBlob } from "@/lib/share-card";
import { ScrollToTop } from "@/components/scroll-to-top";

const SCROLL_KEY = "inbox-scroll-y";

function RelatedItems({ sourceId, currentUrl, departmentName }: { sourceId: string; currentUrl: string; departmentName: string }) {
  const [items, setItems] = useState<{ url: string; title: string; listPublishedAt: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (loaded) { setOpen(true); return; }
    try {
      const res = await fetch(`/api/monitor/items/${encodeURIComponent(sourceId)}?limit=5`, { cache: "no-store" });
      const json = await res.json() as { items?: { url: string; title: string; listPublishedAt: string }[] };
      const related = (json.items ?? []).filter((i) => i.url !== currentUrl).slice(0, 4);
      setItems(related);
      setLoaded(true);
      setOpen(true);
    } catch {}
  }

  return (
    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => open ? setOpen(false) : load()}
        className="text-[11px] text-slate-400 transition hover:text-slate-600"
      >
        {open ? "▾ 收起" : "▸ 同来源更多内容"}（{departmentName}）
      </button>
      {open && items.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {items.map((i) => (
            <li key={i.url} className="flex items-start gap-2">
              <span className="mt-0.5 text-[10px] text-slate-300">·</span>
              <div className="min-w-0">
                <a href={i.url} target="_blank" rel="noreferrer" className="text-[11px] text-sky-700 underline decoration-sky-200 underline-offset-2 line-clamp-1 hover:decoration-sky-400">
                  {i.title}
                </a>
                <span className="ml-2 text-[10px] text-slate-400">{i.listPublishedAt?.slice(0, 10)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && items.length === 0 && loaded && (
        <p className="mt-1 text-[11px] text-slate-400">暂无其他内容</p>
      )}
    </div>
  );
}

type InboxItem = {
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
};

type SourceTreeNode = {
  departmentName: string;
  displayName?: string;
  totalCount: number;
  totalUnread?: number;
  unread: number;
  channels: Array<{ sourceId: string; channelName: string; count: number; unread: number }>;
};

export default function InboxPage() {
  // 惰性初始化：SSR 与客户端首渲染都从"空筛选"起步。
  // 真正的 URL 参数解析放在 useEffect（hydrate 完成后）再 setState，
  // 保证 SSR 生成的 HTML 与客户端首渲染 DOM 一致，避免 hydration mismatch。
  const initial = useMemo(() => readInitialUrlState(), []);

  const { language } = usePrefs();
  const t = useT(language);

  const [q, setQ] = useState<string>(() => initial.q);
  const [onlyUnread, setOnlyUnread] = useState<boolean>(() => initial.onlyUnread);
  const [onlyStarred, setOnlyStarred] = useState<boolean>(() => initial.onlyStarred);

  // 板块A：部委→栏目 筛选
  // selectedDepts = set，空表示"全部部委"
  // selectedSourceIds = set，空表示"不按 sourceId 过滤"（但若已选部委，则在其内部)
  // 逻辑：有 sourceId 选 sourceId；否则有 channelName 选 channelName；否则选部门
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(() => initial.selectedDepts);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(() => initial.selectedChannels);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(() => initial.expandedDepts);

  // 板块A-2：内容类型（大类）筛选 —— 专用于收件箱，把部委原始栏目聚合为少量大类。
  // 选中的大类在 buildParams 时会展开成对应的原始栏目名集合，与 selectedChannels 取并集。
  const [selectedChannelGroups, setSelectedChannelGroups] = useState<Set<ChannelGroupKey>>(new Set());

  // 板块A子项：重要性
  const [importanceLevels, setImportanceLevels] = useState<Set<string>>(() => initial.importanceLevels);

  // 板块B：关键词分类
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => initial.selectedCategories);

  // 板块C：体裁分类
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(() => initial.selectedGenres);
  const [genreOpen, setGenreOpen] = useState<boolean>(false);

  // 板块D：日期范围 + 排序
  const [fromDate, setFromDate] = useState<string>(() => initial.fromDate);
  const [toDate, setToDate] = useState<string>(() => initial.toDate);
  const [dateField, setDateField] = useState<"list_published_at" | "first_seen_at">(() => {
    if (initial.dateField !== "list_published_at") return initial.dateField;
    try { return (JSON.parse(localStorage.getItem("inbox_view_prefs") ?? "{}").dateField ?? initial.dateField); } catch { return initial.dateField; }
  });
  const [sort, setSort] = useState<"relevance" | "first_seen_at" | "published_at" | "follow">(() => {
    if (initial.sort !== "relevance") return initial.sort;
    try { return (JSON.parse(localStorage.getItem("inbox_view_prefs") ?? "{}").sort ?? initial.sort); } catch { return initial.sort; }
  });
  const [onlyFollowed, setOnlyFollowed] = useState<boolean>(false);
  const [region, setRegion] = useState<"all" | "domestic" | "global">(() => {
    try { return (JSON.parse(localStorage.getItem("inbox_view_prefs") ?? "{}").region ?? "all"); } catch { return "all"; }
  });

  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("inbox_search_history") ?? "[]"); } catch { return []; }
  });
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  function addToSearchHistory(term: string) {
    const t = term.trim();
    if (!t || t.length < 2) return;
    setSearchHistory((prev) => {
      const next = [t, ...prev.filter((h) => h !== t)].slice(0, 8);
      try { localStorage.setItem("inbox_search_history", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // 订阅筛选
  const [subscribedDepartments, setSubscribedDepartments] = useState<Set<string>>(new Set());
  const [subscribedKeywords, setSubscribedKeywords] = useState<Set<string>>(new Set());
  const [subscriptionsLoaded, setSubscriptionsLoaded] = useState(false);

  const [items, setItems] = useState<InboxItem[]>([]);
  const [sourcesTree, setSourcesTree] = useState<SourceTreeNode[]>([]);
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryCount[]>([]);
  const [genresWithCounts, setGenresWithCounts] = useState<GenreCount[]>([]);
  const [loading, setLoading] = useState(true);

  const [signalDrawerOpen, setSignalDrawerOpen] = useState(false);
  const [selectedSignalItem, setSelectedSignalItem] = useState<InboxItem | null>(null);
  const [selectedSignalDetail, setSelectedSignalDetail] = useState<Record<string, unknown> | undefined>(undefined);

  // 右侧预览面板
  const [previewItem, setPreviewItem] = useState<InboxItem | null>(null);

  // —— v2 新增：点击条目直接展开详情 ——
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [detailMap, setDetailMap] = useState<Record<string, unknown>>({});
  const [detailLoading, setDetailLoading] = useState<Set<string>>(new Set());
  const detailAbortMapRef = useRef<Map<string, AbortController>>(new Map());
  const readRequestIdMapRef = useRef<Map<string, number>>(new Map());
  const starredRequestIdMapRef = useRef<Map<string, number>>(new Map());
  const autoReadTimerMapRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // 分页
  const PAGE_SIZE = 15;
  const [page, setPage] = useState<number>(1); // 1-based
  const [totalCount, setTotalCount] = useState<number>(0);

  // 视图切换：全部 / 未读 / 我的收藏 / 有信号 / 按部委 / 按标签
  const [activeView, setActiveView] = useState<ViewMode>("all");

  // 键盘导航：j/k 上下，r 切换已读，s 切换收藏
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  // 列表密度（紧凑/标准/宽松）
  type DensityMode = "compact" | "normal" | "spacious";
  const [density, setDensity] = useState<DensityMode>(() => {
    try { return (JSON.parse(localStorage.getItem("inbox_view_prefs") ?? "{}").density as DensityMode) ?? "normal"; } catch { return "normal"; }
  });

  // 视图偏好持久化（sort / region / dateField / density）
  useEffect(() => {
    try { localStorage.setItem("inbox_view_prefs", JSON.stringify({ sort, region, dateField, density })); } catch {}
  }, [sort, region, dateField, density]);

  // 条目自定义标签（localStorage 持久化）
  const [itemTags, setItemTags] = useState<Record<string, string[]>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("inbox_item_tags");
      if (raw) setItemTags(JSON.parse(raw));
    } catch {}
  }, []);
  function saveItemTags(key: string, tags: string[]) {
    setItemTags((prev) => {
      const next = { ...prev };
      if (tags.length > 0) next[key] = tags;
      else delete next[key];
      try { localStorage.setItem("inbox_item_tags", JSON.stringify(next)); } catch {}
      return next;
    });
  }
  const TAG_PRESETS = ["需跟进", "资料", "已处理"] as const;
  const tagFilterItems = Object.keys(itemTags);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  // 批量选择
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  function toggleSelect(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function clearSelection() { setSelectedKeys(new Set()); }

  // 置顶条目（localStorage 持久化）
  const [pinnedItems, setPinnedItems] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem("inbox_pinned_items");
      if (raw) setPinnedItems(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, []);
  function togglePinned(key: string) {
    setPinnedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem("inbox_pinned_items", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // 稍后读清单（localStorage 持久化）
  const [readingList, setReadingList] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem("inbox_reading_list");
      if (raw) setReadingList(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, []);
  function toggleReadingList(key: string) {
    setReadingList((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem("inbox_reading_list", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // 智能建议条 & 今日焦点条：每次加载新数据后重置 dismissed 状态
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [focusDismissed, setFocusDismissed] = useState(false);

  // 保存筛选方案
  type FilterPreset = { name: string; params: string };
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>(() => {
    try { return JSON.parse(localStorage.getItem("inbox_saved_presets") ?? "[]"); } catch { return []; }
  });
  const [presetNameInput, setPresetNameInput] = useState("");
  const [showPresetSave, setShowPresetSave] = useState(false);

  function savePreset() {
    const name = presetNameInput.trim();
    if (!name) return;
    const params = window.location.search;
    const next = [{ name, params }, ...savedPresets.filter((p) => p.name !== name)].slice(0, 8);
    setSavedPresets(next);
    try { localStorage.setItem("inbox_saved_presets", JSON.stringify(next)); } catch {}
    setPresetNameInput("");
    setShowPresetSave(false);
  }

  function deletePreset(name: string) {
    const next = savedPresets.filter((p) => p.name !== name);
    setSavedPresets(next);
    try { localStorage.setItem("inbox_saved_presets", JSON.stringify(next)); } catch {}
  }

  // 条目便签（localStorage 持久化）
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("inbox_notes");
      if (raw) setItemNotes(JSON.parse(raw));
    } catch {}
  }, []);
  function saveNote(key: string, text: string) {
    setItemNotes((prev) => {
      const next = { ...prev };
      if (text.trim()) next[key] = text;
      else delete next[key];
      try { localStorage.setItem("inbox_notes", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // 用 ref 保存 sourcesTree / categoriesWithCounts，避免 state 变化触发循环
  const sourcesTreeRef = useRef<SourceTreeNode[]>([]);
  const categoriesWithCountsRef = useRef<CategoryCount[]>([]);
  const genresWithCountsRef = useRef<GenreCount[]>([]);
  useLayoutEffect(() => {
    sourcesTreeRef.current = sourcesTree;
    categoriesWithCountsRef.current = categoriesWithCounts;
    genresWithCountsRef.current = genresWithCounts;
  });

  // SSR / 客户端首渲染都使用默认值，在挂载后把 URL 参数同步到 state，
  // 避免 hydrate 期间出现"清空筛选"等按钮差异。
  useEffect(() => {
    const loadSubscriptions = async () => {
      console.debug("[InboxFetch] 开始加载订阅数据");
      try {
        const subList = await fetchSubscriptions();
        const depts = new Set<string>();
        const kws = new Set<string>();
        for (const sub of subList) {
          if (sub.enabled) {
            if (sub.type === "department") depts.add(sub.target);
            if (sub.type === "keyword") kws.add(sub.target);
          }
        }
        console.debug(
          `[InboxFetch] 订阅数据加载完成 部委=${depts.size}个 关键词=${kws.size}个`,
        );
        setSubscribedDepartments(depts);
        setSubscribedKeywords(kws);
      } catch (e) {
        const err = e as Error;
        /* debug removed */
      } finally {
        setSubscriptionsLoaded(true);
        console.debug("[InboxFetch] subscriptionsLoaded = true，准备发起首次列表请求");
      }
    };
    loadSubscriptions();

    const fromUrl = parseUrlStateFromLocation();
    if (!fromUrl) return;
    queueMicrotask(() => {
      if (fromUrl.q !== q) setQ(fromUrl.q);
      if (fromUrl.onlyUnread !== onlyUnread) setOnlyUnread(fromUrl.onlyUnread);
      if (fromUrl.onlyStarred !== onlyStarred) setOnlyStarred(fromUrl.onlyStarred);
      if (fromUrl.selectedDepts.size !== selectedDepts.size ||
          [...fromUrl.selectedDepts].some((d) => !selectedDepts.has(d))) {
        setSelectedDepts(fromUrl.selectedDepts);
      }
      if (fromUrl.selectedChannels.size !== selectedChannels.size ||
          [...fromUrl.selectedChannels].some((c) => !selectedChannels.has(c))) {
        setSelectedChannels(fromUrl.selectedChannels);
      }
      if (fromUrl.expandedDepts.size !== expandedDepts.size ||
          [...fromUrl.expandedDepts].some((d) => !expandedDepts.has(d))) {
        setExpandedDepts(fromUrl.expandedDepts);
      }
      if (fromUrl.importanceLevels.size !== importanceLevels.size ||
          [...fromUrl.importanceLevels].some((l) => !importanceLevels.has(l))) {
        setImportanceLevels(fromUrl.importanceLevels);
      }
      if (fromUrl.selectedCategories.size !== selectedCategories.size ||
          [...fromUrl.selectedCategories].some((c) => !selectedCategories.has(c))) {
        setSelectedCategories(fromUrl.selectedCategories);
      }
      if (fromUrl.selectedGenres.size !== selectedGenres.size ||
          [...fromUrl.selectedGenres].some((g) => !selectedGenres.has(g))) {
        setSelectedGenres(fromUrl.selectedGenres);
      }
      if (fromUrl.fromDate !== fromDate) setFromDate(fromUrl.fromDate);
      if (fromUrl.toDate !== toDate) setToDate(fromUrl.toDate);
      if (fromUrl.dateField !== dateField) setDateField(fromUrl.dateField);
      if (fromUrl.sort !== sort) setSort(fromUrl.sort);

      // 根据 URL 参数推断视图模式
      const viewParam = new URLSearchParams(window.location.search).get("view");

      // view=signals 已升级为独立页面 /signals，做永久重定向
      if (viewParam === "signals") {
        const remainingParams = new URLSearchParams(window.location.search);
        remainingParams.delete("view");
        const rest = remainingParams.toString();
        window.location.replace(`/signals${rest ? `?${rest}` : ""}`);
        return;
      }

      const inferredView = deriveViewFromUrlParams(
        viewParam,
        fromUrl.onlyStarred,
        fromUrl.onlyUnread,
      );
      if (inferredView !== activeView) {
        setActiveView(inferredView);
      }
    });

    return () => {
      console.debug("[InboxFetch] 组件卸载");
      // 取消所有正在进行的详情加载请求
      for (const [key, ac] of detailAbortMapRef.current) {
        /* debug removed */
        ac.abort();
      }
      detailAbortMapRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 把「选中的部委 + 选中的栏目」映射成 sourceIds 列表（用于后端 IN 过滤）
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

  // queryKey：把当前所有筛选项压缩成一个稳定字符串，用于 effect 监听
  const queryKey = [
    activeView,
    q.trim(),
    onlyUnread ? "1" : "0",
    onlyStarred ? "1" : "0",
    onlyFollowed ? "1" : "0",
    Array.from(selectedDepts).sort().join("|"),
    Array.from(selectedChannels).sort().join("|"),
    Array.from(selectedChannelGroups).sort().join("|"),
    Array.from(importanceLevels).sort().join("|"),
    Array.from(selectedCategories).sort().join("|"),
    Array.from(selectedGenres).sort().join("|"),
    Array.from(subscribedDepartments).sort().join("|"),
    Array.from(subscribedKeywords).sort().join("|"),
    fromDate,
    toDate,
    dateField,
    sort,
  ].join("§");

  const subscribedGroups = useMemo(() => {
    const depts = Array.from(subscribedDepartments).map((d) => ({ target: d, displayName: d }));
    const kws = Array.from(subscribedKeywords).map((k) => ({ target: k, displayName: k }));
    return { departments: depts, keywords: kws };
  }, [subscribedDepartments, subscribedKeywords]);

  const getItemFollowInfo = useCallback(
    (item: InboxItem): FollowMatchResult => {
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

  const hasSubscriptions = subscriptionsLoaded && (subscribedDepartments.size > 0 || subscribedKeywords.size > 0);

  const displayItems = useMemo(() => {
    let list = [...items];

    if (onlyFollowed && hasSubscriptions) {
      list = list.filter((item) => getItemFollowInfo(item).isFollowed);
    }

    if (sort === "follow" && hasSubscriptions) {
      list = sortByFollowPriority(
        list,
        (item) => getItemFollowInfo(item),
        (item) => item.keywordScore,
      );
    }

    return list;
  }, [items, sort, onlyFollowed, hasSubscriptions, getItemFollowInfo]);

  const tagFilteredItems = useMemo(() => {
    let list = activeTagFilter
      ? displayItems.filter((item) => {
          const key = `${item.sourceId}__${item.url}`;
          return (itemTags[key] ?? []).includes(activeTagFilter);
        })
      : displayItems;
    // Pinned items float to top
    if (pinnedItems.size > 0) {
      const pinned = list.filter((i) => pinnedItems.has(`${i.sourceId}__${i.url}`));
      const rest = list.filter((i) => !pinnedItems.has(`${i.sourceId}__${i.url}`));
      list = [...pinned, ...rest];
    }
    return list;
  }, [displayItems, activeTagFilter, itemTags, pinnedItems]);

  const followedCount = useMemo(() => {
    if (!hasSubscriptions) return 0;
    return items.filter((item) => getItemFollowInfo(item).isFollowed).length;
  }, [items, hasSubscriptions, getItemFollowInfo]);

  const suggestionBanner = useMemo(() => {
    if (loading || suggestionDismissed || items.length === 0) return null;
    const unreadByCategory: Record<string, number> = {};
    let totalUnread = 0;
    for (const item of items) {
      if (item.isRead || !item.categories.length) continue;
      const top = item.categories.reduce((a, b) => (a.score > b.score ? a : b));
      unreadByCategory[top.category] = (unreadByCategory[top.category] ?? 0) + 1;
      totalUnread++;
    }
    if (totalUnread < 5) return null;
    const sorted = Object.entries(unreadByCategory).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return null;
    const [topCat, topCount] = sorted[0];
    if (topCount / totalUnread < 0.35) return null;
    return { category: topCat, count: topCount, total: totalUnread };
  }, [items, loading, suggestionDismissed]);

  const todayFocusItems = useMemo(() => {
    if (loading || focusDismissed || items.length === 0) return [];
    const today = new Date().toISOString().split("T")[0];
    return items.filter((item) => {
      if (item.isRead) return false;
      if (getPriorityMeta(item.importanceLevel).level !== "核心关注") return false;
      const d = (item.firstSeenAt || item.listPublishedAt || "").split("T")[0];
      return d === today;
    });
  }, [items, loading, focusDismissed]);

  // buildParams：普通函数，每次 render 都是最新值
  function buildParams(currentPage: number): URLSearchParams {
    const params = new URLSearchParams();
    params.set("view", "list");
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(Math.max(0, (currentPage - 1) * PAGE_SIZE)));
    if (q.trim()) params.set("q", q.trim());
    if (onlyUnread) params.set("onlyUnread", "1");
    if (onlyStarred) params.set("onlyStarred", "1");

    // 计算"实际命中的栏目名集合"：原始栏目名（selectedChannels） ∪ 大类展开后的栏目名
    const currentTree = sourcesTreeRef.current;
    const allChannelInTree = new Set<string>();
    for (const node of currentTree) for (const c of node.channels) allChannelInTree.add(c.channelName);

    const mergedChannelNames = new Set<string>(selectedChannels);
    if (selectedChannelGroups.size > 0) {
      for (const name of allChannelInTree) {
        if (selectedChannelGroups.has(classifyChannelGroup(name))) mergedChannelNames.add(name);
      }
    }

    if (mergedChannelNames.size > 0) {
      if (selectedDepts.size > 0) {
        const ids = collectSourceIds(currentTree, selectedDepts, mergedChannelNames);
        if (ids.length > 0) params.set("sourceIds", ids.join(","));
      } else {
        params.set("channelNames", Array.from(mergedChannelNames).join(","));
      }
    } else if (selectedDepts.size > 0) {
      const ids = collectSourceIds(currentTree, selectedDepts, null);
      if (ids.length > 0) params.set("sourceIds", ids.join(","));
    }

    // 保持大类自身可被分享：即便栏目名已经展开，也把选中的大类写到 URL 里
    if (selectedChannelGroups.size > 0) {
      params.set("channelGroups", Array.from(selectedChannelGroups).join(","));
    }

    if (importanceLevels.size > 0) params.set("importanceLevels", Array.from(importanceLevels).join(","));
    if (selectedCategories.size > 0) params.set("categories", Array.from(selectedCategories).join(","));
    if (selectedGenres.size > 0) params.set("genres", Array.from(selectedGenres).join(","));
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (dateField) params.set("dateField", dateField);
    if (sort) params.set("sort", sort);
    if (region !== "all") params.set("region", region);

    const subscribedDepts = Array.from(subscribedDepartments);
    const subscribedKws = Array.from(subscribedKeywords);
    if (subscribedDepts.length > 0) params.set("subscribedDepartments", subscribedDepts.join(","));
    if (subscribedKws.length > 0) params.set("subscribedKeywords", subscribedKws.join(","));

    return params;
  }

  // 用 ref 暴露最新的 buildParams / page / loadItemsRaw，供异步回调读取
  const pageRef = useRef(page);
  const buildParamsRef = useRef(buildParams);
  const loadItemsRawRef = useRef<(currentPage: number) => Promise<void>>(() => Promise.resolve());
  useLayoutEffect(() => {
    pageRef.current = page;
    buildParamsRef.current = buildParams;
    loadItemsRawRef.current = loadItemsRaw;
  });

  // 保险：对 sourcesTree 做两层去重（部门名唯一 + 部门内栏目名唯一），避免 React key 冲突
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

  // 维度数据（sourcesTree / categoriesWithCounts / genresWithCounts）缓存
  const dimensionsLoadedRef = useRef(false);
  const dimensionsLoadingRef = useRef(false);

  async function loadDimensionsOnce() {
    // 已经加载过，或正在加载：直接跳过
    if (dimensionsLoadedRef.current || dimensionsLoadingRef.current) return;
    dimensionsLoadingRef.current = true;
    try {
      const json = await cachedFetch<{
        sourcesTree?: unknown[];
        categoriesWithCounts?: unknown[];
        genresWithCounts?: unknown[];
      }>("/api/monitor/items?view=dimensions");

      if (!json) {
        dimensionsLoadingRef.current = false;
        return;
      }

      if (Array.isArray(json.sourcesTree) && sourcesTreeRef.current.length === 0) {
        const deduped = dedupSourcesTree(json.sourcesTree as SourceTreeNode[]);
        sourcesTreeRef.current = deduped;
        setSourcesTree(deduped);
      }
      if (Array.isArray(json.categoriesWithCounts) && categoriesWithCountsRef.current.length === 0) {
        categoriesWithCountsRef.current = json.categoriesWithCounts as CategoryCount[];
        setCategoriesWithCounts(json.categoriesWithCounts as CategoryCount[]);
      }
      if (Array.isArray(json.genresWithCounts) && genresWithCountsRef.current.length === 0) {
        genresWithCountsRef.current = json.genresWithCounts as GenreCount[];
        setGenresWithCounts(json.genresWithCounts as GenreCount[]);
      }
      dimensionsLoadedRef.current = true;
    } catch (e) {
      // 失败不阻塞主流程，下一轮重试
    } finally {
      dimensionsLoadingRef.current = false;
    }
  }

  // 拉取逻辑（普通函数，读最新 buildParamsRef）+ 请求取消 / 竞态保护
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 最后一次 API 响应的错误信息（用于排查"当前筛选下没有内容"）
  const [lastApiError, setLastApiError] = useState<string | null>(null);
  const [lastApiUrl, setLastApiUrl] = useState<string>("");
  const [lastApiReturned, setLastApiReturned] = useState<number | null>(null);

  // —— 政策对比选择 ——
  const MAX_COMPARE_ITEMS = 5;
  type CompareItem = { sourceId: string; url: string; title: string; departmentName: string };
  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);

  function toggleCompare(item: InboxItem) {
    setCompareItems((prev) => {
      const exists = prev.some((c) => c.sourceId === item.sourceId && c.url === item.url);
      if (exists) {
        return prev.filter((c) => !(c.sourceId === item.sourceId && c.url === item.url));
      }
      if (prev.length >= MAX_COMPARE_ITEMS) {
        return prev;
      }
      return [...prev, { sourceId: item.sourceId, url: item.url, title: item.title, departmentName: item.departmentName }];
    });
  }

  function isInCompare(sourceId: string, url: string) {
    return compareItems.some((c) => c.sourceId === sourceId && c.url === url);
  }

  function goToCompare() {
    if (compareItems.length < 2) return;
    const param = compareItems.map((c) => `${c.sourceId}::${c.url}`).join("|");
    window.open(`/compare?items=${encodeURIComponent(param)}`, "_blank");
  }
  const [lastApiTotal, setLastApiTotal] = useState<number | null>(null);

  async function loadItemsRaw(currentPage: number) {
    setLoading(true);
    setLastApiError(null);
    try {
      // 取消上一次请求（若还在飞）
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
          console.debug(
            `[InboxFetch] 取消上一次请求 requestId=${requestIdRef.current}`,
          );
        } catch {}
      }
      const myController = new AbortController();
      abortControllerRef.current = myController;
      const myRequestId = ++requestIdRef.current;

      const params = buildParamsRef.current(currentPage);
      const finalUrl = `/api/monitor/items?${params.toString()}`;
      console.debug(
        `[InboxFetch] 发起请求 requestId=${myRequestId} page=${currentPage} url=${finalUrl}`,
      );
      setLastApiUrl(finalUrl);

      const FETCH_TIMEOUT_MS = 10000;

      const timeoutTimer = setTimeout(() => {
        console.debug(
          `[InboxFetch] 请求超时（${FETCH_TIMEOUT_MS}ms），自动取消 requestId=${myRequestId}`,
        );
        myController.abort();
      }, FETCH_TIMEOUT_MS);

      // 首次进入时：并发拉取"维度数据"和"列表数据"
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
        if (myController.signal.aborted) {
          /* debug removed */
          return;
        }
        json = (await res.json()) as typeof json;
        if (myController.signal.aborted) {
          /* debug removed */
          return;
        }
        if (!res.ok) {
          // 后端返回了错误（例如 SQL 异常）：记录下来
          const errText =
            (String(json.detail ?? "") || String(json.error ?? "") || String(json.message ?? "")) ||
            `HTTP ${res.status} ${res.statusText}`;
          /* error removed */
          setLastApiError(errText);
          setItems([]);
          setTotalCount(0);
          return;
        }
        /* debug removed */
      } catch (fetchErr) {
        clearTimeout(timeoutTimer);
        const err = fetchErr as Error;
        if (myController.signal.aborted || err.name === "AbortError" || err.message.includes("ERR_ABORTED")) {
          /* debug removed */
          return;
        }
        const errMsg = err.message || "fetch failed";
        /* error removed */
        setLastApiError(errMsg);
        setItems([]);
        setTotalCount(0);
        return;
      }

      // 等待维度数据到（最多给 300ms，超时先显示列表）
      try {
        await Promise.race([
          dimPromise,
          new Promise((resolve) => setTimeout(resolve, 300)),
        ]);
      } catch {}

      // 如果又有新请求进来：丢弃本次结果
      if (myRequestId !== requestIdRef.current) {
        console.debug(
          `[InboxFetch] 结果被丢弃（有更新的请求） requestId=${myRequestId} currentRequestId=${requestIdRef.current}`,
        );
        return;
      }
      if (myController.signal.aborted) {
        /* debug removed */
        return;
      }

      const list: InboxItem[] = (json.items || []).map((raw) => {
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
          categories: Array.isArray(r.categories) ? (r.categories as InboxItem["categories"]) : [],
          genres: Array.isArray(r.genres) ? (r.genres as string[]) : [],
          effectiveFrom: (r.effectiveFrom as string | undefined) || null,
          effectiveTo: (r.effectiveTo as string | undefined) || null,
          deadlineDate: (r.deadlineDate as string | undefined) || null,
          matchedKeywordCount: typeof r.matchedKeywordCount === "number" ? r.matchedKeywordCount : undefined,
          signalStrength: typeof r.signalStrength === "number" ? r.signalStrength : undefined,
        };
      });
      setItems(list);
      const tc = typeof json.totalCount === "number" ? json.totalCount : null;
      if (tc !== null) setTotalCount(tc);
      setLastApiReturned(list.length);
      setLastApiTotal(tc);
      // 维度数据（兼容旧版响应）
      if (json.sourcesTree && json.sourcesTree.length > 0 && sourcesTreeRef.current.length === 0) {
        const deduped = dedupSourcesTree(json.sourcesTree as SourceTreeNode[]);
        sourcesTreeRef.current = deduped;
        setSourcesTree(deduped);
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

  // 刷新：用当前页重新拉一次
  const refresh = useCallback(() => {
    loadItemsRawRef.current(pageRef.current);
  }, []);

  // 拉数据：只依赖 queryKey + page
  // 订阅数据未加载完成时不发起请求，避免首次请求被取消产生 ERR_ABORTED
  useLayoutEffect(() => {
    if (!subscriptionsLoaded) {
      console.debug("[InboxFetch] 订阅未加载完成，跳过请求");
      return;
    }
    /* debug removed */
    // 延迟到微任务，避免 React 19 "set-state-in-effect" 警告
    queueMicrotask(() => loadItemsRaw(page));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, page, subscriptionsLoaded]);

  // 筛选变化 → 回到第 1 页
  useLayoutEffect(() => {
    queueMicrotask(() => setPage(1));
     
  }, [queryKey]);

  // 切页时滚到顶部
  const goToPage = useCallback((next: number) => {
    if (typeof window === "undefined") return;
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // 分页统一走浮动页码条（FloatingPagination）。
  // 曾经这里还挂了一套"无限滚动自动翻页"：滚到底部的哨兵进入视口就 setPage(p+1)。
  // 但列表数据是整页替换（setItems(list) 而非追加），一旦某页内容不足一屏，
  // 哨兵会持续处于视口 → 反复自增页码 → 反复替换内容，表现为"页码在闪、正文刷不出来"。
  // 两套分页机制本就冲突，这里移除无限滚动，仅保留页码条。
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  // ===== 滚动位置保存 & 恢复（防抖 + 一次性恢复） =====
  const restoreOnceTimerRef = useRef<number | undefined>(undefined);

  function savePos(y?: number) {
    if (typeof window === "undefined") return;
    try {
      const v = typeof y === "number" ? y : window.scrollY;
      window.sessionStorage.setItem(SCROLL_KEY, String(v));
    } catch {}
  }

  function scheduleRestore() {
    if (typeof window === "undefined") return;
    const y = Number(window.sessionStorage.getItem(SCROLL_KEY) || 0);
    if (!y || y < 50) return;
    if (restoreOnceTimerRef.current !== undefined) {
      window.clearTimeout(restoreOnceTimerRef.current);
    }
    restoreOnceTimerRef.current = window.setTimeout(() => {
      window.scrollTo(0, y);
      window.setTimeout(() => window.scrollTo(0, y), 200);
    }, 0);
  }

  // 滚动监听：250ms 防抖
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    let scrollTimer: number | undefined;
    const onScroll = () => {
      if (scrollTimer !== undefined) window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        savePos();
        scrollTimer = undefined;
      }, 250);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const onHide = () => savePos();
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      if (scrollTimer !== undefined) window.clearTimeout(scrollTimer);
    };
  }, []);

  // pageshow 时再恢复一次
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onShow = () => scheduleRestore();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // 首次加载完成后恢复一次
  const prevLoadingRef = useRef<boolean>(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prevLoadingRef.current && !loading) {
      scheduleRestore();
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  // 汇总信息
  const totals = useMemo(() => {
    const totalCount = items.length;
    const unreadCount = items.filter((i) => !i.isRead).length;
    const starredCount = items.filter((i) => i.isStarred).length;
    const urgentCount = items.filter((i) => getPriorityMeta(i.importanceLevel).level === "核心关注").length;
    const highlightCount = items.filter((i) => getPriorityMeta(i.importanceLevel).level === "重点内容").length;
    return { totalCount, unreadCount, starredCount, urgentCount, highlightCount };
  }, [items]);

  // 日期分组：按 dateField 指向的字段分组，日期组倒序，组内条目按时间倒序
  type DateGroup = { dateKey: string; dateLabel: string; isTodayOrYesterday: boolean; items: InboxItem[] };
  const dateGroups: DateGroup[] = useMemo(() => {
    const field: "listPublishedAt" | "firstSeenAt" = dateField === "list_published_at" ? "listPublishedAt" : "firstSeenAt";

    const itemIndexMap = new Map<string, number>();
    tagFilteredItems.forEach((item, idx) => {
      const key = `${item.sourceId}__${item.url}`;
      itemIndexMap.set(key, idx);
    });

    const groupsMap = new Map<string, InboxItem[]>();
    for (const it of tagFilteredItems) {
      const key = extractDateKey(it[field]);
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(it);
    }

    // 日期组倒序（"unknown" 放最后）
    const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => {
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      return b.localeCompare(a);
    });

    const useDateSort = sort === "first_seen_at" || sort === "published_at";

    return sortedKeys.map((k) => {
      const list = [...groupsMap.get(k)!];
      if (useDateSort) {
        list.sort((a, b) => {
          const av = (a[field] || "") as string;
          const bv = (b[field] || "") as string;
          return bv.localeCompare(av);
        });
      } else {
        list.sort((a, b) => {
          const ai = itemIndexMap.get(`${a.sourceId}__${a.url}`) ?? 0;
          const bi = itemIndexMap.get(`${b.sourceId}__${b.url}`) ?? 0;
          return ai - bi;
        });
      }
      const { label, isTodayOrYesterday } = formatDateLabel(k);
      return { dateKey: k, dateLabel: label, isTodayOrYesterday, items: list };
    });
  }, [tagFilteredItems, dateField, sort]);
  const hasAnyFilter =
    q.trim().length > 0 ||
    onlyUnread ||
    onlyStarred ||
    onlyFollowed ||
    region !== "all" ||
    selectedDepts.size > 0 ||
    selectedChannels.size > 0 ||
    selectedChannelGroups.size > 0 ||
    importanceLevels.size > 0 ||
    selectedCategories.size > 0 ||
    selectedGenres.size > 0 ||
    fromDate.length > 0 ||
    toDate.length > 0;

  function clearFilters() {
    setQ("");
    setOnlyUnread(false);
    setOnlyStarred(false);
    setOnlyFollowed(false);
    setSelectedDepts(new Set());
    setSelectedChannels(new Set());
    setSelectedChannelGroups(new Set());
    setImportanceLevels(new Set());
    setSelectedCategories(new Set());
    setSelectedGenres(new Set());
    setExpandedDepts(new Set());
    setFromDate("");
    setToDate("");
    setDateField("list_published_at");
    setSort("first_seen_at");
    setRegion("all");
  }

  function switchView(view: ViewMode) {
    setActiveView(view);
    setPage(1);
    const preset = getViewPresetState(view);
    setOnlyStarred(preset.onlyStarred);
    setOnlyUnread(preset.onlyUnread);
    if (view === "signals") {
      setSelectedCategories(new Set(preset.selectedCategories));
    }
    syncViewToUrl(view);
  }

  function toggleInSet(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  // 选中"部委"节点：切换 selectedDepts。若取消选中，则同时清空该部委下的 selectedChannels
  function toggleDepartment(deptName: string) {
    const had = selectedDepts.has(deptName);
    const nextDepts = toggleInSet(selectedDepts, deptName);
    setSelectedDepts(nextDepts);
    if (had) {
      // 取消选中部委 → 移除该部委下所有已选栏目
      const deptChannels = sourcesTree.find((d) => d.departmentName === deptName)?.channels ?? [];
      const next = new Set(selectedChannels);
      deptChannels.forEach((c) => next.delete(c.channelName));
      setSelectedChannels(next);
    }
  }

  function toggleChannel(deptName: string, channelName: string) {
    // 若该部委没被选中，选栏目时自动把部委也标记上
    const nextDepts = new Set(selectedDepts);
    nextDepts.add(deptName);
    setSelectedDepts(nextDepts);
    setSelectedChannels(toggleInSet(selectedChannels, channelName));
  }

  async function markAllVisibleRead() {
    const unread = displayItems.filter((i) => !i.isRead);
    if (unread.length === 0) return;
    await Promise.all(unread.map((i) => toggleRead(i.sourceId, i.url, true)));
  }

  function handleBatchMarkAll(action: "markAllRead" | "markAllUnread" | "markAllStarred" | "markAllUnstarred") {
    if (action === "markAllRead") {
      setItems((list) => list.map((i) => ({ ...i, isRead: true })));
    } else if (action === "markAllUnread") {
      setItems((list) => list.map((i) => ({ ...i, isRead: false })));
    } else if (action === "markAllStarred") {
      setItems((list) => list.map((i) => ({ ...i, isStarred: true })));
    } else if (action === "markAllUnstarred") {
      setItems((list) => list.map((i) => ({ ...i, isStarred: false })));
    }
  }

  async function toggleRead(sourceId: string, url: string, next: boolean) {
    const key = `${sourceId}__${url}`;
    const prevReqId = readRequestIdMapRef.current.get(key) ?? 0;
    const myReqId = prevReqId + 1;
    readRequestIdMapRef.current.set(key, myReqId);
    /* debug removed */

    setItems((list) =>
      list.map((i) => (i.sourceId === sourceId && i.url === url ? { ...i, isRead: next } : i)),
    );
    try {
      const res = await fetch(`/api/monitor/items/${encodeURIComponent(sourceId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, isRead: next }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "failed");
      const currentReqId = readRequestIdMapRef.current.get(key) ?? 0;
      if (myReqId !== currentReqId) {
        /* debug removed */
        return;
      }
      /* debug removed */
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const currentReqId = readRequestIdMapRef.current.get(key) ?? 0;
      if (myReqId !== currentReqId) {
        /* debug removed */
        return;
      }
      /* error removed */
      // 失败回滚（仅当这是最新请求时才回滚）
      setItems((list) =>
        list.map((i) => (i.sourceId === sourceId && i.url === url ? { ...i, isRead: !next } : i)),
      );
    }
  }

  async function toggleStarred(sourceId: string, url: string, next: boolean) {
    const key = `${sourceId}__${url}`;
    const prevReqId = starredRequestIdMapRef.current.get(key) ?? 0;
    const myReqId = prevReqId + 1;
    starredRequestIdMapRef.current.set(key, myReqId);
    /* debug removed */

    setItems((list) =>
      list.map((i) => (i.sourceId === sourceId && i.url === url ? { ...i, isStarred: next } : i)),
    );
    try {
      const res = await fetch(`/api/monitor/items/${encodeURIComponent(sourceId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, isStarred: next }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "failed");
      const currentReqId = starredRequestIdMapRef.current.get(key) ?? 0;
      if (myReqId !== currentReqId) {
        /* debug removed */
        return;
      }
      /* debug removed */
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const currentReqId = starredRequestIdMapRef.current.get(key) ?? 0;
      if (myReqId !== currentReqId) {
        /* debug removed */
        return;
      }
      /* error removed */
      // 失败回滚（仅当这是最新请求时才回滚）
      setItems((list) =>
        list.map((i) => (i.sourceId === sourceId && i.url === url ? { ...i, isStarred: !next } : i)),
      );
    }
  }

  // —— v2 新增：展开/折叠条目详情 ——
  function itemKey(sourceId: string, url: string): string {
    return `${sourceId}__${url}`;
  }

  async function toggleExpand(sourceId: string, url: string) {
    const key = itemKey(sourceId, url);
    const isExpanded = expandedItems.has(key);

    // 如果正在展开，并且没有详情，先异步获取
    if (!isExpanded && !detailMap[key] && !detailLoading.has(key)) {
      const ac = new AbortController();
      detailAbortMapRef.current.set(key, ac);

      setDetailLoading((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      /* debug removed */
      try {
        const res = await fetch(
          `/api/monitor/items/${encodeURIComponent(sourceId)}?url=${encodeURIComponent(url)}`,
          { signal: ac.signal }
        );
        if (ac.signal.aborted) {
          /* debug removed */
          return;
        }
        if (res.ok) {
          const json = await res.json();
          if (ac.signal.aborted) {
            /* debug removed */
            return;
          }
          /* debug removed */
          setDetailMap((prev) => ({ ...prev, [key]: json }));
        } else {
          if (ac.signal.aborted) return;
          // API 返回非 200（比如 404/500）——为了仍然展示"查看详细页 / 打开原网址"，
          // 回落到只包含 sourceId 的空对象
          setDetailMap((prev) => ({ ...prev, [key]: { sourceId, url } }));
        }
      } catch (e) {
        const err = e as Error;
        if (err.name === "AbortError" || err.message.includes("ERR_ABORTED")) {
          /* debug removed */
          return;
        }
        /* debug removed */
        // 网络异常：也写一个回落对象，避免显示"无法加载详情"
        setDetailMap((prev) => ({ ...prev, [key]: { sourceId, url } }));
      } finally {
        if (!ac.signal.aborted) {
          setDetailLoading((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
        if (detailAbortMapRef.current.get(key) === ac) {
          detailAbortMapRef.current.delete(key);
        }
      }
    }

    // Track recent item visit when expanding
    if (!isExpanded) {
      const visitedItem = items.find((i) => itemKey(i.sourceId, i.url) === key);
      if (visitedItem) {
        try {
          type RecentEntry = { title: string; url: string; sourceId: string; departmentName: string; listPublishedAt: string; viewedAt: string };
          const recentRaw: RecentEntry[] = JSON.parse(localStorage.getItem("inbox_recent_items") ?? "[]");
          const entry: RecentEntry = { title: visitedItem.title, url: visitedItem.url, sourceId: visitedItem.sourceId, departmentName: visitedItem.departmentName, listPublishedAt: visitedItem.listPublishedAt, viewedAt: new Date().toISOString() };
          localStorage.setItem("inbox_recent_items", JSON.stringify([entry, ...recentRaw.filter((r) => r.url !== visitedItem.url)].slice(0, 10)));
        } catch {}
      }
    }

    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // 折叠时取消待执行的自动已读定时器
        const t = autoReadTimerMapRef.current.get(key);
        if (t) { clearTimeout(t); autoReadTimerMapRef.current.delete(key); }
      } else {
        next.add(key);
        // 展开时：1.5s 后自动标已读（若该条目尚未已读）
        const item = items.find((i) => itemKey(i.sourceId, i.url) === key);
        if (item && !item.isRead) {
          const t = setTimeout(() => {
            autoReadTimerMapRef.current.delete(key);
            toggleRead(item.sourceId, item.url, true);
          }, 1500);
          autoReadTimerMapRef.current.set(key, t);
        }
      }
      return next;
    });
  }

  async function openPreview(item: InboxItem) {
    setPreviewItem(item);
    const key = itemKey(item.sourceId, item.url);
    if (detailMap[key] || detailLoading.has(key)) return;
    const ac = new AbortController();
    detailAbortMapRef.current.set(key, ac);
    setDetailLoading((prev) => { const next = new Set(prev); next.add(key); return next; });
    try {
      const res = await fetch(
        `/api/monitor/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`,
        { signal: ac.signal }
      );
      if (!ac.signal.aborted) {
        const json = res.ok ? await res.json() : { sourceId: item.sourceId, url: item.url };
        if (!ac.signal.aborted) setDetailMap((prev) => ({ ...prev, [key]: json }));
      }
    } catch (e) {
      const err = e as Error;
      if (err.name !== "AbortError" && !err.message.includes("ERR_ABORTED")) {
        setDetailMap((prev) => ({ ...prev, [key]: { sourceId: item.sourceId, url: item.url } }));
      }
    } finally {
      if (!ac.signal.aborted) setDetailLoading((prev) => { const next = new Set(prev); next.delete(key); return next; });
      if (detailAbortMapRef.current.get(key) === ac) detailAbortMapRef.current.delete(key);
    }
  }

  // 键盘快捷键：j/k 导航，r 切换已读，s 切换收藏
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const flatItems = displayItems;
      if (flatItems.length === 0) return;

      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const currentIdx = focusedKey ? flatItems.findIndex((i) => itemKey(i.sourceId, i.url) === focusedKey) : -1;
        const nextIdx = e.key === "j"
          ? Math.min(flatItems.length - 1, currentIdx + 1)
          : Math.max(0, currentIdx === -1 ? 0 : currentIdx - 1);
        const nextKey = itemKey(flatItems[nextIdx].sourceId, flatItems[nextIdx].url);
        setFocusedKey(nextKey);
        document.querySelector(`[data-item-key="${CSS.escape(nextKey)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }

      if ((e.key === "r" || e.key === "s" || e.key === "o" || e.key === "f") && focusedKey) {
        const item = flatItems.find((i) => itemKey(i.sourceId, i.url) === focusedKey);
        if (!item) return;
        e.preventDefault();
        if (e.key === "r") toggleRead(item.sourceId, item.url, !item.isRead);
        if (e.key === "s") toggleStarred(item.sourceId, item.url, !item.isStarred);
        if (e.key === "o") window.open(item.finalUrl || item.url, "_blank");
        if (e.key === "f" && item.departmentName) {
          const nextEnabled = !subscribedDepartments.has(item.departmentName);
          fetch("/api/monitor/subscriptions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "department", target: item.departmentName, enabled: nextEnabled }),
          }).then(() => {
            setSubscribedDepartments((prev) => {
              const next = new Set(prev);
              if (nextEnabled) next.add(item.departmentName);
              else next.delete(item.departmentName);
              return next;
            });
          }).catch(() => {});
        }
      }
      if (e.key === "Enter" && focusedKey) {
        e.preventDefault();
        const item = flatItems.find((i) => itemKey(i.sourceId, i.url) === focusedKey);
        if (item) void toggleExpand(item.sourceId, item.url);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayItems, focusedKey]);

  // 把所有部委下出现过的"唯一栏目名"做聚合 —— 用于两大类：
  //   A. 按部委→具体栏目做精细筛选（已在上面的折叠列表里）
  //   B. 按"内容类型"（大类）做跨部委快速筛选（下面新渲染的板块）
  const uniqueChannelsPerName = useMemo(() => {
    const map = new Map<string, { count: number; unread: number }>();
    for (const node of sourcesTree) {
      for (const c of node.channels) {
        const prev = map.get(c.channelName) ?? { count: 0, unread: 0 };
        prev.count += c.count;
        prev.unread += c.unread;
        map.set(c.channelName, prev);
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ channelName: name, count: v.count, unread: v.unread }))
      .sort((a, b) => b.count - a.count);
  }, [sourcesTree]);

  // 按大类聚合条目数，供新板块渲染胶囊时使用
  const groupedCounts = useMemo<Array<{ key: ChannelGroupKey; label: string; description: string; count: number; unread: number }>>(() => {
    const counts = new Map<ChannelGroupKey, number>();
    const unreads = new Map<ChannelGroupKey, number>();
    for (const row of uniqueChannelsPerName) {
      const g = classifyChannelGroup(row.channelName);
      counts.set(g, (counts.get(g) ?? 0) + row.count);
      unreads.set(g, (unreads.get(g) ?? 0) + row.unread);
    }
    return CHANNEL_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      description: g.description,
      count: counts.get(g.key) ?? 0,
      unread: unreads.get(g.key) ?? 0,
    }));
  }, [uniqueChannelsPerName]);

  function toggleChannelGroup(key: ChannelGroupKey) {
    setSelectedChannelGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
        {/* 顶部标题区 */}
        <section className="rounded-[24px] bg-slate-950 px-5 py-6 text-white shadow-sm sm:rounded-[32px] sm:px-8 sm:py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="space-y-2 max-w-2xl sm:space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">{t("inbox.title")}</h1>
              <p className="text-sm leading-6 text-white sm:leading-7">
                {t("inbox.subtitle")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 sm:rounded-3xl sm:px-4 sm:py-4">
                <div className="text-xs text-white">{t("inbox.stat.total")}</div>
                <div className="mt-1 text-xl font-semibold sm:text-2xl">{totalCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 sm:rounded-3xl sm:px-4 sm:py-4">
                <div className="text-xs text-white">{t("inbox.stat.unread")}</div>
                <div className="mt-1 text-xl font-semibold sm:text-2xl">{totals.unreadCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 sm:rounded-3xl sm:px-4 sm:py-4">
                <div className="text-xs text-white">{t("inbox.stat.key")}</div>
                <div className="mt-1 text-xl font-semibold sm:text-2xl">
                  {totals.starredCount} <span className="inline-flex flex-wrap items-center gap-0.5 text-[11px] text-white/85 sm:gap-1 sm:text-sm">· <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5" />{totals.urgentCount} <TriangleAlert className="h-3 w-3 sm:h-3.5 sm:w-3.5" />{totals.highlightCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 今日焦点条 */}
          {todayFocusItems.length > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <Flame className="h-4 w-4 shrink-0 text-white" />
              <p className="flex-1 text-sm text-white">
                今日 <strong>{todayFocusItems.length}</strong> 条「核心关注」尚未阅读——
                <button
                  type="button"
                  onClick={() => {
                    setImportanceLevels(new Set(["核心关注"]));
                    setOnlyUnread(true);
                  }}
                  className="mx-1 font-semibold underline underline-offset-2 decoration-white/60 hover:text-white/80"
                >
                  立即查看
                </button>
              </p>
              <button
                type="button"
                onClick={() => setFocusDismissed(true)}
                className="shrink-0 text-sm text-white/40 hover:text-white/80"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
          )}

          {/* 视图切换 Tab */}
          <div className="mt-6 flex flex-wrap gap-1 rounded-2xl bg-white/10 p-1">
            {[
              { key: "all" as ViewMode, label: "全部动态", icon: Library },
              { key: "unread" as ViewMode, label: "未读", icon: Circle },
              { key: "starred" as ViewMode, label: "我的收藏", icon: Star },
              { key: "signals" as ViewMode, label: "有信号", icon: RadioTower },
              { key: "byDepartment" as ViewMode, label: "按机构", icon: Landmark },
              { key: "byCategory" as ViewMode, label: "按标签", icon: Tag },
            ].map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => switchView(view.key)}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeView === view.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <view.icon className="h-4 w-4" aria-hidden />
                <span>{view.label}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="mt-6">
          <BatchToolbar
            filter={{
              q,
              onlyUnread,
              onlyStarred,
              departmentName: selectedDepts.size === 1 ? Array.from(selectedDepts)[0] : undefined,
              channelNames: selectedChannels.size > 0 ? Array.from(selectedChannels) : undefined,
              importanceLevels: importanceLevels.size > 0 ? Array.from(importanceLevels) : undefined,
              categories: selectedCategories.size > 0 ? Array.from(selectedCategories) : undefined,
              fromDate: fromDate || undefined,
              toDate: toDate || undefined,
              dateField,
            }}
            onRefetch={refresh}
            onMarkAll={handleBatchMarkAll}
          />
        </div>

        {/* 搜索 + 基础筛选 */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex flex-1 items-center gap-2">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setShowSearchHistory(true)}
                onBlur={() => setTimeout(() => setShowSearchHistory(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && q.trim()) {
                    addToSearchHistory(q);
                    setShowSearchHistory(false);
                  }
                }}
                placeholder="搜索标题、机构、栏目、正文段落…"
                className="h-10 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-slate-500 focus:bg-white"
              />
              {showSearchHistory && searchHistory.length > 0 && !q && (
                <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-slate-400">最近搜索</div>
                  {searchHistory.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onMouseDown={() => { setQ(h); setShowSearchHistory(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                      {h}
                    </button>
                  ))}
                  <button
                    type="button"
                    onMouseDown={() => {
                      setSearchHistory([]);
                      try { localStorage.removeItem("inbox_search_history"); } catch {}
                      setShowSearchHistory(false);
                    }}
                    className="w-full border-t border-slate-100 px-3 py-2 text-center text-[11px] text-slate-400 transition hover:bg-slate-50"
                  >
                    清除历史记录
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* 国内 / 全球 切换 */}
              <div className="inline-flex rounded-full border border-slate-300 overflow-hidden">
                {(["all", "domestic", "global"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setRegion(r); setPage(1); }}
                    className={`px-3 py-1.5 transition ${
                      region === r
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {r === "all" ? "全部" : r === "domestic" ? "国内" : "全球"}
                  </button>
                ))}
              </div>
              <label
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 transition ${
                  onlyUnread ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input type="checkbox" className="hidden" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
                仅看未读
              </label>
              <label
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 transition ${
                  onlyStarred ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input type="checkbox" className="hidden" checked={onlyStarred} onChange={(e) => setOnlyStarred(e.target.checked)} />
                仅看重点
              </label>
              {hasSubscriptions && (
                <label
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 transition ${
                    onlyFollowed ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input type="checkbox" className="hidden" checked={onlyFollowed} onChange={(e) => setOnlyFollowed(e.target.checked)} />
                  <Target className="h-3.5 w-3.5" /> 仅看关注
                </label>
              )}
              {hasAnyFilter ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
                >
                  清空筛选
                </button>
              ) : null}
              {displayItems.some((i) => !i.isRead) && (
                <button
                  type="button"
                  onClick={markAllVisibleRead}
                  className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
                >
                  全部已读
                </button>
              )}
              {/* 阅读进度 */}
              {displayItems.length > 0 && (() => {
                const readCount = displayItems.filter((i) => i.isRead).length;
                const total = displayItems.length;
                const pct = Math.round((readCount / total) * 100);
                return (
                  <button
                    type="button"
                    onClick={() => setOnlyUnread(!onlyUnread)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-200"
                    title="点击切换仅看未读"
                  >
                    <span className="font-medium">已读 {readCount}/{total}</span>
                    <span className={`font-semibold ${pct === 100 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-slate-400"}`}>
                      {pct}%
                    </span>
                  </button>
                );
              })()}
              {/* 导出 Markdown */}
              {tagFilteredItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const lines: string[] = [`# 情报摘要 · ${new Date().toLocaleDateString("zh-CN")}`, ""];
                    const byDept: Record<string, typeof tagFilteredItems> = {};
                    for (const item of tagFilteredItems) {
                      if (!byDept[item.departmentName]) byDept[item.departmentName] = [];
                      byDept[item.departmentName].push(item);
                    }
                    for (const [dept, items] of Object.entries(byDept)) {
                      lines.push(`## ${dept}`, "");
                      for (const item of items) {
                        lines.push(`- [${item.title}](${item.finalUrl || item.url}) · ${item.listPublishedAt.slice(0, 10)}`);
                      }
                      lines.push("");
                    }
                    const md = lines.join("\n");
                    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `情报-${new Date().toISOString().slice(0, 10)}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                  title="将当前页面所有条目导出为 Markdown 文件，可直接粘贴至文档或笔记工具"
                >
                  ↓ Markdown
                </button>
              )}
              {/* 保存筛选方案 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPresetSave((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                  title="保存当前筛选为方案"
                >
                  <Save className="mr-1 inline h-3.5 w-3.5" aria-hidden />保存筛选
                </button>
                {showPresetSave && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                    <input
                      type="text"
                      value={presetNameInput}
                      onChange={(e) => setPresetNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && savePreset()}
                      placeholder="方案名称…"
                      autoFocus
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-violet-400"
                    />
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={savePreset} className="flex-1 rounded-lg py-1.5 text-xs font-medium text-white" style={{ backgroundColor: "var(--brand)" }}>保存</button>
                      <button type="button" onClick={() => setShowPresetSave(false)} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-500">取消</button>
                    </div>
                  </div>
                )}
              </div>
              {/* 复制筛选链接 */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    const el = document.getElementById("inbox-copy-link-btn");
                    if (el) { el.textContent = "✓ 已复制"; setTimeout(() => { if (el) el.textContent = "复制链接"; }, 2000); }
                  });
                }}
                id="inbox-copy-link-btn"
                title="复制当前筛选条件的页面链接，可发给他人直接复现相同视图"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                <LinkIcon className="mr-1 inline h-3.5 w-3.5" aria-hidden />复制链接
              </button>
              {/* 导出 CSV */}
              {tagFilteredItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const header = "标题,部委,栏目,发布日期,发现日期,已读,已收藏,URL";
                    const rows = tagFilteredItems.map((i) => [
                      `"${i.title.replace(/"/g, '""')}"`,
                      `"${i.departmentName}"`,
                      `"${i.channelName}"`,
                      i.listPublishedAt.slice(0, 10),
                      i.firstSeenAt.slice(0, 10),
                      i.isRead ? "是" : "否",
                      i.isStarred ? "是" : "否",
                      `"${i.url}"`,
                    ].join(","));
                    const csv = [header, ...rows].join("\n");
                    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `inbox-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  title="将当前页面所有条目导出为 CSV 文件，可在 Excel 或表格工具中打开"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  ↓ CSV
                </button>
              )}
            </div>
          </div>
          {/* 日期范围 + 排序 */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="text-slate-500">日期范围：</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none hover:bg-slate-50 focus:border-slate-500"
            />
            <span className="text-slate-400">—</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none hover:bg-slate-50 focus:border-slate-500"
            />
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
              {([
                { v: "list_published_at", label: "按发布日期" },
                { v: "first_seen_at", label: "按发现日期" },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setDateField(opt.v)}
                  className={`rounded-full px-2.5 py-1 transition ${
                    dateField === opt.v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="mx-2 h-4 w-px bg-slate-200" />
            <span className="text-slate-500">排序：</span>
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
              {([
                { v: "follow", label: "关注优先", show: hasSubscriptions },
                { v: "first_seen_at", label: "最新发现", show: true },
                { v: "published_at", label: "最新发布", show: true },
                { v: "relevance", label: "相关性", show: true },
              ] as const).filter((opt) => opt.show).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setSort(opt.v)}
                  className={`rounded-full px-2.5 py-1 transition ${
                    sort === opt.v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {opt.v === "follow" && <Target className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />}
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="mx-2 h-4 w-px bg-slate-200" />
            <span className="text-slate-500">密度：</span>
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
              {([
                { v: "compact" as DensityMode, label: "紧凑" },
                { v: "normal" as DensityMode, label: "标准" },
                { v: "spacious" as DensityMode, label: "宽松" },
              ]).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setDensity(opt.v)}
                  className={`rounded-full px-2.5 py-1 transition ${density === opt.v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="mx-2 h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={() => {
                const unread = tagFilteredItems.filter((i) => !i.isRead);
                const pool = unread.length > 0 ? unread : tagFilteredItems;
                if (pool.length === 0) return;
                const picked = pool[Math.floor(Math.random() * pool.length)];
                const k = itemKey(picked.sourceId, picked.url);
                if (!expandedItems.has(k)) void toggleExpand(picked.sourceId, picked.url);
                setTimeout(() => {
                  document.querySelector(`[data-item-key="${CSS.escape(k)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 150);
              }}
              title="随机展开一条未读内容"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
            >
              <Dices className="mr-1 inline h-3.5 w-3.5" aria-hidden />随机发现
            </button>
            {expandedItems.size > 0 && (
              <button
                type="button"
                onClick={() => setExpandedItems(new Set())}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-50"
                title="收起所有已展开的条目"
              >
                ▲ 收起全部 ({expandedItems.size})
              </button>
            )}
            <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
              {tagFilteredItems.length !== totalCount
                ? `显示 ${tagFilteredItems.length} / ${totalCount} 条`
                : `${totalCount} 条`}
            </span>
          </div>
        </section>

        {/* 阅读进度条 */}
        {items.length > 0 && (() => {
          const readCount = items.filter((i) => i.isRead).length;
          const pct = Math.round((readCount / items.length) * 100);
          return (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 overflow-hidden rounded-full bg-slate-100" style={{ height: 4 }}>
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-[10px] text-slate-400">
                已读 {readCount}/{items.length}（{pct}%）
              </span>
            </div>
          );
        })()}

        {/* 智能建议条 */}
        {suggestionBanner && !selectedCategories.has(suggestionBanner.category) && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
            <Lightbulb className="h-4 w-4 shrink-0 text-sky-500" aria-hidden />
            <p className="flex-1 text-xs text-sky-800">
              当前有 <strong>{suggestionBanner.count}</strong> 条未读属于「{categoryDisplayLabel(suggestionBanner.category)}」（共 {suggestionBanner.total} 条未读）——
              <button
                type="button"
                onClick={() => setSelectedCategories(new Set([suggestionBanner.category]))}
                className="mx-1 font-semibold underline underline-offset-2 decoration-sky-400 hover:text-sky-900"
              >
                快速筛选
              </button>
            </p>
            <button
              type="button"
              onClick={() => setSuggestionDismissed(true)}
              className="shrink-0 text-xs text-sky-300 hover:text-sky-600"
              aria-label="关闭建议"
            >
              ✕
            </button>
          </div>
        )}

        {/* 筛选结果统计面板 */}
        {displayItems.length > 0 && (() => {
          const deptMap = new Map<string, number>();
          for (const it of displayItems) {
            deptMap.set(it.departmentName, (deptMap.get(it.departmentName) ?? 0) + 1);
          }
          const top = Array.from(deptMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
          const maxVal = Math.max(1, top[0]?.[1] ?? 1);
          return (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
              <span className="shrink-0 text-[11px] font-medium text-slate-400">结果分布</span>
              {top.map(([dept, cnt]) => (
                <div key={dept} className="flex items-center gap-1.5 text-[11px]">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100" style={{ width: 48 }}>
                    <div
                      className="h-full rounded-full bg-indigo-400 transition-all"
                      style={{ width: `${(cnt / maxVal) * 100}%` }}
                    />
                  </div>
                  <span className="max-w-[80px] truncate text-slate-600" title={dept}>{dept}</span>
                  <span className="text-slate-400">{cnt}</span>
                </div>
              ))}
              {deptMap.size > 5 && (
                <span className="text-[11px] text-slate-400">…共 {deptMap.size} 个机构</span>
              )}
            </div>
          );
        })()}

        {/* 主体：左侧双面板 + 右侧列表 */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          {/* 左侧双面板筛选器 */}
          <aside className="space-y-4">
            {/* 板块A：部委→栏目→重要性（保留原始细分栏目，供精细查找） */}
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">机构 / 栏目</h2>
                <p className="mt-0.5 text-xs text-slate-500">展开机构查看原始栏目，可多选联动。</p>
              </header>

              {/* 重要性（快捷） */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-3 text-xs">
                <span className="text-slate-500">重要性：</span>
                {[
                  { k: "核心关注", label: "核心关注", cls: "text-[var(--brand)] bg-[var(--brand-tint)]" },
                  { k: "重点内容", label: "重点", cls: "text-[var(--brand)] bg-[var(--brand-tint)]" },
                  { k: "中等重点", label: "中等重点", cls: "text-amber-700 bg-amber-50" },
                  { k: "普通内容", label: "普通", cls: "text-slate-700 bg-slate-50" },
                ].map((lvl) => {
                  const on = importanceLevels.has(lvl.k);
                  return (
                    <button
                      key={lvl.k}
                      type="button"
                      onClick={() => setImportanceLevels(toggleInSet(importanceLevels, lvl.k))}
                      className={`rounded-full border px-2.5 py-1 transition ${
                        on
                          ? `border-transparent ${lvl.cls}`
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {lvl.label}
                    </button>
                  );
                })}
              </div>

              {/* 部委→栏目 */}
              <div className="max-h-[520px] overflow-auto">
                {sourcesTree.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-slate-500">暂无数据</div>
                ) : (
                  <ul className="divide-y divide-slate-100 text-sm">
                    {sourcesTree.map((node) => {
                      const expanded = expandedDepts.has(node.departmentName);
                      const deptOn = selectedDepts.has(node.departmentName);
                      return (
                        <li key={node.departmentName}>
                          <div className="flex items-start gap-2 px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedDepts((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(node.departmentName)) next.delete(node.departmentName);
                                  else next.add(node.departmentName);
                                  return next;
                                })
                              }
                              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                              aria-label="展开/收起"
                            >
                              {expanded ? "−" : "+"}
                            </button>
                            <label className="flex flex-1 cursor-pointer items-start gap-2">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
                                checked={deptOn}
                                onChange={() => toggleDepartment(node.departmentName)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-sm font-medium text-slate-800">{node.departmentName}</span>
                                  <span className="shrink-0 text-xs text-slate-500">
                                    {node.totalCount}
                                    {node.unread > 0 ? <span className="ml-1 text-slate-400">(未读{node.unread})</span> : null}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-xs text-slate-500">{node.channels.length} 个栏目</div>
                              </div>
                            </label>
                          </div>
                          {expanded ? (
                            <ul className="space-y-0.5 border-t border-slate-100 bg-slate-50/60 px-4 py-2 pl-11 text-xs">
                              {node.channels.map((c) => {
                                const chOn = selectedChannels.has(c.channelName);
                                return (
                                  <li key={`${node.departmentName}-${c.channelName}`} className="flex items-start gap-2 py-1">
                                    <label className="flex flex-1 cursor-pointer items-start gap-2">
                                      <input
                                        type="checkbox"
                                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-slate-900"
                                        checked={chOn}
                                        onChange={() => toggleChannel(node.departmentName, c.channelName)}
                                      />
                                      <span className="min-w-0 flex-1 text-slate-700">
                                        <span className="truncate">{c.channelName}</span>
                                      </span>
                                      <span className="shrink-0 text-slate-500">
                                        {c.count}
                                        {c.unread > 0 ? <span className="ml-1 text-slate-400">/{c.unread}未读</span> : null}
                                      </span>
                                    </label>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            {/* 板块A-2：内容类型（大类）— 把部委原始栏目归并为少量大类，适合跨部委快速筛选 */}
            {groupedCounts.some((g) => g.count > 0) ? (
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">内容类型</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    把不同机构里意思相近的栏目归并为大类；点击后将跨机构匹配所有对应栏目。
                  </p>
                </header>
                <div className="p-3">
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {groupedCounts
                      .filter((g) => g.count > 0)
                      .map((g) => {
                        const on = selectedChannelGroups.has(g.key);
                        return (
                          <button
                            key={g.key}
                            type="button"
                            title={g.description}
                            onClick={() => toggleChannelGroup(g.key)}
                            className={`rounded-full border px-2.5 py-1 transition ${
                              on
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {g.label}
                            <span className={`ml-1 ${on ? "text-slate-300" : "text-slate-400"}`}>
                              {g.count}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </section>
            ) : null}

            {/* 板块B：标签分布 */}
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">标签分布</h2>
                <p className="mt-0.5 text-xs text-slate-500">命中指定标签的内容才会显示。</p>
              </header>
              <div className="max-h-[260px] overflow-auto p-3">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {categoriesWithCounts.length === 0 ? (
                    <span className="text-slate-500">暂无分类数据</span>
                  ) : (
                    categoriesWithCounts.map((cc) => {
                      const on = selectedCategories.has(cc.category);
                      return (
                        <button
                          key={cc.category}
                          type="button"
                          onClick={() => setSelectedCategories(toggleInSet(selectedCategories, cc.category))}
                          className={`rounded-full border px-2.5 py-1 transition ${
                            on
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                          title={categoryTooltip(cc.category)}
                        >
                          {categoryDisplayLabel(cc.category)}
                          <span className={`ml-1 ${on ? "text-slate-300" : "text-slate-400"}`}>{cc.count}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            {/* 板块C：体裁分类（手风琴） */}
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setGenreOpen(!genreOpen)}
                className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">体裁分类</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {selectedGenres.size > 0
                      ? `已选 ${selectedGenres.size} 项：${Array.from(selectedGenres).join("、")}`
                      : "按公文体裁筛选，点击展开。"}
                  </div>
                </div>
                <span
                  className={`ml-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-500 transition ${
                    genreOpen ? "rotate-180" : ""
                  }`}
                >
                  ▾
                </span>
              </button>
              {genreOpen ? (
                <div className="p-3">
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {(() => {
                      const countMap = new Map<string, number>();
                      for (const gc of genresWithCounts) countMap.set(gc.genre, gc.count);
                      return GENRE_LIST.map((genre) => {
                        const on = selectedGenres.has(genre);
                        const count = countMap.get(genre) ?? 0;
                        return (
                          <button
                            key={genre}
                            type="button"
                            onClick={() => setSelectedGenres(toggleInSet(selectedGenres, genre))}
                            className={`rounded-full border px-2.5 py-1 transition ${
                              on
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {genre}
                            <span className={`ml-1 ${on ? "text-slate-300" : "text-slate-400"}`}>{count}</span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : null}
            </section>

            {/* 当前筛选摘要 */}
            {hasAnyFilter ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-4 text-xs shadow-sm">
                <div className="mb-2 font-semibold text-slate-900">当前筛选</div>
                <ul className="space-y-1 text-slate-600">
                  {q.trim() ? <li>搜索：{q.trim()}</li> : null}
                  {onlyUnread ? <li>仅看未读</li> : null}
                  {onlyStarred ? <li>仅看重点</li> : null}
                  {selectedDepts.size > 0 ? <li>来源：{Array.from(selectedDepts).join("、")}</li> : null}
                  {selectedChannels.size > 0 ? <li>栏目：{Array.from(selectedChannels).join("、")}</li> : null}
                  {importanceLevels.size > 0 ? <li>重要性：{Array.from(importanceLevels).join("、")}</li> : null}
                  {selectedCategories.size > 0 ? (
                    <li>标签：{Array.from(selectedCategories).map((c) => categoryDisplayLabel(c)).join("、")}</li>
                  ) : null}
                  {selectedGenres.size > 0 ? (
                    <li>体裁：{Array.from(selectedGenres).join("、")}</li>
                  ) : null}
                  {fromDate || toDate ? (
                    <li>
                      日期范围：{dateField === "list_published_at" ? "按发布日期" : "按发现日期"}：
                      {fromDate || "不限"} — {toDate || "不限"}
                    </li>
                  ) : null}
                </ul>
              </section>
            ) : null}
          </aside>

          {/* 右侧：列表 */}
          <section className="min-w-0">
            {/* 错误 / 调试信息面板：避免"当前筛选下没有内容"这个误导性信息 */}
            {lastApiError ? (
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <div className="mb-1 font-semibold">API 查询失败</div>
                <pre className="whitespace-pre-wrap text-xs leading-5">{lastApiError}</pre>
                <div className="mt-2 text-xs text-rose-500">
                  请求 URL：<code className="bg-white/60 px-1 rounded">{lastApiUrl || "(none)"}</code>
                  &nbsp;·&nbsp;
                  <a href="/api/monitor/items?view=debug" target="_blank" rel="noreferrer" className="underline">
                    打开 DB 诊断
                  </a>
                </div>
              </div>
            ) : null}
            {hasSubscriptions && !loading && items.length > 0 && (
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 shrink-0 text-[var(--brand)]" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      当前列表有 <span className="text-sky-600 font-semibold">{followedCount}</span> 条与你的关注相关
                    </div>
                    <div className="text-xs text-slate-500">
                      {sort === "follow" ? "已按关注优先级排序，相关内容靠前展示" : "切换到「关注优先」排序，让相关内容靠前展示"}
                    </div>
                  </div>
                </div>
                {sort !== "follow" && (
                  <button
                    type="button"
                    onClick={() => setSort("follow")}
                    className="shrink-0 rounded-full bg-sky-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700"
                  >
                    关注优先 →
                  </button>
                )}
                {sort === "follow" && !onlyFollowed && (
                  <button
                    type="button"
                    onClick={() => setOnlyFollowed(true)}
                    className="shrink-0 rounded-full border border-sky-300 bg-white px-4 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50"
                  >
                    只看关注
                  </button>
                )}
              </div>
            )}
            {/* 已保存筛选方案 */}
            {savedPresets.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">筛选方案：</span>
                {savedPresets.map((p) => (
                  <div key={p.name} className="group relative flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => { window.history.pushState({}, "", p.params || "/inbox"); window.dispatchEvent(new PopStateEvent("popstate")); }}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition"
                    >
                      {p.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePreset(p.name)}
                      className="hidden rounded-full px-1 text-[10px] text-slate-300 hover:text-slate-500 group-hover:flex"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* 标签筛选条：有已打标签的条目时显示 */}
            {tagFilterItems.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">标签筛选：</span>
                {TAG_PRESETS.filter((t) => tagFilterItems.some((k) => (itemTags[k] ?? []).includes(t))).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                      activeTagFilter === tag
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {activeTagFilter && (
                  <button
                    type="button"
                    onClick={() => setActiveTagFilter(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    × 清除
                  </button>
                )}
              </div>
            )}
            {!loading && items.length === 0 && !lastApiError ? (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                当前筛选返回 <strong>{lastApiReturned ?? "?"}</strong> 条 · 总数 <strong>{lastApiTotal ?? "?"}</strong>
                &nbsp;·&nbsp;
                <a href="/api/monitor/items?view=debug" target="_blank" rel="noreferrer" className="underline">
                  打开 DB 诊断
                </a>
                <span className="ml-2 text-slate-400">
                  <code>{lastApiUrl || "(no request)"}</code>
                </span>
              </div>
            ) : null}
            {loading && page === 1 ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-4 w-4 shrink-0 rounded-full bg-slate-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                        <div className="h-3 w-1/2 rounded bg-slate-100" />
                        <div className="flex gap-2 pt-1">
                          <div className="h-5 w-12 rounded-full bg-slate-100" />
                          <div className="h-5 w-16 rounded-full bg-slate-100" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : displayItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                {region !== "all" && !hasAnyFilter ? (
                  <>
                    <p>{region === "domestic" ? "国内" : "全球"}来源暂无内容。</p>
                    <p className="mt-2 text-xs text-slate-400">
                      可先
                      <Link href="/sources" className="mx-1 underline decoration-slate-300 underline-offset-2">
                        添加{region === "domestic" ? "国内" : "全球"}来源
                      </Link>
                      再来查看
                    </p>
                  </>
                ) : (
                  <>
                    当前筛选下没有内容。
                    {hasAnyFilter && (
                      <button type="button" onClick={clearFilters} className="ml-2 underline decoration-slate-300 underline-offset-2">
                        清空筛选
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : activeView === "byDepartment" ? (
              <SourceGridView
                sourcesTree={sourcesTree}
                onSelectDepartment={(deptName) => {
                  setActiveView("all");
                  setSelectedDepts(new Set([deptName]));
                }}
              />
            ) : activeView === "byCategory" ? (
              <CategoryGroupView
                categoriesWithCounts={categoriesWithCounts}
                items={items}
                onSelectCategory={(category) => {
                  setActiveView("all");
                  setSelectedCategories(new Set([category]));
                }}
              />
            ) : (
              <>
                {dateGroups.map((group) => {
                  const onlyOneGroup = dateGroups.length === 1;
                  return (
                    <div key={group.dateKey} className={group.dateKey === dateGroups[0]?.dateKey ? "" : "mt-8"}>
                      {/* 日期分组标题：如果整个筛选结果只有同一天，则弱化标题样式 */}
                      <div
                        className={
                          onlyOneGroup
                            ? "mb-3 flex items-center justify-between text-xs text-slate-500"
                            : "mb-3 flex items-center justify-between"
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              onlyOneGroup
                                ? "text-xs text-slate-500"
                                : "text-sm font-medium text-slate-700"
                            }
                          >
                            {group.dateLabel}
                          </span>
                          <span
                            className={
                              onlyOneGroup
                                ? "text-xs text-slate-400"
                                : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                            }
                          >
                            {group.items.length} 条
                          </span>
                          {group.isTodayOrYesterday && !onlyOneGroup ? (
                            <span className="text-[10px] text-emerald-600">· 最近</span>
                          ) : null}
                        </div>
                      </div>
                      {/* 组内卡片列表 */}
                      <ul className="space-y-2">
                        {group.items.map((item) => {
                          const key = itemKey(item.sourceId, item.url);
                          const isExpanded = expandedItems.has(key);
                          const rawDetail = detailMap[key];
                          const detail = (rawDetail as {
                            sourceId?: string;
                            url?: string;
                            title?: string;
                            summary?: string;
                            departmentName?: string;
                            channelName?: string;
                            listPublishedAt?: string;
                            paragraphs?: string[];
                            attachments?: Array<{ url: string; text?: string; kind?: string }>;
                            matchedKeywords?: string[];
                            hasFunding?: boolean;
                            hasProcurement?: boolean;
                            hasPilot?: boolean;
                            hasStandards?: boolean;
                          } | undefined) || undefined;
                          const isLoading = detailLoading.has(key);
                          const followInfo = getItemFollowInfo(item);

                          return (
                            <li
                              key={key}
                              data-item-key={key}
                              className={`relative rounded-2xl border transition overflow-hidden ${
                                focusedKey === key
                                  ? "border-[var(--brand)] ring-2 ring-[var(--brand-border)]"
                                  : followInfo.isFollowed
                                  ? "border-[var(--brand-border)] bg-[var(--brand-tint)]/40"
                                  : isExpanded
                                  ? "border-slate-300 bg-slate-50 shadow-sm"
                                  : "border-slate-200 bg-white hover:shadow-sm"
                              }`}
                            >
                              {followInfo.isFollowed && (
                                <div className="absolute left-0 top-0 h-full w-0.5 bg-[var(--brand)]" />
                              )}
                              {/* 批量选择复选框 */}
                              <div
                                className="absolute right-1 top-1 z-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedKeys.has(key)}
                                  onChange={() => toggleSelect(key)}
                                  className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[var(--brand)]"
                                  aria-label="选择此条目"
                                />
                              </div>
                              <div
                                className={`cursor-pointer ${density === "compact" ? "p-2 sm:p-2.5" : density === "spacious" ? "p-4 sm:p-5" : "p-3 sm:p-4"}`}
                                onClick={() => toggleExpand(item.sourceId, item.url)}
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                      <ImportanceBadge
                                        level={item.importanceLevel}
                                        keywordScore={item.keywordScore}
                                        showLegacyTag
                                      />
                                      {pinnedItems.has(key) && (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">置顶</span>
                                      )}
                                      {subscriptionsLoaded && followInfo.isFollowed && (
                                        <SubscriptionBadge matches={followInfo.allMatches} compact />
                                      )}
                                      <span className="group inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                                        {item.departmentName}
                                        {subscriptionsLoaded && !followInfo.isFollowed && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              fetch("/api/monitor/subscriptions", {
                                                method: "POST",
                                                headers: { "content-type": "application/json" },
                                                body: JSON.stringify({ type: "department", target: item.departmentName, enabled: true }),
                                              }).then(() => {
                                                setSubscribedDepartments((prev) => new Set([...prev, item.departmentName]));
                                              }).catch(() => {});
                                            }}
                                            className="hidden rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 transition hover:bg-slate-200 group-hover:inline-flex"
                                            title="关注此机构"
                                          >
                                            + 关注
                                          </button>
                                        )}
                                      </span>
                                      <span>{item.channelName}</span>
                                      <span>· {item.listPublishedAt}</span>
                                      {item.keywordScore > 0 ? (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                                          命中 {item.matchedKeywordCount || 0} 词
                                          {item.signalStrength && item.signalStrength > 0 ? (
                                            <span className="ml-1 text-slate-400">· 信号 {item.signalStrength}</span>
                                          ) : null}
                                        </span>
                                      ) : null}
                                      {(() => {
                                        const today = new Date().toISOString().split("T")[0];
                                        if (item.deadlineDate) {
                                          const d = item.deadlineDate.split("T")[0];
                                          if (d < today) return <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">已截止</span>;
                                          if (new Date(d).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000) return <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">截止 {d}</span>;
                                        }
                                        if (item.effectiveTo && item.effectiveTo.split("T")[0] < today) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">已过期</span>;
                                        return null;
                                      })()}
                                      <span
                                        className={`ml-1 text-slate-400 transition ${isExpanded ? "rotate-180" : ""}`}
                                      >
                                        ▾
                                      </span>
                                    </div>
                                    <h3 className={`mt-1 block text-[15px] leading-snug ${item.isRead ? "font-medium text-slate-600" : "font-semibold text-slate-900"}`}>
                                      <Link
                                        href={`/items/${encodeURIComponent(item.sourceId)}?sourceId=${encodeURIComponent(item.sourceId)}&url=${encodeURIComponent(item.url)}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`block break-all hover:text-[var(--brand)] ${density === "compact" ? "line-clamp-1" : density === "spacious" ? "line-clamp-none" : "line-clamp-2 sm:line-clamp-1"}`}
                                      >
                                        <Highlight text={item.title} query={q} />
                                      </Link>
                                      {itemNotes[key] && (
                                        <span className="ml-1 align-middle rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500" title={itemNotes[key]}>备注</span>
                                      )}
                                    </h3>
                                    {item.categories && item.categories.length > 0 ? (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {item.categories.slice(0, 4).map((cat, idx) => (
                                          <span
                                            key={`${cat.category}-${idx}`}
                                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600"
                                            title={categoryTooltip(cat.category)}
                                          >
                                            {categoryDisplayLabel(cat.category)}
                                            <span className="ml-1 text-slate-400">({cat.score})</span>
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="flex shrink-0 items-start gap-1.5 sm:pl-4">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleStarred(item.sourceId, item.url, !item.isStarred);
                                      }}
                                      title={item.isStarred ? "取消重点" : "标为重点"}
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                        item.isStarred
                                          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                                      }`}
                                      aria-label={item.isStarred ? "取消重点" : "标为重点"}
                                    >
                                      ★
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleRead(item.sourceId, item.url, !item.isRead);
                                      }}
                                      title={item.isRead ? "标记未读" : "标记已读"}
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                        item.isRead
                                          ? "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                          : "border-slate-300 bg-white text-slate-700 hover:border-[var(--brand-border)] hover:text-[var(--brand)]"
                                      }`}
                                      aria-label={item.isRead ? "标记未读" : "标记已读"}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleCompare(item);
                                      }}
                                      title={isInCompare(item.sourceId, item.url) ? "移出对比" : "加入对比"}
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                        isInCompare(item.sourceId, item.url)
                                          ? "border-[var(--brand-border)] bg-[var(--brand-tint)] text-[var(--brand)]"
                                          : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                                      }`}
                                      aria-label={isInCompare(item.sourceId, item.url) ? "移出对比" : "加入对比"}
                                    >
                                      ⇄
                                    </button>
                                    {activeView === "signals" ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedSignalItem(item);
                                          setSelectedSignalDetail(detail);
                                          setSignalDrawerOpen(true);
                                        }}
                                        title="信号分析"
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-[var(--brand-border)] hover:text-[var(--brand)]"
                                        aria-label="信号分析"
                                      >
                                        <RadioTower className="h-4 w-4" aria-hidden />
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openPreview(item);
                                      }}
                                      title="侧边预览"
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                        previewItem && itemKey(previewItem.sourceId, previewItem.url) === key
                                          ? "border-violet-400 bg-violet-50 text-violet-700"
                                          : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                                      }`}
                                      aria-label="侧边预览"
                                    >
                                      ▷
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* —— v2 新增：展开后的详情内容 —— */}
                              {isExpanded ? (
                                <div className="border-t border-slate-200 bg-white/70 p-4">
                                  {isLoading && !detail ? (
                                    <div className="text-xs text-slate-500">正在加载详情…</div>
                                  ) : detail && detail.sourceId ? (
                                    <div className="space-y-4 text-sm">
                                      {/* 阅读时长估算 */}
                                      {(() => {
                                        const totalChars =
                                          (detail.summary?.length ?? 0) +
                                          (Array.isArray(detail.paragraphs)
                                            ? detail.paragraphs.slice(0, 5).join("").length
                                            : 0);
                                        if (totalChars < 50) return null;
                                        const mins = Math.max(1, Math.ceil(totalChars / 300));
                                        return (
                                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                            <Timer className="h-4 w-4" aria-hidden />
                                            <span>约 {mins} 分钟阅读</span>
                                            <span className="text-slate-300">·</span>
                                            <span>{totalChars} 字</span>
                                          </div>
                                        );
                                      })()}
                                      {/* 链接信息 */}
                                      <div className="flex flex-wrap gap-2 text-xs">
                                        <Link
                                          href={`/items/${encodeURIComponent(item.sourceId)}?sourceId=${encodeURIComponent(item.sourceId)}&url=${encodeURIComponent(item.url)}`}
                                          className="rounded-full bg-slate-900 px-3 py-1 text-white hover:bg-slate-800"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          查看详细页 →
                                        </Link>
                                        <a
                                          href={item.finalUrl || item.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="rounded-full bg-sky-50 px-3 py-1 text-sky-700 hover:bg-sky-100"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          打开原网址 →
                                        </a>
                                        {/* 一键分享 */}
                                        <button
                                          type="button"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const text = [
                                              `【${item.title}】`,
                                              `来源：${item.departmentName}`,
                                              `日期：${item.listPublishedAt.slice(0, 10)}`,
                                              `链接：${item.finalUrl || item.url}`,
                                              ``,
                                              `via 政策雷达`,
                                            ].join("\n");
                                            try {
                                              await navigator.clipboard.writeText(text);
                                              const btn = e.currentTarget;
                                              const prev = btn.textContent;
                                              btn.textContent = "✓ 已复制";
                                              setTimeout(() => { btn.textContent = prev; }, 1800);
                                            } catch {}
                                          }}
                                          className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-200"
                                        >
                                          <ClipboardList className="mr-1 inline h-3.5 w-3.5" aria-hidden />分享
                                        </button>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                          首次发现：{formatDateTimeFull(item.firstSeenAt) || "-"}
                                        </span>
                                        {item.effectiveFrom ? (
                                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                                            生效：{item.effectiveFrom}
                                          </span>
                                        ) : null}
                                        {item.deadlineDate ? (
                                          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                                            截止：{item.deadlineDate}
                                          </span>
                                        ) : null}
                                      </div>

                                      {/* 完整分类标签 */}
                                      {item.categories && item.categories.length > 0 ? (
                                        <div>
                                          <div className="text-xs font-medium text-slate-700">标签分类</div>
                                          <div className="mt-1 flex flex-wrap gap-1.5">
                                            {item.categories.map((cat, idx) => (
                                              <span
                                                key={`${cat.category}-${idx}`}
                                                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                                                title={categoryTooltip(cat.category)}
                                              >
                                                {categoryDisplayLabel(cat.category)}
                                                <span className="ml-1 text-slate-400">({cat.score})</span>
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}

                                      {/* 详情：摘要 */}
                                      {detail.summary ? (
                                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                          <div className="text-xs font-medium text-slate-700">内容摘要</div>
                                          <div className="mt-1 text-xs leading-5 text-slate-700">
                                            <Highlight
                                              text={detail.summary}
                                              keywords={detail.matchedKeywords && detail.matchedKeywords.length > 0 ? detail.matchedKeywords : undefined}
                                              query={q}
                                            />
                                          </div>
                                        </div>
                                      ) : null}

                                      {/* 详情：正文段落 */}
                                      {Array.isArray(detail.paragraphs) && detail.paragraphs.length > 0 ? (
                                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                          <div className="text-xs font-medium text-slate-700">正文段落（前 5 段）</div>
                                          <div className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                                            {detail.paragraphs.slice(0, 5).map((p: string, idx: number) => (
                                              <p key={idx} className="whitespace-pre-wrap break-words">
                                                <Highlight
                                                  text={p}
                                                  keywords={detail.matchedKeywords && detail.matchedKeywords.length > 0 ? detail.matchedKeywords : undefined}
                                                  query={q}
                                                />
                                              </p>
                                            ))}
                                            {detail.paragraphs.length > 5 ? (
                                              <p className="text-slate-400">…（共 {detail.paragraphs.length} 段）</p>
                                            ) : null}
                                          </div>
                                        </div>
                                      ) : null}

                                      {/* 详情：附件 */}
                                      {Array.isArray(detail.attachments) && detail.attachments.length > 0 ? (
                                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                          <div className="text-xs font-medium text-slate-700">附件（{detail.attachments.length}）</div>
                                          <div className="mt-1 space-y-1 text-xs">
                                            {detail.attachments.slice(0, 5).map((att, idx) => (
                                              <a
                                                key={idx}
                                                href={att.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block truncate text-sky-700 hover:text-sky-900"
                                              >
                                                {att.text || att.url}
                                              </a>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}

                                      {/* 没有任何内容时的友善提示（不再显示"无法加载详情"——因为详情其实已成功加载） */}
                                      {!detail.summary &&
                                      !(Array.isArray(detail.paragraphs) && detail.paragraphs.length > 0) &&
                                      !(Array.isArray(detail.attachments) && detail.attachments.length > 0) ? (
                                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-3 text-xs text-slate-500">
                                          该条目尚未抓取到正文内容，可能是刚入库的新条目。
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-500">
                                      无法加载详情，您可以{' '}
                                      <Link
                                        href={`/items/${encodeURIComponent(item.sourceId)}?sourceId=${encodeURIComponent(item.sourceId)}&url=${encodeURIComponent(item.url)}`}
                                        className="text-sky-700 underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        打开详情页
                                      </Link>
                                      ，或直接{' '}
                                        <a
                                          href={item.finalUrl || item.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sky-700 underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          打开原网址
                                        </a>{' '}
                                      查看。
                                    </div>
                                  )}
                                {/* 一键分享卡 + 稍后读 */}
                                <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    id={`share-${key}`}
                                    onClick={() => {
                                      const text = [
                                        `${item.title}`,
                                        `来源：${item.departmentName}${item.channelName ? ` · ${item.channelName}` : ""}`,
                                        item.listPublishedAt ? `时间：${item.listPublishedAt}` : "",
                                        `链接：${item.finalUrl || item.url}`,
                                      ].filter(Boolean).join("\n");
                                      navigator.clipboard.writeText(text).then(() => {
                                        const btn = document.getElementById(`share-${key}`);
                                        if (btn) { btn.textContent = "已复制"; setTimeout(() => { if (btn) btn.textContent = "复制分享"; }, 2000); }
                                      });
                                    }}
                                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                                  >
                                    复制分享
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleReadingList(key)}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${readingList.has(key) ? "border-[var(--brand-border)] bg-[var(--brand-tint)] text-[var(--brand)]" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
                                  >
                                    {readingList.has(key) ? "已稍后读" : "稍后读"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => togglePinned(key)}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${pinnedItems.has(key) ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
                                  >
                                    {pinnedItems.has(key) ? "已置顶" : "置顶"}
                                  </button>
                                  <button
                                    type="button"
                                    id={`card-${key}`}
                                    onClick={async () => {
                                      const btn = document.getElementById(`card-${key}`);
                                      if (btn) btn.textContent = "生成中…";
                                      try {
                                        const blob = await generateShareCard({
                                          title: item.title,
                                          source: item.departmentName,
                                          channel: item.channelName,
                                          publishedAt: item.listPublishedAt,
                                          categories: item.categories.map((c) => c.category),
                                          url: item.finalUrl || item.url,
                                        });
                                        downloadBlob(blob, `情报卡-${item.title.slice(0, 20)}.png`);
                                        if (btn) btn.textContent = "已下载";
                                        setTimeout(() => { if (btn) btn.textContent = "生成卡片"; }, 2000);
                                      } catch {
                                        if (btn) btn.textContent = "生成卡片";
                                      }
                                    }}
                                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                                  >
                                    生成卡片
                                  </button>
                                </div>
                                {/* 条目自定义标签 */}
                                <div
                                  className="mt-2 flex flex-wrap items-center gap-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-[11px] text-slate-400">标签：</span>
                                  {TAG_PRESETS.map((tag) => {
                                    const currentTags = itemTags[key] ?? [];
                                    const active = currentTags.includes(tag);
                                    return (
                                      <button
                                        key={tag}
                                        type="button"
                                        onClick={() => {
                                          const next = active
                                            ? currentTags.filter((t) => t !== tag)
                                            : [...currentTags, tag];
                                          saveItemTags(key, next);
                                        }}
                                        className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                                          active
                                            ? "border-violet-400 bg-violet-50 text-violet-700"
                                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                                        }`}
                                      >
                                        {active ? "✓ " : ""}{tag}
                                      </button>
                                    );
                                  })}
                                  {(itemTags[key] ?? []).length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => saveItemTags(key, [])}
                                      className="text-[11px] text-slate-300 hover:text-slate-500"
                                    >
                                      × 清除
                                    </button>
                                  )}
                                </div>
                                {/* 条目便签 */}
                                <div
                                  className="mt-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <textarea
                                    value={itemNotes[key] ?? ""}
                                    onChange={(e) => saveNote(key, e.target.value)}
                                    placeholder="添加便签（仅本地保存）…"
                                    rows={2}
                                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-300 focus:border-sky-300 focus:ring-1 focus:ring-sky-200"
                                  />
                                </div>
                                {/* 同来源更多内容 */}
                                <RelatedItems sourceId={item.sourceId} currentUrl={item.url} departmentName={item.departmentName} />
                              </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </>
            )}
          </section>
        </div>

        {/* 无限滚动哨兵：进入视口时自动加载下一页 */}
        <div ref={scrollSentinelRef} className="h-1" aria-hidden />
        {loading && page > 1 && (
          <div className="py-4 text-center text-xs text-slate-400">加载中…</div>
        )}

        {/* 底部常驻浮窗：分页 + 返回 + 顶部 */}
        <FloatingPagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          onChange={goToPage}
        />

        {/* 对比栏 */}
        {compareItems.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2.5 shadow-lg backdrop-blur sm:px-4 sm:py-3">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 sm:gap-1.5 sm:px-3">
                    <span>⇄</span>
                    已选 {compareItems.length}/{MAX_COMPARE_ITEMS} 条
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-hide">
                  {compareItems.map((c) => (
                    <div
                      key={`${c.sourceId}::${c.url}`}
                      className="flex max-w-36 flex-shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 sm:max-w-48 sm:gap-2"
                    >
                      <span className="truncate text-xs text-slate-700">
                        {c.title.slice(0, 12)}
                        {c.title.length > 12 ? "..." : ""}
                      </span>
                      <button
                        onClick={() =>
                          setCompareItems((prev) =>
                            prev.filter(
                              (x) => !(x.sourceId === c.sourceId && x.url === c.url)
                            )
                          )
                        }
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-slate-400 hover:text-rose-500"
                        title="移除"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center justify-between gap-2 sm:justify-end">
                <button
                  onClick={() => setCompareItems([])}
                  className="flex-1 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 sm:flex-none sm:py-1.5"
                >
                  清空
                </button>
                <button
                  onClick={goToCompare}
                  disabled={compareItems.length < 2}
                  className="flex-[2] inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:min-h-[36px] sm:py-1.5"
                >
                  开始对比
                  {compareItems.length >= 2 && (
                    <span className="text-violet-300">→</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <SignalDrawer
          isOpen={signalDrawerOpen}
          onClose={() => setSignalDrawerOpen(false)}
          item={selectedSignalItem}
          detail={selectedSignalDetail}
        />
      </div>

      {/* 批量选择浮动操作条 */}
      {selectedKeys.size > 0 && (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 sm:bottom-6">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-xl ring-1 ring-slate-900/5">
            <span className="text-xs font-medium text-slate-700">已选 {selectedKeys.size} 条</span>
            <div className="mx-1 h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={async () => {
                const keys = Array.from(selectedKeys);
                for (const k of keys) {
                  const [sid, ...urlParts] = k.split("__");
                  const url = urlParts.join("__");
                  await toggleRead(sid, url, true);
                }
                clearSelection();
              }}
              className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
            >
              全部标为已读
            </button>
            <button
              type="button"
              onClick={async () => {
                const keys = Array.from(selectedKeys);
                for (const k of keys) {
                  const [sid, ...urlParts] = k.split("__");
                  const url = urlParts.join("__");
                  await toggleStarred(sid, url, true);
                }
                clearSelection();
              }}
              className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
            >
              全部收藏
            </button>
            <button
              type="button"
              onClick={() => {
                for (const k of Array.from(selectedKeys)) toggleReadingList(k);
                clearSelection();
              }}
              className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
            >
              稍后读
            </button>
            <button
              type="button"
              onClick={() => {
                for (const k of Array.from(selectedKeys)) togglePinned(k);
                clearSelection();
              }}
              className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
            >
              <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden />置顶
            </button>
            <button
              type="button"
              onClick={() => {
                const keys = Array.from(selectedKeys);
                for (const k of keys) {
                  saveItemTags(k, TAG_PRESETS.includes("需跟进") ? ["需跟进"] : []);
                }
                clearSelection();
              }}
              className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100"
            >
              标记"需跟进"
            </button>
            <div className="mx-1 h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              × 取消
            </button>
          </div>
        </div>
      )}
      {/* 右侧预览面板 */}
      {previewItem && (() => {
        const pKey = itemKey(previewItem.sourceId, previewItem.url);
        const pDetail = (detailMap[pKey] as { summary?: string; paragraphs?: string[]; matchedKeywords?: string[]; attachments?: { url: string; text?: string }[] } | undefined);
        const pLoading = detailLoading.has(pKey);
        return (
          <div className="fixed inset-0 z-50 flex pointer-events-none">
            <div className="flex-1 pointer-events-auto" onClick={() => setPreviewItem(null)} />
            <div
              className="pointer-events-auto flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl sm:w-[420px]"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const pIdx = previewItem ? tagFilteredItems.findIndex((i) => i.sourceId === previewItem.sourceId && i.url === previewItem.url) : -1;
                const hasPrev = pIdx > 0;
                const hasNext = pIdx >= 0 && pIdx < tagFilteredItems.length - 1;
                return (
                  <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">侧边预览</span>
                      {pIdx >= 0 && (
                        <span className="text-[11px] text-slate-400">{pIdx + 1}/{tagFilteredItems.length}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!hasPrev}
                        onClick={() => hasPrev && void openPreview(tagFilteredItems[pIdx - 1])}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="上一条"
                        title="上一条"
                      >‹</button>
                      <button
                        type="button"
                        disabled={!hasNext}
                        onClick={() => hasNext && void openPreview(tagFilteredItems[pIdx + 1])}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="下一条"
                        title="下一条"
                      >›</button>
                      <button
                        type="button"
                        onClick={() => setPreviewItem(null)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label="关闭预览"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })()}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <ImportanceBadge level={previewItem.importanceLevel} keywordScore={previewItem.keywordScore} showLegacyTag />
                  {!previewItem.isRead && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">未读</span>}
                  {previewItem.isStarred && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">★ 重点</span>}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{previewItem.departmentName}</span>
                  <span className="text-slate-500">{previewItem.channelName}</span>
                  <span className="text-slate-400">· {previewItem.listPublishedAt}</span>
                </div>
                <h2 className="text-base font-semibold leading-snug text-slate-900">
                  {previewItem.title}
                </h2>
                {previewItem.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {previewItem.categories.slice(0, 5).map((cat, idx) => (
                      <span
                        key={`${cat.category}-${idx}`}
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600"
                        title={categoryTooltip(cat.category)}
                      >
                        {categoryDisplayLabel(cat.category)}
                      </span>
                    ))}
                  </div>
                )}
                {pLoading && <div className="text-xs text-slate-500 animate-pulse">正在加载…</div>}
                {pDetail?.summary && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="mb-1.5 text-[11px] font-medium text-slate-500">内容摘要</div>
                    <p className="text-xs leading-5 text-slate-700">{pDetail.summary}</p>
                  </div>
                )}
                {Array.isArray(pDetail?.paragraphs) && pDetail!.paragraphs!.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-medium text-slate-500">正文段落（前 3 段）</div>
                    <div className="space-y-2">
                      {pDetail!.paragraphs!.slice(0, 3).map((p: string, idx: number) => (
                        <p key={idx} className="rounded-xl border border-slate-100 bg-white p-3 text-xs leading-5 text-slate-700 whitespace-pre-wrap break-words">
                          {p}
                        </p>
                      ))}
                      {pDetail!.paragraphs!.length > 3 && (
                        <p className="text-[11px] text-slate-400">…共 {pDetail!.paragraphs!.length} 段</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Link
                    href={`/items/${encodeURIComponent(previewItem.sourceId)}?sourceId=${encodeURIComponent(previewItem.sourceId)}&url=${encodeURIComponent(previewItem.url)}`}
                    className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    查看详细页 →
                  </Link>
                  <a
                    href={previewItem.finalUrl || previewItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    原始链接 ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <ScrollToTop />
    </main>
  );
}
