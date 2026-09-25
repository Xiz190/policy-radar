import { getPgPool } from "@/lib/db";
import { getCachedCount, setCachedCount } from "../utils/cache";
import { normalizeItemUrl } from "../utils";

export type MonitorInboxItemRow = {
  source_id: string;
  url: string;
  title: string;
  list_published_at: Date | string;
  first_seen_at: Date | string;
  is_read: boolean;
  is_starred: boolean;
  keyword_score: number | string | null;
  importance_level: string | null;
  matched_categories_json: string | null;
};

export async function getInboxItems(params?: { sourceId?: string; limit?: number }) {
  const pool = getPgPool();
  const limit = params?.limit ?? 100;

  if (params?.sourceId) {
    const res = await pool.query<MonitorInboxItemRow>(
      `select mi.source_id, mi.url, mi.title, mi.list_published_at, mi.first_seen_at, mi.is_read, mi.is_starred,
              mi.keyword_score, mi.importance_level, mi.matched_categories::text as matched_categories_json
       from monitor_items mi
       inner join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
       where mi.source_id = $1
         and mi.list_published_at >= ms.start_date
       order by (coalesce(mi.keyword_score, 0)) desc, mi.first_seen_at desc, mi.list_published_at desc
       limit $2`,
      [params.sourceId, limit],
    );
    return res.rows;
  }

  const res = await pool.query<MonitorInboxItemRow>(
    `select mi.source_id, mi.url, mi.title, mi.list_published_at, mi.first_seen_at, mi.is_read, mi.is_starred,
            mi.keyword_score, mi.importance_level, mi.matched_categories::text as matched_categories_json
     from monitor_items mi
     inner join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where mi.list_published_at >= ms.start_date
     order by (coalesce(mi.keyword_score, 0)) desc, first_seen_at desc, list_published_at desc
     limit $1`,
    [limit],
  );
  return res.rows;
}

export async function getInboxSourceCounts() {
  const pool = getPgPool();
  const res = await pool.query<{ source_id: string; count: string; unread: string; starred: string }>(
    `select mi.source_id, count(*)::text as count,
            count(case when not mi.is_read then 1 end)::text as unread,
            count(case when mi.is_starred then 1 end)::text as starred
     from monitor_items mi
     inner join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where mi.list_published_at >= ms.start_date
     group by mi.source_id
     order by count(*) desc, mi.source_id asc`,
  );
  return res.rows.map((row) => ({
    sourceId: row.source_id,
    count: Number(row.count),
    unread: Number(row.unread),
    starred: Number(row.starred),
  }));
}

export type GroupedInboxChannelItem = {
  sourceId: string;
  departmentName: string;
  channelName: string;
  displayName: string;
  url: string;
  title: string;
  listPublishedAt: string;
  firstSeenAt: string;
  isRead: boolean;
  isStarred: boolean;
  keywordScore: number;
  importanceLevel: string;
  categories: Array<{ category: string; score: number; topKeywords: string[] }>;
};

export type GroupedInboxSummary = {
  departmentName: string;
  totalCount: number;
  unreadCount: number;
  starredCount: number;
  latestFirstSeenAt: string | null;
  channels: Array<{
    sourceId: string;
    channelName: string;
    displayName: string;
    count: number;
    unread: number;
    starred: number;
    items: GroupedInboxChannelItem[];
  }>;
};

export async function getGroupedInboxSummary(params?: { q?: string; onlyUnread?: boolean; onlyStarred?: boolean; departmentName?: string; perChannelLimit?: number }) {
  const pool = getPgPool();
  const q = (params?.q ?? "").trim().toLowerCase();
  const perChannelLimit = params?.perChannelLimit ?? 50;
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (q) {
    clauses.push(`(lower(mi.title) like $${values.length + 1} or lower(ms.department_name) like $${values.length + 1} or lower(ms.channel_name) like $${values.length + 1})`);
    values.push(`%${q}%`);
  }
  if (params?.onlyUnread) {
    clauses.push(`mi.is_read = false`);
  }
  if (params?.onlyStarred) {
    clauses.push(`mi.is_starred = true`);
  }
  if (params?.departmentName) {
    clauses.push(`ms.department_name = $${values.length + 1}`);
    values.push(params.departmentName);
  }

  const statsRes = await pool.query<{
    department_name: string;
    source_id: string;
    channel_name: string;
    display_name: string;
    count: string;
    unread: string;
    starred: string;
    latest_first_seen_at: Date | string | null;
  }>(
    `select ms.department_name,
            mi.source_id,
            ms.channel_name,
            ms.display_name,
            count(*)::text as count,
            count(case when not mi.is_read then 1 end)::text as unread,
            count(case when mi.is_starred then 1 end)::text as starred,
            max(mi.first_seen_at)::text as latest_first_seen_at
     from monitor_items mi
     inner join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where mi.list_published_at >= ms.start_date
     ${clauses.length > 0 ? `and ${clauses.join(" and ")}` : ""}
     group by ms.department_name, mi.source_id, ms.channel_name, ms.display_name
     order by ms.department_name asc, count(*) desc, ms.channel_name asc`,
    values,
  );

  const byDepartment = new Map<string, GroupedInboxSummary>();
  const sourceIds: string[] = [];
  for (const row of statsRes.rows) {
    const dept = row.department_name || "未分类部委";
    if (!byDepartment.has(dept)) {
      byDepartment.set(dept, {
        departmentName: dept,
        totalCount: 0,
        unreadCount: 0,
        starredCount: 0,
        latestFirstSeenAt: null,
        channels: [],
      });
    }
    const group = byDepartment.get(dept)!;
    const count = Number(row.count);
    const unread = Number(row.unread);
    const starred = Number(row.starred);
    group.totalCount += count;
    group.unreadCount += unread;
    group.starredCount += starred;
    const latest = row.latest_first_seen_at ? String(row.latest_first_seen_at) : null;
    if (latest && (!group.latestFirstSeenAt || latest > group.latestFirstSeenAt)) {
      group.latestFirstSeenAt = latest;
    }
    group.channels.push({
      sourceId: row.source_id,
      channelName: row.channel_name || row.display_name || row.source_id,
      displayName: row.display_name || `${row.department_name || "未分类"}·${row.channel_name || ""}`.trim(),
      count,
      unread,
      starred,
      items: [],
    });
    sourceIds.push(row.source_id);
  }

  const bySource = new Map<string, GroupedInboxChannelItem[]>();
  if (sourceIds.length > 0) {
    const placeholders = sourceIds.map((_, i) => `$${i + 1}`).join(",");
    const itemsRes = await pool.query<{
      source_id: string;
      department_name: string;
      channel_name: string;
      display_name: string;
      url: string;
      title: string;
      list_published_at: Date | string;
      first_seen_at: Date | string;
      is_read: boolean;
      is_starred: boolean;
      keyword_score: number | string | null;
      importance_level: string | null;
      matched_categories_json: string | null;
    }>(
      `select mi.source_id,
              coalesce(ms.department_name, '未分类部委') as department_name,
              coalesce(ms.channel_name, coalesce(ms.display_name, mi.source_id)) as channel_name,
              coalesce(ms.display_name, concat(coalesce(ms.department_name, '未分类部委'), '·', coalesce(ms.channel_name, ''))) as display_name,
              mi.url,
              mi.title,
              mi.list_published_at,
              mi.first_seen_at,
              mi.is_read,
              mi.is_starred,
              coalesce(mi.keyword_score, 0) as keyword_score,
              mi.importance_level,
              mi.matched_categories::text as matched_categories_json
       from (
         select *, row_number() over (partition by source_id order by coalesce(keyword_score, 0) desc, is_starred desc, first_seen_at desc, list_published_at desc) as rn
         from monitor_items mi
         where mi.source_id in (${placeholders})
       ) mi
       inner join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
       where rn <= $${sourceIds.length + 1}
         and mi.list_published_at >= ms.start_date
       order by mi.source_id, coalesce(mi.keyword_score, 0) desc, mi.first_seen_at desc, mi.list_published_at desc`,
      [...sourceIds, perChannelLimit],
    );
    for (const row of itemsRes.rows) {
      let parsedCats: Array<{ category: string; score: number; topKeywords: string[] }> = [];
      if (row.matched_categories_json) {
        try {
          const parsed = JSON.parse(row.matched_categories_json);
          if (Array.isArray(parsed)) parsedCats = parsed;
        } catch {}
      }
      if (!bySource.has(row.source_id)) bySource.set(row.source_id, []);
      bySource.get(row.source_id)!.push({
        sourceId: row.source_id,
        departmentName: String(row.department_name),
        channelName: String(row.channel_name),
        displayName: String(row.display_name),
        url: row.url,
        title: row.title,
        listPublishedAt: row.list_published_at instanceof Date ? row.list_published_at.toISOString().slice(0, 10) : String(row.list_published_at).slice(0, 10),
        firstSeenAt: row.first_seen_at instanceof Date ? row.first_seen_at.toISOString() : String(row.first_seen_at),
        isRead: !!row.is_read,
        isStarred: !!row.is_starred,
        keywordScore: Number(row.keyword_score ?? 0),
        importanceLevel: row.importance_level ?? "普通内容",
        categories: parsedCats,
      });
    }
  }

  for (const group of byDepartment.values()) {
    for (const channel of group.channels) {
      channel.items = bySource.get(channel.sourceId) || [];
    }
  }

  return Array.from(byDepartment.values()).sort((a, b) => {
    const aLatest = a.latestFirstSeenAt ?? "";
    const bLatest = b.latestFirstSeenAt ?? "";
    if (aLatest !== bLatest) return bLatest.localeCompare(aLatest);
    return b.totalCount - a.totalCount;
  });
}

type ParamBuilder = {
  push: (value: unknown) => string;
  pushMany: (values: unknown[]) => string;
  addClause: (clause: string) => void;
  length: () => number;
  params: () => unknown[];
  whereClause: () => string;
};
function createParamBuilder(): ParamBuilder {
  const params: unknown[] = [];
  const clauses: string[] = [];
  return {
    push(value: unknown): string {
      params.push(value);
      return `$${params.length}`;
    },
    pushMany(values: unknown[]): string {
      if (values.length === 0) return "(null)";
      const startIdx = params.length + 1;
      params.push(...values);
      const parts: string[] = [];
      for (let i = 0; i < values.length; i++) parts.push(`$${startIdx + i}`);
      return `(${parts.join(",")})`;
    },
    addClause(clause: string): void {
      clauses.push(clause);
    },
    length(): number {
      return params.length;
    },
    params(): unknown[] {
      return params;
    },
    whereClause(): string {
      if (clauses.length === 0) return "";
      return `where ${clauses.join(" and ")}`;
    },
  };
}

export async function getInboxItemsByFilter(params: {
  q?: string;
  onlyUnread?: boolean;
  onlyStarred?: boolean;
  departmentName?: string;
  sourceIds?: string[];
  channelNames?: string[];
  importanceLevels?: string[];
  categories?: string[];
  genres?: string[];
  fromDate?: string;
  toDate?: string;
  dateField?: "list_published_at" | "first_seen_at";
  sort?: "relevance" | "first_seen_at" | "published_at";
  limit?: number;
  offset?: number;
  subscribedDepartments?: string[];
  subscribedKeywords?: string[];
  region?: "domestic" | "global";
}) {
  const pool = getPgPool();
  const qNorm = (params.q ?? "").trim().toLowerCase();
  const pb = createParamBuilder();

  pb.addClause(`(ms.id is null or ms.start_date is null or mi.list_published_at is null or mi.list_published_at >= ms.start_date)`);

  let qPlaceholder: string | null = null;
  if (qNorm) {
    qPlaceholder = pb.push(`%${qNorm}%`);
    pb.addClause(`(
      lower(mi.title) like ${qPlaceholder}
      or lower(coalesce(ms.department_name, '')) like ${qPlaceholder}
      or lower(coalesce(ms.channel_name, '')) like ${qPlaceholder}
      or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(mi.content_json) = 'array' then mi.content_json else '[]'::jsonb end) as p where lower(p) like ${qPlaceholder})
    )`);
  }

  if (params.onlyUnread) pb.addClause(`mi.is_read = false`);
  if (params.onlyStarred) pb.addClause(`mi.is_starred = true`);
  if (params.region) pb.addClause(`coalesce(ms.region, 'domestic') = ${pb.push(params.region)}`);

  if (params.departmentName) pb.addClause(`coalesce(mi.department_name, '') = ${pb.push(params.departmentName)}`);
  if (params.sourceIds && params.sourceIds.length > 0) {
    const plainIds: string[] = [];
    const compositePairs: Array<[string, string]> = [];
    for (const s of params.sourceIds) {
      const idx = s.indexOf("::");
      if (idx > 0) {
        compositePairs.push([s.slice(0, idx), s.slice(idx + 2)]);
      } else {
        plainIds.push(s);
      }
    }
    const parts: string[] = [];
    if (plainIds.length > 0) {
      parts.push(`mi.source_id in ${pb.pushMany(plainIds)}`);
    }
    for (const [dn, cn] of compositePairs) {
      parts.push(
        `(ms.department_name = ${pb.push(dn)} and coalesce(ms.channel_name, '') = ${pb.push(cn)})`,
      );
    }
    if (parts.length > 0) {
      pb.addClause(`(${parts.join(" or ")})`);
    }
  }
  if (params.channelNames && params.channelNames.length > 0) {
    pb.addClause(`coalesce(ms.channel_name, '') in ${pb.pushMany(params.channelNames)}`);
  }
  if (params.importanceLevels && params.importanceLevels.length > 0) {
    pb.addClause(`mi.importance_level in ${pb.pushMany(params.importanceLevels)}`);
  }
  function expandCategoryKeys(categories: string[]): string[] {
    const map: Record<string, string[]> = {
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
    const result: string[] = [];
    for (const c of categories) {
      result.push(...(map[c] ?? [c]));
    }
    return result;
  }

  if (params.categories && params.categories.length > 0) {
    const expanded = expandCategoryKeys(params.categories);
    pb.addClause(
      `exists (select 1 from jsonb_array_elements(case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end) as c where c->>'category' in ${pb.pushMany(expanded)})`,
    );
  }
  if (params.genres && params.genres.length > 0) {
    pb.addClause(
      `exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(mi.matched_genres) = 'array' then mi.matched_genres else '[]'::jsonb end) as g where g in ${pb.pushMany(params.genres)})`,
    );
  }

  const subscriptionParts: string[] = [];
  if (params.subscribedDepartments && params.subscribedDepartments.length > 0) {
    subscriptionParts.push(`coalesce(mi.department_name, '') in ${pb.pushMany(params.subscribedDepartments)}`);
  }
  if (params.subscribedKeywords && params.subscribedKeywords.length > 0) {
    const kwClauses = params.subscribedKeywords.map((kw) => `lower(mi.title) like ${pb.push(`%${kw.toLowerCase()}%`)}`);
    subscriptionParts.push(`(${kwClauses.join(" or ")})`);
  }
  if (subscriptionParts.length > 0) {
    pb.addClause(`(${subscriptionParts.join(" or ")})`);
  }

  const dateCol = params.dateField === "list_published_at" ? "mi.list_published_at" : "mi.first_seen_at";
  if (params.fromDate) pb.addClause(`${dateCol} >= ${pb.push(params.fromDate)}`);
  if (params.toDate) pb.addClause(`${dateCol} <= ${pb.push(params.toDate)}`);

  const priorityRankExpr = `case
      when mi.importance_level in ('核心关注', '加急推荐') then 3
      when mi.importance_level = '重点内容' then 2
      when mi.importance_level = '中等重点' then 1
      else 0 end`;

  const rankExpr =
    qPlaceholder !== null
      ? `(
          case when lower(mi.title) like ${qPlaceholder} then 3 else 0 end
          + case when lower(coalesce(ms.department_name,'')) like ${qPlaceholder} then 1.5 else 0 end
          + case when lower(coalesce(ms.channel_name,'')) like ${qPlaceholder} then 1.5 else 0 end
          + (${priorityRankExpr})
          + coalesce(mi.keyword_score, 0) * 0.1
        )::text as relevance_rank`
      : `'0'::text as relevance_rank`;

  const sortMode = params.sort ?? "first_seen_at";
  let orderClause: string;
  if (sortMode === "published_at") {
    orderClause = `mi.list_published_at desc, mi.first_seen_at desc`;
  } else if (sortMode === "relevance") {
    if (qPlaceholder !== null) {
      orderClause = `
        (case when lower(mi.title) like ${qPlaceholder} then 3 else 0 end
          + case when lower(coalesce(ms.department_name,'')) like ${qPlaceholder} then 1.5 else 0 end
          + case when lower(coalesce(ms.channel_name,'')) like ${qPlaceholder} then 1.5 else 0 end
          + (${priorityRankExpr})
          + coalesce(mi.keyword_score, 0) * 0.1) desc,
        mi.is_starred desc,
        mi.first_seen_at desc
      `;
    } else {
      orderClause = `(${priorityRankExpr}) desc, mi.is_starred desc, coalesce(mi.keyword_score, 0) desc, mi.first_seen_at desc`;
    }
  } else {
    orderClause = `(${priorityRankExpr}) desc, mi.is_starred desc, coalesce(mi.keyword_score, 0) desc, mi.first_seen_at desc, mi.list_published_at desc`;
  }

  const safeLimit = Number.isFinite(Number(params.limit)) ? Math.max(1, Math.min(Math.trunc(Number(params.limit)), 2000)) : 200;
  const safeOffset = Number.isFinite(Number(params.offset)) ? Math.max(0, Math.trunc(Number(params.offset))) : 0;
  const where = pb.whereClause() || "where true";
  const finalParams = pb.params();

  const cachedCount = getCachedCount(where, finalParams);
  let totalCount: number;

  if (cachedCount !== null) {
    totalCount = cachedCount;
  } else {
    const countRes = await pool.query<{ total: string }>(
      `select count(*)::text as total from monitor_items mi join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true ${where}`,
      finalParams,
    );
    totalCount = Number(countRes.rows[0]?.total ?? 0);
    setCachedCount(where, finalParams, totalCount);
  }

  const res = await pool.query<{
      source_id: string;
      department_name: string;
      channel_name: string;
      display_name: string;
      url: string;
      title: string;
      list_published_at: Date | string;
      first_seen_at: Date | string;
      is_read: boolean;
      is_starred: boolean;
      keyword_score: number | string | null;
      importance_level: string | null;
      matched_categories: string | null;
      matched_genres: string | null;
      matched_keywords: string | null;
      signal_hits: string | null;
      relevance_rank: string;
      effective_from: Date | string | null;
      effective_to: Date | string | null;
      deadline_date: Date | string | null;
      has_funding: boolean | null;
      has_procurement: boolean | null;
      has_pilot: boolean | null;
      has_standards: boolean | null;
    }>(
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
              mi.importance_level,
              mi.matched_categories,
              mi.matched_genres,
              mi.matched_keywords,
              mi.signal_hits,
              ${rankExpr},
              mi.effective_from,
              mi.effective_to,
              mi.deadline_date,
              mi.has_funding,
              mi.has_procurement,
              mi.has_pilot,
              mi.has_standards
       from monitor_items mi
       join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
       ${where}
       order by ${orderClause}
       limit ${safeLimit} offset ${safeOffset}`,
      finalParams,
    );

  const items = res.rows.map((row) => {
    let cats: Array<{ category: string; score: number; topKeywords?: string[] }> = [];
    if (row.matched_categories) {
      try {
        const raw = row.matched_categories;
        const parsed = Array.isArray(raw) ? raw : JSON.parse(String(raw));
        if (Array.isArray(parsed)) cats = parsed;
      } catch {
        // ignore
      }
    }
    let genres: string[] = [];
    if (row.matched_genres) {
      try {
        const parsed = JSON.parse(String(row.matched_genres));
        if (Array.isArray(parsed)) genres = parsed.filter((x) => typeof x === "string");
      } catch {}
    }
    let matchedKeywordCount: number | undefined;
    if (row.matched_keywords) {
      try {
        const parsed = JSON.parse(String(row.matched_keywords));
        if (Array.isArray(parsed)) matchedKeywordCount = parsed.length;
      } catch {}
    }
    let signalStrength: number | undefined;
    if (row.signal_hits) {
      try {
        const parsed = JSON.parse(String(row.signal_hits));
        if (parsed && typeof parsed === "object" && parsed._meta && typeof parsed._meta.totalSignalStrength === "number") {
          signalStrength = parsed._meta.totalSignalStrength;
        }
      } catch {}
    }
    const toDateStr = (d: Date | string | null): string | null => {
      if (!d) return null;
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      const s = String(d);
      return s.slice(0, 10);
    };
    return {
      sourceId: row.source_id,
      departmentName: String(row.department_name),
      channelName: String(row.channel_name),
      displayName: String(row.display_name),
      url: row.url,
      title: row.title,
      listPublishedAt: row.list_published_at instanceof Date ? row.list_published_at.toISOString().slice(0, 10) : String(row.list_published_at).slice(0, 10),
      firstSeenAt: row.first_seen_at instanceof Date ? row.first_seen_at.toISOString() : String(row.first_seen_at),
      isRead: Boolean(row.is_read),
      isStarred: Boolean(row.is_starred),
      keywordScore: Number(row.keyword_score) || 0,
      importanceLevel: row.importance_level || "普通内容",
      categories: cats,
      genres,
      relevanceRank: Number(row.relevance_rank) || 0,
      effectiveFrom: toDateStr(row.effective_from),
      effectiveTo: toDateStr(row.effective_to),
      deadlineDate: toDateStr(row.deadline_date),
      matchedKeywordCount,
      signalStrength,
      hasFunding: Boolean(row.has_funding),
      hasProcurement: Boolean(row.has_procurement),
      hasPilot: Boolean(row.has_pilot),
      hasStandards: Boolean(row.has_standards),
    };
  });

  return { items, totalCount };
}

export async function setItemRead(sourceId: string, url: string, isRead: boolean) {
  const pool = getPgPool();
  const targetUrl = normalizeItemUrl(url);
  await pool.query(
    `update monitor_items set is_read = $1 where source_id = $2 and url = $3`,
    [isRead, sourceId, targetUrl],
  );
}

export async function setItemStarred(sourceId: string, url: string, isStarred: boolean) {
  const pool = getPgPool();
  const targetUrl = normalizeItemUrl(url);
  await pool.query(
    `update monitor_items set is_starred = $1 where source_id = $2 and url = $3`,
    [isStarred, sourceId, targetUrl],
  );
}

export async function markAllReadByDepartment(departmentName: string) {
  const pool = getPgPool();
  await pool.query(
    `update monitor_items set is_read = true
     from monitor_sources ms
     where monitor_items.source_id = ms.id and ms.department_name = $1`,
    [departmentName],
  );
}