import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { mctClassificationConfig, type CrawlDepth, type SiteModuleConfig } from "@/lib/site-configs/mct";

function getDepthLabel(depth: CrawlDepth) {
  if (depth === "terminal_list") {
    return "最终列表页";
  }

  if (depth === "nested_hub") {
    return "中间嵌套页";
  }

  if (depth === "special_topic") {
    return "专题聚合页";
  }

  return "年份归档页";
}

function getDepthBadge(depth: CrawlDepth) {
  if (depth === "terminal_list") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (depth === "nested_hub") {
    return "bg-amber-50 text-amber-700";
  }

  if (depth === "special_topic") {
    return "bg-violet-50 text-violet-700";
  }

  return "bg-sky-50 text-sky-700";
}

function groupBySiteAndChannel(modules: SiteModuleConfig[]) {
  const siteMap = new Map<
    string,
    {
      domain: string;
      siteName: string;
      channels: Map<string, SiteModuleConfig[]>;
    }
  >();

  for (const mod of modules) {
    const key = `${mod.siteName}__${mod.domain}`;
    const siteEntry =
      siteMap.get(key) ??
      {
        domain: mod.domain,
        siteName: mod.siteName,
        channels: new Map<string, SiteModuleConfig[]>(),
      };

    const channelModules = siteEntry.channels.get(mod.channelGroup) ?? [];
    channelModules.push(mod);
    siteEntry.channels.set(mod.channelGroup, channelModules);
    siteMap.set(key, siteEntry);
  }

  return Array.from(siteMap.values());
}

export default function MctSourcePage() {
  const groupedSites = groupBySiteAndChannel(mctClassificationConfig.modules);
  const unresolvedCount = mctClassificationConfig.modules.filter((mod) => mod.unresolved).length;
  const terminalCount = mctClassificationConfig.modules.filter(
    (mod) => mod.crawlDepth === "terminal_list",
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>来源网站</span>
          <span>/</span>
          <span>文化和旅游部</span>
        </div>

        <section className="rounded-[32px] bg-slate-950 px-8 py-10 text-white shadow-sm">
          <div className="grid gap-8 lg:grid-cols-[1.45fr_1fr]">
            <div className="space-y-5">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm">
                已接入网页展示的来源配置
              </span>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">
                  文化和旅游部来源网站分类页
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300">
                  这页先把你发来的文旅部网站配置跑到网页里。现在能直接看站点、频道组、栏目、子栏目、
                  抓取深度、未解决嵌套和列表链接，方便你先审一版再调整。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {mctClassificationConfig.classificationPrinciples.map((principle) => (
                  <div
                    key={principle}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                  >
                    {principle}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">来源模块数</div>
                <div className="mt-1 text-3xl font-semibold">{mctClassificationConfig.modules.length}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">来源站点数</div>
                <div className="mt-1 text-3xl font-semibold">{groupedSites.length}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">已到最终列表</div>
                <div className="mt-1 text-3xl font-semibold">{terminalCount}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">未解决嵌套</div>
                <div className="mt-1 text-3xl font-semibold">{unresolvedCount}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">文章级来源追踪字段</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            这里是后续每篇文章建议保留的精确来源字段。重点不是只记住“文旅部”，而是要能定位到文章来自哪个列表页、
            最终对应哪个详情页。
          </p>
          <div className="mt-4">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sources/mct/szyw-live"
                className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                试抓取时政要闻最新动态
              </Link>
              <Link
                href="/sources/mct/jyjd-live"
                className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                试抓取决议决定
              </Link>
              <Link
                href="/sources/mct/genres-live"
                className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                体裁分类最近10条
              </Link>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {mctClassificationConfig.sourceTraceFields.map((field) => (
              <span
                key={field}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700"
              >
                {field}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          {groupedSites.map((site) => (
            <div key={`${site.siteName}-${site.domain}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">{site.siteName}</h2>
                  <p className="mt-1 text-sm text-slate-500">{site.domain}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  {Array.from(site.channels.keys()).length} 个频道组
                </span>
              </div>

              <div className="mt-6 space-y-6">
                {Array.from(site.channels.entries()).map(([channelName, modules]) => (
                  <div key={channelName} className="rounded-3xl bg-slate-50 p-5">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">{channelName}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          这里按栏目和子栏目展示，便于你检查有没有分错、漏分或还没钻到底。
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                        {modules.length} 个模块
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      {modules.map((mod) => (
                        <div key={mod.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-xs text-slate-500">{mod.id}</div>
                              <h4 className="mt-1 text-lg font-semibold">
                                {mod.moduleName}
                                {mod.submoduleName ? ` / ${mod.submoduleName}` : ""}
                              </h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${getDepthBadge(mod.crawlDepth)}`}
                              >
                                {getDepthLabel(mod.crawlDepth)}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  mod.unresolved
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {mod.unresolved ? "未解决" : "已到当前终态"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 space-y-3 text-sm text-slate-600">
                            <div>
                              <div className="text-slate-500">列表页链接</div>
                              <a
                                href={mod.listUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 block break-all text-slate-900 underline decoration-slate-300 underline-offset-4"
                              >
                                {mod.listUrl}
                              </a>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                最终来源要求：详情页级
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                {mod.departmentName}
                              </span>
                            </div>
                            {mod.notes ? (
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                                {mod.notes}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
