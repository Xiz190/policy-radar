export type CategoryCount = { category: string; count: number };
export type GenreCount = { genre: string; count: number };

export const GENRE_LIST = [
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

export function extractDateKey(s: string | undefined): string {
  if (!s) return "unknown";
  const t = String(s).trim();
  if (t.length >= 10) {
    const head = t.slice(0, 10);
    const match = head.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return head;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return "unknown";
}

export function getShanghaiDateKeys(): { todayKey: string; yesterdayKey: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).formatToParts(now);
  let y = "", m = "", d = "";
  for (const p of parts) {
    if (p.type === "year") y = p.value;
    if (p.type === "month") m = p.value;
    if (p.type === "day") d = p.value;
  }
  const todayKey = `${y}-${m}-${d}`;
  const yest = new Date(now.getTime() - 86400000);
  const yestParts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).formatToParts(yest);
  let yy = "", ym = "", yd = "";
  for (const p of yestParts) {
    if (p.type === "year") yy = p.value;
    if (p.type === "month") ym = p.value;
    if (p.type === "day") yd = p.value;
  }
  const yesterdayKey = `${yy}-${ym}-${yd}`;
  return { todayKey, yesterdayKey };
}

export function formatDateLabel(dateKey: string): { label: string; isTodayOrYesterday: boolean } {
  if (dateKey === "unknown") return { label: "未知日期", isTodayOrYesterday: false };
  const { todayKey, yesterdayKey } = getShanghaiDateKeys();
  const [y, m, d] = dateKey.split("-");
  const parts = { year: Number(y), month: Number(m), day: Number(d) };
  if (!parts.year || !parts.month || !parts.day) return { label: dateKey, isTodayOrYesterday: false };
  const dayDate = new Date(parts.year, parts.month - 1, parts.day);
  const weekdayCN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][dayDate.getDay()] || "";
  const monthLabel = `${parts.month}月${parts.day}日`;
  if (dateKey === todayKey) return { label: `今天 ${monthLabel}`, isTodayOrYesterday: true };
  if (dateKey === yesterdayKey) return { label: `昨天 ${monthLabel}`, isTodayOrYesterday: true };
  return { label: `${monthLabel} ${weekdayCN}`, isTodayOrYesterday: false };
}

export type UrlInitialState = {
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
  fromDate: string;
  toDate: string;
  dateField: "list_published_at" | "first_seen_at";
  sort: "relevance" | "first_seen_at" | "published_at";
};

export function makeEmptyUrlState(): UrlInitialState {
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
    fromDate: "",
    toDate: "",
    dateField: "list_published_at",
    sort: "first_seen_at",
  };
}

export function readInitialUrlState(): UrlInitialState {
  return makeEmptyUrlState();
}

export function parseUrlStateFromLocation(): UrlInitialState | null {
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

    const deptNames = deptParam ? deptParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const chNames = chParam ? chParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const catNames = categoriesParam ? categoriesParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const genreNames = genresParam ? genresParam.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const dateField: UrlInitialState["dateField"] =
      dateFieldParam === "list_published_at" || dateFieldParam === "first_seen_at"
        ? dateFieldParam
        : "list_published_at";
    const sort: UrlInitialState["sort"] =
      sortParam === "relevance" || sortParam === "first_seen_at" || sortParam === "published_at"
        ? sortParam
        : "first_seen_at";

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
      fromDate: fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : "",
      toDate: toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : "",
      dateField,
      sort,
    };
  } catch {
    return null;
  }
}
