import { getPgPool } from "@/lib/db";
import type { MonitorSourceRecord } from "@/lib/monitor/types";

type MonitorSourceRow = {
  id: string;
  department_name: string;
  channel_group: string | null;
  channel_name: string;
  display_name: string;
  type: string;
  list_url: string;
  enabled: boolean;
  auto_monitor: boolean;
  is_key: boolean;
  start_date: Date | string;
  max_items: number;
  notes: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
};

function mapSourceRow(row: MonitorSourceRow): MonitorSourceRecord {
  const startDate = row.start_date instanceof Date ? row.start_date.toISOString().slice(0, 10) : String(row.start_date).slice(0, 10);
  return {
    id: row.id,
    departmentName: row.department_name,
    channelGroup: row.channel_group ?? null,
    channelName: row.channel_name,
    displayName: row.display_name,
    type: row.type as MonitorSourceRecord["type"],
    listUrl: row.list_url,
    enabled: row.enabled,
    autoMonitor: row.auto_monitor,
    isKey: row.is_key,
    startDate,
    maxItems: row.max_items,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ? (row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)) : undefined,
    updatedAt: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)) : undefined,
  };
}

export async function getMonitorSources() {
  const pool = getPgPool();
  const res = await pool.query<MonitorSourceRow>(
    `select *
     from monitor_sources
     order by department_name asc, channel_name asc, created_at asc`,
  );
  return res.rows.map(mapSourceRow);
}

export async function getAutoMonitorSources() {
  const pool = getPgPool();
  const res = await pool.query<MonitorSourceRow>(
    `select *
     from monitor_sources
     where enabled = true and auto_monitor = true
     order by department_name asc, channel_name asc, created_at asc`,
  );
  return res.rows.map(mapSourceRow);
}

export async function createMonitorSource(input: {
  departmentName: string;
  channelGroup?: string;
  channelName: string;
  type: string;
  listUrl: string;
  displayName?: string;
  enabled?: boolean;
  autoMonitor?: boolean;
  isKey?: boolean;
  startDate: string;
  maxItems: number;
  notes?: string;
}) {
  const pool = getPgPool();
  const id = `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const displayName = input.displayName?.trim() || (input.channelGroup?.trim() ? `${input.departmentName.trim()}·${input.channelGroup.trim()}·${input.channelName.trim()}` : `${input.departmentName.trim()}·${input.channelName.trim()}`);
  await pool.query(
    `insert into monitor_sources (
      id, department_name, channel_group, channel_name, display_name, type, list_url,
      enabled, auto_monitor, is_key, start_date, max_items, notes
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13)`,
    [
      id,
      input.departmentName.trim(),
      input.channelGroup?.trim() || null,
      input.channelName.trim(),
      displayName,
      input.type,
      input.listUrl.trim(),
      input.enabled ?? true,
      input.autoMonitor ?? false,
      input.isKey ?? false,
      input.startDate,
      input.maxItems,
      input.notes?.trim() || null,
    ],
  );
  return id;
}

export async function updateMonitorSource(
  id: string,
  input: {
    departmentName: string;
    channelGroup?: string;
    channelName: string;
    type: string;
    listUrl: string;
    displayName?: string;
    enabled?: boolean;
    autoMonitor?: boolean;
    isKey?: boolean;
    startDate: string;
    maxItems: number;
    notes?: string;
  },
) {
  const pool = getPgPool();
  const displayName = input.displayName?.trim() || (input.channelGroup?.trim() ? `${input.departmentName.trim()}·${input.channelGroup.trim()}·${input.channelName.trim()}` : `${input.departmentName.trim()}·${input.channelName.trim()}`);
  await pool.query(
    `update monitor_sources
     set department_name = $2,
         channel_group = $3,
         channel_name = $4,
         display_name = $5,
         type = $6,
         list_url = $7,
         enabled = $8,
         auto_monitor = $9,
         is_key = $10,
         start_date = $11::date,
         max_items = $12,
         notes = $13,
         updated_at = now()
     where id = $1`,
    [
      id,
      input.departmentName.trim(),
      input.channelGroup?.trim() || null,
      input.channelName.trim(),
      displayName,
      input.type,
      input.listUrl.trim(),
      input.enabled ?? true,
      input.autoMonitor ?? false,
      input.isKey ?? false,
      input.startDate,
      input.maxItems,
      input.notes?.trim() || null,
    ],
  );
}

export async function deleteMonitorSource(id: string, options?: { dryRun?: boolean }) {
  const pool = getPgPool();
  const dryRun = options?.dryRun ?? false;
  const startTime = Date.now();

  const deletedCountsByTable: Record<string, number> = {};
  let deletedSource = false;

  const client = await pool.connect();
  try {
    await client.query("begin");

    const sourceRes = await client.query(
        `select * from monitor_sources where id = $1`,
        [id],
      );
      if ((sourceRes.rowCount ?? 0) > 0) {
        deletedSource = true;
      }

    if (!dryRun) {
      const itemsRes = await client.query(
        `delete from monitor_items where source_id = $1`,
        [id],
      );
      deletedCountsByTable["monitor_items"] = itemsRes.rowCount ?? 0;

      const runRes = await client.query(
        `delete from monitor_runs where id like $1`,
        [`${id}%`],
      );
      deletedCountsByTable["monitor_runs"] = runRes.rowCount ?? 0;

      const sourcesRes = await client.query(
        `delete from monitor_sources where id = $1`,
        [id],
      );
      deletedCountsByTable["monitor_sources"] = sourcesRes.rowCount ?? 0;

      await client.query("commit");
    } else {
      const itemsCount = await client.query(
        `select count(*) as cnt from monitor_items where source_id = $1`,
        [id],
      );
      deletedCountsByTable["monitor_items"] = itemsCount.rows[0]?.cnt ?? 0;

      const sourcesCount = await client.query(
        `select count(*) as cnt from monitor_sources where id = $1`,
        [id],
      );
      deletedCountsByTable["monitor_sources"] = sourcesCount.rows[0]?.cnt ?? 0;

      await client.query("rollback");
    }
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  return {
    deletedSource,
    deletedCountsByTable,
    dryRun,
    durationMs: Date.now() - startTime,
  };
}

export async function deleteDepartmentByName(departmentName: string, options?: { dryRun?: boolean }) {
  const pool = getPgPool();
  const dryRun = options?.dryRun ?? false;
  const startTime = Date.now();

  const deletedCountsByTable: Record<string, number> = {};
  let deletedMinistry = false;

  const client = await pool.connect();
  try {
    await client.query("begin");

    const sourceRes = await client.query(
        `select * from monitor_sources where department_name = $1 limit 1`,
        [departmentName],
      );
      if ((sourceRes.rowCount ?? 0) > 0) {
        deletedMinistry = true;
      }

    if (!dryRun) {
      const itemsRes = await client.query(
        `delete from monitor_items where department_name = $1`,
        [departmentName],
      );
      deletedCountsByTable["monitor_items"] = itemsRes.rowCount ?? 0;

      const sourcesRes = await client.query(
        `delete from monitor_sources where department_name = $1`,
        [departmentName],
      );
      deletedCountsByTable["monitor_sources"] = sourcesRes.rowCount ?? 0;

      const keywordsRes = await client.query(
        `delete from monitor_keywords where department_name = $1`,
        [departmentName],
      );
      deletedCountsByTable["monitor_keywords"] = keywordsRes.rowCount ?? 0;

      await client.query("commit");
    } else {
      const itemsCount = await client.query(
        `select count(*) as cnt from monitor_items where department_name = $1`,
        [departmentName],
      );
      deletedCountsByTable["monitor_items"] = itemsCount.rows[0]?.cnt ?? 0;

      const sourcesCount = await client.query(
        `select count(*) as cnt from monitor_sources where department_name = $1`,
        [departmentName],
      );
      deletedCountsByTable["monitor_sources"] = sourcesCount.rows[0]?.cnt ?? 0;

      const keywordsCount = await client.query(
        `select count(*) as cnt from monitor_keywords where department_name = $1`,
        [departmentName],
      );
      deletedCountsByTable["monitor_keywords"] = keywordsCount.rows[0]?.cnt ?? 0;

      await client.query("rollback");
    }
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  return {
    deletedMinistry,
    deletedCountsByTable,
    dryRun,
    durationMs: Date.now() - startTime,
  };
}

export type DeleteSourceResult = {
  deletedSource: boolean;
  deletedCountsByTable: Record<string, number>;
  dryRun: boolean;
  durationMs: number;
};

export type DeleteDepartmentResult = {
  deletedMinistry: boolean;
  deletedCountsByTable: Record<string, number>;
  dryRun: boolean;
  durationMs: number;
};