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
