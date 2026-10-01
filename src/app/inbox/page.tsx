"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePrefs } from "@/contexts/prefs-context";
import { useT } from "@/lib/i18n";
import { pickLens } from "@/lib/localized-fields";
import { categoryDisplayLabel, categoryTooltip } from "@/lib/monitor/content-meta";
import {
  ArrowLeftRight, Check, ChevronDown, Circle, ClipboardList, Clock, Dices, Ellipsis, Flame, Landmark, Library, Lightbulb, Link as LinkIcon, MapPin, RadioTower, Save, PanelRight, SlidersHorizontal, Star, Tag, Target, Timer, TriangleAlert,
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
import { useDemoVisitor } from "@/hooks/use-demo-visitor";
import { notifyDemoReadonly } from "@/lib/demo-readonly";

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
  creatorLens?: string | null;
  creatorLensEn?: string | null;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [q, setQ] = useState<string>(() => initial.q);
  const [onlyUnread, setOnlyUnread] = useState<boolean>(() => initial.onlyUnread);
  const [onlyStarred, setOnlyStarred] = useState<boolean>(() => initial.onlyStarred);

  // 板块A：机构→栏目 筛选
  // selectedDepts = set，空表示"全部机构"
  // selectedSourceIds = set，空表示"不按 sourceId 过滤"（但若已选机构，则在其内部)
  // 逻辑：有 sourceId 选 sourceId；否则有 channelName 选 channelName；否则选部门
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(() => initial.selectedDepts);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(() => initial.selectedChannels);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(() => initial.expandedDepts);

  // 板块A-2：内容类型（大类）筛选 —— 专用于收件箱，把机构原始栏目聚合为少量大类。
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
  // 初始值用固定默认（服务端/客户端首屏一致，避免 hydration 报错）；localStorage 偏好在下方挂载后恢复
  const [dateField, setDateField] = useState<"list_published_at" | "first_seen_at">(initial.dateField);
  const [sort, setSort] = useState<"relevance" | "first_seen_at" | "published_at" | "follow">(initial.sort);
  const [onlyFollowed, setOnlyFollowed] = useState<boolean>(false);
  const [region, setRegion] = useState<"all" | "domestic" | "global">("all");

  // 挂载后再从 localStorage 恢复视图偏好（不在 useState 初始值里读，否则 SSR/CSR 首屏不一致会触发 hydration 报错）
  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem("inbox_view_prefs") ?? "{}");
      if (prefs.dateField) setDateField(prefs.dateField);
      if (prefs.sort) setSort(prefs.sort);
      if (prefs.region) setRegion(prefs.region);
    } catch {}
  }, []);

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
  // 演示站访客不能改收藏/已读/关注：在写操作入口统一挡住（按钮另有 data-owner-only 变灰与提示）。
  // 用 ref 而不是直接读 state：键盘监听等闭包是早先创建的，读 ref 才拿得到最新身份。
  const visitor = useDemoVisitor();
  const visitorRef = useRef(false);
  visitorRef.current = visitor;
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

  // 视图切换：全部 / 未读 / 我的收藏 / 有信号 / 按机构 / 按标签
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
          `[InboxFetch] 订阅数据加载完成 机构=${depts.size}个 关键词=${kws.size}个`,
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
      if (fromUrl.onlyFollowed) setOnlyFollowed(true);
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

  // 把「选中的机构 + 选中的栏目」映射成 sourceIds 列表（用于后端 IN 过滤）
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
    region,
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

    // 订阅（关注机构/关键词）只在「只看关注」打开时作为后端硬过滤条件；
    // 否则收件箱默认展示全部内容，订阅仅用于前端的关注高亮/排序。
    // 之前无条件下发导致：选中某来源时被订阅关键词（仅匹配标题）二次过滤，
    // 中文标题几乎不含英文订阅词 → 明明有未读却返回 0 条，且大量内容被悄悄隐藏。
    if (onlyFollowed) {
      const subscribedDepts = Array.from(subscribedDepartments);
      const subscribedKws = Array.from(subscribedKeywords);
      if (subscribedDepts.length > 0) params.set("subscribedDepartments", subscribedDepts.join(","));
      if (subscribedKws.length > 0) params.set("subscribedKeywords", subscribedKws.join(","));
    }

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
          creatorLens: (r.creatorLens as string | undefined) || null,
          creatorLensEn: (r.creatorLensEn as string | undefined) || null,
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

  // 无限滚动已移除：它与手动翻页（FloatingPagination）是两套分页范式。
  // 本页是"替换式翻页"（每页 setItems 替换而非累加），自动 observer 会在
  // sentinel 保持可见时连环触发 setPage(+1)，从第 1 页一路冲到最后一页并不断闪烁。
  // 翻页统一走 FloatingPagination；sentinel ref 仅留作底部占位。
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
      const { label, isTodayOrYesterday } = formatDateLabel(k, language);
      return { dateKey: k, dateLabel: label, isTodayOrYesterday, items: list };
    });
  }, [tagFilteredItems, dateField, sort, language]);
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

  // 选中"机构"节点：切换 selectedDepts。若取消选中，则同时清空该机构下的 selectedChannels
  function toggleDepartment(deptName: string) {
    const had = selectedDepts.has(deptName);
    const nextDepts = toggleInSet(selectedDepts, deptName);
    setSelectedDepts(nextDepts);
    if (had) {
      // 取消选中机构 → 移除该机构下所有已选栏目
      const deptChannels = sourcesTree.find((d) => d.departmentName === deptName)?.channels ?? [];
      const next = new Set(selectedChannels);
      deptChannels.forEach((c) => next.delete(c.channelName));
      setSelectedChannels(next);
    }
  }

  function toggleChannel(deptName: string, channelName: string) {
    // 若该机构没被选中，选栏目时自动把机构也标记上
    const nextDepts = new Set(selectedDepts);
    nextDepts.add(deptName);
    setSelectedDepts(nextDepts);
    setSelectedChannels(toggleInSet(selectedChannels, channelName));
  }

  async function markAllVisibleRead() {
    if (visitorRef.current) return notifyDemoReadonly();
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
    // 访客：静默跳过（展开条目 1.5 秒后的自动标已读也走这里，不该凭空弹提示）
    if (visitorRef.current) return;
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
    if (visitorRef.current) return;
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
        if (visitorRef.current && e.key !== "o") return notifyDemoReadonly();
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

  // 把所有机构下出现过的"唯一栏目名"做聚合 —— 用于两大类：
  //   A. 按机构→具体栏目做精细筛选（已在上面的折叠列表里）
  //   B. 按"内容类型"（大类）做跨机构快速筛选（下面新渲染的板块）
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

  // —— 工具栏「⋯」菜单里的动作（原先各自是一个常驻按钮）——
  const quickFilterCount =
    (onlyUnread ? 1 : 0) + (onlyStarred ? 1 : 0) + (onlyFollowed ? 1 : 0) + (fromDate || toDate ? 1 : 0);

  function downloadText(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportMarkdown() {
    const lines: string[] = [`# ${t("inbox.export.md-title")} · ${new Date().toLocaleDateString(language === "en" ? "en-US" : "zh-CN")}`, ""];
    const byDept: Record<string, typeof tagFilteredItems> = {};
    for (const item of tagFilteredItems) {
      (byDept[item.departmentName] ??= []).push(item);
    }
    for (const [dept, deptItems] of Object.entries(byDept)) {
      lines.push(`## ${dept}`, "");
      for (const item of deptItems) {
        lines.push(`- [${item.title}](${item.finalUrl || item.url}) · ${item.listPublishedAt.slice(0, 10)}`);
      }
      lines.push("");
    }
    downloadText(lines.join("\n"), `radar-${new Date().toISOString().slice(0, 10)}.md`, "text/markdown;charset=utf-8");
  }

  function exportCsv() {
    const yes = t("inbox.export.yes");
    const no = t("inbox.export.no");
    const header = t("inbox.export.csv-header");
    const rows = tagFilteredItems.map((i) => [
      `"${i.title.replace(/"/g, '""')}"`,
      `"${i.departmentName}"`,
      `"${i.channelName}"`,
      i.listPublishedAt.slice(0, 10),
      i.firstSeenAt.slice(0, 10),
      i.isRead ? yes : no,
      i.isStarred ? yes : no,
      `"${i.url}"`,
    ].join(","));
    downloadText("\ufeff" + [header, ...rows].join("\n"), `inbox-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
  }

  function copyViewLink() {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  function pickRandomUnread() {
    const unread = tagFilteredItems.filter((i) => !i.isRead);
    const pool = unread.length > 0 ? unread : tagFilteredItems;
    if (pool.length === 0) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const k = itemKey(picked.sourceId, picked.url);
    if (!expandedItems.has(k)) void toggleExpand(picked.sourceId, picked.url);
    setTimeout(() => {
      document.querySelector(`[data-item-key="${CSS.escape(k)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
        {/* 页头：标题 + 一行计数。原深色 hero、KPI 砖、焦点条、进度条、建议条、分布条都撤掉——
            工作台要的是规整，第一条内容应该在首屏上半部就出现 */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t("inbox.title")}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {t("inbox.countline", { total: totalCount, unread: totals.unreadCount })}
            </p>
          </div>
        </header>

        {/* 视图切换：细线下划线 */}
        <nav className="mt-5 flex gap-6 overflow-x-auto border-b border-slate-200 text-sm" aria-label={t("inbox.views")}>
          {([
            { key: "all" as ViewMode, label: t("inbox.view.all") },
            { key: "unread" as ViewMode, label: t("inbox.view.unread") },
            { key: "starred" as ViewMode, label: t("inbox.view.starred") },
            { key: "signals" as ViewMode, label: t("inbox.view.signals") },
            { key: "byDepartment" as ViewMode, label: t("inbox.view.bySource") },
            { key: "byCategory" as ViewMode, label: t("inbox.view.byTag") },
          ]).map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => switchView(view.key)}
              aria-current={activeView === view.key ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 pb-2.5 transition ${
                activeView === view.key
                  ? "border-slate-900 font-medium text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {view.label}
            </button>
          ))}
        </nav>

        {/* 工具栏：一行 = 搜索 · 范围 · 排序 · 筛选 · 更多。低频操作全收进「⋯」，功能一个不删 */}
        <section className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <div className="relative min-w-[240px] flex-1">
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
              placeholder={t("inbox.search.placeholder")}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-slate-900"
            />
            {showSearchHistory && searchHistory.length > 0 && !q && (
              <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                <div className="px-3 pb-1 pt-2 text-xs font-medium text-slate-500">{t("inbox.search.recent")}</div>
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
                  className="w-full border-t border-slate-100 px-3 py-2 text-center text-xs text-slate-500 transition hover:bg-slate-50"
                >
                  {t("inbox.search.clear-history")}
                </button>
              </div>
            )}
          </div>

          {/* 国内 / 全球 */}
          <div className="inline-flex h-9 overflow-hidden rounded-md border border-slate-300 text-xs" role="group" aria-label={t("inbox.region")}>
            {(["all", "domestic", "global"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRegion(r); setPage(1); }}
                aria-pressed={region === r}
                className={`px-3 transition ${region === r ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"}`}
              >
                {t(`inbox.region.${r}`)}
              </button>
            ))}
          </div>

          {/* 排序 */}
          <label className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-600">
            <span>{t("inbox.sort")}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="bg-transparent font-medium text-slate-900 outline-none"
            >
              {hasSubscriptions && <option value="follow">{t("inbox.sort.follow")}</option>}
              <option value="first_seen_at">{t("inbox.sort.first-seen")}</option>
              <option value="published_at">{t("inbox.sort.published")}</option>
              <option value="relevance">{t("inbox.sort.relevance")}</option>
            </select>
          </label>

          {/* 筛选 */}
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs transition ${
              filtersOpen || quickFilterCount > 0 ? "border-slate-900 text-slate-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            {t("inbox.filters")}
            {quickFilterCount > 0 && (
              <span className="rounded-full bg-slate-900 px-1.5 text-[11px] font-medium leading-5 text-white">{quickFilterCount}</span>
            )}
          </button>

          {/* 更多：批量、导出、分享、偏好 */}
          <details className="group relative">
            <summary
              className="inline-flex h-9 cursor-pointer list-none items-center rounded-md border border-slate-300 px-2.5 text-slate-700 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
              aria-label={t("inbox.more")}
              title={t("inbox.more")}
            >
              <Ellipsis className="h-4 w-4" aria-hidden />
            </summary>
            <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-slate-200 bg-white p-1.5 text-sm shadow-lg">
              <div className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-slate-500">{t("inbox.menu.bulk")}</div>
              <div className="px-1.5 pb-1.5">
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
              {displayItems.some((i) => !i.isRead) && (
                <MenuItem onClick={markAllVisibleRead}>{t("inbox.menu.mark-page-read")}</MenuItem>
              )}
              {expandedItems.size > 0 && (
                <MenuItem onClick={() => setExpandedItems(new Set())}>{t("inbox.menu.collapse-all", { n: expandedItems.size })}</MenuItem>
              )}
              <MenuItem onClick={pickRandomUnread}>{t("inbox.menu.random")}</MenuItem>

              <div className="my-1 border-t border-slate-100" />
              <div className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-slate-500">{t("inbox.menu.export")}</div>
              {tagFilteredItems.length > 0 && <MenuItem onClick={exportMarkdown}>{t("inbox.menu.markdown")}</MenuItem>}
              {tagFilteredItems.length > 0 && <MenuItem onClick={exportCsv}>{t("inbox.menu.csv")}</MenuItem>}
              <MenuItem onClick={copyViewLink}>{linkCopied ? t("common.copied") : t("inbox.menu.copy-link")}</MenuItem>
              {showPresetSave ? (
                <div className="flex gap-1.5 px-2.5 py-1.5">
                  <input
                    type="text"
                    value={presetNameInput}
                    onChange={(e) => setPresetNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && savePreset()}
                    placeholder={t("inbox.menu.preset-name")}
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-900"
                  />
                  <button type="button" onClick={savePreset} className="rounded bg-slate-900 px-2.5 text-xs font-medium text-white">{t("common.save")}</button>
                </div>
              ) : (
                <MenuItem onClick={() => setShowPresetSave(true)}>{t("inbox.menu.save-filter")}</MenuItem>
              )}

              <div className="my-1 border-t border-slate-100" />
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <span className="text-xs text-slate-500">{t("inbox.menu.density")}</span>
                <div className="inline-flex overflow-hidden rounded border border-slate-300 text-xs">
                  {(["compact", "normal", "spacious"] as DensityMode[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDensity(v)}
                      aria-pressed={density === v}
                      className={`px-2 py-1 transition ${density === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      {t(`inbox.density.${v}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <span className="ml-auto text-xs tabular-nums text-slate-500">
            {tagFilteredItems.length !== totalCount
              ? t("inbox.showing", { shown: tagFilteredItems.length, total: totalCount })
              : t("inbox.count", { n: totalCount })}
          </span>
        </section>

        {/* 筛选面板：快捷开关 + 日期范围（按需展开，不常驻） */}
        {filtersOpen && (
          <section className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs">
            <FilterToggle on={onlyUnread} onChange={setOnlyUnread}>{t("inbox.filter.unread")}</FilterToggle>
            <FilterToggle on={onlyStarred} onChange={setOnlyStarred}>{t("inbox.filter.starred")}</FilterToggle>
            {hasSubscriptions && (
              <FilterToggle on={onlyFollowed} onChange={setOnlyFollowed}>{t("inbox.filter.followed")}</FilterToggle>
            )}
            <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
            <span className="text-slate-500">{t("inbox.filter.date")}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label={t("inbox.filter.from")}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-900"
            />
            <span className="text-slate-400" aria-hidden>–</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label={t("inbox.filter.to")}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-900"
            />
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as typeof dateField)}
              aria-label={t("inbox.filter.date-field")}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none"
            >
              <option value="list_published_at">{t("inbox.filter.by-published")}</option>
              <option value="first_seen_at">{t("inbox.filter.by-first-seen")}</option>
            </select>
            {hasAnyFilter && (
              <button type="button" onClick={clearFilters} className="ml-auto text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">
                {t("inbox.filter.clear")}
              </button>
            )}
          </section>
        )}

        {/* 主体：左侧双面板 + 右侧列表 */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          {/* 左侧双面板筛选器 */}
          <aside className="space-y-4">
            {/* 板块A：机构→栏目→重要性（保留原始细分栏目，供精细查找） */}
            <details className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-100 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{t("inbox.side.source")}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{t("inbox.side.source-desc")}</p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>

              {/* 重要性（快捷） */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-3 text-xs">
                <span className="text-slate-500">{t("inbox.side.importance")}</span>
                {[
                  { k: "核心关注", label: t("importance.label.core"), cls: "text-[var(--brand)] bg-[var(--brand-tint)]" },
                  { k: "重点内容", label: t("importance.label.key"), cls: "text-[var(--brand)] bg-[var(--brand-tint)]" },
                  { k: "中等重点", label: t("importance.label.mid"), cls: "text-amber-700 bg-amber-50" },
                  { k: "普通内容", label: t("importance.label.normal"), cls: "text-slate-700 bg-slate-50" },
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

              {/* 机构→栏目 */}
              <div className="max-h-[520px] overflow-auto">
                {sourcesTree.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-slate-500">{t("inbox.side.empty")}</div>
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
                              aria-label={t("inbox.side.toggle")}
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
                                    {node.unread > 0 ? <span className="ml-1 text-slate-400">{t("inbox.side.unread-paren", { n: node.unread })}</span> : null}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-xs text-slate-500">{t("inbox.side.channels", { n: node.channels.length })}</div>
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
                                        {c.unread > 0 ? <span className="ml-1 text-slate-400">{t("inbox.side.unread-slash", { n: c.unread })}</span> : null}
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
            </details>

            {/* 板块A-2：内容类型（大类）— 把各机构原始栏目归并为少量大类，适合跨机构快速筛选（政策台专有，创作者雷达隐藏） */}
            {groupedCounts.some((g) => g.count > 0) ? (
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">{t("inbox.side.content-type")}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t("inbox.side.content-type-desc")}
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
            <details className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-100 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{t("inbox.side.tags")}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{t("inbox.side.tags-desc")}</p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="max-h-[260px] overflow-auto p-3">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {categoriesWithCounts.length === 0 ? (
                    <span className="text-slate-500">{t("inbox.side.tags-empty")}</span>
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
                          {categoryDisplayLabel(cc.category, language)}
                          <span className={`ml-1 ${on ? "text-slate-300" : "text-slate-400"}`}>{cc.count}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </details>

            {/* 板块C：体裁分类（手风琴） */}
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setGenreOpen(!genreOpen)}
                className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{t("inbox.side.genre")}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {selectedGenres.size > 0
                      ? t("inbox.side.genre-selected", { n: selectedGenres.size, list: Array.from(selectedGenres).join(language === "en" ? ", " : "、") })
                      : t("inbox.side.genre-desc")}
                  </div>
                </div>
                <ChevronDown
                  className={`ml-3 h-4 w-4 shrink-0 text-slate-400 transition-transform ${genreOpen ? "rotate-180" : ""}`}
                />
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
                <div className="mb-2 font-semibold text-slate-900">{t("inbox.side.current")}</div>
                <ul className="space-y-1 text-slate-600">
                  {q.trim() ? <li>{t("inbox.side.cur.search")}{q.trim()}</li> : null}
                  {onlyUnread ? <li>{t("inbox.filter.unread")}</li> : null}
                  {onlyStarred ? <li>{t("inbox.filter.starred")}</li> : null}
                  {selectedDepts.size > 0 ? <li>{t("inbox.side.cur.source")}{Array.from(selectedDepts).join("、")}</li> : null}
                  {selectedChannels.size > 0 ? <li>{t("inbox.side.cur.channel")}{Array.from(selectedChannels).join("、")}</li> : null}
                  {importanceLevels.size > 0 ? <li>{t("inbox.side.importance")} {Array.from(importanceLevels).join("、")}</li> : null}
                  {selectedCategories.size > 0 ? (
                    <li>{t("inbox.side.cur.tag")}{Array.from(selectedCategories).map((c) => categoryDisplayLabel(c, language)).join("、")}</li>
                  ) : null}
                  {selectedGenres.size > 0 ? (
                    <li>{t("inbox.side.cur.genre")}{Array.from(selectedGenres).join("、")}</li>
                  ) : null}
                  {fromDate || toDate ? (
                    <li>
                      {t("inbox.side.cur.date")}{dateField === "list_published_at" ? t("inbox.filter.by-published") : t("inbox.filter.by-first-seen")}：
                      {fromDate || t("inbox.side.cur.any")} — {toDate || t("inbox.side.cur.any")}
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
                <div className="mb-1 font-semibold">{t("inbox.err.api")}</div>
                <pre className="whitespace-pre-wrap text-xs leading-5">{lastApiError}</pre>
                <div className="mt-2 text-xs text-rose-500">
                  {t("inbox.err.url")}<code className="bg-white/60 px-1 rounded">{lastApiUrl || "(none)"}</code>
                  &nbsp;·&nbsp;
                  <a href="/api/monitor/items?view=debug" target="_blank" rel="noreferrer" className="underline">
                    {t("inbox.err.diag")}
                  </a>
                </div>
              </div>
            ) : null}
            {/* 已保存筛选方案 */}
            {savedPresets.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">{t("inbox.presets")}</span>
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
                <span className="text-xs text-slate-400">{t("inbox.tag-filter")}</span>
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
                    {t("inbox.clear-x")}
                  </button>
                )}
              </div>
            )}
            {!loading && items.length === 0 && !lastApiError ? (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                {t("inbox.debug.returned")} <strong>{lastApiReturned ?? "?"}</strong> · {t("inbox.debug.total")} <strong>{lastApiTotal ?? "?"}</strong>
                &nbsp;·&nbsp;
                <a href="/api/monitor/items?view=debug" target="_blank" rel="noreferrer" className="underline">
                  {t("inbox.err.diag")}
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
                    <p>{t(region === "domestic" ? "inbox.empty.region-domestic" : "inbox.empty.region-global")}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {t("inbox.empty.first")}
                      <Link href="/sources" className="mx-1 underline decoration-slate-300 underline-offset-2">
                        {t("inbox.empty.add-source")}
                      </Link>
                      {t("inbox.empty.then")}
                    </p>
                  </>
                ) : (
                  <>
                    {t("inbox.empty.filtered")}
                    {hasAnyFilter && (
                      <button type="button" onClick={clearFilters} className="ml-2 underline decoration-slate-300 underline-offset-2">
                        {t("inbox.filter.clear")}
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
                            {t(group.items.length === 1 ? "inbox.count-one" : "inbox.count", { n: group.items.length })}
                          </span>
                          {group.isTodayOrYesterday && !onlyOneGroup ? (
                            <span className="text-[11px] text-slate-500">· {t("inbox.recent")}</span>
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
                              className={`group relative overflow-hidden rounded-2xl border transition ${
                                focusedKey === key
                                  ? "border-[var(--brand)] ring-2 ring-[var(--brand-border)]"
                                  : isExpanded
                                  ? "border-slate-300 bg-slate-50 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
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
                                  aria-label={t("inbox.item.select")}
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
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{t("inbox.item.pinned")}</span>
                                      )}
                                      {subscriptionsLoaded && followInfo.isFollowed && (
                                        <SubscriptionBadge matches={followInfo.allMatches} compact />
                                      )}
                                      <span className="group inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                                        {item.departmentName}
                                        {subscriptionsLoaded && !followInfo.isFollowed && (
                                          <button data-owner-only
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
                                            title={t("inbox.item.follow-source")}
                                          >
                                            {t("inbox.item.follow")}
                                          </button>
                                        )}
                                      </span>
                                      <span>{item.channelName}</span>
                                      <span>· {item.listPublishedAt}</span>
                                      {(() => {
                                        const today = new Date().toISOString().split("T")[0];
                                        if (item.deadlineDate) {
                                          const d = item.deadlineDate.split("T")[0];
                                          if (d < today) return <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">{t("inbox.item.closed")}</span>;
                                          if (new Date(d).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000) return <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">{t("inbox.item.deadline", { d })}</span>;
                                        }
                                        if (item.effectiveTo && item.effectiveTo.split("T")[0] < today) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{t("inbox.item.expired")}</span>;
                                        return null;
                                      })()}
                                      <ChevronDown
                                        className={`ml-0.5 h-3.5 w-3.5 text-slate-400 transition ${isExpanded ? "rotate-180" : ""}`}
                                        aria-hidden
                                      />
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
                                        <span className="ml-1 align-middle rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500" title={itemNotes[key]}>{t("inbox.item.note")}</span>
                                      )}
                                    </h3>
                                    {/* 护城河在扫读处露出：与首页/伴侣版同一写法 */}
                                    {pickLens(item, language) && (
                                      <p className="mt-1 font-serif text-[15px] leading-snug text-[var(--brand)] line-clamp-2">
                                        {pickLens(item, language)}
                                      </p>
                                    )}
                                    {item.categories && item.categories.length > 0 ? (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {item.categories.slice(0, 3).map((cat, idx) => (
                                          <span
                                            key={`${cat.category}-${idx}`}
                                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600"
                                            title={categoryTooltip(cat.category)}
                                          >
                                            {categoryDisplayLabel(cat.category, language)}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="flex shrink-0 items-start gap-1.5 transition-opacity sm:pl-4 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                                    <button data-owner-only
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleStarred(item.sourceId, item.url, !item.isStarred);
                                      }}
                                      title={item.isStarred ? t("inbox.item.unstar") : t("inbox.item.star")}
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                        item.isStarred
                                          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                                      }`}
                                      aria-label={item.isStarred ? t("inbox.item.unstar") : t("inbox.item.star")}
                                      aria-pressed={!!item.isStarred}
                                    >
                                      <Star className={`h-4 w-4 ${item.isStarred ? "fill-current" : ""}`} aria-hidden />
                                    </button>
                                    <button data-owner-only
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleRead(item.sourceId, item.url, !item.isRead);
                                      }}
                                      title={item.isRead ? t("inbox.item.mark-unread") : t("inbox.item.mark-read")}
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                        item.isRead
                                          ? "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                          : "border-slate-300 bg-white text-slate-700 hover:border-[var(--brand-border)] hover:text-[var(--brand)]"
                                      }`}
                                      aria-label={item.isRead ? t("inbox.item.mark-unread") : t("inbox.item.mark-read")}
                                    >
                                      <Check className="h-4 w-4" aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleCompare(item);
                                      }}
                                      title={isInCompare(item.sourceId, item.url) ? t("inbox.item.uncompare") : t("inbox.item.compare")}
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                        isInCompare(item.sourceId, item.url)
                                          ? "border-[var(--brand-border)] bg-[var(--brand-tint)] text-[var(--brand)]"
                                          : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                                      }`}
                                      aria-label={isInCompare(item.sourceId, item.url) ? t("inbox.item.uncompare") : t("inbox.item.compare")}
                                    >
                                      <ArrowLeftRight className="h-4 w-4" aria-hidden />
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
                                        title={t("inbox.item.signal")}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-[var(--brand-border)] hover:text-[var(--brand)]"
                                        aria-label={t("inbox.item.signal")}
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
                                      title={t("inbox.item.preview")}
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                        previewItem && itemKey(previewItem.sourceId, previewItem.url) === key
                                          ? "border-violet-400 bg-violet-50 text-violet-700"
                                          : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                                      }`}
                                      aria-label={t("inbox.item.preview")}
                                    >
                                      <PanelRight className="h-4 w-4" aria-hidden />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* —— v2 新增：展开后的详情内容 —— */}
                              {isExpanded ? (
                                <div className="border-t border-slate-200 bg-white/70 p-4">
                                  {isLoading && !detail ? (
                                    <div className="text-xs text-slate-500">{t("inbox.x.loading-detail")}</div>
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
                                            <span>{t("inbox.x.read-time", { n: mins })}</span>
                                            <span className="text-slate-300">·</span>
                                            <span>{t("inbox.x.chars", { n: totalChars })}</span>
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
                                          {t("inbox.x.open-detail")}
                                        </Link>
                                        <a
                                          href={item.finalUrl || item.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="rounded-full bg-sky-50 px-3 py-1 text-sky-700 hover:bg-sky-100"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {t("inbox.x.open-original")}
                                        </a>
                                        {/* 一键分享 */}
                                        <button
                                          type="button"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const text = [
                                              `【${item.title}】`,
                                              `${t("inbox.side.cur.source")}${item.departmentName}`,
                                              `${t("inbox.x.date")}${item.listPublishedAt.slice(0, 10)}`,
                                              `${t("inbox.x.link")}${item.finalUrl || item.url}`,
                                              ``,
                                              `via ${t("site.title")}`,
                                            ].join("\n");
                                            try {
                                              await navigator.clipboard.writeText(text);
                                              const btn = e.currentTarget;
                                              const prev = btn.textContent;
                                              btn.textContent = t("common.copied");
                                              setTimeout(() => { btn.textContent = prev; }, 1800);
                                            } catch {}
                                          }}
                                          className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-200"
                                        >
                                          <ClipboardList className="h-3.5 w-3.5" aria-hidden />{t("inbox.x.share")}
                                        </button>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                          {t("inbox.x.first-seen")}{formatDateTimeFull(item.firstSeenAt) || "-"}
                                        </span>
                                        {item.effectiveFrom ? (
                                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                                            {t("inbox.x.effective")}{item.effectiveFrom}
                                          </span>
                                        ) : null}
                                        {item.deadlineDate ? (
                                          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                                            {t("inbox.x.deadline")}{item.deadlineDate}
                                          </span>
                                        ) : null}
                                      </div>

                                      {/* 完整分类标签 */}
                                      {item.categories && item.categories.length > 0 ? (
                                        <div>
                                          <div className="text-xs font-medium text-slate-700">{t("inbox.x.tags")}</div>
                                          <div className="mt-1 flex flex-wrap gap-1.5">
                                            {item.categories.map((cat, idx) => (
                                              <span
                                                key={`${cat.category}-${idx}`}
                                                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                                                title={categoryTooltip(cat.category)}
                                              >
                                                {categoryDisplayLabel(cat.category, language)}
                                                <span className="ml-1 text-slate-400">({cat.score})</span>
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}

                                      {/* 详情：摘要 */}
                                      {detail.summary ? (
                                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                          <div className="text-xs font-medium text-slate-700">{t("inbox.x.summary")}</div>
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
                                          <div className="text-xs font-medium text-slate-700">{t("inbox.x.paras5")}</div>
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
                                              <p className="text-slate-400">{t("inbox.x.paras-total", { n: detail.paragraphs.length })}</p>
                                            ) : null}
                                          </div>
                                        </div>
                                      ) : null}

                                      {/* 详情：附件 */}
                                      {Array.isArray(detail.attachments) && detail.attachments.length > 0 ? (
                                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                          <div className="text-xs font-medium text-slate-700">{t("inbox.x.attachments", { n: detail.attachments.length })}</div>
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
                                          {t("inbox.x.no-body")}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-500">
                                      {t("inbox.x.cant-load")}{' '}
                                      <Link
                                        href={`/items/${encodeURIComponent(item.sourceId)}?sourceId=${encodeURIComponent(item.sourceId)}&url=${encodeURIComponent(item.url)}`}
                                        className="text-sky-700 underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {t("inbox.x.open-detail-page")}
                                      </Link>
                                      {t("inbox.x.or")}{' '}
                                        <a
                                          href={item.finalUrl || item.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sky-700 underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {t("inbox.x.open-original-plain")}
                                        </a>{' '}
                                      {t("inbox.x.period")}
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
                                        `${t("inbox.side.cur.source")}${item.departmentName}${item.channelName ? ` · ${item.channelName}` : ""}`,
                                        item.listPublishedAt ? `${t("inbox.x.date")}${item.listPublishedAt}` : "",
                                        `${t("inbox.x.link")}${item.finalUrl || item.url}`,
                                      ].filter(Boolean).join("\n");
                                      navigator.clipboard.writeText(text).then(() => {
                                        const btn = document.getElementById(`share-${key}`);
                                        if (btn) { btn.textContent = t("common.copied"); setTimeout(() => { if (btn) btn.textContent = t("inbox.x.copy-share"); }, 2000); }
                                      });
                                    }}
                                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                                  >
                                    {t("inbox.x.copy-share")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleReadingList(key)}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${readingList.has(key) ? "border-[var(--brand-border)] bg-[var(--brand-tint)] text-[var(--brand)]" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
                                  >
                                    {readingList.has(key) ? t("inbox.x.later-on") : t("inbox.x.later")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => togglePinned(key)}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${pinnedItems.has(key) ? "border-slate-400 bg-slate-100 text-slate-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
                                  >
                                    {pinnedItems.has(key) ? t("inbox.x.pinned-on") : t("inbox.item.pinned")}
                                  </button>
                                  <button
                                    type="button"
                                    id={`card-${key}`}
                                    onClick={async () => {
                                      const btn = document.getElementById(`card-${key}`);
                                      if (btn) btn.textContent = t("inbox.x.generating");
                                      try {
                                        const blob = await generateShareCard({
                                          title: item.title,
                                          source: item.departmentName,
                                          channel: item.channelName,
                                          publishedAt: item.listPublishedAt,
                                          categories: item.categories.map((c) => c.category),
                                          url: item.finalUrl || item.url,
                                        });
                                        downloadBlob(blob, `radar-card-${item.title.slice(0, 20)}.png`);
                                        if (btn) btn.textContent = t("inbox.x.downloaded");
                                        setTimeout(() => { if (btn) btn.textContent = t("inbox.x.card"); }, 2000);
                                      } catch {
                                        if (btn) btn.textContent = t("inbox.x.card");
                                      }
                                    }}
                                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                                  >
                                    {t("inbox.x.card")}
                                  </button>
                                </div>
                                {/* 条目自定义标签 */}
                                <div
                                  className="mt-2 flex flex-wrap items-center gap-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-xs text-slate-500">{t("inbox.side.cur.tag")}</span>
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
                                      {t("inbox.clear-x")}
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
                                    placeholder={t("inbox.x.note-ph")}
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
        {/* 给底部分页浮窗留位，最后一张卡不会被它常驻挡住 */}
        <div className="h-20" aria-hidden />
        {loading && page > 1 && (
          <div className="py-4 text-center text-xs text-slate-500">{t("insight.loading")}</div>
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
          <div className="hide-when-zoomed fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2.5 shadow-lg backdrop-blur sm:px-4 sm:py-3">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 sm:gap-1.5 sm:px-3">
                    <span>⇄</span>
                    {t("inbox.cmp.selected", { n: compareItems.length, max: MAX_COMPARE_ITEMS })}
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
                        title={t("inbox.cmp.remove")}
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
                  {t("inbox.cmp.clear")}
                </button>
                <button
                  onClick={goToCompare}
                  disabled={compareItems.length < 2}
                  className="flex-[2] inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:min-h-[36px] sm:py-1.5"
                >
                  {t("inbox.cmp.start")}
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
        <div className="hide-when-zoomed fixed bottom-20 left-1/2 z-40 -translate-x-1/2 sm:bottom-6">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-xl ring-1 ring-slate-900/5">
            <span className="text-xs font-medium text-slate-700">{t("inbox.bulk.selected", { n: selectedKeys.size })}</span>
            <div className="mx-1 h-4 w-px bg-slate-200" />
            <button data-owner-only
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
              {t("inbox.bulk.read")}
            </button>
            <button data-owner-only
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
              {t("inbox.bulk.star")}
            </button>
            <button
              type="button"
              onClick={() => {
                for (const k of Array.from(selectedKeys)) toggleReadingList(k);
                clearSelection();
              }}
              className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
            >
              {t("inbox.x.later")}
            </button>
            <button
              type="button"
              onClick={() => {
                for (const k of Array.from(selectedKeys)) togglePinned(k);
                clearSelection();
              }}
              className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden />{t("inbox.item.pinned")}
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
              {t("inbox.bulk.followup")}
            </button>
            <div className="mx-1 h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              {t("inbox.bulk.cancel")}
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
                      <span className="text-sm font-semibold text-slate-800">{t("inbox.item.preview")}</span>
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
                        aria-label={t("inbox.pv.prev")}
                        title={t("inbox.pv.prev")}
                      >‹</button>
                      <button
                        type="button"
                        disabled={!hasNext}
                        onClick={() => hasNext && void openPreview(tagFilteredItems[pIdx + 1])}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={t("inbox.pv.next")}
                        title={t("inbox.pv.next")}
                      >›</button>
                      <button
                        type="button"
                        onClick={() => setPreviewItem(null)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label={t("inbox.pv.close")}
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
                  {!previewItem.isRead && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">{t("inbox.view.unread")}</span>}
                  {previewItem.isStarred && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">{t("inbox.view.starred")}</span>}
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
                        {categoryDisplayLabel(cat.category, language)}
                      </span>
                    ))}
                  </div>
                )}
                {pLoading && <div className="text-xs text-slate-500 animate-pulse">{t("insight.loading")}</div>}
                {pDetail?.summary && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="mb-1.5 text-[11px] font-medium text-slate-500">{t("inbox.x.summary")}</div>
                    <p className="text-xs leading-5 text-slate-700">{pDetail.summary}</p>
                  </div>
                )}
                {Array.isArray(pDetail?.paragraphs) && pDetail!.paragraphs!.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-medium text-slate-500">{t("inbox.x.paras3")}</div>
                    <div className="space-y-2">
                      {pDetail!.paragraphs!.slice(0, 3).map((p: string, idx: number) => (
                        <p key={idx} className="rounded-xl border border-slate-100 bg-white p-3 text-xs leading-5 text-slate-700 whitespace-pre-wrap break-words">
                          {p}
                        </p>
                      ))}
                      {pDetail!.paragraphs!.length > 3 && (
                        <p className="text-[11px] text-slate-400">{t("inbox.x.paras-total", { n: pDetail!.paragraphs!.length })}</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Link
                    href={`/items/${encodeURIComponent(previewItem.sourceId)}?sourceId=${encodeURIComponent(previewItem.sourceId)}&url=${encodeURIComponent(previewItem.url)}`}
                    className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    {t("inbox.x.open-detail")}
                  </Link>
                  <a
                    href={previewItem.finalUrl || previewItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-slate-300 px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {t("inbox.x.original-link")}
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

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center rounded px-2.5 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
    >
      {children}
    </button>
  );
}

function FilterToggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`inline-flex h-8 items-center rounded-md border px-2.5 transition ${
        on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
