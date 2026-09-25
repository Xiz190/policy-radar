import { getPgPool } from "@/lib/db";

export async function getSourcesTree() {
  const pool = getPgPool();
  const res = await pool.query<{
    department_name: string;
    channel_name: string;
    source_id: string;
    count: string;
    unread: string;
  }>(
    `select ms.department_name,
            ms.channel_name,
            max(ms.id)::text as source_id,
            count(distinct mi.url || '::' || mi.source_id)::text as count,
            count(distinct case when not mi.is_read then mi.url || '::' || mi.source_id end)::text as unread
     from monitor_sources ms
     left join monitor_items mi on mi.source_id = ms.id and mi.list_published_at >= ms.start_date
     where ms.enabled = true
     group by ms.department_name, ms.channel_name
     order by ms.department_name asc, count desc, ms.channel_name asc`,
  );

  const grouped = new Map<
    string,
    {
      departmentName: string;
      totalCount: number;
      unread: number;
      channels: Array<{ sourceId: string; channelName: string; count: number; unread: number }>;
    }
  >();
  for (const row of res.rows) {
    const dept = row.department_name || "未分类部委";
    if (!grouped.has(dept)) {
      grouped.set(dept, { departmentName: dept, totalCount: 0, unread: 0, channels: [] });
    }
    const g = grouped.get(dept)!;
    const count = Number(row.count);
    const unread = Number(row.unread);
    g.totalCount += count;
    g.unread += unread;
    g.channels.push({
      sourceId: row.source_id,
      channelName: row.channel_name || "未命名栏目",
      count,
      unread,
    });
  }
  return Array.from(grouped.values()).sort((a, b) => b.totalCount - a.totalCount);
}

export async function getCategoriesWithCounts() {
  const pool = getPgPool();
  const res = await pool.query<{ category: string; count: string }>(
    `select c->>'category' as category,
            count(*)::text as count
     from monitor_items mi
     cross join jsonb_array_elements(case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end) as c
     group by c->>'category'
     order by count(*) desc`,
  );
  return res.rows.map((r) => ({ category: r.category, count: Number(r.count) }));
}

export async function getGenresWithCounts() {
  const pool = getPgPool();
  const res = await pool.query<{ genre: string; count: string }>(
    `select g as genre, count(*)::text as count
     from monitor_items mi
     cross join jsonb_array_elements_text(mi.matched_genres) as g
     group by g
     order by count(*) desc`,
  );
  return res.rows.map((r) => ({ genre: r.genre, count: Number(r.count) }));
}