import { getPgPool } from "@/lib/db";

export type DepartmentDirectoryItem = {
  departmentName: string;
  channelCount: number;
  channelNames: string[];
  last7DaysCount: number;
  todayCount: number;
  urgentCount: number;
  highlightCount: number;
  midCount: number;
  unreadCount: number;
  starredCount: number;
  totalCount: number;
  latestPublishedAt: string | null;
  latestTitle: string | null;
  latestUrl: string | null;
};

export async function getDepartmentDirectory(): Promise<DepartmentDirectoryItem[]> {
  const pool = getPgPool();
  const aggRes = await pool.query<{
    department_name: string;
    channel_count: string;
    channel_names: string | null;
    last_7_days: string;
    today_count: string;
    urgent_count: string;
    highlight_count: string;
    mid_count: string;
    unread_count: string;
    starred_count: string;
    total_count: string;
    latest_published_at: string | null;
  }>(
    `
    select
      ms.department_name,
      count(distinct ms.channel_name)::text as channel_count,
      string_agg(distinct ms.channel_name, '||') as channel_names,
      count(distinct case when mi.list_published_at >= current_date - interval '7 days' and mi.list_published_at is not null then mi.url || '::' || mi.source_id end)::text as last_7_days,
      count(distinct case when mi.list_published_at >= current_date then mi.url || '::' || mi.source_id end)::text as today_count,
      count(distinct case when mi.importance_level = '加急推荐' then mi.url || '::' || mi.source_id end)::text as urgent_count,
      count(distinct case when mi.importance_level in ('核心关注', '加急推荐') then mi.url || '::' || mi.source_id end)::text as highlight_count,
      count(distinct case when mi.importance_level = '中等重点' then mi.url || '::' || mi.source_id end)::text as mid_count,
      count(distinct case when not mi.is_read then mi.url || '::' || mi.source_id end)::text as unread_count,
      count(distinct case when mi.is_starred then mi.url || '::' || mi.source_id end)::text as starred_count,
      count(distinct mi.url || '::' || mi.source_id)::text as total_count,
      max(mi.list_published_at)::text as latest_published_at
    from monitor_sources ms
    left join monitor_items mi on mi.source_id = ms.id
    group by ms.department_name
    order by total_count desc, ms.department_name asc
    `,
  );

  const deptNames = aggRes.rows.map((r) => r.department_name);
  const latestByDept = new Map<string, { title: string; url: string; publishedAt: string }>();
  if (deptNames.length > 0) {
    const placeholders = deptNames.map((_, i) => `$${i + 1}`).join(",");
    const latestRes = await pool.query<{ department_name: string; title: string; url: string; list_published_at: string }>(
      `
      select distinct on (ms.department_name)
        ms.department_name,
        mi.title,
        mi.url,
        mi.list_published_at::text as list_published_at
      from monitor_items mi
      inner join monitor_sources ms on ms.id = mi.source_id
      where ms.department_name in (${placeholders})
      order by ms.department_name, mi.list_published_at desc, mi.first_seen_at desc
      `,
      deptNames,
    );
    for (const row of latestRes.rows) {
      latestByDept.set(row.department_name, { title: row.title, url: row.url, publishedAt: row.list_published_at });
    }
  }

  return aggRes.rows.map((row) => {
    const channelNames = row.channel_names ? String(row.channel_names).split("||") : [];
    const latest = latestByDept.get(row.department_name) || null;
    return {
      departmentName: row.department_name,
      channelCount: Number(row.channel_count),
      channelNames,
      last7DaysCount: Number(row.last_7_days),
      todayCount: Number(row.today_count),
      urgentCount: Number(row.urgent_count),
      highlightCount: Number(row.highlight_count),
      midCount: Number(row.mid_count),
      unreadCount: Number(row.unread_count),
      starredCount: Number(row.starred_count),
      totalCount: Number(row.total_count),
      latestPublishedAt: latest?.publishedAt || row.latest_published_at || null,
      latestTitle: latest?.title || null,
      latestUrl: latest?.url || null,
    };
  });
}

export type DepartmentChannelStat = {
  channelName: string;
  itemCount: number;
  unreadCount: number;
};

export type DepartmentDailySeries = {
  date: string;
  count: number;
};

export type DepartmentCategoryCount = {
  category: string;
  count: number;
};

export type DepartmentDetail = {
  departmentName: string;
  slug: string;
  sourceCount: number;
  itemCount: number;
  unreadCount: number;
  starredCount: number;
  lastUpdate: string;
  channels: DepartmentChannelStat[];
  dailySeries: DepartmentDailySeries[];
  categories: DepartmentCategoryCount[];
  importanceDistribution: Array<{ level: string; count: number }>;
};

export async function getDepartmentDetail(departmentName: string): Promise<DepartmentDetail | null> {
  const pool = getPgPool();
  const [stats, channels, dailySeries, categories, importance] = await Promise.all([
    pool.query<{ source_count: string; item_count: string; unread_count: string; starred_count: string; last_update: Date | string }>(
      `select count(distinct s.id) as source_count,
              count(distinct i.id) as item_count,
              sum(case when i.is_read = false then 1 else 0 end) as unread_count,
              sum(case when i.is_starred = true then 1 else 0 end) as starred_count,
              max(i.first_seen_at) as last_update
       from monitor_sources s
       left join monitor_items i on i.source_id = s.id
       where s.department_name = $1`,
      [departmentName],
    ),
    pool.query<{ channel_name: string; item_count: string; unread_count: string }>(
      `select s.channel_name,
              count(distinct i.id) as item_count,
              sum(case when i.is_read = false then 1 else 0 end) as unread_count
       from monitor_sources s
       left join monitor_items i on i.source_id = s.id
       where s.department_name = $1 and s.channel_name is not null
       group by s.channel_name
       order by item_count desc`,
      [departmentName],
    ),
    pool.query<{ date: string; count: string }>(
      `select date_trunc('day', i.first_seen_at)::date as date, count(*) as count
       from monitor_items i
       join monitor_sources s on s.id = i.source_id
       where s.department_name = $1 and i.first_seen_at >= now() - interval '30 days'
       group by date_trunc('day', i.first_seen_at)::date
       order by date`,
      [departmentName],
    ),
    pool.query<{ category: string; count: string }>(
      `select jsonb_array_elements_text(case when jsonb_typeof(i.matched_categories->'category') = 'array' then i.matched_categories->'category' else '[]'::jsonb end) as category, count(*) as count
       from monitor_items i
       join monitor_sources s on s.id = i.source_id
       where s.department_name = $1 and i.matched_categories is not null
       group by category
       order by count desc
       limit 10`,
      [departmentName],
    ),
    pool.query<{ importance_level: string; count: string }>(
      `select i.importance_level, count(*) as count
       from monitor_items i
       join monitor_sources s on s.id = i.source_id
       where s.department_name = $1 and i.importance_level is not null
       group by i.importance_level
       order by count desc`,
      [departmentName],
    ),
  ]);

  if (stats.rows.length === 0) return null;
  const row = stats.rows[0];

  return {
    departmentName,
    slug: departmentName.toLowerCase().replace(/\s+/g, "-"),
    sourceCount: Number(row.source_count),
    itemCount: Number(row.item_count),
    unreadCount: Number(row.unread_count),
    starredCount: Number(row.starred_count),
    lastUpdate: row.last_update instanceof Date ? row.last_update.toISOString() : String(row.last_update),
    channels: channels.rows.map((r) => ({
      channelName: r.channel_name,
      itemCount: Number(r.item_count),
      unreadCount: Number(r.unread_count),
    })),
    dailySeries: dailySeries.rows.map((r) => ({ date: r.date, count: Number(r.count) })),
    categories: categories.rows.map((r) => ({ category: r.category, count: Number(r.count) })),
    importanceDistribution: importance.rows.map((r) => ({ level: r.importance_level, count: Number(r.count) })),
  };
}

export type DepartmentTopItem = {
  id: string;
  url: string;
  title: string;
  listPublishedAt: string;
  sourceId: string;
  sourceName: string;
  importanceLevel: string;
  keywordScore: number;
  isStarred: boolean;
  isRead: boolean;
};

export async function getDepartmentTopItems(departmentName: string, limit: number = 20): Promise<DepartmentTopItem[]> {
  const pool = getPgPool();
  const res = await pool.query<{
    id: string;
    url: string;
    title: string;
    list_published_at: Date | string;
    source_id: string;
    source_name: string;
    importance_level: string;
    keyword_score: string;
    is_starred: boolean;
    is_read: boolean;
  }>(
    `select i.id, i.url, i.title, i.list_published_at, i.source_id, s.source_name,
            i.importance_level, coalesce(i.keyword_score,0)::text as keyword_score,
            i.is_starred, i.is_read
     from monitor_items i
     join monitor_sources s on s.id = i.source_id
     where s.department_name = $1
     order by i.keyword_score desc nulls last, i.first_seen_at desc
     limit $2`,
    [departmentName, limit],
  );
  return res.rows.map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    listPublishedAt: row.list_published_at instanceof Date ? row.list_published_at.toISOString() : String(row.list_published_at),
    sourceId: row.source_id,
    sourceName: row.source_name,
    importanceLevel: row.importance_level || "普通内容",
    keywordScore: Number(row.keyword_score),
    isStarred: row.is_starred,
    isRead: row.is_read,
  }));
}