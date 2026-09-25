import { getPgPool } from "@/lib/db";

export async function ensureNotificationSchema() {
  const pool = getPgPool();
  await pool.query(`
    create table if not exists monitor_notification_log (
      id text primary key,
      kind text not null,
      created_at timestamptz not null default now(),
      last_seen_count integer not null default 0,
      last_sent_at timestamptz,
      meta_jsonb jsonb not null default '{}'::jsonb
    )
  `);
  await pool.query(`create index if not exists monitor_notification_kind_idx on monitor_notification_log(kind, created_at desc)`);
}

export async function upsertNotificationState(kind: string, meta: Record<string, unknown>, count: number) {
  const pool = getPgPool();
  const id = `state_${kind}`;
  await pool.query(
    `insert into monitor_notification_log (id, kind, created_at, last_seen_count, last_sent_at, meta_jsonb)
     values ($1, $2, now(), $3, now(), $4::jsonb)
     on conflict (id) do update set
       last_seen_count = excluded.last_seen_count,
       last_sent_at = now(),
       meta_jsonb = excluded.meta_jsonb`,
    [id, kind, count, JSON.stringify(meta)],
  );
}

export async function getLastNotificationState(kind: string) {
  const pool = getPgPool();
  const res = await pool.query<{ last_sent_at: string | null; last_seen_count: string; meta_jsonb: string }>(
    `select last_sent_at::text as last_sent_at, last_seen_count::text, meta_jsonb::text as meta_jsonb
     from monitor_notification_log
     where id = $1`,
    [`state_${kind}`],
  );
  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  return {
    lastSentAt: row.last_sent_at,
    lastSeenCount: Number(row.last_seen_count),
    meta: (() => {
      try {
        return JSON.parse(row.meta_jsonb || "{}");
      } catch {
        return {};
      }
    })(),
  };
}