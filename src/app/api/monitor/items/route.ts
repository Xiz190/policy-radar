import { NextResponse } from "next/server";
import { requireAdminToken, getPgPool, isDbAvailable } from "@/lib/db";
import {
  ensureMonitorSchema,
  getDepartmentNamesWithItems,
  getForecastItems,
  getGroupedInboxSummary,
  getInboxItemsByFilter,
  getRecentKeywordHits,
  getSourcesTree,
  getCategoriesWithCounts,
  getGenresWithCounts,
  rescanAllGenres,
  rescanKeywordsOnItems,
} from "@/lib/monitor/db";
import {
  mockDelay,
  generateMockItems,
  generateMockSourcesTree,
  generateMockDimensions,
  generateMockGrouped,
} from "@/lib/monitor/mock";
import { createApiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const apiLog = createApiLogger("api/monitor/items");

interface GroupedCacheEntry {
  data: unknown;
  expiresAt: number;
}

const groupedCache = new Map<string, GroupedCacheEntry>();
const GROUPED_CACHE_TTL_MS = 30 * 1000;

function getGroupedCacheKey(params: { q?: string; onlyUnread?: boolean; onlyStarred?: boolean; departmentName?: string }): string {
  return JSON.stringify({
    q: params.q ?? "",
    onlyUnread: params.onlyUnread ?? false,
    onlyStarred: params.onlyStarred ?? false,
    departmentName: params.departmentName ?? "",
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of groupedCache) {
    if (now >= entry.expiresAt) {
      groupedCache.delete(key);
    }
  }
}, 10 * 1000);

function parseList(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const items = value.split(",").map((x) => x.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

export async function POST(request: Request) {
  const startTime = apiLog.start("POST", request.url);
  try {
    const auth = requireAdminToken(request);
    if (!auth.ok) {
      apiLog.warn(`认证失败: ${auth.message}`, { status: auth.status });
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

    await ensureMonitorSchema();
    
    if (!isDbAvailable()) {
      apiLog.warn("数据库不可用", { status: 503 });
      return NextResponse.json({ ok: false, error: "数据库不可用，降级模式下不支持写操作" }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();

    if (action === "rescan-genres") {
      const limit = Number(body?.limit ?? 5000);
      const stats = await rescanAllGenres(Number.isFinite(limit) && limit > 0 ? limit : 5000);
      apiLog.success(startTime, "POST", request.url, 200, { action, ...stats });
      return NextResponse.json({ ok: true, ...stats });
    }

    if (action === "mark-all-read") {
      const pool = getPgPool();
      const res = await pool.query(
        `update monitor_items set is_read = true where is_read = false`,
      );
      const n = Number(res.rowCount ?? 0);
      apiLog.success(startTime, "POST", request.url, 200, { action, updated: n });
      return NextResponse.json({ ok: true, action: "mark-all-read", updated: n, message: n > 0 ? `已将 ${n} 条未读标为已读` : "没有未读条目" });
    }

    if (action === "unstar-old") {
      const days = Number(body?.days ?? 14);
      const pool = getPgPool();
      const res = await pool.query(
        `update monitor_items set is_starred = false where is_starred = true and first_seen_at < current_timestamp - ($1 || ' days')::interval`,
        [Math.max(1, Number.isFinite(days) ? days : 14)],
      );
      const n = Number(res.rowCount ?? 0);
      apiLog.success(startTime, "POST", request.url, 200, { action, days, updated: n });
      return NextResponse.json({ ok: true, action: "unstar-old", days, updated: n, message: n > 0 ? `已取消 ${n} 条 ${days} 天前的重点标记` : "没有可取消的重点" });
    }

    if (action === "clean-old") {
      const days = Number(body?.days ?? 90);
      const pool = getPgPool();
      const res = await pool.query(
        `delete from monitor_items where first_seen_at < current_timestamp - ($1 || ' days')::interval`,
        [Math.max(7, Number.isFinite(days) ? days : 90)],
      );
      const n = Number(res.rowCount ?? 0);
      apiLog.success(startTime, "POST", request.url, 200, { action, days, deleted: n });
      return NextResponse.json({ ok: true, action: "clean-old", days, deleted: n, message: n > 0 ? `已删除 ${n} 条 ${days} 天前的条目` : "没有可删除的旧条目" });
    }

    if (action === "rescan-keywords") {
      const limit = Number(body?.limit ?? 1000);
      const pool = getPgPool();
      const stats = await rescanKeywordsOnItems(pool, Number.isFinite(limit) && limit > 0 ? limit : 1000);
      apiLog.success(startTime, "POST", request.url, 200, { action, ...stats });
      return NextResponse.json({ ok: true, ...stats });
    }

    apiLog.warn(`未知操作: ${action}`, { status: 400 });
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (err) {
    apiLog.requestError(startTime, "POST", request.url, 500, err);
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV === "development") {
      const stack = err instanceof Error ? (err.stack || "").slice(0, 500) : "";
      return NextResponse.json({
        error: "action_failed",
        detail: message,
        stack,
      }, { status: 500 });
    }
    return NextResponse.json({
      error: "action_failed",
      detail: "服务器内部错误，请稍后重试",
    }, { status: 500 });
  }
}

function parseDateParam(value: string | null): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return value;
}

export async function GET(request: Request) {
  const startTime = apiLog.start("GET", request.url);
  try {
    await ensureMonitorSchema();
    
    if (!isDbAvailable()) {
      await mockDelay();
      const url = new URL(request.url);
      const view = url.searchParams.get("view") ?? "list";
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 15)));
      
      if (view === "dimensions") {
        apiLog.success(startTime, "GET", request.url, 200, { view, mock: true });
        return NextResponse.json(generateMockDimensions());
      }
      
      if (view === "grouped") {
        apiLog.success(startTime, "GET", request.url, 200, { view, mock: true });
        return NextResponse.json(generateMockGrouped());
      }
      
      const mockRegionRaw = url.searchParams.get("region");
      const mockRegion = mockRegionRaw === "domestic" || mockRegionRaw === "global" ? mockRegionRaw : undefined;
      const items = generateMockItems(limit, mockRegion);
      const mockTotal = mockRegion === "domestic" ? 5 : mockRegion === "global" ? 10 : 15;
      apiLog.success(startTime, "GET", request.url, 200, { view, mock: true, count: items.length });
      return NextResponse.json({
        items,
        totalCount: mockTotal,
        offset: 0,
        limit,
      });
    }
    
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "list";

    // —— 诊断模式：?view=debug 直接返回 DB 健康检查
    if (view === "debug") {
      const pool = getPgPool();
      const total = await pool.query<{ n: string }>(`select count(*)::text as n from monitor_items`);
      const sources = await pool.query<{ n: string }>(`select count(*)::text as n from monitor_sources`);
      const enabledSources = await pool.query<{ n: string }>(
        `select count(*)::text as n from monitor_sources where enabled = true`,
      );
      const withListPublished = await pool.query<{ n: string }>(
        `select count(*)::text as n from monitor_items where list_published_at is not null`,
      );
      const withStartDate = await pool.query<{ n: string }>(
        `select count(*)::text as n from monitor_sources where start_date is not null`,
      );
      const futureStart = await pool.query<{ n: string }>(
        `select count(*)::text as n from monitor_sources where start_date > current_date`,
      );
      const sample = await pool.query<{
        id: string; department_name: string; channel_name: string; start_date: string;
      }>(`select id, department_name, channel_name, start_date::text as start_date from monitor_sources order by department_name, id limit 10`);
      const sampleItems = await pool.query<{
        source_id: string; title: string; list_published_at: string; first_seen_at: string;
      }>(`select source_id, substring(coalesce(title,''),1,40) as title, list_published_at::text as list_published_at, first_seen_at::text as first_seen_at from monitor_items order by first_seen_at desc limit 5`);

      const rawCount = await pool.query<{ n: string }>(
        `select count(*)::text as n from monitor_items mi left join monitor_sources ms on ms.id = mi.source_id where (ms.id is null or ms.start_date is null or mi.list_published_at is null or mi.list_published_at >= ms.start_date)`,
      );
      const strictCount = await pool.query<{ n: string }>(
        `select count(*)::text as n from monitor_items mi inner join monitor_sources ms on ms.id = mi.source_id where mi.list_published_at >= ms.start_date`,
      );
      const orphanItems = await pool.query<{ n: string }>(
        `select count(*)::text as n from monitor_items mi left join monitor_sources ms on ms.id = mi.source_id where ms.id is null`,
      );
      const itemsBeforeStart = await pool.query<{ n: string }>(
        `select count(*)::text as n from monitor_items mi inner join monitor_sources ms on ms.id = mi.source_id where mi.list_published_at < ms.start_date`,
      );

      // 直接执行一次空筛选的查询，看真实返回多少条
      const testRes = await pool.query(
        `select mi.source_id,
                coalesce(ms.department_name, '未分类部委') as department_name,
                coalesce(ms.channel_name, coalesce(ms.display_name, mi.source_id)) as channel_name,
                coalesce(ms.display_name, concat(coalesce(ms.department_name,'未分类部委'),'·',coalesce(ms.channel_name,''))) as display_name,
                mi.url,
                mi.title,
                mi.list_published_at,
                mi.first_seen_at,
                mi.is_read,
                mi.is_starred,
                coalesce(mi.keyword_score, 0) as keyword_score,
                mi.importance_level
         from monitor_items mi
         left join monitor_sources ms on ms.id = mi.source_id
         where (ms.id is null or ms.start_date is null or mi.list_published_at is null or mi.list_published_at >= ms.start_date)
         order by mi.first_seen_at desc
         limit 3`,
      );

      apiLog.success(startTime, "GET", request.url, 200, { view, debug: true });
      return NextResponse.json({
        items_total: total.rows[0].n,
        sources_total: sources.rows[0].n,
        sources_enabled: enabledSources.rows[0].n,
        items_with_list_published_at: withListPublished.rows[0].n,
        sources_with_start_date: withStartDate.rows[0].n,
        sources_start_date_in_future: futureStart.rows[0].n,
        orphan_items_no_matching_source: orphanItems.rows[0].n,
        items_before_source_start_date: itemsBeforeStart.rows[0].n,
        base_query_left_join_count: rawCount.rows[0].n,
        base_query_inner_join_count: strictCount.rows[0].n,
        test_query_returned_rows: testRes.rows.length,
        test_sample: testRes.rows,
        sample_sources: sample.rows,
        sample_items: sampleItems.rows,
      });
    }

    // —— 预估中心接口（合并版）：?view=forecast 返回全部 + 各维度统计
    //    旧参数 ?filter=xxx&limit=yyy 仍然兼容（按单一筛选返回），
    //    但推荐不带 filter：一次请求即可拿到全部数据和统计，
    //    浏览器端按字段本地过滤，避免并行请求导致 ERR_ABORTED。
    if (view === "forecast") {
      const filter = url.searchParams.get("filter") as
        | "all"
        | "forecast"
        | "signal"
        | "funding"
        | "procurement"
        | "pilot"
        | "standards"
        | null;
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? 500)));

      // 旧行为（兼容）：当指定 filter 时，返回该筛选下的条目列表
      if (filter) {
        const items = await getForecastItems(filter, limit);
        apiLog.success(startTime, "GET", request.url, 200, { view, filter, count: items.length });
        return NextResponse.json({ items });
      }

      // 新行为：一次性返回全部 items + 各 filter 的统计数
      const allItems = await getForecastItems("all", limit);
      const stats = {
        forecast: 0,
        signal: 0,
        funding: 0,
        procurement: 0,
        pilot: 0,
        standards: 0,
      };
      for (const it of allItems) {
        if (it.forecastHigh || it.forecastMidHigh || it.forecastMid || it.forecastLow) stats.forecast++;
        const hasSignal = it.hasFunding || it.hasProcurement || it.hasPilot || it.hasStandards;
        if (hasSignal && !(it.forecastHigh || it.forecastMidHigh || it.forecastMid || it.forecastLow)) stats.signal++;
        if (it.hasFunding) stats.funding++;
        if (it.hasProcurement) stats.procurement++;
        if (it.hasPilot) stats.pilot++;
        if (it.hasStandards) stats.standards++;
      }
      apiLog.success(startTime, "GET", request.url, 200, { view, count: allItems.length });
      return NextResponse.json({ items: allItems, stats });
    }

    // 单独的"维度数据"接口：仅在 ?view=dimensions 时返回，避免每个翻页请求都重复查询
    if (view === "dimensions") {
      const [sourcesTree, categoriesWithCounts, genresWithCounts, departments] =
        await Promise.all([
          getSourcesTree(),
          getCategoriesWithCounts(),
          getGenresWithCounts(),
          getDepartmentNamesWithItems(),
        ]);
      apiLog.success(startTime, "GET", request.url, 200, { view });
      return NextResponse.json({ sourcesTree, categoriesWithCounts, genresWithCounts, departments });
    }

    const q = url.searchParams.get("q") ?? "";
    const onlyUnread = url.searchParams.get("onlyUnread") === "1";
    const onlyStarred = url.searchParams.get("onlyStarred") === "1";
    const departmentName = url.searchParams.get("departmentName") ?? undefined;
    const sourceIds = parseList(url.searchParams.get("sourceIds"));
    const channelNames = parseList(url.searchParams.get("channelNames"));
    const importanceLevels = parseList(url.searchParams.get("importanceLevels"));
    const categories = parseList(url.searchParams.get("categories"));
    const genres = parseList(url.searchParams.get("genres"));
    const tags = parseList(url.searchParams.get("tags"));
    const tagCategories = parseList(url.searchParams.get("tagCategories"));
    const excludeDuplicates = url.searchParams.get("excludeDuplicates") === "1";
    const subscribedDepartments = parseList(url.searchParams.get("subscribedDepartments"));
    const subscribedKeywords = parseList(url.searchParams.get("subscribedKeywords"));
    const fromDate = parseDateParam(url.searchParams.get("fromDate"));
    const toDate = parseDateParam(url.searchParams.get("toDate"));
    const dateFieldRaw = url.searchParams.get("dateField");
    const dateField = dateFieldRaw === "list_published_at" || dateFieldRaw === "first_seen_at" ? dateFieldRaw : undefined;
    const sortRaw = url.searchParams.get("sort");
    const sort =
      sortRaw === "relevance" || sortRaw === "first_seen_at" || sortRaw === "published_at" ? sortRaw : undefined;
    const regionRaw = url.searchParams.get("region");
    const region = regionRaw === "domestic" || regionRaw === "global" ? regionRaw : undefined;
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 15)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

    if (view === "grouped") {
      const cacheKey = getGroupedCacheKey({ q, onlyUnread, onlyStarred, departmentName });
      const cached = groupedCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        apiLog.success(startTime, "GET", request.url, 200, { view, cached: true });
        return NextResponse.json(cached.data);
      }

      const [summary, departments, recentKeywordHits, sourcesTree, categoriesWithCounts, genresWithCounts] = await Promise.all([
        getGroupedInboxSummary({ q, onlyUnread, onlyStarred, departmentName }),
        getDepartmentNamesWithItems(),
        getRecentKeywordHits(14, 3),
        getSourcesTree(),
        getCategoriesWithCounts(),
        getGenresWithCounts(),
      ]);

      const result = { summary, departments, recentKeywordHits, sourcesTree, categoriesWithCounts, genresWithCounts };
      groupedCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + GROUPED_CACHE_TTL_MS,
      });

      apiLog.success(startTime, "GET", request.url, 200, { view, cached: false });
      return NextResponse.json(result);
    }

    const itemsResult = await getInboxItemsByFilter({
      q,
      onlyUnread,
      onlyStarred,
      departmentName,
      sourceIds,
      channelNames,
      importanceLevels,
      categories,
      genres,
      fromDate,
      toDate,
      dateField,
      sort,
      limit,
      offset,
      subscribedDepartments,
      subscribedKeywords,
      region,
    });
    apiLog.success(startTime, "GET", request.url, 200, { 
      view, 
      count: itemsResult.items.length, 
      totalCount: itemsResult.totalCount,
      hasQuery: !!q,
      onlyUnread,
      onlyStarred,
    });
    return NextResponse.json({
      items: itemsResult.items,
      totalCount: itemsResult.totalCount,
      offset,
      limit,
    });
  } catch (err) {
    apiLog.requestError(startTime, "GET", request.url, 500, err);
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV === "development") {
      const stack = err instanceof Error ? (err.stack || "").slice(0, 500) : "";
      return NextResponse.json({
        error: "query_failed",
        detail: message,
        stack,
      }, { status: 500 });
    }
    return NextResponse.json({
      error: "query_failed",
      detail: "服务器内部错误，请稍后重试",
    }, { status: 500 });
  }
}
