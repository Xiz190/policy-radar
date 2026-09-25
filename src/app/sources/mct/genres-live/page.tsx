import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MctGenreGroupsAccordion } from "@/components/mct-genre-groups-accordion";
import { getLatestMctGenreGroups } from "@/lib/live-mct-genres";
import {
  filterLatestItemsFromMonitorWindow,
  MONITOR_EMPTY_TEXT,
  MONITOR_MAX_ITEMS,
  MONITOR_START_DATE,
} from "@/lib/monitor-window";

export const dynamic = "force-dynamic";

function formatBeijingTime(isoString: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(isoString));
}

export default async function MctGenresLivePage() {
  const result = await getLatestMctGenreGroups(10);
  const filteredGroups = result.groups.map((group) => ({
    ...group,
    items: filterLatestItemsFromMonitorWindow(group.items, (item) => item.date),
  }));
  const totalItems = filteredGroups.reduce((sum, group) => sum + group.items.length, 0);
  const groupsWithUpdates = filteredGroups.filter((group) => group.items.length > 0).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/sources/mct" className="hover:text-slate-900">
            文化和旅游部
          </Link>
          <span>/</span>
          <span>体裁分类最近10条</span>
        </div>

        <section className="rounded-[32px] bg-slate-950 px-8 py-10 text-white shadow-sm">
          <div className="grid gap-8 lg:grid-cols-[1.45fr_1fr]">
            <div className="space-y-4">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm">
                真实抓取汇总页
              </span>
              <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">
                体裁分类 12 个栏目最近 10 条汇总
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300">
                这页把文旅部政府信息公开站 `体裁分类` 下 12 个最终子目录页统一抓取出来，
                但只保留 `2026-05-05` 之后的内容。每个栏目最多展示最新 {MONITOR_MAX_ITEMS} 条，
                如果没有更新就显示“{MONITOR_EMPTY_TEXT}”。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">栏目数</div>
                <div className="mt-1 text-3xl font-semibold">{filteredGroups.length}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">汇总条数</div>
                <div className="mt-1 text-3xl font-semibold">{totalItems}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">有更新栏目</div>
                <div className="mt-1 text-3xl font-semibold">{groupsWithUpdates}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">起始日期</div>
                <div className="mt-1 text-2xl font-semibold">{MONITOR_START_DATE}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 sm:col-span-2">
                <div className="text-sm text-slate-300">抓取时间</div>
                <div className="mt-1 text-sm font-semibold">{formatBeijingTime(result.fetchedAt)}</div>
              </div>
            </div>
          </div>
        </section>

        <MctGenreGroupsAccordion groups={filteredGroups} />
      </div>
    </main>
  );
}
