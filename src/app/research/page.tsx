import { SiteHeader } from "@/components/site-header";
import { ResearchListClient } from "@/components/research-list-client";
import {
  ensureMonitorSchema,
  getInboxItemsByFilter,
  getSubscriptionsByUser,
} from "@/lib/monitor/db";
import { isDbAvailable } from "@/lib/db";
import { generateMockItems } from "@/lib/monitor/mock";
import {
  ClipboardList,
} from "lucide-react";

export const dynamic = "force-dynamic";

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

async function getStarredItems(): Promise<StarredItem[]> {
  if (!isDbAvailable()) {
    const mockItems = generateMockItems(10);
    return mockItems
      .filter((m, i) => i < 3)
      .map((m) => ({
        sourceId: m.sourceId,
        departmentName: m.departmentName,
        channelName: m.channelName,
        title: m.title,
        url: m.url,
        listPublishedAt: m.listPublishedAt,
        firstSeenAt: m.firstSeenAt,
        importanceLevel: m.importanceLevel,
        keywordScore: m.keywordScore,
        categories: m.categories || [],
        isStarred: true,
        isRead: m.isRead,
      }));
  }

  const result = await getInboxItemsByFilter({
    onlyStarred: true,
    sort: "first_seen_at",
    limit: 50,
    offset: 0,
  });

  return (result.items as StarredItem[]) || [];
}

async function getSubscriptions(): Promise<SubscriptionItem[]> {
  if (!isDbAvailable()) {
    return [
      { id: "mock-1", type: "department", target: "工业和信息化部", targetName: "工业和信息化部", enabled: true, createdAt: "2025-01-15T00:00:00Z", updatedAt: "2025-01-15T00:00:00Z" },
      { id: "mock-2", type: "keyword", target: "数据要素", targetName: null, enabled: true, createdAt: "2025-01-20T00:00:00Z", updatedAt: "2025-01-20T00:00:00Z" },
      { id: "mock-3", type: "keyword", target: "专项资金", targetName: null, enabled: false, createdAt: "2025-02-01T00:00:00Z", updatedAt: "2025-02-10T00:00:00Z" },
    ];
  }

  const rows = await getSubscriptionsByUser("default");
  return rows as SubscriptionItem[];
}

export default async function ResearchPage() {
  await ensureMonitorSchema();
  const dbAvailable = isDbAvailable();

  const starredItemsPromise = getStarredItems();
  const subscriptionsPromise = getSubscriptions();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      {!dbAvailable && (
        <div className="border-b border-sky-200 bg-sky-50 px-6 py-3 text-sm text-sky-800">
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-2">
            <span className="font-medium">演示模式</span>
            <span>当前展示模拟数据，可浏览完整功能界面。</span>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 页头 */}
        <section className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <ClipboardList className="h-4 w-4" aria-hidden />
            <span>我的研究</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            你的个人研究空间
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            收藏、待跟进、备注 — 所有你的研究动作都在这里
          </p>
        </section>

        {/* 列表区 */}
        <ResearchListClient
          starredItemsPromise={starredItemsPromise}
          subscriptionsPromise={subscriptionsPromise}
        />

        {/* 底部说明 */}
        <footer className="mt-12 border-t border-slate-200 pt-6 pb-4 text-center text-xs text-slate-400">
          我的研究 · 数据保存在本地浏览器中
        </footer>
      </div>
    </main>
  );
}
