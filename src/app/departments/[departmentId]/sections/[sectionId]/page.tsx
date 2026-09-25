import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ImportanceBadge } from "@/components/importance-badge";
import {
  ensureMonitorSchema,
  getItemsByDepartmentAndChannel,
} from "@/lib/monitor/db";
import { isDbAvailable } from "@/lib/db";
import { generateMockItems } from "@/lib/monitor/mock";

type SectionPageProps = {
  params: Promise<{
    departmentId: string;
    sectionId: string;
  }>;
};

export default async function SectionPage({ params }: SectionPageProps) {
  const { departmentId, sectionId } = await params;
  const departmentName = decodeURIComponent(departmentId);
  const channelName = decodeURIComponent(sectionId);

  try { await ensureMonitorSchema(); } catch {}

  if (!isDbAvailable()) {
    const mockItems = generateMockItems(15).filter(
      (i) => i.departmentName === departmentName || i.channelName === channelName
    );
    const items = mockItems.length > 0 ? mockItems : generateMockItems(8);
    const displayName = `${departmentName}·${channelName}`;
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="mb-4 text-sm text-slate-500">
            <Link href="/inbox" className="hover:underline">收件箱</Link>
            <span className="mx-1">/</span>
            <span>{displayName}</span>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 mb-4">演示模式 · 显示示例数据</div>
          <div className="space-y-2">
            {items.map((item) => (
              <Link key={item.sourceId} href={`/items/${item.sourceId}?sourceId=${item.sourceId}&url=${encodeURIComponent(item.url)}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-slate-300">
                <div className="text-sm font-medium text-slate-900">{item.title}</div>
                <div className="mt-1 text-xs text-slate-400">{item.listPublishedAt.slice(0, 10)}</div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const data = await getItemsByDepartmentAndChannel(departmentName, channelName, 50);

  const displayName = data.items[0]?.displayName || `${departmentName}·${channelName}`;
  const totalCount = data.totalCount;
  const todayCount = data.todayCount;
  const items = data.items;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link
            href={`/departments/${encodeURIComponent(departmentName)}`}
            className="hover:text-slate-900"
          >
            {departmentName}
          </Link>
          <span>/</span>
          <span>{channelName}</span>
        </div>

        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm text-slate-500">{departmentName}</div>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">
                {channelName}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                {displayName} · 该栏目下共 {totalCount} 条监测内容，今日新增 {todayCount} 条。
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 px-5 py-4 text-sm text-slate-600">
              <div>模块分类：渠道栏目</div>
              <div className="mt-1">
                今日新增：<span className="font-semibold text-slate-900">{todayCount}</span> 条
              </div>
              <div className="mt-1">
                历史总数：<span className="font-semibold text-slate-900">{totalCount}</span> 条
              </div>
              <div className="mt-1">
                来源配置数：<span className="font-semibold text-slate-900">{data.sourceIds.length}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">栏目内容</h2>
              <p className="mt-1 text-sm text-slate-500">
                按发布日期倒序。点击条目可进入内容详情页查看正文、附件与分析。
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {items.length > 0 ? (
              items.map((item) => {
                const safeTitle = String(item.title ?? "").trim();
                const safeSummary = item.summary ? String(item.summary).trim() : safeTitle;
                return (
                  <Link
                    key={`${item.url}-${item.sourceId}`}
                    href={`/items/x?sourceId=${encodeURIComponent(item.sourceId)}&url=${encodeURIComponent(item.url)}`}
                    className="block rounded-3xl border border-slate-200 p-5 transition hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span>{item.listPublishedAt}</span>
                      <span>·</span>
                      <span>{item.channelName}</span>
                      {item.isStarred ? (
                        <span className="rounded-full bg-amber-50 px-3 py-0.5 text-xs text-amber-700">
                          已标星
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-3 text-xl font-semibold">{safeTitle}</h3>
                    {safeSummary && safeSummary !== safeTitle ? (
                      <p className="mt-2 text-sm leading-6 text-slate-600">{safeSummary}</p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <ImportanceBadge
                        level={item.importanceLevel}
                        keywordScore={item.keywordScore}
                        className="px-3 py-1"
                      />
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                暂未抓取到该栏目下的内容。来源配置完成后，运行监测任务会自动把新条目抓取到这里。
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
