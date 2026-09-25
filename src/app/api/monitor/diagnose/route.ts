import { NextResponse } from "next/server";
import { getPgPool, requireAdminToken } from "@/lib/db";
import { createApiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const logger = createApiLogger("api/monitor/diagnose");

// 旧分类名 → 新分类名 的映射
// 注意：旧的 signal_pre/start/opportunity/risk/launch 在新体系里用不同的 signal_* 表达
//     旧的 ai/data/platform/security/innovation/gov_service/regulations → 新的 topic_* + signal_*
//     旧的 region_bjj → 新的 region_general
//     旧的 byte_related → 在新体系里无对应，直接移除
const OLD_TO_NEW_CATEGORY: Record<string, string> = {
  // 主题类
  ai: "topic_ai",
  data: "topic_data",
  platform: "topic_computing",
  innovation: "topic_industry",
  gov_service: "topic_gov",
  regulations: "topic_regulation",
  // 信号类（旧的 5 个 signal → 新的 5 个里就近映射）
  signal_pre: "signal_explore",
  signal_start: "signal_launch",
  signal_opportunity: "signal_support",
  signal_risk: "signal_risk",
  signal_launch: "signal_launch",
  // 区域/负向
  region_bjj: "region_general",
  security: "signal_risk",
  byte_related: "__DELETE__", // 旧体系特有，新体系删除
};

const OLD_CATEGORIES = Object.keys(OLD_TO_NEW_CATEGORY);

export async function GET(request: Request) {
  const startTime = logger.start(request.method, new URL(request.url).pathname);
  try {
    const auth = requireAdminToken(request);
    if (!auth.ok) {
      logger.authFailed(auth.message, auth.status);
      return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
    }

    const pool = getPgPool();

    // 1) 关键词表中还在使用旧分类的记录（按部委+分类聚合）
    const keywordsByDeptCat = await pool.query<{
      department_name: string;
      category: string;
      count: string;
      sample_keywords: string;
    }>(`
      select
        department_name,
        category,
        count(*)::text as count,
        string_agg(keyword, '、' order by weight desc) as sample_keywords
      from monitor_keywords
      where category = any($1::text[])
      group by department_name, category
      order by department_name, count(*) desc
    `, [OLD_CATEGORIES]);

    // 2) 已入库条目的 matched_categories 仍含旧分类名的
    const itemsWithOldCats = await pool.query<{
      url: string;
      title: string;
      matched_categories: string;
    }>(`
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
    `, [OLD_CATEGORIES]);

    // 3) beijing.gov.cn 条目里正文抓取失败的（capture_note 含"未能提取"）
    const beijingFailedItems = await pool.query<{
      url: string;
      title: string;
      capture_note: string;
      list_published_at: string;
    }>(`
      select i.url, i.title, coalesce(i.capture_note, '') as capture_note,
        coalesce(i.list_published_at::text, '') as list_published_at
      from monitor_items i
      join monitor_sources s on s.id = i.source_id
      where s.department_name like '%北京%'
        and (
          i.content_json is null
          or jsonb_typeof(i.content_json) != 'array'
          or jsonb_array_length(case when jsonb_typeof(i.content_json) = 'array' then i.content_json else '[]'::jsonb end) = 0
          or i.capture_note like '%未能提取%'
        )
      order by i.first_seen_at desc
      limit 30
    `);

    // 4) 全库关键词分布（新旧都列），方便你看整体情况
    const categoryDistribution = await pool.query<{
      category: string;
      count: string;
    }>(`
      select category, count(*)::text as count
      from monitor_keywords
      group by category
      order by count(*) desc
    `);

    // 5) 新增调试：monitor_items.matched_categories 中所有实际出现过的 category 值 + 数量
    const itemCategoryDistribution = await pool.query<{
      category: string;
      count: string;
    }>(`
      select c->>'category' as category, count(*)::text as count
      from monitor_items mi
      cross join jsonb_array_elements(
        case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end
      ) as c
      where jsonb_typeof(mi.matched_categories) = 'array'
      group by c->>'category'
      order by count(*) desc
    `);

    // 6) 新增调试：近 14 天，信号类条目的日分布
    const signalTrendDebug = await pool.query<{
      category: string;
      day: string;
      cnt: string;
    }>(`
      select
        c->>'category' as category,
        i.first_seen_at::date as day,
        count(*)::text as cnt
      from monitor_items i
      cross join jsonb_array_elements(
        case when jsonb_typeof(i.matched_categories) = 'array' then i.matched_categories else '[]'::jsonb end
      ) as c
      where i.first_seen_at >= (current_date - 14)::timestamptz
        and jsonb_typeof(i.matched_categories) = 'array'
        and (
          c->>'category' in ('C·风险信号', 'B·强支持信号', 'D·探索信号', 'A·强执行信号', '通用启动/落地')
          or c->>'category' in ('signal_risk', 'signal_support', 'signal_explore', 'signal_exec', 'signal_launch')
          or c->>'category' in ('signal_pre', 'signal_start', 'signal_opportunity')
          or c->>'category' in ('risk', 'opportunity', 'pre_signal')
          or c->>'category' in ('signal_risk_signal', 'topic_ai', 'topic_data', 'topic_computing', 'topic_industry', 'topic_gov', 'topic_regulation', 'region_general', 'negative')
        )
      group by c->>'category', i.first_seen_at::date
      order by day desc, cnt desc
      limit 100
    `);

    // 7) 近 14 天，所有条目的总数量（有/无 matched_categories）
    const total14 = await pool.query<{
      total_items: string;
      items_with_categories: string;
    }>(`
      select
        count(*)::text as total_items,
        count(case when jsonb_typeof(matched_categories) = 'array' and jsonb_array_length(matched_categories) > 0 then 1 end)::text as items_with_categories
      from monitor_items i
      where i.first_seen_at >= (current_date - 14)::timestamptz
    `);

    // 8) 脏数据统计：非数组的 jsonb 字段
    const dirtyData = await pool.query<{
      field: string;
      typeof_val: string;
      cnt: string;
    }>(`
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
    `);

    const result = {
      ok: true,
      oldCategoryKeywords: keywordsByDeptCat.rows,
      itemsWithOldCategoryLabels: itemsWithOldCats.rows,
      beijingDetailPageFailures: beijingFailedItems.rows,
      categoryDistribution: categoryDistribution.rows,
      debug: {
        allItemCategoryKeys: itemCategoryDistribution.rows,
        signalTrendLast14Days: signalTrendDebug.rows,
        total14Days: total14.rows[0],
      },
      dirtyData: dirtyData.rows,
      summary: {
        oldCategoryKeywordCount: keywordsByDeptCat.rows.reduce((s, r) => s + Number(r.count), 0),
        itemsWithOldCatsCount: itemsWithOldCats.rows.length,
        beijingDetailFailuresCount: beijingFailedItems.rows.length,
        totalKeywordCount: categoryDistribution.rows.reduce((s, r) => s + Number(r.count), 0),
      },
    };

    logger.success(startTime, request.method, new URL(request.url).pathname, 200);
    return NextResponse.json(result);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.requestError(startTime, request.method, new URL(request.url).pathname, 500, err);
    return NextResponse.json(
      { ok: false, error: errMsg },
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
