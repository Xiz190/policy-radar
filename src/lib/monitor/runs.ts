import { getPgPool } from "@/lib/db";
import type { MonitorRunRecord } from "@/lib/monitor/types";

export async function insertRunStarted(run: MonitorRunRecord) {
  const pool = getPgPool();
  await pool.query(
    `insert into monitor_runs (id, started_at, status) values ($1, $2::timestamptz, $3)`,
    [run.id, run.startedAt, run.status],
  );
}

export async function updateRunFinished(run: MonitorRunRecord) {
  const pool = getPgPool();
  await pool.query(
    `update monitor_runs
     set finished_at = $2::timestamptz,
         status = $3,
         error_message = $4,
         results = $5::jsonb
     where id = $1`,
    [run.id, run.finishedAt ?? null, run.status, run.errorMessage ?? null, JSON.stringify(run.results ?? null)],
  );
}

export async function getLatestRun(): Promise<MonitorRunRecord | null> {
  const pool = getPgPool();
  const res = await pool.query(`select * from monitor_runs order by started_at desc limit 1`);
  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    startedAt: row.started_at?.toISOString?.() ?? String(row.started_at),
    finishedAt: row.finished_at ? (row.finished_at?.toISOString?.() ?? String(row.finished_at)) : undefined,
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    results: row.results ?? undefined,
  };
}