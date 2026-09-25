"use client";

import { useState, useMemo, useCallback, use } from "react";
import Link from "next/link";
import {
  getAllPersonalResearch,
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_STATUS_ICONS,
  bulkSetFollowUpStatus,
  bulkDeletePersonalResearch,
  getAllTags,
  getTagColor,
  getTagCounts,
  type PersonalResearchItem,
  type FollowUpStatus,
  type ResearchTag,
} from "@/lib/personal-research";
import {
  ArrowLeftRight, Bell, ClipboardList, Icon, NotebookPen, Star, type LucideIcon,
} from "lucide-react";
import { StatusIcon } from "@/components/status-icon";

type StarredItem = {
  sourceId: string;
  departmentName: string;
  channelName: string;
  title: string;
  url: string;
  listPublishedAt: string;
  firstSeenAt: string;
  importanceLevel: string;
  keywordScore: number;
  categories: Array<{ category: string; score: number; topKeywords?: string[] }>;
  isStarred: boolean;
  isRead: boolean;
};

type SubscriptionItem = {
  id: string;
  type: "department" | "keyword" | "category";
  target: string;
  targetName: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ResearchTab = "followup" | "starred" | "noted" | "subscriptions" | "compare";

const TAB_CONFIG: Array<{ key: ResearchTab; label: string; icon: LucideIcon; desc: string }> = [
  { key: "followup", label: "待跟进", icon: ClipboardList, desc: "需要处理的政策" },
  { key: "starred", label: "收藏", icon: Star, desc: "收藏的重点政策" },
  { key: "noted", label: "有备注", icon: NotebookPen, desc: "写过备注的政策" },
  { key: "compare", label: "对比中", icon: ArrowLeftRight, desc: "待对比的政策列表" },
  { key: "subscriptions", label: "订阅", icon: Bell, desc: "关键词与机构订阅" },
];

function summarizeTitle(title: string, maxLen = 56): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen) + "…";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

const ACTIVE_STATUSES: FollowUpStatus[] = ["to_read", "reading", "to_act"];

function ResearchListClient({
  starredItemsPromise,
  subscriptionsPromise,
}: {
  starredItemsPromise: Promise<StarredItem[]>;
  subscriptionsPromise: Promise<SubscriptionItem[]>;
}) {
  const starredItems = use(starredItemsPromise);
  const subscriptions = use(subscriptionsPromise);
  const [activeTab, setActiveTab] = useState<ResearchTab>("followup");
  const [researchItems, setResearchItems] = useState<PersonalResearchItem[]>(getAllPersonalResearch);
  const [compareItems, setCompareItems] = useState<Array<{ sourceId: string; url: string; title: string }>>(() => {
    try {
      const raw = window.localStorage.getItem("compare_items");
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState<ResearchTag[]>(getAllTags);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>(getTagCounts);

  const refreshResearch = useCallback(() => {
    setResearchItems(getAllPersonalResearch());
    setAllTags(getAllTags());
    setTagCounts(getTagCounts());
    try {
      const raw = window.localStorage.getItem("compare_items");
      if (raw) {
        setCompareItems(JSON.parse(raw));
      }
    } catch {}
  }, []);

  const followupItems = useMemo(() => {
    let items = researchItems
      .filter((item) => ACTIVE_STATUSES.includes(item.followUpStatus))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (selectedTag) {
      items = items.filter((item) => item.tags.includes(selectedTag));
    }
    return items;
  }, [researchItems, selectedTag]);

  const notedItems = useMemo(() => {
    let items = researchItems
      .filter((item) => item.note && item.note.trim().length > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (selectedTag) {
      items = items.filter((item) => item.tags.includes(selectedTag));
    }
    return items;
  }, [researchItems, selectedTag]);

  const tabCounts = {
    followup: followupItems.length,
    starred: starredItems.length,
    noted: notedItems.length,
    compare: compareItems.length,
    subscriptions: subscriptions.length,
  };

  return (
    <div>
      {/* 状态统计卡片 */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        {[
          { status: "to_read" as const, label: "待读", color: "sky" },
          { status: "reading" as const, label: "在读", color: "amber" },
          { status: "to_act" as const, label: "待行动", color: "violet" },
          { status: "done" as const, label: "已完成", color: "emerald" },
        ].map(({ status, label, color }) => {
          const count = researchItems.filter(
            (item) => item.followUpStatus === status,
          ).length;
          const colorClasses: Record<string, string> = {
            sky: "bg-sky-50 text-sky-700 border-sky-100",
            amber: "bg-amber-50 text-amber-700 border-amber-100",
            violet: "bg-violet-50 text-violet-700 border-violet-100",
            emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
          };
          return (
            <div
              key={status}
              className={`rounded-2xl border p-4 ${colorClasses[color]}`}
            >
              <div className="text-2xl font-semibold">{count}</div>
              <div className="mt-0.5 text-xs">
                <StatusIcon status={status} className="inline h-3.5 w-3.5" /> {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* 标签筛选 */}
      {allTags.length > 0 && (activeTab === "followup" || activeTab === "noted") && (
        <div className="mb-6">
          <div className="mb-2 text-xs font-medium text-slate-500">按标签筛选</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedTag === null
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              全部
            </button>
            {allTags.map((tag) => {
              const count = tagCounts[tag.name] ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={tag.name}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                    selectedTag === tag.name
                      ? `${tag.color} border ring-2 ring-offset-1`
                      : `${tag.color} border opacity-70 hover:opacity-100`
                  }`}
                >
                  {tag.name}
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 mb-6">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-3 text-sm font-medium transition ${
              activeTab === tab.key
                ? "text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <tab.icon className="h-4 w-4" aria-hidden />
              <span>{tab.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500"
              }`}>
                {tabCounts[tab.key]}
              </span>
            </span>
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
            )}
          </button>
        ))}
      </div>

      {/* 待跟进列表 */}
      {activeTab === "followup" && (
        <div>
          {followupItems.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="暂无待跟进的政策"
              desc="看完政策后可以标记待跟进，这里会自动汇总"
              actionText="去动态资讯看看"
              actionHref="/inbox"
            />
          ) : (
            <div>
              {/* 批量操作工具栏 */}
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === followupItems.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(followupItems.map((i) => `${i.sourceId}::${i.url}`)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-sm text-slate-600">
                      已选 <span className="font-semibold text-slate-900">{selectedIds.size}</span> / {followupItems.length}
                    </span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <>
                      {[
                        { status: "reading" as const, label: "在读" },
                        { status: "to_act" as const, label: "待行动" },
                        { status: "done" as const, label: "已完成" },
                      ].map((opt) => (
                        <button
                          key={opt.status}
                          type="button"
                          onClick={() => {
                            const items = followupItems.filter((i) =>
                              selectedIds.has(`${i.sourceId}::${i.url}`)
                            );
                            bulkSetFollowUpStatus(items, opt.status);
                            setSelectedIds(new Set());
                            refreshResearch();
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                        >
                          设为{opt.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(`确定要删除选中的 ${selectedIds.size} 条吗？`)) return;
                          const items = followupItems.filter((i) =>
                            selectedIds.has(`${i.sourceId}::${i.url}`)
                          );
                          bulkDeletePersonalResearch(items);
                          setSelectedIds(new Set());
                          refreshResearch();
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {followupItems.map((item) => {
                  const isSelected = selectedIds.has(`${item.sourceId}::${item.url}`);
                  return (
                    <div
                      key={`${item.sourceId}::${item.url}`}
                      className={`group rounded-2xl border p-4 transition hover:shadow-sm ${
                        isSelected
                          ? "border-sky-200 bg-sky-50/30"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const id = `${item.sourceId}::${item.url}`;
                            const next = new Set(selectedIds);
                            if (e.target.checked) {
                              next.add(id);
                            } else {
                              next.delete(id);
                            }
                            setSelectedIds(next);
                          }}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <div className="shrink-0 text-lg">
                          <StatusIcon status={item.followUpStatus} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-slate-500">
                              {FOLLOW_UP_STATUS_LABELS[item.followUpStatus]}
                            </span>
                            <span className="text-xs text-slate-400">
                              更新于 {formatDate(item.updatedAt)}
                            </span>
                          </div>
                          <Link
                            href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                            className="mt-1 block line-clamp-2 text-sm font-medium text-slate-900 hover:text-slate-600"
                          >
                            {summarizeTitle(item.title)}
                          </Link>
                          {item.note && (
                            <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
                              <NotebookPen className="mr-1 inline h-3 w-3" aria-hidden />{item.note}
                            </p>
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.tags.slice(0, 4).map((tag) => {
                                const color = getTagColor(tag);
                                return (
                                  <span
                                    key={tag}
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${color} border`}
                                  >
                                    {tag}
                                  </span>
                                );
                              })}
                              {item.tags.length > 4 && (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                                  +{item.tags.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 收藏列表 */}
      {activeTab === "starred" && (
        <div>
          {starredItems.length === 0 ? (
            <EmptyState
              icon={Star}
              title="暂无收藏的政策"
              desc="遇到重要的政策可以点击收藏，这里会自动汇总"
              actionText="去动态资讯看看"
              actionHref="/inbox"
            />
          ) : (
            <div className="space-y-2">
              {starredItems.map((item) => (
                <Link
                  key={`${item.sourceId}-${item.url}`}
                  href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                  className="group block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Star className="h-3 w-3" aria-hidden />已收藏</span>
                        <span className="text-xs text-slate-400">
                          {item.departmentName}
                        </span>
                      </div>
                      <h3 className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-slate-600">
                        {summarizeTitle(item.title)}
                      </h3>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                        <span>{item.channelName}</span>
                        {item.listPublishedAt && (
                          <span>{formatDate(item.listPublishedAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 有备注列表 */}
      {activeTab === "noted" && (
        <div>
          {notedItems.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="暂无写过备注的政策"
              desc="在政策详情页可以添加备注，记录你的想法和分析"
              actionText="去动态资讯看看"
              actionHref="/inbox"
            />
          ) : (
            <div className="space-y-2">
              {notedItems.map((item) => (
                <Link
                  key={`${item.sourceId}::${item.url}`}
                  href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                  className="group block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <NotebookPen className="h-5 w-5 shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400">
                          更新于 {formatDate(item.updatedAt)}
                        </span>
                      </div>
                      <h3 className="mt-1 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-slate-600">
                        {summarizeTitle(item.title)}
                      </h3>
                      <p className="mt-2 text-xs text-slate-600 line-clamp-3 bg-slate-50 rounded-lg p-3">
                        {item.note}
                      </p>
                      {item.tags && item.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.tags.slice(0, 4).map((tag) => {
                            const color = getTagColor(tag);
                            return (
                              <span
                                key={tag}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${color} border`}
                              >
                                {tag}
                              </span>
                            );
                          })}
                          {item.tags.length > 4 && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                              +{item.tags.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 对比中列表 */}
      {activeTab === "compare" && (
        <div>
          {compareItems.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="暂无待对比的政策"
              desc="在政策详情页或相关政策中加入对比，这里会自动汇总"
              actionText="去动态资讯看看"
              actionHref="/inbox"
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  已选择 <span className="font-semibold text-slate-900">{compareItems.length}</span> 条政策
                </div>
                {compareItems.length >= 2 && (
                  <Link
                    href="/compare"
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700"
                  >
                    <span>⇄</span>
                    <span>开始对比</span>
                  </Link>
                )}
              </div>
              <div className="space-y-2">
                {compareItems.map((item, idx) => (
                  <Link
                    key={`${item.sourceId}::${item.url}`}
                    href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
                    className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="shrink-0 text-lg">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-violet-600">⇄ 对比中</span>
                      </div>
                      <h3 className="mt-1 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-slate-600">
                        {summarizeTitle(item.title)}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
              {compareItems.length < 2 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  至少选择 2 条政策才能开始对比
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 订阅列表 */}
      {activeTab === "subscriptions" && (
        <div>
          {subscriptions.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="暂无订阅"
              desc="订阅关键词或机构，第一时间获取相关政策更新"
              actionText="管理订阅"
              actionHref="/subscribe"
            />
          ) : (
            <div className="space-y-4">
              <SubscriptionSection
                title="机构订阅"
                items={subscriptions.filter((s) => s.type === "department")}
              />
              <SubscriptionSection
                title="关键词订阅"
                items={subscriptions.filter((s) => s.type === "keyword")}
              />
              <SubscriptionSection
                title="分类订阅"
                items={subscriptions.filter((s) => s.type === "category")}
              />
              <div className="text-center pt-2">
                <Link
                  href="/subscribe"
                  className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
                >
                  管理全部订阅 →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubscriptionSection({
  title,
  items,
}: {
  title: string;
  items: SubscriptionItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {items.length} 个
        </span>
      </div>
      <div className="space-y-2">
        {items.map((sub) => (
          <div
            key={sub.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-900">
                {sub.targetName || sub.target}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {formatDate(sub.createdAt)} 添加
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                sub.enabled
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {sub.enabled ? "已启用" : "已禁用"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  actionText,
  actionHref,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  actionText: string;
  actionHref: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 py-12 text-center">
      <div className="mb-3 flex justify-center"><Icon className="h-8 w-8 text-slate-300" aria-hidden /></div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
      <Link
        href={actionHref}
        className="inline-flex items-center gap-1 mt-4 text-sm text-slate-600 hover:text-slate-800"
      >
        {actionText} →
      </Link>
    </div>
  );
}

export { ResearchListClient };
