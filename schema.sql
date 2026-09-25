-- ============================================================
-- 公开信息同步台 - 数据库表结构定义
-- 创建时间: 2026-07-03
-- 适用版本: v1.0.0
-- 执行方式: psql -U <username> -d <database> -f schema.sql
-- ============================================================

-- 创建扩展
create extension if not exists pg_trgm;

-- ============================================================
-- 监测源配置表
-- ============================================================
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

-- ============================================================
-- 监测运行记录表
-- ============================================================
create table if not exists monitor_runs (
  id text primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null,
  error_message text,
  results jsonb
);

-- ============================================================
-- 分析模板表
-- ============================================================
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

-- ============================================================
-- 聊天记录表
-- ============================================================
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

-- ============================================================
-- 监测条目表（核心业务表）
-- ============================================================
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
  external_links_json jsonb,
  captured_at timestamptz,
  keyword_score integer not null default 0,
  matched_keywords jsonb,
  matched_categories jsonb,
  matched_genres jsonb,
  signal_hits jsonb,
  importance_level text,
  summary text,
  effective_from date,
  effective_to date,
  deadline_date date,
  extracted_dates_json jsonb,
  document_status text,
  scope text,
  support_objects text,
  support_tools text,
  constraints text,
  execution_handles text,
  has_funding boolean not null default false,
  has_procurement boolean not null default false,
  has_pilot boolean not null default false,
  has_standards boolean not null default false,
  forecast_high text,
  forecast_mid_high text,
  forecast_mid text,
  forecast_low text,
  forecast_notes text,
  forecast_sources_json jsonb,
  policy_chain_json jsonb,
  industry_impact_json jsonb,
  pre_signals_json jsonb,
  forecast_updated_at timestamptz,
  channel_group text,
  department_name text,
  primary key (source_id, url)
);

-- ============================================================
-- 关键词配置表
-- ============================================================
create table if not exists monitor_keywords (
  id text primary key,
  department_name text not null,
  keyword text not null,
  weight integer not null default 1,
  category text not null default 'general',
  match_mode text not null default 'phrase',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 订阅配置表
-- ============================================================
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

-- ============================================================
-- 索引定义
-- ============================================================

-- monitor_sources
create index if not exists monitor_sources_enabled_idx on monitor_sources(enabled, auto_monitor);

-- monitor_items
create index if not exists monitor_items_first_seen_at on monitor_items(first_seen_at desc);
create index if not exists monitor_items_list_published_at on monitor_items(list_published_at desc);
create index if not exists monitor_items_is_read on monitor_items(is_read);
create index if not exists monitor_items_is_starred on monitor_items(is_starred);
create index if not exists monitor_items_keyword_score on monitor_items(keyword_score desc nulls last);
create index if not exists monitor_items_document_status on monitor_items(document_status);
create index if not exists monitor_items_has_funding on monitor_items(has_funding) where has_funding = true;
create index if not exists monitor_items_has_procurement on monitor_items(has_procurement) where has_procurement = true;
create index if not exists monitor_items_has_pilot on monitor_items(has_pilot) where has_pilot = true;
create index if not exists monitor_items_has_standards on monitor_items(has_standards) where has_standards = true;
create index if not exists monitor_items_importance on monitor_items(importance_level);
create index if not exists monitor_items_matched_genres on monitor_items using gin(matched_genres);
create index if not exists monitor_items_department_name on monitor_items(department_name);
create index if not exists monitor_items_dept_first_seen_idx on monitor_items(department_name, first_seen_at desc);

-- pg_trgm 索引加速模糊搜索
create index if not exists monitor_items_title_trgm_idx on monitor_items using gin (lower(title) gin_trgm_ops);

-- v3 性能优化索引
create index if not exists monitor_items_importance_first_seen_idx on monitor_items(importance_level, first_seen_at desc);
create index if not exists monitor_items_starred_first_seen_idx on monitor_items(first_seen_at desc) where is_starred = true;
create index if not exists monitor_items_unread_first_seen_idx on monitor_items(first_seen_at desc) where is_read = false;
create index if not exists monitor_items_score_first_seen_idx on monitor_items(keyword_score desc nulls last, first_seen_at desc);
create index if not exists monitor_items_default_sort_idx on monitor_items(importance_level desc, is_starred desc, keyword_score desc nulls last, first_seen_at desc);

-- 覆盖索引
create index if not exists monitor_items_dept_cover_idx on monitor_items(department_name, first_seen_at desc) include (
  source_id, title, url, list_published_at,
  is_read, is_starred, keyword_score, importance_level,
  matched_categories, matched_genres, matched_keywords,
  signal_hits, effective_from, effective_to, deadline_date
);

create index if not exists monitor_items_default_sort_cover_idx on monitor_items(importance_level desc, is_starred desc, keyword_score desc nulls last, first_seen_at desc) include (
  source_id, department_name, title, url, list_published_at,
  is_read, is_starred, keyword_score, importance_level,
  matched_categories, matched_genres, matched_keywords,
  signal_hits, effective_from, effective_to, deadline_date
);

-- monitor_keywords
create index if not exists monitor_keywords_department_idx on monitor_keywords(department_name);
create index if not exists monitor_keywords_category_idx on monitor_keywords(category);
create unique index if not exists monitor_keywords_unique_idx on monitor_keywords(department_name, keyword);

-- monitor_subscriptions
create index if not exists monitor_subscriptions_user_type_idx on monitor_subscriptions(user_id, type);
create unique index if not exists monitor_subscriptions_user_target_idx on monitor_subscriptions(user_id, type, target);

-- ============================================================
-- 创建完成
-- ============================================================
-- 执行 init-data.sql 导入初始数据
