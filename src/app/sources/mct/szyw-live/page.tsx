import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getLatestMctSzywNews } from "@/lib/live-mct-szyw";
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

export default async function MctSzywLivePage() {
  const result = await getLatestMctSzywNews(10);
  const visibleItems = filterLatestItemsFromMonitorWindow(result.items, (item) => item.listPublishedAt);
  const latestDate = visibleItems[0]?.listPublishedAt ?? MONITOR_EMPTY_TEXT;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/sources/mct" className="hover:text-slate-900">
            文化和旅游部
          </Link>
          <span>/</span>
          <span>时政要闻抓取演示</span>
        </div>

        <section className="rounded-[32px] bg-slate-950 px-8 py-10 text-white shadow-sm">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm">
                真实抓取演示
              </span>
              <h1 className="text-4xl font-semibold tracking-tight">
                文旅部时政要闻，按离今天最近日期获取最新动态
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300">
                这页不是模拟数据，而是实时从文旅部 `时政要闻` 列表抓取最近内容。当前只保留 `2026-05-05`
                之后的内容，并展示最新 {MONITOR_MAX_ITEMS} 条，
                并补充正文提取、详情页时间、来源识别、转载/首发判断和双链接展示，方便你判断后面能不能正式接入同步系统。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">栏目列表页</div>
                <div className="mt-1 text-lg font-semibold">时政要闻</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">列表页最近日期</div>
                <div className="mt-1 text-lg font-semibold">{latestDate}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">抓取条数</div>
                <div className="mt-1 text-lg font-semibold">{visibleItems.length}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-sm text-slate-300">抓取时间</div>
                <div className="mt-1 text-sm font-semibold">{formatBeijingTime(result.fetchedAt)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">来源说明</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">栏目列表页</div>
              <a
                href={result.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block break-all text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
              >
                {result.sourceUrl}
              </a>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              当前规则：
              <div>1. 只保留 {MONITOR_START_DATE} 之后的内容</div>
              <div>2. 过滤后只展示最新 {MONITOR_MAX_ITEMS} 条</div>
              <div>3. 进入详情页抓取发布时间、来源和正文前几段</div>
              <div>4. 根据来源字段判断“疑似转载 / 疑似首发 / 待判断”</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">最新动态列表</h2>
              <p className="mt-1 text-sm text-slate-500">
                {visibleItems.length > 0
                  ? `这里只展示 ${MONITOR_START_DATE} 之后的最新内容，当前最近日期是 ${latestDate}。`
                  : MONITOR_EMPTY_TEXT}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {visibleItems.length > 0 ? visibleItems.map((item, index) => (
              <div key={item.url} className="rounded-3xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>#{index + 1}</span>
                  <span>·</span>
                  <span>列表页日期 {item.listPublishedAt}</span>
                  <span>·</span>
                  <span>时政要闻</span>
                </div>

                <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span
                    className={`rounded-full px-3 py-1 font-medium ${
                      item.originJudgment === "疑似首发"
                        ? "bg-emerald-50 text-emerald-700"
                        : item.originJudgment === "疑似转载"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {item.originJudgment ?? "待判断"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                    {item.detailSource ? `来源识别：${item.detailSource}` : "来源待识别"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">详情页时间与来源</div>
                    <div className="mt-2 text-sm font-medium text-slate-900">
                      {item.detailPublishedAt ?? "暂未解析到详情页时间"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {item.detailSource ? `来源：${item.detailSource}` : "暂未解析到来源"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">转载 / 首发判断</div>
                    <div className="mt-2 text-sm font-medium text-slate-900">
                      {item.originJudgment ?? "待判断"}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">
                      {item.originReason ?? "暂未生成判断说明"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm text-slate-500">当前详情页链接</div>
                        <div className="mt-1 text-sm text-slate-600">
                          这是你当前最应该优先查看和跳转确认的链接。
                        </div>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-fit rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        打开当前详情页
                      </a>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">来源站链接</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {item.sourceSiteUrl ? (
                        <a
                          href={item.sourceSiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          打开{item.sourceSiteLabel}
                        </a>
                      ) : (
                        <div className="text-sm text-slate-600">当前还没有可跳转的固定来源站链接</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">来源栏目列表页</div>
                    <div className="mt-1 text-sm text-slate-600">
                      这个是辅助核对入口，不作为主要操作入口。
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">
                        展开辅助跳转
                      </summary>
                      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <a
                          href={item.sourceListUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          打开栏目页
                        </a>
                      </div>
                    </details>
                  </div>
                </div>

                <details className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    展开查看正文提取
                  </summary>
                  {item.contentParagraphs && item.contentParagraphs.length > 0 ? (
                    <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
                      {item.contentParagraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-600">暂未提取到正文内容。</div>
                  )}
                </details>
              </div>
            )) : (
              <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
                {MONITOR_EMPTY_TEXT}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
