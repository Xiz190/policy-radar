import { getPgPool } from "@/lib/db";
import { normalizeItemUrl } from "../utils";

export async function getDepartmentNamesWithItems() {
  const pool = getPgPool();
  const res = await pool.query<{ department_name: string; count: string }>(
    `select coalesce(ms.department_name, '未分类部委') as department_name, count(*)::text as count
     from monitor_items mi
     join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     group by coalesce(ms.department_name, '未分类部委')
     order by count(*) desc, department_name asc`,
  );
  return res.rows.map((row) => ({ departmentName: row.department_name, count: Number(row.count) }));
}

export type MonitorItemDetail = {
  sourceId: string;
  url: string;
  title: string;
  listPublishedAt: string;
  firstSeenAt: string;
  isRead: boolean;
  isStarred: boolean;
  pageTitle: string | null;
  summary: string | null;
  paragraphs: string[];
  attachments: Array<{ url: string; text: string; kind: string }>;
  externalLinks: Array<{ text: string; url: string }>;
  contentQuality: string | null;
  captureNote: string | null;
  capturedAt: string | null;
  departmentName: string;
  channelName: string;
  displayName: string;
  keywordScore: number;
  importanceLevel: string;
  categories: Array<{ category: string; score: number; topKeywords?: string[] }>;
  matchedKeywords: Array<{ keyword: string; category: string; weight: number }>;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  deadlineDate: string | null;
  extractedDates: Array<{ type: string; date: string; raw?: string }>;
  signalMeta: {
    totalScore?: number;
    totalSignalStrength?: number;
    strongTopicCategories?: string[];
    distinctStrongTopicKeywords?: number;
    bodyParagraphCount?: number;
    totalStructureScore?: number;
    titleStructureHit?: boolean;
    hasStrongTopic?: boolean;
    riskHit?: boolean;
    hasTitleStructure?: boolean;
    thresholdDiscount?: number;
    thresholds?: {
      core: number;
      highlight: number;
      mid: number;
    };
    level?: string;
  } | null;
  signalHitsRaw: Record<string, unknown> | null;
  documentStatus: string | null;
  hasFunding: boolean;
  hasProcurement: boolean;
  hasPilot: boolean;
  hasStandards: boolean;
  forecastHigh: string | null;
  forecastMidHigh: string | null;
  forecastMid: string | null;
  forecastLow: string | null;
  forecastNotes: string | null;
  forecastSources: Array<{ title: string; url: string; note?: string }> | null;
  policyChain: Record<string, unknown> | null;
  industryImpact: Record<string, unknown> | null;
  preSignals: Record<string, unknown> | null;
  forecastUpdatedAt: string | null;
};

function mapItemDetailRow(row: Record<string, unknown>): MonitorItemDetail {
  const parseJsonArray = <T,>(value: unknown, validate: (item: unknown) => item is T): T[] => {
    if (!Array.isArray(value)) return [];
    const out: T[] = [];
    for (const item of value) {
      if (validate(item)) out.push(item);
    }
    return out;
  };

  const isString = (v: unknown): v is string => typeof v === "string";
  const isAttachment = (v: unknown): v is { url: string; text: string; kind: string } =>
    !!v && typeof v === "object" && typeof (v as { url?: unknown }).url === "string" &&
    typeof (v as { text?: unknown }).text === "string" && typeof (v as { kind?: unknown }).kind === "string";
  const isExternalLink = (v: unknown): v is { text: string; url: string } =>
    !!v && typeof v === "object" && typeof (v as { text?: unknown }).text === "string" &&
    typeof (v as { url?: unknown }).url === "string";

  const paragraphs: string[] = parseJsonArray(row.content_json, isString);
  const attachments: Array<{ url: string; text: string; kind: string }> = parseJsonArray(row.attachments_json, isAttachment);
  const externalLinks: Array<{ text: string; url: string }> = parseJsonArray(row.external_links_json, isExternalLink);
  let categories: Array<{ category: string; score: number; topKeywords?: string[] }> = [];
  if (row.matched_categories) {
    try {
      const raw = row.matched_categories;
      const parsed = Array.isArray(raw) ? raw : JSON.parse(String(raw));
      if (Array.isArray(parsed)) categories = parsed;
    } catch {
      // ignore
    }
  }
  const matchedKeywords: Array<{ keyword: string; category: string; weight: number }> = [];
  for (const cat of categories) {
    for (const kw of cat.topKeywords ?? []) {
      matchedKeywords.push({ keyword: String(kw), category: cat.category, weight: Number(cat.score) || 0 });
    }
  }
  const toDateStr = (d: unknown): string => {
    if (!d) return "";
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    const s = String(d);
    return s.slice(0, 10);
  };
  const toDateStrOrNull = (d: unknown): string | null => {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    const s = String(d);
    return s.slice(0, 10) || null;
  };
  let extractedDates: Array<{ type: string; date: string; raw?: string }> = [];
  if (row.extracted_dates_json) {
    try {
      const parsed = JSON.parse(String(row.extracted_dates_json));
      if (Array.isArray(parsed)) extractedDates = parsed;
    } catch {}
  }
  let signalMeta: MonitorItemDetail["signalMeta"] = null;
  let signalHitsRaw: Record<string, unknown> | null = null;
  if (row.signal_hits) {
    try {
      const parsed: Record<string, unknown> = JSON.parse(String(row.signal_hits));
      signalHitsRaw = parsed;
      if (parsed && typeof parsed._meta === "object" && parsed._meta !== null) {
        const m = parsed._meta as Record<string, unknown>;
        signalMeta = {
          totalScore: typeof m.totalScore === "number" ? m.totalScore : undefined,
          totalSignalStrength: typeof m.totalSignalStrength === "number" ? m.totalSignalStrength : undefined,
          strongTopicCategories: Array.isArray(m.strongTopicCategories)
            ? (m.strongTopicCategories as string[])
            : undefined,
          distinctStrongTopicKeywords: typeof m.distinctStrongTopicKeywords === "number"
            ? m.distinctStrongTopicKeywords
            : undefined,
          bodyParagraphCount: typeof m.bodyParagraphCount === "number" ? m.bodyParagraphCount : undefined,
          totalStructureScore: typeof m.totalStructureScore === "number" ? m.totalStructureScore : undefined,
          titleStructureHit: typeof m.titleStructureHit === "boolean" ? m.titleStructureHit : undefined,
          hasStrongTopic: typeof m.hasStrongTopic === "boolean" ? m.hasStrongTopic : undefined,
          riskHit: typeof m.riskHit === "boolean" ? m.riskHit : undefined,
          hasTitleStructure: typeof m.hasTitleStructure === "boolean" ? m.hasTitleStructure : undefined,
          thresholdDiscount: typeof m.thresholdDiscount === "number" ? m.thresholdDiscount : undefined,
          thresholds: typeof m.thresholds === "object" && m.thresholds !== null
            ? {
                core: Number((m.thresholds as Record<string, unknown>).core),
                highlight: Number((m.thresholds as Record<string, unknown>).highlight),
                mid: Number((m.thresholds as Record<string, unknown>).mid),
              }
            : undefined,
          level: typeof m.level === "string" ? m.level : undefined,
        };
      }
    } catch {}
  }
  return {
    sourceId: String(row.source_id),
    url: String(row.url),
    title: String(row.title),
    listPublishedAt: toDateStr(row.list_published_at),
    firstSeenAt: row.first_seen_at instanceof Date ? row.first_seen_at.toISOString() : String(row.first_seen_at),
    isRead: Boolean(row.is_read),
    isStarred: Boolean(row.is_starred),
    pageTitle: row.page_title ? String(row.page_title) : null,
    summary: row.summary ? String(row.summary) : null,
    paragraphs,
    attachments,
    externalLinks,
    contentQuality: row.content_quality ? String(row.content_quality) : null,
    captureNote: row.capture_note ? String(row.capture_note) : null,
    capturedAt: row.captured_at ? (row.captured_at instanceof Date ? row.captured_at.toISOString() : String(row.captured_at)) : null,
    departmentName: String(row.department_name),
    channelName: String(row.channel_name),
    displayName: String(row.display_name),
    keywordScore: Number(row.keyword_score) || 0,
    importanceLevel: row.importance_level ? String(row.importance_level) : "普通内容",
    categories,
    matchedKeywords,
    effectiveFrom: toDateStrOrNull(row.effective_from),
    effectiveTo: toDateStrOrNull(row.effective_to),
    deadlineDate: toDateStrOrNull(row.deadline_date),
    extractedDates,
    signalMeta,
    signalHitsRaw,
    documentStatus: row.document_status ? String(row.document_status) : null,
    hasFunding: Boolean(row.has_funding),
    hasProcurement: Boolean(row.has_procurement),
    hasPilot: Boolean(row.has_pilot),
    hasStandards: Boolean(row.has_standards),
    forecastHigh: row.forecast_high ? String(row.forecast_high) : null,
    forecastMidHigh: row.forecast_mid_high ? String(row.forecast_mid_high) : null,
    forecastMid: row.forecast_mid ? String(row.forecast_mid) : null,
    forecastLow: row.forecast_low ? String(row.forecast_low) : null,
    forecastNotes: row.forecast_notes ? String(row.forecast_notes) : null,
    forecastSources: (() => { try { return row.forecast_sources_json ? JSON.parse(String(row.forecast_sources_json)) : null; } catch { return null; } })(),
    policyChain: (() => { try { return row.policy_chain_json ? JSON.parse(String(row.policy_chain_json)) : null; } catch { return null; } })(),
    industryImpact: (() => { try { return row.industry_impact_json ? JSON.parse(String(row.industry_impact_json)) : null; } catch { return null; } })(),
    preSignals: (() => { try { return row.pre_signals_json ? JSON.parse(String(row.pre_signals_json)) : null; } catch { return null; } })(),
    forecastUpdatedAt: row.forecast_updated_at ? (row.forecast_updated_at instanceof Date ? row.forecast_updated_at.toISOString() : String(row.forecast_updated_at)) : null,
  };
}

export async function getItemDetailBySourceId(sourceId: string): Promise<MonitorItemDetail | null> {
  const pool = getPgPool();
  const res = await pool.query(
    `select mi.source_id,
            mi.url,
            mi.title,
            mi.list_published_at,
            mi.first_seen_at,
            mi.is_read,
            mi.is_starred,
            mi.page_title,
            mi.summary,
            mi.content_json,
            mi.content_quality,
            mi.capture_note,
            mi.attachments_json,
            mi.external_links_json,
            mi.captured_at,
            mi.keyword_score,
            mi.importance_level,
            mi.matched_categories,
            mi.effective_from,
            mi.effective_to,
            mi.deadline_date,
            mi.extracted_dates_json,
            mi.signal_hits,
            mi.document_status,
            mi.has_funding,
            mi.has_procurement,
            mi.has_pilot,
            mi.has_standards,
            mi.forecast_high,
            mi.forecast_mid_high,
            mi.forecast_mid,
            mi.forecast_low,
            mi.forecast_notes,
            mi.forecast_sources_json,
            mi.policy_chain_json,
            mi.industry_impact_json,
            mi.pre_signals_json,
            mi.forecast_updated_at,
            coalesce(ms.department_name, '未分类部委') as department_name,
            coalesce(ms.channel_name, mi.source_id) as channel_name,
            coalesce(ms.display_name, concat(coalesce(ms.department_name, '未分类部委'), '·', coalesce(ms.channel_name, ''))) as display_name
     from monitor_items mi
     join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where mi.source_id = $1
     order by mi.first_seen_at desc
     limit 1`,
    [sourceId],
  );
  if (res.rows.length === 0) return null;
  return mapItemDetailRow(res.rows[0]);
}

export async function getItemDetailBySourceAndUrl(sourceId: string, url: string): Promise<MonitorItemDetail | null> {
  const pool = getPgPool();
  const targetUrl = normalizeItemUrl(url);
  const res = await pool.query(
    `select mi.source_id,
            mi.url,
            mi.title,
            mi.list_published_at,
            mi.first_seen_at,
            mi.is_read,
            mi.is_starred,
            mi.page_title,
            mi.summary,
            mi.content_json,
            mi.content_quality,
            mi.capture_note,
            mi.attachments_json,
            mi.external_links_json,
            mi.captured_at,
            mi.keyword_score,
            mi.importance_level,
            mi.matched_categories,
            mi.effective_from,
            mi.effective_to,
            mi.deadline_date,
            mi.extracted_dates_json,
            mi.signal_hits,
            mi.document_status,
            mi.has_funding,
            mi.has_procurement,
            mi.has_pilot,
            mi.has_standards,
            mi.forecast_high,
            mi.forecast_mid_high,
            mi.forecast_mid,
            mi.forecast_low,
            mi.forecast_notes,
            mi.forecast_sources_json,
            mi.policy_chain_json,
            mi.industry_impact_json,
            mi.pre_signals_json,
            mi.forecast_updated_at,
            coalesce(ms.department_name, '未分类部委') as department_name,
            coalesce(ms.channel_name, mi.source_id) as channel_name,
            coalesce(ms.display_name, concat(coalesce(ms.department_name, '未分类部委'), '·', coalesce(ms.channel_name, ''))) as display_name
     from monitor_items mi
     join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where mi.source_id = $1 and mi.url = $2
     limit 1`,
    [sourceId, targetUrl],
  );
  if (res.rows.length === 0) return null;
  return mapItemDetailRow(res.rows[0]);
}

export type ForecastItem = {
  sourceId: string;
  url: string;
  title: string;
  listPublishedAt: string;
  firstSeenAt: string;
  departmentName: string;
  channelName: string;
  displayName: string;
  importanceLevel: string;
  keywordScore: number;
  summary: string | null;
  documentStatus: string | null;
  hasFunding: boolean;
  hasProcurement: boolean;
  hasPilot: boolean;
  hasStandards: boolean;
  forecastHigh: string | null;
  forecastMidHigh: string | null;
  forecastMid: string | null;
  forecastLow: string | null;
  forecastNotes: string | null;
  forecastSources: Array<{ title: string; url: string; note?: string }> | null;
  forecastUpdatedAt: string | null;
  topCategories: Array<{ category: string; score: number }>;
};

export async function getForecastItems(
  filter: "all" | "forecast" | "signal" | "funding" | "procurement" | "pilot" | "standards" = "all",
  limit = 100,
): Promise<ForecastItem[]> {
  const pool = getPgPool();

  const whereConditions: string[] = [];
  const params: unknown[] = [];

  if (filter === "forecast") {
    whereConditions.push(
      "(forecast_high is not null or forecast_mid_high is not null or forecast_mid is not null or forecast_low is not null)",
    );
  } else if (filter === "signal") {
    whereConditions.push(
      "(has_funding = true or has_procurement = true or has_pilot = true or has_standards = true)",
    );
    whereConditions.push(
      "(forecast_high is null and forecast_mid_high is null and forecast_mid is null and forecast_low is null)",
    );
  } else if (filter === "funding") {
    whereConditions.push("has_funding = true");
  } else if (filter === "procurement") {
    whereConditions.push("has_procurement = true");
  } else if (filter === "pilot") {
    whereConditions.push("has_pilot = true");
  } else if (filter === "standards") {
    whereConditions.push("has_standards = true");
  } else {
    whereConditions.push(
      "(has_funding = true or has_procurement = true or has_pilot = true or has_standards = true or forecast_high is not null or forecast_mid_high is not null or forecast_mid is not null or forecast_low is not null)",
    );
  }

  const whereClause = whereConditions.length > 0 ? `where ${whereConditions.join(" and ")}` : "";

  const res = await pool.query(
    `select mi.source_id,
            mi.url,
            mi.title,
            mi.list_published_at,
            mi.first_seen_at,
            mi.keyword_score,
            mi.importance_level,
            mi.matched_categories,
            mi.document_status,
            mi.has_funding,
            mi.has_procurement,
            mi.has_pilot,
            mi.has_standards,
            mi.forecast_high,
            mi.forecast_mid_high,
            mi.forecast_mid,
            mi.forecast_low,
            mi.forecast_notes,
            mi.forecast_sources_json,
            mi.forecast_updated_at,
            mi.summary,
            coalesce(ms.department_name, '未分类部委') as department_name,
            coalesce(ms.channel_name, mi.source_id) as channel_name,
            coalesce(ms.display_name, concat(coalesce(ms.department_name, '未分类部委'), '·', coalesce(ms.channel_name, ''))) as display_name
     from monitor_items mi
     join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     ${whereClause}
     order by mi.first_seen_at desc
     limit $1`,
    [...params, limit],
  );

  return res.rows.map((row) => {
    let categories: Array<{ category: string; score: number }> = [];
    if (row.matched_categories) {
      try {
        const raw = row.matched_categories;
        const parsed = Array.isArray(raw) ? raw : JSON.parse(String(raw));
        if (Array.isArray(parsed)) {
          categories = parsed
            .filter((c) => c && typeof c.category === "string")
            .slice(0, 3)
            .map((c) => ({ category: c.category, score: Number(c.score) || 0 }));
        }
      } catch {
        // ignore
      }
    }

    const formatDate = (d: unknown): string => {
      if (!d) return "";
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      return String(d).slice(0, 10);
    };

    const formatDateFull = (d: unknown): string | null => {
      if (!d) return null;
      if (d instanceof Date) return d.toISOString();
      return String(d) || null;
    };

    return {
      sourceId: row.source_id,
      url: row.url,
      title: row.title,
      listPublishedAt: formatDate(row.list_published_at),
      firstSeenAt: row.first_seen_at instanceof Date ? row.first_seen_at.toISOString() : String(row.first_seen_at),
      departmentName: row.department_name,
      channelName: row.channel_name,
      displayName: row.display_name,
      importanceLevel: row.importance_level || "普通内容",
      keywordScore: Number(row.keyword_score) || 0,
      summary: row.summary ?? null,
      documentStatus: row.document_status ?? null,
      hasFunding: Boolean(row.has_funding),
      hasProcurement: Boolean(row.has_procurement),
      hasPilot: Boolean(row.has_pilot),
      hasStandards: Boolean(row.has_standards),
      forecastHigh: row.forecast_high ?? null,
      forecastMidHigh: row.forecast_mid_high ?? null,
      forecastMid: row.forecast_mid ?? null,
      forecastLow: row.forecast_low ?? null,
      forecastNotes: row.forecast_notes ?? null,
      forecastSources: row.forecast_sources_json ?? null,
      forecastUpdatedAt: formatDateFull(row.forecast_updated_at),
      topCategories: categories,
    };
  });
}

export type ChannelSectionItem = {
  sourceId: string;
  url: string;
  title: string;
  summary: string | null;
  listPublishedAt: string;
  firstSeenAt: string;
  importanceLevel: string;
  keywordScore: number;
  isStarred: boolean;
  channelName: string;
  displayName: string;
};

export async function getItemsByDepartmentAndChannel(
  departmentName: string,
  channelName: string,
  limit = 50,
): Promise<{ items: ChannelSectionItem[]; todayCount: number; totalCount: number; sourceIds: string[] }> {
  const pool = getPgPool();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const [itemsRes, totalRes, todayRes, sourcesRes] = await Promise.all([
    pool.query(
      `select mi.source_id,
              mi.url,
              mi.title,
              coalesce(left(mi.summary, 220), left(mi.title, 220)) as summary,
              mi.list_published_at,
              mi.first_seen_at,
              mi.importance_level,
              mi.keyword_score,
              mi.is_starred,
              coalesce(ms.channel_name, mi.source_id) as channel_name,
              coalesce(ms.display_name, concat(coalesce(ms.department_name, '未分类部委'), '·', coalesce(ms.channel_name, ''))) as display_name
       from monitor_items mi
       join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
       where (ms.department_name = $1 or (ms.department_name is null and $1 = '未分类部委'))
         and coalesce(ms.channel_name, mi.source_id) = $2
       order by mi.list_published_at desc, mi.first_seen_at desc
       limit $3`,
      [departmentName, channelName, limit],
    ),
    pool.query(
      `select count(*) as cnt
       from monitor_items mi
       join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
       where (ms.department_name = $1 or (ms.department_name is null and $1 = '未分类部委'))
         and coalesce(ms.channel_name, mi.source_id) = $2`,
      [departmentName, channelName],
    ),
    pool.query(
      `select count(*) as cnt
       from monitor_items mi
       join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
       where (ms.department_name = $1 or (ms.department_name is null and $1 = '未分类部委'))
         and coalesce(ms.channel_name, mi.source_id) = $2
         and date(mi.list_published_at) = $3`,
      [departmentName, channelName, todayStr],
    ),
    pool.query(
      `select ms.id
       from monitor_sources ms
       where (ms.department_name = $1 or (ms.department_name is null and $1 = '未分类部委'))
         and coalesce(ms.channel_name, ms.id) = $2
       order by ms.created_at asc`,
      [departmentName, channelName],
    ),
  ]);

  const items: ChannelSectionItem[] = itemsRes.rows.map((row) => ({
    sourceId: row.source_id,
    url: row.url,
    title: row.title,
    summary: row.summary ?? null,
    listPublishedAt: row.list_published_at instanceof Date ? row.list_published_at.toISOString().slice(0, 10) : String(row.list_published_at).slice(0, 10),
    firstSeenAt: row.first_seen_at instanceof Date ? row.first_seen_at.toISOString() : String(row.first_seen_at),
    importanceLevel: row.importance_level || "普通内容",
    keywordScore: Number(row.keyword_score) || 0,
    isStarred: Boolean(row.is_starred),
    channelName: row.channel_name,
    displayName: row.display_name,
  }));

  return {
    items,
    totalCount: Number(totalRes.rows[0]?.cnt ?? 0),
    todayCount: Number(todayRes.rows[0]?.cnt ?? 0),
    sourceIds: sourcesRes.rows.map((r) => String(r.id)),
  };
}

export async function getRelatedItemsByItem(params: {
  sourceId: string;
  url: string;
  departmentName: string;
  categories?: string[];
  limit?: number;
}) {
  const pool = getPgPool();
  const limit = params.limit ?? 6;
  const categories = (params.categories ?? []).filter((c) => c && c.length > 0).slice(0, 5);
  const values: unknown[] = [params.sourceId, params.url, params.departmentName, limit];

  const categoryMapForQuery: Record<string, string[]> = {
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
  const expandedCategories: string[] = [];
  for (const c of categories) {
    expandedCategories.push(...(categoryMapForQuery[c] ?? [c]));
  }

  const categoryClauses: string[] = [];
  if (expandedCategories.length > 0) {
    const placeholders = expandedCategories.map((_, i) => `$${values.length + i + 1}`).join(",");
    values.push(...expandedCategories);
    categoryClauses.push(
      `exists (select 1 from jsonb_array_elements(case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end) as c where c->>'category' in (${placeholders}))`,
    );
  }
  const whereExtra = categoryClauses.length > 0 ? `and ${categoryClauses.join(" and ")}` : "";
  const res = await pool.query(
    `select distinct on (mi.url)
            mi.source_id,
            mi.url,
            mi.title,
            mi.list_published_at,
            mi.first_seen_at,
            mi.importance_level,
            coalesce(mi.keyword_score, 0) as keyword_score,
            mi.matched_categories,
            coalesce(ms.department_name, '未分类部委') as department_name,
            coalesce(ms.channel_name, mi.source_id) as channel_name,
            coalesce(ms.display_name, concat(coalesce(ms.department_name, '未分类部委'), '·', coalesce(ms.channel_name, ''))) as display_name
     from monitor_items mi
     inner join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where mi.source_id <> $1
       and mi.url <> $2
       and ms.department_name = $3
       and mi.list_published_at >= ms.start_date
       ${whereExtra}
     order by
       mi.url asc,
       case when mi.importance_level in ('核心关注', '加急推荐') then 3
            when mi.importance_level = '重点内容' then 2
            when mi.importance_level = '中等重点' then 1
            else 0 end desc,
       coalesce(mi.keyword_score, 0) desc,
       mi.list_published_at desc
     limit $4`,
    values,
  );
  return res.rows.map((row) => {
    let cats: string[] = [];
    if (row.matched_categories) {
      try {
        const raw = row.matched_categories;
        const parsed = Array.isArray(raw) ? raw : JSON.parse(String(raw));
        if (Array.isArray(parsed)) cats = parsed
          .filter((c) => c && typeof (c as { category?: unknown }).category === "string")
          .map((c) => String((c as { category: string }).category));
      } catch {
        // ignore
      }
    }
    return {
      sourceId: row.source_id,
      url: row.url,
      title: row.title,
      listPublishedAt: row.list_published_at instanceof Date ? row.list_published_at.toISOString().slice(0, 10) : String(row.list_published_at).slice(0, 10),
      firstSeenAt: row.first_seen_at instanceof Date ? row.first_seen_at.toISOString() : String(row.first_seen_at),
      importanceLevel: row.importance_level || "普通内容",
      keywordScore: Number(row.keyword_score) || 0,
      departmentName: row.department_name,
      channelName: row.channel_name,
      displayName: row.display_name,
      categories: cats,
    };
  });
}

export async function getSameTopicItems(params: {
  sourceId: string;
  url: string;
  categories?: string[];
  limit?: number;
}) {
  const pool = getPgPool();
  const limit = params.limit ?? 6;
  const categories = (params.categories ?? []).filter((c) => c && c.length > 0).slice(0, 5);

  const DEBUG =
    typeof process !== "undefined" &&
    process.env &&
    process.env.CONTENT_META_DEBUG === "1";
  const LOG_PREFIX = "[DB][getSameTopicItems]";

  if (categories.length === 0) {
    return [];
  }

  const values: unknown[] = [params.sourceId, params.url, limit];

  const categoryMapForQuery: Record<string, string[]> = {
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
  const expandedCategories: string[] = [];
  for (const c of categories) {
    expandedCategories.push(...(categoryMapForQuery[c] ?? [c]));
  }

  let whereExtra = "";
  if (expandedCategories.length > 0) {
    const placeholders = expandedCategories.map((_, i) => `$${values.length + i + 1}`).join(",");
    values.push(...expandedCategories);
    whereExtra = `and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end) as c where c->>'category' in (${placeholders}))`;
  }

  const res = await pool.query(
    `select distinct on (mi.url)
            mi.source_id,
            mi.url,
            mi.title,
            mi.list_published_at,
            mi.first_seen_at,
            mi.importance_level,
            coalesce(mi.keyword_score, 0) as keyword_score,
            mi.matched_categories,
            coalesce(ms.department_name, '未分类部委') as department_name,
            coalesce(ms.channel_name, mi.source_id) as channel_name,
            coalesce(ms.display_name, concat(coalesce(ms.department_name, '未分类部委'), '·', coalesce(ms.channel_name, ''))) as display_name
     from monitor_items mi
     inner join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where mi.source_id <> $1
       and mi.url <> $2
       and mi.list_published_at >= ms.start_date
       ${whereExtra}
     order by
       mi.url asc,
       case when mi.importance_level in ('核心关注', '加急推荐') then 3
            when mi.importance_level = '重点内容' then 2
            when mi.importance_level = '中等重点' then 1
            else 0 end desc,
       coalesce(mi.keyword_score, 0) desc,
       mi.list_published_at desc
     limit $3`,
    values,
  );

  if (DEBUG) {
    if (res.rows.length > 0) {
      console.log(
        `${LOG_PREFIX} 结果列表:`,
        res.rows.map((r) => ({
          title: r.title,
          department: r.department_name,
          score: r.keyword_score,
          level: r.importance_level,
        })),
      );
    }
  }

  return res.rows.map((row) => {
    let cats: string[] = [];
    if (row.matched_categories) {
      try {
        const raw = row.matched_categories;
        const parsed = Array.isArray(raw) ? raw : JSON.parse(String(raw));
        if (Array.isArray(parsed)) cats = parsed
          .filter((c) => c && typeof (c as { category?: unknown }).category === "string")
          .map((c) => String((c as { category: string }).category));
      } catch {
        // ignore
      }
    }
    return {
      sourceId: row.source_id,
      url: row.url,
      title: row.title,
      listPublishedAt: row.list_published_at instanceof Date ? row.list_published_at.toISOString().slice(0, 10) : String(row.list_published_at).slice(0, 10),
      firstSeenAt: row.first_seen_at instanceof Date ? row.first_seen_at.toISOString() : String(row.first_seen_at),
      importanceLevel: row.importance_level || "普通内容",
      keywordScore: Number(row.keyword_score) || 0,
      departmentName: row.department_name,
      channelName: row.channel_name,
      displayName: row.display_name,
      categories: cats,
    };
  });
}

export async function getLatestItemsByDepartment(
  departmentName: string,
  excludeUrl?: string,
  limit = 6,
) {
  const pool = getPgPool();
  const values: unknown[] = [departmentName, limit];
  let urlFilter = "";
  if (excludeUrl) {
    values.push(excludeUrl);
    urlFilter = `and mi.url <> $${values.length}`;
  }

  const res = await pool.query(
    `select mi.source_id,
            mi.url,
            mi.title,
            mi.list_published_at,
            mi.first_seen_at,
            mi.importance_level,
            coalesce(mi.keyword_score, 0) as keyword_score,
            coalesce(ms.department_name, '未分类部委') as department_name,
            coalesce(ms.channel_name, mi.source_id) as channel_name,
            coalesce(ms.display_name, concat(coalesce(ms.department_name, '未分类部委'), '·', coalesce(ms.channel_name, ''))) as display_name
     from monitor_items mi
     inner join monitor_sources ms on ms.id = mi.source_id and ms.enabled = true
     where (ms.department_name = $1 or (ms.department_name is null and $1 = '未分类部委'))
       and mi.list_published_at >= ms.start_date
       ${urlFilter}
     order by mi.list_published_at desc, mi.first_seen_at desc
     limit $2`,
    values,
  );

  return res.rows.map((row) => ({
    sourceId: row.source_id,
    url: row.url,
    title: row.title,
    listPublishedAt: row.list_published_at instanceof Date ? row.list_published_at.toISOString().slice(0, 10) : String(row.list_published_at).slice(0, 10),
    firstSeenAt: row.first_seen_at instanceof Date ? row.first_seen_at.toISOString() : String(row.first_seen_at),
    importanceLevel: row.importance_level || "普通内容",
    keywordScore: Number(row.keyword_score) || 0,
    departmentName: row.department_name,
    channelName: row.channel_name,
    displayName: row.display_name,
  }));
}

export async function upsertItemDetail(
  sourceId: string,
  url: string,
  data: {
    pageTitle?: string | null;
    paragraphs: string[];
    attachments: Array<{ url: string; text: string; kind: string }>;
    externalLinks?: Array<{ text: string; url: string }>;
    contentQuality: string;
    captureNote: string;
    capturedAtIso: string;
  },
) {
  const pool = getPgPool();
  const targetUrl = normalizeItemUrl(url);
  await pool.query(
    `update monitor_items
     set page_title = $3,
         content_json = $4::jsonb,
         content_quality = $5,
         capture_note = $6,
         attachments_json = $7::jsonb,
         external_links_json = $8::jsonb,
         captured_at = $9::timestamptz
     where source_id = $1 and url = $2`,
    [
      sourceId,
      targetUrl,
      data.pageTitle ?? null,
      JSON.stringify(data.paragraphs),
      data.contentQuality,
      data.captureNote,
      JSON.stringify(data.attachments),
      JSON.stringify(data.externalLinks ?? []),
      data.capturedAtIso,
    ],
  );
}

export type StructuredDates = {
  effectiveFrom: string | null;
  effectiveTo: string | null;
  deadlineDate: string | null;
  allMatches: Array<{ type: string; date: string; raw: string }>;
};

export async function updateItemStructuredDates(
  sourceId: string,
  url: string,
  dates: StructuredDates,
) {
  const pool = getPgPool();
  const targetUrl = normalizeItemUrl(url);
  await pool.query(
    `update monitor_items
     set effective_from = $3::date,
         effective_to = $4::date,
         deadline_date = $5::date,
         extracted_dates_json = $6::jsonb
     where source_id = $1 and url = $2`,
    [
      sourceId,
      targetUrl,
      dates.effectiveFrom ?? null,
      dates.effectiveTo ?? null,
      dates.deadlineDate ?? null,
      JSON.stringify(dates.allMatches),
    ],
  );
}