import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import { getPgPool, isDbAvailable } from "@/lib/db";
import { categoryLabel } from "@/lib/monitor/content-meta";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const logger = createLogger("diagnose-page");

type OldKwRow = { department_name: string; category: string; count: string; sample_keywords: string };
type OldItemRow = { url: string; title: string; matched_categories: string };
type FailedItemRow = { url: string; title: string; capture_note: string; list_published_at: string };
type CategoryDistRow = { category: string; count: string };
type ItemCategoryRow = { category: string; count: string };
type SignalDebugRow = { category: string; day: string; cnt: string };
type Total14Row = { total_items: string; items_with_categories: string };
type SourcesOverviewRow = { total: string; enabled: string; auto_monitor: string; key: string };
type DirtyDataRow = { field: string; typeof_val: string; cnt: string };

const OLD_CATEGORIES: readonly string[] = [
  "ai", "data", "platform", "innovation", "gov_service", "regulations",
  "signal_pre", "signal_start", "signal_opportunity", "signal_risk",
  "region_bjj", "security", "byte_related",
  "topic_ai", "topic_data", "topic_computing", "topic_industry", "topic_gov", "topic_regulation",
  "signal_exec", "signal_support", "signal_explore", "signal_launch",
  "region_general", "negative",
];

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

async function safeQuery<T extends Record<string, unknown>>(name: string, pool: ReturnType<typeof getPgPool>, sql: string, values?: unknown[]): Promise<{ rows: T[] }> {
  try {
    const res = await pool.query(sql, values);
    return { rows: res.rows as T[] };
  } catch (err) {
    logger.error(`查询失败: ${name}`, { error: err instanceof Error ? err.message : String(err) });
    return { rows: [] };
  }
}

export default async function DiagnosePage() {
  if (!isDbAvailable()) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-6 py-12">
          <SettingsBreadcrumb current="数据诊断" />
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
            <div className="text-base font-semibold text-slate-900">演示模式</div>
            <p className="mt-2">数据诊断页面需要连接数据库。当前为本地演示模式，无法运行诊断查询。</p>
          </div>
        </div>
      </main>
    );
  }

  const pool = getPgPool();

  const [
    keywordsByDeptCat,
    itemsWithOldCats,
    failedItems,
    categoryDistribution,
    itemCategoryDistribution,
    signalTrendDebug,
    total14,
    sourcesOverview,
    dirtyDataStats,
  ] = await Promise.all([
    // 1) 关键词表中还在使用旧分类的记录（按部委+分类聚合）
    safeQuery<OldKwRow>("old-category-keywords", pool, `
      select department_name, category, count(*)::text as count,
        string_agg(keyword, '、' order by weight desc) as sample_keywords
      from monitor_keywords
      where category = any($1::text[])
      group by department_name, category
      order by department_name, count(*) desc
    `, [OLD_CATEGORIES]),

    // 2) 已入库条目的 matched_categories 仍含旧分类名的
    safeQuery<OldItemRow>("items-with-old-cats", pool, `
      select url, title, matched_categories::text as matched_categories
      from monitor_items
      where matched_categories is not null
        and jsonb_typeof(matched_categories) = 'array'
        and jsonb_array_length(matched_categories) > 0
        and exists (
          select 1 from jsonb_array_elements(
            case when jsonb_typeof(matched_categories) = 'array' then matched_categories else '[]'::jsonb end
          ) as c
          where c->>'category' = any($1::text[])
        )
      order by first_seen_at desc
      limit 50
    `, [OLD_CATEGORIES]),

    // 3) 部委/栏目中正文抓取失败的
    safeQuery<FailedItemRow>("failed-items", pool, `
      select i.url, i.title, coalesce(i.capture_note, '') as capture_note,
        coalesce(i.list_published_at::text, '') as list_published_at
      from monitor_items i
      join monitor_sources s on s.id = i.source_id
      where i.content_json is null
         or jsonb_typeof(i.content_json) != 'array'
         or jsonb_array_length(case when jsonb_typeof(i.content_json) = 'array' then i.content_json else '[]'::jsonb end) = 0
         or i.capture_note like '%未能提取%'
      order by i.first_seen_at desc
      limit 50
    `),

    // 4) 全库关键词分布
    safeQuery<CategoryDistRow>("category-distribution", pool, `
      select category, count(*)::text as count
      from monitor_keywords
      group by category
      order by count(*) desc
    `),

    // 5) 已入库条目中实际出现过的分类值
    safeQuery<ItemCategoryRow>("item-category-distribution", pool, `
      select c->>'category' as category, count(*)::text as count
      from monitor_items mi
      cross join jsonb_array_elements(
        case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end
      ) as c
      where jsonb_typeof(mi.matched_categories) = 'array'
      group by c->>'category'
      order by count(*) desc
    `),

    // 6) 近 14 天，信号类条目的日分布
    safeQuery<SignalDebugRow>("signal-trend-debug", pool, `
      select c->>'category' as category, i.first_seen_at::date as day, count(*)::text as cnt
      from monitor_items i
      cross join jsonb_array_elements(
        case when jsonb_typeof(i.matched_categories) = 'array' then i.matched_categories else '[]'::jsonb end
      ) as c
      where i.first_seen_at >= (current_date - 14)::timestamptz
        and jsonb_typeof(i.matched_categories) = 'array'
      group by c->>'category', i.first_seen_at::date
      order by day desc, cnt desc
      limit 100
    `),

    // 7) 近 14 天总数量
    safeQuery<Total14Row>("total-14days", pool, `
      select
        count(*)::text as total_items,
        count(case when jsonb_typeof(matched_categories) = 'array' and jsonb_array_length(matched_categories) > 0 then 1 end)::text as items_with_categories
      from monitor_items i
      where i.first_seen_at >= (current_date - 14)::timestamptz
    `),

    // 8) 监测来源总览
    safeQuery<SourcesOverviewRow>("sources-overview", pool, `
      select
        count(*)::text as total,
        count(case when enabled then 1 end)::text as enabled,
        count(case when enabled and auto_monitor then 1 end)::text as auto_monitor,
        count(case when is_key then 1 end)::text as key
      from monitor_sources
    `),

    // 9) 脏数据统计：matched_categories / content_json 非数组的分布
    safeQuery<DirtyDataRow>("dirty-data-stats", pool, `
      select 'matched_categories' as field, jsonb_typeof(matched_categories) as typeof_val, count(*)::text as cnt
      from monitor_items
      where matched_categories is not null
        and jsonb_typeof(matched_categories) != 'array'
      group by jsonb_typeof(matched_categories)
      union all
      select 'content_json' as field, jsonb_typeof(content_json) as typeof_val, count(*)::text as cnt
      from monitor_items
      where content_json is not null
        and jsonb_typeof(content_json) != 'array'
      group by jsonb_typeof(content_json)
    `),
  ]);

  const oldKwCount = keywordsByDeptCat.rows.reduce((s, r) => s + Number(r.count), 0);
  const oldItemCount = itemsWithOldCats.rows.length;
  const failedCount = failedItems.rows.length;
  const totalKw = categoryDistribution.rows.reduce((s, r) => s + Number(r.count), 0);
  const t14 = total14.rows[0] ?? { total_items: "0", items_with_categories: "0" };
  const dirtyTotal = dirtyDataStats.rows.reduce((s, r) => s + Number(r.cnt), 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-10">
        <SettingsBreadcrumb current="数据诊断" />

        {/* 顶部总览卡片 */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs text-slate-500">监测来源</div>
            <div className="mt-2 text-2xl font-semibold">{sourcesOverview.rows[0].total}</div>
            <div className="mt-1 text-xs text-slate-500">
              已启用 {sourcesOverview.rows[0].enabled} · 自动 {sourcesOverview.rows[0].auto_monitor} · 重点 {sourcesOverview.rows[0].key}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs text-slate-500">近 14 天入库</div>
            <div className="mt-2 text-2xl font-semibold">{t14.total_items}</div>
            <div className="mt-1 text-xs text-slate-500">
              有关键词命中 {t14.items_with_categories} 条
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs text-slate-500">关键词总数</div>
            <div className="mt-2 text-2xl font-semibold">{totalKw}</div>
            <div className="mt-1 text-xs text-slate-500">覆盖 {categoryDistribution.rows.length} 个分类</div>
          </div>

          <div className={`rounded-3xl border p-5 shadow-sm ${oldKwCount > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
            <div className="text-xs text-slate-500">待清理：旧分类关键词</div>
            <div className="mt-2 text-2xl font-semibold">{oldKwCount}</div>
            <div className="mt-1 text-xs text-slate-500">
              含旧分类名的条目 {oldItemCount} 条 · 抓取失败 {failedCount} 条
            </div>
          </div>
        </section>

        {/* 1. 关键词分类分布 */}
        <details className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-200 group-open:rotate-180 group-open:bg-slate-50 group-open:text-slate-700"
                aria-hidden="true"
              >
                ▾
              </span>
              <div>
                <h2 className="text-lg font-semibold">关键词分类分布</h2>
                <p className="mt-1 text-sm text-slate-500">monitor_keywords 表中每个分类下的关键词数量</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-700">{categoryDistribution.rows.length} 个分类</span>
              <Link href="/monitor" className="text-sm text-slate-700 underline underline-offset-4">系统设置</Link>
            </div>
          </summary>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {categoryDistribution.rows.map((row) => {
              const isOldCategory = OLD_CATEGORIES.includes(row.category);
              return (
                <div key={row.category} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{categoryLabel(row.category) || row.category}</span>
                    {isOldCategory && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">旧分类名</span>}
                  </div>
                  <div className="text-xs text-slate-600">{row.count} 个</div>
                </div>
              );
            })}
          </div>
        </details>

        {/* 2. 已入库条目使用的分类 key */}
        <details className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-200 group-open:rotate-180 group-open:bg-slate-50 group-open:text-slate-700"
                aria-hidden="true"
              >
                ▾
              </span>
              <div>
                <h2 className="text-lg font-semibold">条目命中分类分布</h2>
                <p className="mt-1 text-sm text-slate-500">monitor_items 表中实际使用的分类名（按出现次数排序）</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-700">{itemCategoryDistribution.rows.length} 个分类</span>
          </summary>

          <div className="mt-5 grid gap-2 md:grid-cols-3">
            {itemCategoryDistribution.rows.map((row) => {
              const clean = categoryLabel(row.category) || row.category;
              const needsTranslate = clean !== row.category || /[a-z]/i.test(row.category);
              return (
                <div key={row.category} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium text-slate-700">{clean}</div>
                    {needsTranslate && (
                      <div className="text-xs text-slate-400">原始：{row.category}</div>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">{row.count} 条</div>
                </div>
              );
            })}
          </div>
        </details>

        {/* 3. 旧分类关键词（需要清理的） */}
        <details
          className={`group rounded-3xl border p-6 shadow-sm ${oldKwCount > 0 ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-white"}`}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-transform duration-200 group-open:rotate-180 ${
                  oldKwCount > 0
                    ? "border-amber-200 bg-amber-100/60 text-amber-700 group-open:bg-amber-100"
                    : "border-slate-200 text-slate-500 group-open:bg-slate-50 group-open:text-slate-700"
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
              <div>
                <h2 className="text-lg font-semibold">⚠ 旧分类关键词</h2>
                <p className="mt-1 text-sm text-slate-500">以下关键词使用的是旧分类体系，建议在来源配置中更新为新分类名</p>
              </div>
            </div>
            <div className="text-sm font-semibold text-amber-700">{oldKwCount} 个待处理</div>
          </summary>

          {keywordsByDeptCat.rows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              没有旧分类关键词，全部已更新
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {keywordsByDeptCat.rows.map((row) => (
                <div key={`${row.department_name}-${row.category}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-slate-800">{row.department_name || "未分类"}</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{row.category}</span>
                      <span className="text-xs text-slate-500">→ {categoryLabel(row.category) || "（需人工确认）"}</span>
                    </div>
                    <div className="text-xs text-slate-600">{row.count} 个关键词</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">{truncate(row.sample_keywords, 180)}</div>
                </div>
              ))}
            </div>
          )}
        </details>

        {/* 4. 条目里仍含旧分类的 */}
        <details className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-200 group-open:rotate-180 group-open:bg-slate-50 group-open:text-slate-700"
                aria-hidden="true"
              >
                ▾
              </span>
              <div>
                <h2 className="text-lg font-semibold">条目含旧分类名</h2>
                <p className="mt-1 text-sm text-slate-500">这些条目在 matched_categories 字段中还存着旧分类 key（UI已翻译，仅影响数据纯净度）</p>
              </div>
            </div>
            <div className="text-sm font-semibold text-slate-700">{oldItemCount} 条</div>
          </summary>

          {itemsWithOldCats.rows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              已入库条目全部使用新分类体系
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {itemsWithOldCats.rows.map((row, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-0 flex-1">
                    <Link href={row.url} target="_blank" className="block truncate text-sm font-medium text-slate-800 hover:text-indigo-700">
                      {row.title || row.url}
                    </Link>
                    <div className="mt-1 truncate text-xs text-slate-500">{row.url}</div>
                  </div>
                  <Link
                    href={`/inbox?url=${encodeURIComponent(row.url)}`}
                    className="shrink-0 text-xs text-slate-700 underline underline-offset-4"
                  >查看</Link>
                </div>
              ))}
            </div>
          )}
        </details>

        {/* 5. 正文抓取失败的条目 */}
        <details className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-200 group-open:rotate-180 group-open:bg-slate-50 group-open:text-slate-700"
                aria-hidden="true"
              >
                ▾
              </span>
              <div>
                <h2 className="text-lg font-semibold">抓取失败的条目</h2>
                <p className="mt-1 text-sm text-slate-500">正文为空或提取失败的条目，可用于排查解析器问题</p>
              </div>
            </div>
            <div className="text-sm font-semibold text-slate-700">{failedCount} 条</div>
          </summary>

          {failedItems.rows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              没有抓取失败的条目
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {failedItems.rows.map((row, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={row.url} target="_blank" className="block truncate text-sm font-medium text-slate-800 hover:text-indigo-700">
                        {row.title || row.url}
                      </Link>
                      <div className="mt-1 truncate text-xs text-slate-500">{row.url}</div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-500">{row.list_published_at?.slice(0, 10) || ""}</div>
                  </div>
                  {row.capture_note && (
                    <div className="mt-1 text-xs text-slate-500">{truncate(row.capture_note, 200)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </details>

        {/* 6. 近 14 天信号类条目日分布 */}
        <details className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-200 group-open:rotate-180 group-open:bg-slate-50 group-open:text-slate-700"
                aria-hidden="true"
              >
                ▾
              </span>
              <div>
                <h2 className="text-lg font-semibold">近 14 天分类分布（调试视图）</h2>
                <p className="mt-1 text-sm text-slate-500">近 14 天各类别的每日命中条数（原始数据）</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-700">{signalTrendDebug.rows.length} 条记录</span>
          </summary>

          {signalTrendDebug.rows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              暂无数据
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2 text-left font-medium text-slate-700">日期</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">分类</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">条数</th>
                  </tr>
                </thead>
                <tbody>
                  {signalTrendDebug.rows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-600">{String(row.day).slice(0, 10)}</td>
                      <td className="px-3 py-2 text-slate-700">{categoryLabel(row.category) || row.category}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{row.cnt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>

        {/* 7. 脏数据统计 */}
        <details
          className={`group rounded-3xl border p-6 shadow-sm ${
            dirtyTotal > 0 ? "border-rose-200 bg-rose-50/60" : "border-slate-200 bg-white"
          }`}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-transform duration-200 group-open:rotate-180 ${
                  dirtyTotal > 0
                    ? "border-rose-200 bg-rose-100/60 text-rose-700 group-open:bg-rose-100"
                    : "border-slate-200 text-slate-500 group-open:bg-slate-50 group-open:text-slate-700"
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
              <div>
                <h2 className="text-lg font-semibold">JSONB 字段类型异常统计</h2>
                <p className="mt-1 text-sm text-slate-500">
                  matched_categories 和 content_json 应为数组类型，以下为非数组的脏数据分布
                </p>
              </div>
            </div>
            <div className={`text-sm font-semibold ${dirtyTotal > 0 ? "text-rose-700" : "text-slate-700"}`}>
              {dirtyTotal} 条异常
            </div>
          </summary>

          {dirtyDataStats.rows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              所有 JSONB 字段类型正常，无非数组脏数据
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {dirtyDataStats.rows.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                      {row.field}
                    </span>
                    <span className="text-sm text-slate-600">
                      类型：<code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{row.typeof_val}</code>
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-rose-700">{row.cnt} 条</span>
                </div>
              ))}
            </div>
          )}
        </details>
      </div>
    </main>
  );
}
