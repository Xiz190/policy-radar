// 个人研究数据：备注、跟进状态、自定义标签
// MVP 阶段使用 localStorage 存储，后续可平滑迁移到后端
// 与收藏（is_starred）的关系：
//   - 收藏 = 标记重点（快速筛选）
//   - 个人研究 = 更深层的处理（备注、跟进、标签）
//   - 两者独立：可以只收藏不备注，也可以只备注不收藏

import {
  BookOpen, Check, Circle, Hourglass, Target, type LucideIcon,
} from "lucide-react";

export type FollowUpStatus = "none" | "to_read" | "reading" | "to_act" | "done";

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  none: "无状态",
  to_read: "待读",
  reading: "在读",
  to_act: "待行动",
  done: "已完成",
};

export const FOLLOW_UP_STATUS_ICONS: Record<FollowUpStatus, LucideIcon> = {
  none: Circle,
  to_read: BookOpen,
  reading: Hourglass,
  to_act: Target,
  done: Check,
};

export const FOLLOW_UP_STATUS_OPTIONS: Array<{
  value: FollowUpStatus;
  label: string;
  icon: LucideIcon;
  desc: string;
}> = [
  { value: "none", label: "清除状态", icon: Circle, desc: "不设置跟进状态" },
  { value: "to_read", label: "待读", icon: BookOpen, desc: "还没仔细看，先存着" },
  { value: "reading", label: "在读", icon: Hourglass, desc: "正在研究中" },
  { value: "to_act", label: "待行动", icon: Target, desc: "需要采取行动" },
  { value: "done", label: "已完成", icon: Check, desc: "已处理完毕" },
];

export type PersonalResearchItem = {
  sourceId: string;
  url: string;
  title: string;
  note: string;
  followUpStatus: FollowUpStatus;
  tags: string[];
  updatedAt: string;
  createdAt: string;
};

export type ResearchTag = {
  name: string;
  color: string;
};

const STORAGE_KEY = "policy_personal_research_v1";
const TAGS_STORAGE_KEY = "policy_research_tags_v1";

export const DEFAULT_TAG_COLORS = [
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-sky-50 text-sky-700 border-sky-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
  "bg-slate-50 text-slate-700 border-slate-200",
];

export const PRESET_TAGS: ResearchTag[] = [
  { name: "重点关注", color: DEFAULT_TAG_COLORS[0] },
  { name: "需深度研究", color: DEFAULT_TAG_COLORS[1] },
  { name: "有资金机会", color: DEFAULT_TAG_COLORS[2] },
  { name: "风险关注", color: DEFAULT_TAG_COLORS[6] },
  { name: "项目相关", color: DEFAULT_TAG_COLORS[4] },
  { name: "竞品关注", color: DEFAULT_TAG_COLORS[5] },
];

function getAllFromStorage(): Record<string, PersonalResearchItem> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, Partial<PersonalResearchItem>>;
    const result: Record<string, PersonalResearchItem> = {};
    for (const [key, item] of Object.entries(data)) {
      result[key] = {
        sourceId: item.sourceId || "",
        url: item.url || "",
        title: item.title || "",
        note: item.note || "",
        followUpStatus: (item.followUpStatus as FollowUpStatus) || "none",
        tags: Array.isArray(item.tags) ? item.tags : [],
        updatedAt: item.updatedAt || "",
        createdAt: item.createdAt || "",
      };
    }
    return result;
  } catch {
    return {};
  }
}

function saveAllToStorage(data: Record<string, PersonalResearchItem>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 存储失败静默处理
  }
}

function itemKey(sourceId: string, url: string): string {
  return `${sourceId}::${url}`;
}

export function getPersonalResearch(sourceId: string, url: string): PersonalResearchItem | null {
  const all = getAllFromStorage();
  return all[itemKey(sourceId, url)] ?? null;
}

export function getNote(sourceId: string, url: string): string {
  return getPersonalResearch(sourceId, url)?.note ?? "";
}

export function getFollowUpStatus(sourceId: string, url: string): FollowUpStatus {
  return getPersonalResearch(sourceId, url)?.followUpStatus ?? "none";
}

export function setNote(
  sourceId: string,
  url: string,
  title: string,
  note: string,
): PersonalResearchItem {
  const all = getAllFromStorage();
  const key = itemKey(sourceId, url);
  const now = new Date().toISOString();
  const existing = all[key];

  const item: PersonalResearchItem = existing
    ? { ...existing, note, updatedAt: now }
    : {
        sourceId,
        url,
        title,
        note,
        followUpStatus: "none",
        tags: [],
        createdAt: now,
        updatedAt: now,
      };

  all[key] = item;
  saveAllToStorage(all);
  return item;
}

export function setFollowUpStatus(
  sourceId: string,
  url: string,
  title: string,
  status: FollowUpStatus,
): PersonalResearchItem {
  const all = getAllFromStorage();
  const key = itemKey(sourceId, url);
  const now = new Date().toISOString();
  const existing = all[key];

  const item: PersonalResearchItem = existing
    ? { ...existing, followUpStatus: status, updatedAt: now }
    : {
        sourceId,
        url,
        title,
        note: "",
        followUpStatus: status,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };

  all[key] = item;
  saveAllToStorage(all);
  return item;
}

export function bulkSetFollowUpStatus(
  items: Array<{ sourceId: string; url: string; title: string }>,
  status: FollowUpStatus,
): number {
  if (items.length === 0) return 0;
  const all = getAllFromStorage();
  const now = new Date().toISOString();
  let count = 0;

  for (const itemData of items) {
    const key = itemKey(itemData.sourceId, itemData.url);
    const existing = all[key];
    const item: PersonalResearchItem = existing
      ? { ...existing, followUpStatus: status, updatedAt: now }
      : {
          sourceId: itemData.sourceId,
          url: itemData.url,
          title: itemData.title,
          note: "",
          followUpStatus: status,
          tags: [],
          createdAt: now,
          updatedAt: now,
        };
    all[key] = item;
    count++;
  }

  saveAllToStorage(all);
  return count;
}

export function bulkDeletePersonalResearch(
  items: Array<{ sourceId: string; url: string }>,
): number {
  if (items.length === 0) return 0;
  const all = getAllFromStorage();
  let count = 0;

  for (const item of items) {
    const key = itemKey(item.sourceId, item.url);
    if (all[key]) {
      delete all[key];
      count++;
    }
  }

  saveAllToStorage(all);
  return count;
}

export function getAllPersonalResearch(): PersonalResearchItem[] {
  const all = getAllFromStorage();
  return Object.values(all).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getFollowUpCount(status: FollowUpStatus): number {
  const all = getAllFromStorage();
  return Object.values(all).filter((item) => item.followUpStatus === status).length;
}

export function hasAnyPersonalResearch(): boolean {
  const all = getAllFromStorage();
  return Object.keys(all).length > 0;
}

function getAllTagsFromStorage(): ResearchTag[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TAGS_STORAGE_KEY);
    if (!raw) return PRESET_TAGS;
    const parsed = JSON.parse(raw) as ResearchTag[];
    if (!Array.isArray(parsed) || parsed.length === 0) return PRESET_TAGS;
    return parsed;
  } catch {
    return PRESET_TAGS;
  }
}

function saveAllTagsToStorage(tags: ResearchTag[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
  } catch {
    // 存储失败静默处理
  }
}

export function getAllTags(): ResearchTag[] {
  return getAllTagsFromStorage();
}

export function getTagColor(tagName: string): string {
  const tags = getAllTagsFromStorage();
  const found = tags.find((t) => t.name === tagName);
  return found?.color ?? DEFAULT_TAG_COLORS[DEFAULT_TAG_COLORS.length - 1];
}

export function addTag(tagName: string): ResearchTag | null {
  if (!tagName.trim()) return null;
  const tags = getAllTagsFromStorage();
  const existing = tags.find((t) => t.name === tagName.trim());
  if (existing) return existing;

  const usedColors = new Set(tags.map((t) => t.color));
  const availableColor = DEFAULT_TAG_COLORS.find((c) => !usedColors.has(c)) ?? DEFAULT_TAG_COLORS[0];
  const newTag: ResearchTag = { name: tagName.trim(), color: availableColor };
  tags.push(newTag);
  saveAllTagsToStorage(tags);
  return newTag;
}

export function removeTag(tagName: string): boolean {
  const tags = getAllTagsFromStorage();
  const idx = tags.findIndex((t) => t.name === tagName);
  if (idx === -1) return false;
  tags.splice(idx, 1);
  saveAllTagsToStorage(tags);

  const all = getAllFromStorage();
  let changed = false;
  for (const key of Object.keys(all)) {
    const item = all[key];
    if (item.tags.includes(tagName)) {
      item.tags = item.tags.filter((t) => t !== tagName);
      changed = true;
    }
  }
  if (changed) saveAllToStorage(all);
  return true;
}

export function addTagToItem(
  sourceId: string,
  url: string,
  title: string,
  tagName: string,
): PersonalResearchItem | null {
  if (!tagName.trim()) return null;
  const all = getAllFromStorage();
  const key = itemKey(sourceId, url);
  const now = new Date().toISOString();
  const existing = all[key];

  addTag(tagName.trim());

  const item: PersonalResearchItem = existing
    ? {
        ...existing,
        tags: existing.tags.includes(tagName.trim())
          ? existing.tags
          : [...existing.tags, tagName.trim()],
        updatedAt: now,
      }
    : {
        sourceId,
        url,
        title,
        note: "",
        followUpStatus: "none",
        tags: [tagName.trim()],
        createdAt: now,
        updatedAt: now,
      };

  all[key] = item;
  saveAllToStorage(all);
  return item;
}

export function removeTagFromItem(
  sourceId: string,
  url: string,
  tagName: string,
): PersonalResearchItem | null {
  const all = getAllFromStorage();
  const key = itemKey(sourceId, url);
  const existing = all[key];
  if (!existing) return null;

  const newTags = existing.tags.filter((t) => t !== tagName);
  if (newTags.length === existing.tags.length) return existing;

  const updated = { ...existing, tags: newTags, updatedAt: new Date().toISOString() };
  all[key] = updated;
  saveAllToStorage(all);
  return updated;
}

export function getItemsByTag(tagName: string): PersonalResearchItem[] {
  const all = getAllFromStorage();
  return Object.values(all)
    .filter((item) => item.tags.includes(tagName))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getTagCounts(): Record<string, number> {
  const all = getAllFromStorage();
  const counts: Record<string, number> = {};
  for (const item of Object.values(all)) {
    for (const tag of item.tags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
}

export function getItemsByStatus(status: FollowUpStatus): PersonalResearchItem[] {
  const all = getAllFromStorage();
  return Object.values(all)
    .filter((item) => item.followUpStatus === status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getActiveItems(): PersonalResearchItem[] {
  const all = getAllFromStorage();
  const activeStatuses: FollowUpStatus[] = ["to_read", "reading", "to_act"];
  return Object.values(all)
    .filter((item) => activeStatuses.includes(item.followUpStatus))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getItemsWithNotes(): PersonalResearchItem[] {
  const all = getAllFromStorage();
  return Object.values(all)
    .filter((item) => item.note.trim().length > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// ============ 2026-11：「保存」类概念合并 ============
// 以前动态资讯页自己另存了四份本地数据：稍后读、置顶、三个预设标签、便签。它们和「待跟进」重叠，
// 备注和标签还和详情页各存一份、互相看不见。现在只留「收藏（数据库）+ 待跟进（本地）」两种。
// 第一次打开网站时把旧数据搬进待跟进，搬完删掉旧键，打上标记不再重复执行。
const LEGACY_MIGRATED_KEY = "legacy_inbox_data_migrated_v1";
const LEGACY_KEYS = {
  readingList: "inbox_reading_list",
  pinned: "inbox_pinned_items",
  tags: "inbox_item_tags",
  notes: "inbox_notes",
} as const;

/** 动态资讯页旧数据的键是 `${sourceId}__${url}` */
function splitLegacyKey(k: string): { sourceId: string; url: string } | null {
  const i = k.indexOf("__");
  if (i <= 0) return null;
  return { sourceId: k.slice(0, i), url: k.slice(i + 2) };
}

/** 旧状态排在新状态前面时才覆盖：待读 < 在读 < 待行动 < 已完成，"none" 最弱 */
const STATUS_RANK: Record<FollowUpStatus, number> = { none: 0, to_read: 1, reading: 2, to_act: 3, done: 4 };

export function migrateLegacyInboxData(): { moved: number } {
  if (typeof window === "undefined") return { moved: 0 };
  const ls = window.localStorage;
  try {
    if (ls.getItem(LEGACY_MIGRATED_KEY)) return { moved: 0 };
  } catch {
    return { moved: 0 };
  }
  const read = <T,>(key: string, fallback: T): T => {
    try {
      const raw = ls.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const readingList = read<string[]>(LEGACY_KEYS.readingList, []);
  const pinned = read<string[]>(LEGACY_KEYS.pinned, []);
  const tags = read<Record<string, string[]>>(LEGACY_KEYS.tags, {});
  const notes = read<Record<string, string>>(LEGACY_KEYS.notes, {});

  const all = getAllFromStorage();
  const now = new Date().toISOString();
  let moved = 0;
  const touch = (k: string) => {
    const ref = splitLegacyKey(k);
    if (!ref) return null;
    const key = itemKey(ref.sourceId, ref.url);
    all[key] ??= { ...ref, title: "", note: "", followUpStatus: "none", tags: [], createdAt: now, updatedAt: now };
    all[key].updatedAt = now;
    return all[key];
  };
  const raise = (k: string, status: FollowUpStatus) => {
    const item = touch(k);
    if (!item) return;
    if (STATUS_RANK[status] > STATUS_RANK[item.followUpStatus]) item.followUpStatus = status;
    moved++;
  };

  for (const k of readingList) raise(k, "to_read");
  for (const k of pinned) raise(k, "to_act");
  for (const [k, list] of Object.entries(tags)) {
    for (const tag of list ?? []) {
      if (tag === "需跟进") raise(k, "to_act");
      else if (tag === "已处理") raise(k, "done");
      else {
        const item = touch(k);
        if (!item) continue;
        if (!item.tags.includes(tag)) item.tags.push(tag);
        addTag(tag);
        moved++;
      }
    }
  }
  for (const [k, text] of Object.entries(notes)) {
    const t = (text ?? "").trim();
    if (!t) continue;
    const item = touch(k);
    if (!item) continue;
    // 两边都写过就拼起来，不丢任何一边
    item.note = item.note && item.note.trim() !== t ? `${item.note}\n\n${t}` : t;
    moved++;
  }

  saveAllToStorage(all);
  try {
    for (const key of Object.values(LEGACY_KEYS)) ls.removeItem(key);
    ls.setItem(LEGACY_MIGRATED_KEY, now);
  } catch {
    // 存储不可用时下次再试
  }
  return { moved };
}

/** 搬过来的旧数据只有链接没有标题：页面拿到条目后顺手补上 */
export function backfillResearchTitles(items: Array<{ sourceId: string; url: string; title: string }>): number {
  if (typeof window === "undefined" || items.length === 0) return 0;
  const all = getAllFromStorage();
  let n = 0;
  for (const it of items) {
    const entry = all[itemKey(it.sourceId, it.url)];
    if (entry && !entry.title && it.title) {
      entry.title = it.title;
      n++;
    }
  }
  if (n) saveAllToStorage(all);
  return n;
}
