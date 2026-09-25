
// ============================================================================
// 政策库视图切换 - 纯逻辑工具
// ============================================================================

export type ViewMode = "all" | "unread" | "starred" | "signals" | "byDepartment" | "byCategory";

export const VALID_VIEWS: ViewMode[] = ["all", "unread", "starred", "signals", "byDepartment", "byCategory"];

const SIGNAL_VIEW_CATEGORIES = [
  "A·强执行信号",
  "B·强支持信号",
  "C·风险信号",
  "D·探索信号",
  "通用启动/落地",
];

export type ViewPresetState = {
  onlyStarred: boolean;
  onlyUnread: boolean;
  selectedCategories: string[];
};

/**
 * 根据 URL 参数推断初始视图模式。
 * 优先级：view 参数 > onlyStarred > onlyUnread > 默认 all
 */
export function deriveViewFromUrlParams(
  viewParam: string | null,
  onlyStarred: boolean,
  onlyUnread: boolean,
): ViewMode {
  if (viewParam && (VALID_VIEWS as string[]).includes(viewParam)) {
    return viewParam as ViewMode;
  }
  if (onlyStarred) return "starred";
  if (onlyUnread) return "unread";
  return "all";
}

/**
 * 获取指定视图的预设筛选状态。
 * 切换视图时，除了 activeView 本身，还会同步设置对应的筛选条件。
 */
export function getViewPresetState(view: ViewMode): ViewPresetState {
  switch (view) {
    case "all":
      return { onlyStarred: false, onlyUnread: false, selectedCategories: [] };
    case "unread":
      return { onlyStarred: false, onlyUnread: true, selectedCategories: [] };
    case "starred":
      return { onlyStarred: true, onlyUnread: false, selectedCategories: [] };
    case "signals":
      return {
        onlyStarred: false,
        onlyUnread: false,
        selectedCategories: [...SIGNAL_VIEW_CATEGORIES],
      };
    case "byDepartment":
    case "byCategory":
      return { onlyStarred: false, onlyUnread: false, selectedCategories: [] };
  }
}

export { SIGNAL_VIEW_CATEGORIES };

/**
 * 根据当前 URL 和目标视图，生成新的 search string。
 * 纯函数，便于测试——不操作真实 URL。
 * - view=all 时移除 view 参数（默认视图不写 URL，保持 URL 干净）
 * - 其他视图设置 view 参数
 * - 保留所有其他查询参数
 */
export function buildViewSearchParams(
  currentSearch: string,
  view: ViewMode,
): string {
  const sp = new URLSearchParams(currentSearch);
  if (view === "all") {
    sp.delete("view");
  } else {
    sp.set("view", view);
  }
  const str = sp.toString();
  return str ? `?${str}` : "";
}

/**
 * 将视图同步到浏览器 URL（使用 replaceState，不增加历史记录）。
 * SSR 安全：无 window 时静默返回。
 */
export function syncViewToUrl(view: ViewMode): void {
  if (typeof window === "undefined") return;
  const newSearch = buildViewSearchParams(window.location.search, view);
  const newUrl = `${window.location.pathname}${newSearch}${window.location.hash}`;
  window.history.replaceState(null, "", newUrl);
}
