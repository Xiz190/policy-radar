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
    `update monitor_runs set finished_at = $2::timestamptz, status = $3, error_message = $4, results = $5 where id = $1`,
    [
      run.id,
      run.finishedAt,
      run.status,
      run.errorMessage,
      run.results ? JSON.stringify(run.results) : null,
    ],
  );
}

export async function getLatestRun(): Promise<MonitorRunRecord | null> {
  const pool = getPgPool();
  const res = await pool.query(
    `select id, started_at, finished_at, status, error_message, results from monitor_runs order by started_at desc limit 1`,
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at),
    finishedAt: row.finished_at ? (row.finished_at instanceof Date ? row.finished_at.toISOString() : String(row.finished_at)) : undefined,
    status: row.status as MonitorRunRecord["status"],
    errorMessage: row.error_message ?? undefined,
    results: row.results ?? undefined,
  };
}

export async function getRecentRuns(limit = 12): Promise<MonitorRunRecord[]> {
  const pool = getPgPool();
  const res = await pool.query(
    `select id, started_at, finished_at, status, error_message, results from monitor_runs order by started_at desc limit $1`,
    [limit],
  );
  return res.rows.map((row) => ({
    id: row.id,
    startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at),
    finishedAt: row.finished_at ? (row.finished_at instanceof Date ? row.finished_at.toISOString() : String(row.finished_at)) : undefined,
    status: row.status as MonitorRunRecord["status"],
    errorMessage: row.error_message ?? undefined,
    results: row.results ?? undefined,
  }));
}