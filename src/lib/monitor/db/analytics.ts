import { getPgPool } from "@/lib/db";

export type DailySeriesRow = {
  date: string;
  count: number;
  core: number;
  highlight: number;
  mid: number;
  urgent: number;
  unread: number;
  starred: number;
};

export async function getDailySeries(days: number = 30): Promise<DailySeriesRow[]> {
  const pool = getPgPool();
  const res = await pool.query(
    `select to_char(s.d, 'YYYY-MM-DD') as date,
            count(mi.source_id) as count,
            count(*) filter (where mi.importance_level in ('核心关注', '加急推荐')) as core,
            count(*) filter (where mi.importance_level = '重点内容') as highlight,
            count(*) filter (where mi.importance_level = '中等重点') as mid,
            count(*) filter (where mi.importance_level = '加急推荐') as urgent,
            count(*) filter (where not mi.is_read) as unread,
            count(*) filter (where mi.is_starred) as starred
     from generate_series(
            current_date - $1::int + 1,
            current_date,
            interval '1 day'
          ) as s(d)
     left join monitor_items mi
            on mi.list_published_at::date = s.d::date and mi.source_id in (select id from monitor_sources where enabled = true)
     group by s.d
     order by s.d asc`,
    [days],
  );
  return res.rows.map((r) => ({
    date: r.date,
    count: Number(r.count) || 0,
    core: Number(r.core) || 0,
    highlight: Number(r.highlight) || 0,
    mid: Number(r.mid) || 0,
    urgent: Number(r.urgent) || 0,
    unread: Number(r.unread) || 0,
    starred: Number(r.starred) || 0,
  }));
}

export async function getByDepartment(days: number = 30, topN: number = 20) {
  const pool = getPgPool();
  const res = await pool.query(
    `select coalesce(ms.department_name, '未分类部委') as department_name,
            count(*) as count,
            count(*) filter (where mi.importance_level in ('核心关注', '加急推荐')) as core,
            count(*) filter (where mi.importance_level = '重点内容') as highlight,
            count(*) filter (where mi.importance_level = '中等重点') as mid,
            count(*) filter (where mi.importance_level = '加急推荐') as urgent,
            count(*) filter (where not mi.is_read) as unread,
            count(*) filter (where mi.is_starred) as starred
     from monitor_items mi
     join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where mi.list_published_at >= current_date - $1::int
     group by 1
     order by (count(*) filter (where mi.importance_level in ('核心关注', '加急推荐'))) desc,
              (count(*) filter (where mi.importance_level = '重点内容')) desc,
              count desc
     limit $2`,
    [days, topN],
  );
  return res.rows.map((r) => ({
    departmentName: r.department_name,
    count: Number(r.count) || 0,
    core: Number(r.core) || 0,
    highlight: Number(r.highlight) || 0,
    mid: Number(r.mid) || 0,
    urgent: Number(r.urgent) || 0,
    unread: Number(r.unread) || 0,
    starred: Number(r.starred) || 0,
  }));
}

export async function getByChannel(days: number = 30, topN: number = 20, departmentName?: string) {
  const pool = getPgPool();
  const whereDept = departmentName
    ? `and ms.department_name = $3`
    : ``;
  const values: unknown[] = [days, topN];
  if (departmentName) values.push(departmentName);

  const res = await pool.query(
    `select coalesce(ms.department_name, '未分类部委') as department_name,
            coalesce(ms.channel_name, coalesce(ms.display_name, mi.source_id)) as channel_name,
            count(*) as count,
            count(*) filter (where mi.importance_level = '加急推荐') as urgent,
            count(*) filter (where mi.importance_level in ('核心关注', '加急推荐')) as core,
            count(*) filter (where mi.importance_level = '重点内容') as highlight,
            count(*) filter (where mi.importance_level = '中等重点') as mid,
            count(*) filter (where not mi.is_read) as unread,
            count(*) filter (where mi.is_starred) as starred
     from monitor_items mi
     join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where mi.list_published_at >= current_date - $1::int
       ${whereDept}
     group by 1, 2
     order by count desc
     limit $2`,
    values,
  );
  return res.rows.map((r) => ({
    departmentName: r.department_name,
    channelName: r.channel_name,
    count: Number(r.count) || 0,
    urgent: Number(r.urgent) || 0,
    core: Number(r.core) || 0,
    highlight: Number(r.highlight) || 0,
    mid: Number(r.mid) || 0,
    unread: Number(r.unread) || 0,
    starred: Number(r.starred) || 0,
  }));
}

type PushSignal = { lastSignalAt: number; lastReason: string };
const globalForMonitor = globalThis as unknown as Record<string, PushSignal | undefined>;
const SIGNAL_KEY = "__monitor_push_signal_v1__";
function getPushSignal(): PushSignal {
  if (!globalForMonitor[SIGNAL_KEY]) {
    globalForMonitor[SIGNAL_KEY] = { lastSignalAt: 0, lastReason: "" };
  }
  return globalForMonitor[SIGNAL_KEY]!;
}
export function signalPush(reason: string) {
  const s = getPushSignal();
  s.lastSignalAt = Date.now();
  s.lastReason = reason;
}
export function getLastPushSignal(): { lastSignalAt: number; lastReason: string } {
  const s = getPushSignal();
  return { lastSignalAt: s.lastSignalAt, lastReason: s.lastReason };
}

export type DailySummaryData = {
  date: string;
  sinceHours: number;
  urgentCount: number;
  highlightCount: number;
  unreadCount: number;
  dailySeries: DailySeriesRow[];
  departmentStats: Array<{
    departmentName: string;
    todayCount: number;
    last7DaysCount: number;
    urgentCount: number;
    highlightCount: number;
    totalCount: number;
    channelCount: number;
  }>;
  topItems: Array<{
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
  }>;
};

export async function getDailySummaryData(sinceHours: number = 24, limit: number = 10): Promise<DailySummaryData> {
  const date = new Date().toISOString().slice(0, 10);
  const days = Math.ceil(sinceHours / 24);
  const pool = getPgPool();
  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();

  const [dailySeries, deptStats, topItems, countsRes] = await Promise.all([
    getDailySeries(Math.min(30, Math.max(3, days + 6))),
    getByDepartment(7, 12),
    getDailyTopItems(limit, sinceHours),
    pool.query<{ urgent: string; highlight: string; unread: string }>(
      `select
         count(*) filter (where mi.importance_level in ('核心关注', '加急推荐') and not mi.is_read)::text as urgent,
         count(*) filter (where mi.importance_level = '重点内容' and not mi.is_read)::text as highlight,
         count(*) filter (where not mi.is_read)::text as unread
       from monitor_items mi
       where mi.first_seen_at >= $1::timestamptz
         and exists (select 1 from monitor_sources s where s.id = mi.source_id and s.enabled)`,
      [since],
    ),
  ]);

  const counts = countsRes.rows[0] ?? { urgent: "0", highlight: "0", unread: "0" };

  return {
    date,
    sinceHours,
    urgentCount: Number(counts.urgent) || 0,
    highlightCount: Number(counts.highlight) || 0,
    unreadCount: Number(counts.unread) || 0,
    dailySeries,
    departmentStats: deptStats.map((d) => ({
      departmentName: d.departmentName,
      todayCount: Number(d.count) || 0,
      last7DaysCount: Number(d.count) || 0,
      urgentCount: Number(d.urgent) || 0,
      highlightCount: Number(d.highlight) || 0,
      totalCount: Number(d.count) || 0,
      channelCount: 0,
    })),
    topItems,
  };
}

export type BatchFilter = {
  departmentName?: string;
  sourceIds?: string[];
  channelNames?: string[];
  importanceLevels?: string[];
  categories?: string[];
  q?: string;
  onlyUnread?: boolean;
  onlyStarred?: boolean;
  sourceId?: string;
  url?: string;
  fromDate?: string;
  toDate?: string;
  dateField?: "list_published_at" | "first_seen_at";
};

async function buildBatchWhere(
  pool: ReturnType<typeof getPgPool>,
  params: BatchFilter,
): Promise<{ clauses: string[]; values: unknown[] }> {
  void pool;
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (params.departmentName) {
    values.push(params.departmentName);
    clauses.push(`exists (select 1 from monitor_sources ms where ms.id = mi.source_id and ms.department_name = $${values.length})`);
  }
  if (params.sourceIds && params.sourceIds.length > 0) {
    const plainIds: string[] = [];
    const compositePairs: Array<[string, string]> = [];
    for (const s of params.sourceIds) {
      const idx = s.indexOf("::");
      if (idx > 0) compositePairs.push([s.slice(0, idx), s.slice(idx + 2)]);
      else plainIds.push(s);
    }
    const orParts: string[] = [];
    if (plainIds.length > 0) {
      const start = values.length + 1;
      const ph = plainIds.map((_, i) => `$${start + i}`).join(",");
      orParts.push(`mi.source_id in (${ph})`);
      values.push(...plainIds);
    }
    for (const [dn, cn] of compositePairs) {
      const start = values.length + 1;
      values.push(dn, cn);
      orParts.push(
        `exists (select 1 from monitor_sources ms where ms.id = mi.source_id and ms.department_name = $${start} and ms.channel_name = $${start + 1})`,
      );
    }
    if (orParts.length > 0) {
      clauses.push(`(${orParts.join(" or ")})`);
    }
  }
  if (params.sourceId) {
    values.push(params.sourceId);
    clauses.push(`mi.source_id = $${values.length}`);
  }
  if (params.url) {
    values.push(params.url);
    clauses.push(`mi.url = $${values.length}`);
  }
  if (params.channelNames && params.channelNames.length > 0) {
    const start = values.length + 1;
    const ph = params.channelNames.map((_, i) => `$${start + i}`).join(",");
    clauses.push(`exists (select 1 from monitor_sources ms where ms.id = mi.source_id and ms.channel_name in (${ph}))`);
    values.push(...params.channelNames);
  }
  if (params.importanceLevels && params.importanceLevels.length > 0) {
    const start = values.length + 1;
    const ph = params.importanceLevels.map((_, i) => `$${start + i}`).join(",");
    clauses.push(`mi.importance_level in (${ph})`);
    values.push(...params.importanceLevels);
  }
  if (params.categories && params.categories.length > 0) {
    const categoryMap: Record<string, string[]> = {
      "C·风险信号": ["C·风险信号", "signal_risk", "risk"],
      "B·强支持信号": ["B·强支持信号", "signal_support", "signal_opportunity", "opportunity"],
      "D·探索信号": ["D·探索信号", "signal_explore", "signal_pre", "pre_signal"],
      "A·强执行信号": ["A·强执行信号", "signal_exec", "signal_start"],
      "通用启动/落地": ["通用启动/落地", "signal_launch"],
      "AI/智能体/大模型": ["AI/智能体/大模型", "ai", "topic_ai", "byte-related", "byte_related"],
      "算力/算力网/算电协同": ["算力/算力网/算电协同", "topic_computing", "computing"],
      "数据要素/高质量数据集": ["数据要素/高质量数据集", "data", "topic_data"],
      "产业合作/京津冀协同": ["产业合作/京津冀协同", "industry", "topic_industry", "innovation"],
      "政务服务/平台经济/数字经济": ["政务服务/平台经济/数字经济", "gov_service", "platform", "topic_gov", "gov"],
      "法规/征求意见": ["法规/征求意见", "regulations", "topic_regulation", "regulation"],
      "京津冀/北京/区域": ["京津冀/北京/区域", "region_bjj", "region_general", "region"],
      "噪音词汇": ["噪音词汇", "negative"],
    };
    const expanded: string[] = [];
    for (const c of params.categories) {
      expanded.push(...(categoryMap[c] ?? [c]));
    }
    const start = values.length + 1;
    const ph = expanded.map((_, i) => `$${start + i}`).join(",");
    clauses.push(`exists (select 1 from jsonb_array_elements(case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end) as c where c->>'category' in (${ph}))`);
    values.push(...expanded);
  }
  if (params.onlyUnread) clauses.push(`mi.is_read = false`);
  if (params.onlyStarred) clauses.push(`mi.is_starred = true`);
  if (params.q && params.q.trim()) {
    values.push(`%${params.q.trim().toLowerCase()}%`);
    clauses.push(`lower(mi.title) like $${values.length}`);
  }
  const dateCol = params.dateField === "list_published_at" ? "mi.list_published_at" : "mi.first_seen_at";
  if (params.fromDate) {
    values.push(params.fromDate);
    clauses.push(`${dateCol} >= $${values.length}`);
  }
  if (params.toDate) {
    values.push(params.toDate);
    clauses.push(`${dateCol} <= $${values.length}`);
  }
  return { clauses, values };
}

export async function batchUpdateItems(params: BatchFilter & { isRead?: boolean; isStarred?: boolean }) {
  const pool = getPgPool();
  const { clauses, values } = await buildBatchWhere(pool, params);
  const sets: string[] = [];
  const allValues: unknown[] = [];
  if (typeof params.isRead === "boolean") {
    sets.push(`is_read = $${allValues.length + 1}`);
    allValues.push(params.isRead);
  }
  if (typeof params.isStarred === "boolean") {
    sets.push(`is_starred = $${allValues.length + 1}`);
    allValues.push(params.isStarred);
  }
  if (sets.length === 0) return { updated: 0 };
  if (clauses.length === 0) {
    return { updated: 0, error: "no_filter" };
  }
  const offset = sets.length;
  const shiftedClauses = offset > 0
    ? clauses.map((c) => c.replace(/\$(\d+)/g, (_m, n) => `$${Number(n) + offset}`))
    : clauses;
  const whereClause = `where ${shiftedClauses.join(" and ")}`;
  allValues.push(...values);

  const res = await pool.query(
    `with matched as (
       select mi.source_id, mi.url
       from monitor_items mi
       ${whereClause}
       for update skip locked
     )
     update monitor_items mi
     set ${sets.join(", ")}
     from matched m
     where mi.source_id = m.source_id and mi.url = m.url`,
    allValues,
  );
  return { updated: Number(res.rowCount ?? 0) };
}

export async function getUrgentUnreadCount(sinceHours: number = 24) {
  const pool = getPgPool();
  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
  const res = await pool.query<{ count: string }>(
    `select count(*)::text as count
     from monitor_items mi
     where mi.importance_level in ('核心关注', '加急推荐', '重点内容')
       and not mi.is_read
       and mi.first_seen_at >= $1::timestamptz
       and exists (select 1 from monitor_sources s where s.id = mi.source_id and s.enabled)`,
    [since],
  );
  return Number(res.rows[0]?.count ?? 0);
}

export async function getDailyTopItems(limit: number = 10, sinceHours: number = 24) {
  const pool = getPgPool();
  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
  const res = await pool.query<{
    source_id: string;
    department_name: string;
    channel_name: string;
    title: string;
    url: string;
    list_published_at: string;
    first_seen_at: string;
    importance_level: string;
    keyword_score: string;
    matched_categories: string | null;
    has_funding: boolean | null;
    has_procurement: boolean | null;
    has_pilot: boolean | null;
    has_standards: boolean | null;
    is_starred: boolean | null;
  }>(
    `select mi.source_id,
            coalesce(ms.department_name, '未分类部委') as department_name,
            coalesce(ms.channel_name, coalesce(ms.display_name, mi.source_id)) as channel_name,
            mi.title,
            mi.url,
            mi.list_published_at::text as list_published_at,
            mi.first_seen_at::text as first_seen_at,
            coalesce(mi.importance_level, '普通内容') as importance_level,
            coalesce(mi.keyword_score, 0)::text as keyword_score,
            mi.matched_categories::text as matched_categories,
            mi.has_funding,
            mi.has_procurement,
            mi.has_pilot,
            mi.has_standards,
            mi.is_starred
     from monitor_items mi
     inner join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where mi.first_seen_at >= $1::timestamptz
     order by
       case when mi.importance_level in ('核心关注', '加急推荐') then 3
            when mi.importance_level = '重点内容' then 2
            when mi.importance_level = '中等重点' then 1
            else 0 end desc,
       coalesce(mi.keyword_score, 0) desc,
       case when mi.has_funding or mi.has_procurement then 2
            when mi.has_pilot or mi.has_standards then 1
            else 0 end desc,
       mi.first_seen_at desc
     limit $2`,
    [since, limit],
  );
  return res.rows.map((r) => ({
    sourceId: r.source_id,
    departmentName: r.department_name,
    channelName: r.channel_name,
    title: r.title,
    url: r.url,
    listPublishedAt: r.list_published_at,
    firstSeenAt: r.first_seen_at,
    importanceLevel: r.importance_level,
    keywordScore: Number(r.keyword_score) || 0,
    categories: parseCategories(r.matched_categories),
    hasFunding: Boolean(r.has_funding),
    hasProcurement: Boolean(r.has_procurement),
    hasPilot: Boolean(r.has_pilot),
    hasStandards: Boolean(r.has_standards),
    isStarred: Boolean(r.is_starred),
  }));
}

function parseCategories(jsonText: string | null): Array<{ category: string; score: number; topKeywords?: string[] }> {
  if (!jsonText) return [];
  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}