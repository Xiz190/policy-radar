import { getPgPool } from "@/lib/db";

export async function ensureP2Schema() {
  const pool = getPgPool();

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

  await pool.query(`create index if not exists analysis_templates_category on analysis_templates(category, is_active);`);
  await pool.query(`create index if not exists chat_logs_session_id on chat_logs(session_id);`);
  await pool.query(`create index if not exists chat_logs_source_url on chat_logs(source_id, item_url);`);
  await pool.query(`create index if not exists chat_logs_created_at on chat_logs(created_at desc);`);
}