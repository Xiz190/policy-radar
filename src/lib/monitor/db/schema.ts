import { getPgPool } from "@/lib/db";
import { DEFAULT_MONITOR_SOURCES } from "@/lib/monitor/config";
import {
  SCHEMA_ENSURE_TTL_MS,
  SOURCES_SYNC_TTL_MS,
} from "./utils";

let schemaEnsuredAt: number | null = null;
let schemaEnsurePromise: Promise<void> | null = null;
let sourcesSyncedAt: number | null = null;
let sourcesSyncPromise: Promise<void> | null = null;

export async function ensureMonitorSchema() {
  if (process.env.FORCE_MOCK_API === "1" || process.env.FORCE_MOCK_API === "true") return;
  const now = Date.now();
  let needSchema = schemaEnsuredAt === null || now - schemaEnsuredAt >= SCHEMA_ENSURE_TTL_MS;
  let needSources = sourcesSyncedAt === null || now - sourcesSyncedAt >= SOURCES_SYNC_TTL_MS;

  if (!needSchema && !needSources) return;

  if (needSchema && schemaEnsurePromise) {
    await schemaEnsurePromise;
    needSchema = false;
  }
  if (needSources && sourcesSyncPromise) {
    await sourcesSyncPromise;
    needSources = false;
  }
  if (!needSchema && !needSources) return;

  if (needSchema) {
    const schemaPromise = (async () => {
      try {
        await ensureMonitorSchemaInternal();
        schemaEnsuredAt = Date.now();
      } finally {
        setTimeout(() => { schemaEnsurePromise = null; }, 1000);
      }
    })();
    schemaEnsurePromise = schemaPromise;
    await schemaPromise;
  }

  if (needSources) {
    const sourcesPromise = (async () => {
      try {
        await ensureMonitorSourcesInternal();
        sourcesSyncedAt = Date.now();
      } finally {
        setTimeout(() => { sourcesSyncPromise = null; }, 1000);
      }
    })();
    sourcesSyncPromise = sourcesPromise;
    await sourcesPromise;
  }
}

async function ensureMonitorSourcesInternal() {
  const pool = getPgPool();
  for (const src of DEFAULT_MONITOR_SOURCES) {
    try {
      const exist = await pool.query(
        `select id from monitor_sources where id = $1 limit 1`,
        [src.id],
      );
      if (exist.rowCount && exist.rowCount > 0) {
        await pool.query(
          `update monitor_sources
           set department_name = $2,
               channel_group = $3,
               channel_name = $4,
               display_name = $5,
               type = $6,
               list_url = $7,
               start_date = $8::date,
               max_items = $9,
               notes = coalesce($10, notes),
               updated_at = now()
           where id = $1`,
          [
            src.id,
            src.departmentName || "未分类部委",
            src.channelGroup || null,
            src.channelName || "未命名栏目",
            src.displayName || `${src.departmentName || ""}·${src.channelName || ""}`,
            src.type || "mct_szyw",
            src.listUrl,
            src.startDate,
            Number(src.maxItems) || 10,
            src.notes || null,
          ],
        );
      } else {
        await pool.query(
          `insert into monitor_sources (
             id, department_name, channel_group, channel_name, display_name, type, list_url,
             enabled, auto_monitor, is_key, start_date, max_items, notes
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13)`,
          [
            src.id,
            src.departmentName || "未分类部委",
            src.channelGroup || null,
            src.channelName || "未命名栏目",
            src.displayName || `${src.departmentName || ""}·${src.channelName || ""}`,
            src.type || "mct_szyw",
            src.listUrl,
            src.enabled === false ? false : true,
            src.autoMonitor === true ? true : false,
            src.isKey === true ? true : false,
            src.startDate,
            Number(src.maxItems) || 10,
            src.notes || null,
          ],
        );
      }
    } catch {
      // ignore
    }
  }
}

async function ensureMonitorSchemaInternal() {
  const pool = getPgPool();
  await pool.query(`
    create table if not exists monitor_sources (
      id text primary key,
      department_name text not null,
      channel_group text,
      channel_name text not null,
      display_name text not null,
      type text not null,
      list_url text not null,
      enabled boolean not null default true,
      auto_monitor boolean not null default false,
      is_key boolean not null default false,
      start_date date not null,
      max_items integer not null,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists monitor_runs (
      id text primary key,
      started_at timestamptz not null,
      finished_at timestamptz,
      status text not null,
      error_message text,
      results jsonb
    );
  `);

  await pool.query(`
    create table if not exists analysis_templates (
      id text primary key,
      name text not null,
      description text,
      category text not null,
      config_json jsonb not null,
      is_active boolean not null default true,
      sort_order integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists chat_logs (
      id text primary key,
      session_id text not null,
      source_id text,
      item_url text,
      user_message text not null,
      assistant_response text not null,
      context_json jsonb,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists monitor_items (
      source_id text not null,
      url text not null,
      title text not null,
      list_published_at date not null,
      first_seen_at timestamptz not null,
      is_read boolean not null default false,
      is_starred boolean not null default false,
      page_title text,
      content_json jsonb,
      content_quality text,
      capture_note text,
      attachments_json jsonb,
      captured_at timestamptz,
      primary key (source_id, url)
    );
  `);

  try {
    await pool.query(`alter table monitor_sources add column if not exists channel_group text`);
  } catch {
    // ignore
  }
  try {
    await pool.query(`alter table monitor_sources add column if not exists language text not null default 'zh'`);
  } catch {
    // ignore
  }
  try {
    await pool.query(`alter table monitor_sources add column if not exists region text not null default 'domestic'`);
  } catch {
    // ignore
  }
  try {
    await pool.query(`alter table monitor_sources add column if not exists content_category text not null default 'general'`);
  } catch {
    // ignore
  }

  try {
    await pool.query(`alter table monitor_items add column if not exists channel_group text`);
  } catch {
    // ignore
  }

  const colsToAdd: Array<{ name: string; type: string; default?: string }> = [
    { name: "is_read", type: "boolean", default: "false" },
    { name: "is_starred", type: "boolean", default: "false" },
    { name: "page_title", type: "text" },
    { name: "content_json", type: "jsonb" },
    { name: "content_quality", type: "text" },
    { name: "capture_note", type: "text" },
    { name: "attachments_json", type: "jsonb" },
    { name: "external_links_json", type: "jsonb" },
    { name: "captured_at", type: "timestamptz" },
    { name: "keyword_score", type: "integer", default: "0" },
    { name: "matched_keywords", type: "jsonb" },
    { name: "matched_categories", type: "jsonb" },
    { name: "matched_genres", type: "jsonb" },
    { name: "signal_hits", type: "jsonb" },
    { name: "importance_level", type: "text" },
    { name: "summary", type: "text" },
    { name: "effective_from", type: "date" },
    { name: "effective_to", type: "date" },
    { name: "deadline_date", type: "date" },
    { name: "extracted_dates_json", type: "jsonb" },
    { name: "document_status", type: "text" },
    { name: "scope", type: "text" },
    { name: "support_objects", type: "text" },
    { name: "support_tools", type: "text" },
    { name: "constraints", type: "text" },
    { name: "execution_handles", type: "text" },
    { name: "has_funding", type: "boolean", default: "false" },
    { name: "has_procurement", type: "boolean", default: "false" },
    { name: "has_pilot", type: "boolean", default: "false" },
    { name: "has_standards", type: "boolean", default: "false" },
    { name: "forecast_high", type: "text" },
    { name: "forecast_mid_high", type: "text" },
    { name: "forecast_mid", type: "text" },
    { name: "forecast_low", type: "text" },
    { name: "forecast_notes", type: "text" },
    { name: "forecast_sources_json", type: "jsonb" },
    { name: "policy_chain_json", type: "jsonb" },
    { name: "industry_impact_json", type: "jsonb" },
    { name: "pre_signals_json", type: "jsonb" },
    { name: "forecast_updated_at", type: "timestamptz" },
  ];

  for (const col of colsToAdd) {
    try {
      const ddl = col.default
        ? `alter table monitor_items add column if not exists ${col.name} ${col.type} not null default ${col.default}`
        : `alter table monitor_items add column if not exists ${col.name} ${col.type}`;
      await pool.query(ddl);
    } catch {
      // ignore
    }
  }

  const ensureJsonbColumn = async (col: string) => {
    const r = await pool.query(
      `select data_type from information_schema.columns where table_name = 'monitor_items' and column_name = $1`,
      [col],
    );
    if (r.rows[0]?.data_type === "jsonb") return;
    try {
      await pool.query(
        `alter table monitor_items alter column ${col} type jsonb using case when ${col} is null then '[]'::jsonb when ${col} = '' then '[]'::jsonb else ${col}::jsonb end`,
      );
    } catch {
      // ignore
    }
  };

  await ensureJsonbColumn("content_json");
  await ensureJsonbColumn("attachments_json");
  await ensureJsonbColumn("external_links_json");
  await ensureJsonbColumn("policy_chain_json");
  await ensureJsonbColumn("industry_impact_json");
  await ensureJsonbColumn("pre_signals_json");

  try {
    const r = await pool.query(
      `select data_type from information_schema.columns where table_name = 'monitor_items' and column_name = 'captured_at'`,
    );
    if (r.rows[0]?.data_type !== "timestamp with time zone") {
      await pool.query(`alter table monitor_items alter column captured_at type timestamptz using captured_at::timestamptz`);
    }
  } catch {
    // ignore
  }

  await pool.query(`create index if not exists monitor_sources_enabled_idx on monitor_sources(enabled, auto_monitor);`);
  await pool.query(`create index if not exists monitor_items_first_seen_at on monitor_items(first_seen_at desc);`);
  await pool.query(`create index if not exists monitor_items_list_published_at on monitor_items(list_published_at desc);`);
  await pool.query(`create index if not exists monitor_items_is_read on monitor_items(is_read);`);
  await pool.query(`create index if not exists monitor_items_is_starred on monitor_items(is_starred);`);
  await pool.query(`create index if not exists monitor_items_keyword_score on monitor_items(keyword_score desc nulls last);`);
  await pool.query(`create index if not exists monitor_items_document_status on monitor_items(document_status);`);
  await pool.query(`create index if not exists monitor_items_has_funding on monitor_items(has_funding) where has_funding = true;`);
  await pool.query(`create index if not exists monitor_items_has_procurement on monitor_items(has_procurement) where has_procurement = true;`);
  await pool.query(`create index if not exists monitor_items_has_pilot on monitor_items(has_pilot) where has_pilot = true;`);
  await pool.query(`create index if not exists monitor_items_has_standards on monitor_items(has_standards) where has_standards = true;`);
  await pool.query(`create index if not exists monitor_items_importance on monitor_items(importance_level);`);
  await pool.query(`create index if not exists monitor_items_matched_genres on monitor_items using gin(matched_genres);`);

  try {
    await pool.query(`alter table monitor_items add column if not exists department_name text`);
  } catch {}
  try {
    await pool.query(`
      update monitor_items mi
      set department_name = ms.department_name
      from monitor_sources ms
      where mi.source_id = ms.id
        and mi.department_name is null
    `);
  } catch {}
  await pool.query(`create index if not exists monitor_items_department_name on monitor_items(department_name);`);
  await pool.query(`create index if not exists monitor_items_dept_first_seen_idx on monitor_items(department_name, first_seen_at desc);`);

  try {
    await pool.query(`create extension if not exists pg_trgm`);
    await pool.query(`create index if not exists monitor_items_title_trgm_idx on monitor_items using gin (lower(title) gin_trgm_ops);`);
  } catch {
    // ignore
  }

  await pool.query(`create index if not exists monitor_items_importance_first_seen_idx on monitor_items(importance_level, first_seen_at desc);`);
  await pool.query(`create index if not exists monitor_items_starred_first_seen_idx on monitor_items(first_seen_at desc) where is_starred = true;`);
  await pool.query(`create index if not exists monitor_items_unread_first_seen_idx on monitor_items(first_seen_at desc) where is_read = false;`);
  await pool.query(`create index if not exists monitor_items_score_first_seen_idx on monitor_items(keyword_score desc nulls last, first_seen_at desc);`);
  await pool.query(`create index if not exists monitor_items_default_sort_idx on monitor_items(importance_level desc, is_starred desc, keyword_score desc nulls last, first_seen_at desc);`);

  await pool.query(`create index if not exists monitor_items_dept_cover_idx on monitor_items(department_name, first_seen_at desc) include (
    source_id, title, url, list_published_at,
    is_read, is_starred, keyword_score, importance_level,
    matched_categories, matched_genres, matched_keywords,
    signal_hits, effective_from, effective_to, deadline_date
  );`);
  await pool.query(`create index if not exists monitor_items_default_sort_cover_idx on monitor_items(importance_level desc, is_starred desc, keyword_score desc nulls last, first_seen_at desc) include (
    source_id, department_name, title, url, list_published_at,
    is_read, is_starred, keyword_score, importance_level,
    matched_categories, matched_genres, matched_keywords,
    signal_hits, effective_from, effective_to, deadline_date
  );`);

  await pool.query(`
    create table if not exists monitor_keywords (
      id text primary key,
      department_name text not null,
      keyword text not null,
      weight integer not null default 1,
      category text not null default 'general',
      match_mode text not null default 'phrase',
      created_at timestamptz not null default now()
    );
  `);
  try { await pool.query(`alter table monitor_keywords add column if not exists weight integer not null default 1`); } catch {}
  try { await pool.query(`alter table monitor_keywords add column if not exists category text not null default 'general'`); } catch {}
  try { await pool.query(`alter table monitor_keywords add column if not exists match_mode text not null default 'phrase'`); } catch {}
  await pool.query(`create index if not exists monitor_keywords_department_idx on monitor_keywords(department_name);`);
  await pool.query(`create index if not exists monitor_keywords_category_idx on monitor_keywords(category);`);
  await pool.query(`create unique index if not exists monitor_keywords_unique_idx on monitor_keywords(department_name, keyword);`);

  await pool.query(`
    create table if not exists monitor_subscriptions (
      id text primary key,
      user_id text not null default 'default',
      type text not null,
      target text not null,
      target_name text,
      enabled boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`create index if not exists monitor_subscriptions_user_type_idx on monitor_subscriptions(user_id, type);`);
  await pool.query(`create unique index if not exists monitor_subscriptions_user_target_idx on monitor_subscriptions(user_id, type, target);`);

  const dirtyCheck = await pool.query(
    `select count(*)::integer as cnt from monitor_sources where channel_name like '体裁分类·%'`,
  );
  const dirtyCount = Number(dirtyCheck.rows[0]?.cnt ?? 0);
  if (dirtyCount > 0) {
    const deptShort: Record<string, string> = {
      文化和旅游部: "文旅部",
      财政部: "财政部",
      国务院: "国务院",
      教育部: "教育部",
      科技部: "科技部",
      工业和信息化部: "工信部",
      人力资源和社会保障部: "人社部",
      自然资源部: "自然资源部",
      生态环境部: "生态环境部",
      住房和城乡建设部: "住建部",
      交通运输部: "交通运输部",
      水利部: "水利部",
      农业农村部: "农业农村部",
      商务部: "商务部",
      国家卫生健康委员会: "卫健委",
      退役军人事务部: "退役军人事务部",
      应急管理部: "应急管理部",
      中国人民银行: "央行",
      审计署: "审计署",
    };
    const dirtyRows = await pool.query(
      `select id, department_name, channel_name, display_name from monitor_sources where channel_name like '体裁分类·%'`,
    );
    for (const r of dirtyRows.rows) {
      const channel = String(r.channel_name).replace("体裁分类·", "");
      const prefix = deptShort[String(r.department_name)] ?? String(r.department_name);
      await pool.query(
        `update monitor_sources set channel_name = $1, display_name = $2, updated_at = now() where id = $3`,
        [channel, `${prefix}·${channel}`, String(r.id)],
      );
    }
  }
}

export function normalizeItemUrl(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);

    const trackingKeys = new Set([
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "spm", "clickid", "gclid", "fbclid", "from", "ref", "referer", "referrer",
    ]);

    const keys = Array.from(u.searchParams.keys());
    for (const k of keys) {
      if (trackingKeys.has(k.toLowerCase())) u.searchParams.delete(k);
      const v = u.searchParams.get(k);
      if (v === null || v === "") u.searchParams.delete(k);
    }
    u.searchParams.sort();

    let p = u.pathname.replace(/\/+/g, "/");
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    u.pathname = p;

    return u.toString();
  } catch {
    return trimmed;
  }
}

export async function seedDefaultKeywordsIfEmpty() {
  const pool = getPgPool();

  await pool.query(`delete from monitor_keywords where department_name = '__global__'`);

  const shared: Array<{ keyword: string; weight: number; category: string; matchMode: string }> = [];
  const pushList = (kws: string[], weight: number, category: string) => {
    for (const kw of kws) shared.push({ keyword: kw, weight, category, matchMode: "phrase" });
  };
  const pushRegex = (kws: string[], weight: number, category: string) => {
    for (const kw of kws) shared.push({ keyword: kw, weight, category, matchMode: "regex" });
  };

  pushList(
    [
      "实施细则", "申报通知", "申报指南", "采购目录", "招标公告", "招标文件",
      "框架协议", "试点名单", "示范名单", "白名单", "验收办法", "评分细则",
      "评分标准", "接入规范", "统一标准", "统一规则", "统一接口",
      "技术规范", "技术标准", "评测规范", "评测办法", "目录", "受理通知",
      "入库", "备案办法", "联合申报", "推荐申报", "面向社会征集",
    ],
    6,
    "A·强执行信号",
  );

  pushList(
    [
      "政府采购智能体", "采购大模型", "采购智能体服务", "政府采购",
      "标杆场景", "示范应用", "示范项目", "试点示范", "场景开放",
      "开放性场景", "可复制", "重点支持", "鼓励发展", "重点培育", "重点布局",
      "补贴", "补助", "不超过30%", "不超过5000万", "最高补贴200万",
      "专项资金", "算力券", "数据券", "券", "以旧换新补贴", "设备更新",
      "技术改造贷款", "再贷款", "再贷款支持", "财政支持", "贷款支持",
      "奖补", "资助", "资金安排", "资金支持", "财政资金",
      "能力建设", "平台建设", "基地建设", "联合建设", "合作共建",
      "战略合作", "合作协议", "合作备忘录", "生态合作", "联合实验室",
      "产业联盟", "产业基金", "标杆案例", "示范单位", "试点单位",
    ],
    5,
    "B·强支持信号",
  );

  pushList(
    [
      "分类分级治理", "分类分级", "高风险领域", "安全底线", "模型技术治理",
      "智能体安全治理", "模型安全", "算法安全", "安全评估", "风险评估",
      "评测", "评测办法", "评测规范", "红队", "可追溯", "可解释", "可审计",
      "资质", "准入门槛", "接入要求", "实名管理", "主页明示资质",
      "数据安全", "个人信息保护", "隐私保护", "跨境数据流动", "数据出境",
      "加强监管", "从严监管", "清理整顿", "整改", "处罚", "问责",
      "禁止", "限制", "负面清单", "审核", "审查", "备案", "审批",
      "应急征用", "日志留存", "审计", "未成年人保护", "网络暴力", "谣言治理",
    ],
    4,
    "C·风险信号",
  );

  pushList(
    [
      "探索", "探索发展", "探索机制", "试行", "研究", "研究制定",
      "正在研究", "开展研究", "鼓励", "鼓励探索",
      "token", "词元", "词元经济", "token确权", "token交易",
      "OPC", "OPC社区", "创新创业模式", "挂牌交易", "API调用",
      "确权", "流通交易", "数据流通", "条件成熟时", "逐步推进",
      "正在制定", "拟出台", "将出台", "将发布",
      "后续出台", "后续发布", "近期出台", "年内出台", "适时出台",
      "加快制定", "推动制定", "抓紧制定", "形成方案", "起草中", "修订中",
    ],
    2,
    "D·探索信号",
  );

  pushList(
    [
      "正式启动", "组织开展", "部署开展", "推进实施", "全面推进", "加快推进",
      "启动实施", "组织申报", "开始申报", "遴选", "试点启动", "示范启动",
      "发布实施", "正式印发", "印发实施", "正式施行", "开始执行",
      "落地实施", "推广应用", "扩围", "复制推广", "应用示范",
    ],
    3,
    "通用启动/落地",
  );

  pushList(
    [
      "人工智能", "大模型", "通用人工智能", "生成式人工智能", "生成式AI",
      "智能体", "AI原生应用", "智能原生应用", "基础模型",
      "模型备案", "模型评测", "模型安全", "模型应用",
      "智算", "智算中心", "智能算力", "推理算力", "训练算力", "算力基础设施",
      "算法备案", "算法模型", "深度合成", "合成内容", "AI安全", "AI治理", "AI伦理",
      "AI+", "人工智能+",
      "机器学习", "深度学习", "模型训练", "多模态", "智能算法",
      "行业模型", "垂类模型", "行业大模型",
      "智能问答", "智能创作", "AI内容", "智能终端",
      "智能体规范应用", "智能体创新发展",
    ],
    5,
    "AI/智能体/大模型",
  );

  shared.push({ keyword: "AI", weight: 5, category: "AI/智能体/大模型", matchMode: "word_boundary_en" });
  shared.push({ keyword: "AIGC", weight: 5, category: "AI/智能体/大模型", matchMode: "word_boundary_en" });

  pushList(
    [
      "全国一体化算力网", "算力网", "监测调度平台", "算力调度",
      "互联互通", "公共算力", "企业闲置算力", "市场算力",
      "市场化撮合", "供需撮合",
      "算电协同", "清洁能源供给", "绿电直连", "绿色低碳",
      "算力中心", "算力枢纽", "算力节点", "算力供给",
      "跨区域调度", "统一台账",
      "北京算力", "天津算力", "河北算力", "京津冀算力",
    ],
    4,
    "算力/算力网/算电协同",
  );

  pushList(
    [
      "数据要素", "数据要素市场", "数据流通", "数据交易", "数据产品",
      "数据资产", "数据确权", "数据治理", "数据开放",
      "公共数据", "公共数据授权运营", "数据开发利用", "数据基础制度",
      "高质量数据集", "数据集建设", "数据集共建", "行业数据集",
      "模数共振", "模型+数据", "场景数据", "优化模型",
      "行业应用标杆", "数据服务", "API服务", "API调用",
      "数据专区", "数据运营", "数据目录", "数据资源",
      "隐私计算", "数据脱敏", "数据合规", "数据分类分级",
    ],
    4,
    "数据要素/高质量数据集",
  );

  pushList(
    [
      "产业合作", "产业协同", "产业发展", "产业政策", "重点产业",
      "战略性新兴产业", "未来产业", "产业链", "供应链", "产业生态",
      "产业集群", "产业园区", "产业基地", "产业招商", "产业落地",
      "创新联合体", "总部经济", "区域合作", "区域协同",
      "场景创新", "场景开放", "应用示范",
      "京津冀协同发展", "京津冀一体化", "京津冀协同创新", "京津冀产业协同",
      "京津冀数字经济", "京津冀人工智能", "京津冀产业链", "京津冀数据流通",
      "京津冀场景开放", "京津冀公共服务", "京津冀重点项目", "京津冀合作",
      "京津冀联动", "京津冀共建", "京津冀应用示范",
      "北京国际科技创新中心", "全球数字经济标杆城市", "国际科技创新中心",
      "中关村论坛", "中关村", "北京城市副中心", "两区建设", "自贸试验区",
      "国家服务业扩大开放综合示范区", "北京经开区",
      "雄安新区", "雄安人工智能", "雄安数字城市", "雄安数据", "雄安场景", "雄安试点",
      "北京市人工智能", "北京市数字经济", "北京市数据要素", "北京市平台经济",
      "北京市未来产业", "北京市重点产业",
      "天津人工智能", "天津数字经济", "天津港产城融合",
      "河北数字经济", "河北数据产业", "河北承接", "区域协作", "飞地合作", "产业承接",
      "海淀", "朝阳", "通州", "昌平", "丰台", "顺义", "房山", "石景山",
    ],
    4,
    "产业合作/京津冀协同",
  );

  pushList(
    [
      "数字经济", "平台经济", "平台企业", "互联网平台", "数字平台",
      "平台治理", "平台责任", "平台合规", "平台监管",
      "数字产业", "数字化转型", "数实融合", "产业互联网", "工业互联网",
      "数字贸易", "网络零售", "直播电商", "网络直播", "短视频",
      "内容平台", "社交平台", "网络视听", "融媒体", "新媒体",
      "数字内容", "内容产业", "视听产业", "内容生态",
      "政务服务", "数字政务", "城市治理", "智慧城市", "基层治理", "公共服务",
      "数字教育", "智慧医疗", "智慧文旅", "智慧交通",
      "数字乡村", "数字消费", "智慧商圈", "文化科技融合",
      "服务业扩能提质", "AI+服务业",
    ],
    3,
    "政务服务/平台经济/数字经济",
  );

  pushList(
    [
      "征求意见", "公开征求意见", "实施方案", "行动计划", "工作要点",
      "工作方案", "实施意见", "起草说明", "解读", "修订", "条例",
      "办法", "规定", "细则", "指南", "指引", "通知", "若干措施",
    ],
    3,
    "法规/征求意见",
  );

  pushList(["北京", "天津", "河北", "雄安", "自贸区"], 1, "京津冀/北京/区域");

  pushList(
    [
      "领导讲话", "致辞", "出席会议", "出席活动", "主持召开", "会议纪要",
      "调研", "考察", "会见", "慰问", "个人简历", "人员名单", "任免名单",
      "出席开幕式", "出席论坛", "出席峰会",
    ],
    -3,
    "噪音词汇",
  );

  pushList(["印发", "发布", "公布", "下发", "转发", "批转", "批复", "复函", "函复", "通报"], 4, "结构·正式发文");
  pushList(
    [
      "通知", "公告", "通告", "意见", "指导意见", "实施意见", "实施方案",
      "工作方案", "行动计划", "行动方案", "工作要点", "管理办法", "实施细则",
      "暂行办法", "若干措施", "政策措施", "规定", "指引", "指南", "标准", "规则",
      "决定", "函",
    ],
    5,
    "结构·正式发文",
  );
  pushRegex(
    [
      "^关于印发《[^》]*》的通知$",
      "^关于发布《[^》]*》的公告$",
      "^关于公布《[^》]*》的通知$",
      "^关于印发《[^》]*实施方案》的通知$",
      "^关于印发《[^》]*行动计划》的通知$",
      "^关于印发《[^》]*若干措施》的通知$",
      "^关于印发《[^》]*管理办法》的通知$",
      "^关于印发《[^》]*工作要点》的通知$",
      "^关于印发《[^》]*指导意见》的通知$",
      "^关于转发《[^》]*》的通知$",
      "^关于批复《[^》]*》的通知$",
    ],
    7,
    "结构·正式发文",
  );

  pushList(["征求意见", "公开征求意见", "向社会公开征求意见", "再次征求意见", "公示", "予以公示"], 5, "结构·征求意见");
  pushList(
    [
      "征求意见稿", "草案", "草案说明", "送审稿", "修订草案", "修订草案征求意见稿", "意见反馈",
    ],
    4,
    "结构·征求意见",
  );
  pushRegex(
    [
      "^关于公开征求《[^》]*》意见的通知$",
      "^关于就《[^》]*》公开征求意见的公告$",
      "^关于《[^》]*》公开征求意见的公告$",
      "^关于征求《[^》]*》意见的函$",
      "^《[^》]*（征求意见稿）》",
      "^《[^》]*（修订草案征求意见稿）》",
    ],
    7,
    "结构·征求意见",
  );

  pushList(
    [
      "开展", "组织开展", "部署", "推进", "深入推进", "进一步推进",
      "实施", "组织实施", "贯彻落实", "抓好落实", "做好", "切实做好",
      "加快", "加快推进", "深化", "强化", "推动", "促进", "支持", "加强",
      "优化", "健全", "完善", "提升", "建立", "构建", "启动", "全面启动",
    ],
    3,
    "结构·推进实施",
  );
  pushRegex(
    [
      "^关于开展.*的通知$",
      "^关于组织开展.*的通知$",
      "^关于做好.*工作的通知$",
      "^关于进一步做好.*工作的通知$",
      "^关于推进.*的通知$",
      "^关于加快推进.*的意见$",
      "^关于支持.*的若干措施$",
      "^关于促进.*发展的意见$",
      "^关于加强.*管理的通知$",
      "^关于规范.*的通知$",
    ],
    6,
    "结构·推进实施",
  );

  pushList(
    [
      "规范", "进一步规范", "调整", "优化调整", "修订", "修正", "修改",
      "废止", "停止执行", "继续执行", "延续实施", "明确", "重申", "细化",
      "完善", "统一", "整治", "整改", "清理", "清查",
    ],
    3,
    "结构·规范调整",
  );

  pushList(
    [
      "名单", "目录", "清单", "台账", "库", "入库", "备案", "公布名单",
      "发布名单", "白名单", "项目库", "储备库",
    ],
    4,
    "结构·名单目录",
  );

  pushList(["认定", "评定", "评选", "申报", "推荐", "遴选", "组织申报", "推荐申报"], 4, "结构·认定申报");
  pushRegex(
    [
      "^关于开展.*申报工作的通知$",
      "^关于组织申报.*的通知$",
      "^关于公布.*认定结果的通知$",
      "^关于开展.*遴选工作的通知$",
    ],
    6,
    "结构·认定申报",
  );

  pushList(
    [
      "试点", "开展试点", "先行先试", "示范", "示范应用", "试点示范",
      "试验区", "专项行动", "行动计划", "三年行动", "攻坚行动",
      "提升行动", "专项治理", "专项整治", "重点任务",
    ],
    4,
    "结构·试点示范",
  );
  pushRegex(
    [
      "^关于开展.*试点工作的通知$",
      "^关于公布.*试点示范名单的通知$",
      "^关于组织申报.*试点示范的通知$",
    ],
    6,
    "结构·试点示范",
  );

  const insertStmt = `
    insert into monitor_keywords (id, department_name, keyword, weight, category, match_mode)
    values ($1, $2, $3, $4, $5, $6)
    on conflict (department_name, keyword) do nothing
  `;
  for (const item of shared) {
    const id = `gbl_${item.category}_${Buffer.from(item.keyword).toString("base64url")}`;
    await pool.query(insertStmt, [id, "__global__", item.keyword, item.weight, item.category, item.matchMode]);
  }
}