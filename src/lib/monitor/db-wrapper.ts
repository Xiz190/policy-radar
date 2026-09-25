import { tryGetPgPool } from "@/lib/db";
import type { MonitorRunRecord, MonitorSourceRecord } from "@/lib/monitor/types";
import type { GroupedInboxSummary } from "@/lib/monitor/db";
import {
  ensureMonitorSchema as ensureMonitorSchemaImpl,
  getLatestRun as getLatestRunImpl,
  getMonitorSources as getMonitorSourcesImpl,
  getInboxSourceCounts as getInboxSourceCountsImpl,
  getDailySeries as getDailySeriesImpl,
  getGroupedInboxSummary as getGroupedInboxSummaryImpl,
} from "@/lib/monitor/db";
import { getSourceItemStats as getSourceItemStatsImpl } from "@/lib/monitor/db/sources";
import {
  getFallbackMonitorSources,
  getFallbackLatestRun,
  getFallbackInboxSourceCounts,
  getFallbackDailySeries,
  getFallbackGroupedInboxSummary,
} from "@/lib/monitor/db-fallback";

let dbChecked = false;
let dbAvailable = true;

async function checkDb(): Promise<boolean> {
  if (dbChecked) return dbAvailable;
  dbChecked = true;
  
  try {
    const pool = await tryGetPgPool();
    dbAvailable = pool !== null;
    return dbAvailable;
  } catch {
    dbAvailable = false;
    return false;
  }
}

export async function ensureMonitorSchema() {
  if (!await checkDb()) {
    console.warn("[db-wrapper] 数据库不可用，跳过 schema 初始化（使用降级模式）");
    return;
  }
  try {
    await ensureMonitorSchemaImpl();
  } catch (err) {
    console.error("[db-wrapper] schema 初始化失败，切换到降级模式:", err);
    dbAvailable = false;
  }
}

export async function getLatestRun(): Promise<MonitorRunRecord | null> {
  if (!await checkDb()) {
    return getFallbackLatestRun();
  }
  try {
    return await getLatestRunImpl();
  } catch (err) {
    console.error("[db-wrapper] getLatestRun 失败，使用降级数据:", err);
    return getFallbackLatestRun();
  }
}

export async function getMonitorSources(): Promise<MonitorSourceRecord[]> {
  if (!await checkDb()) {
    return getFallbackMonitorSources();
  }
  try {
    return await getMonitorSourcesImpl();
  } catch (err) {
    console.error("[db-wrapper] getMonitorSources 失败，使用降级数据:", err);
    return getFallbackMonitorSources();
  }
}

/** 每个来源的条目数与最近入库时间；DB 不可用时返回空表（页面会显示为"无数据"） */
export async function getSourceItemStats(): Promise<Record<string, { totalCount: number; lastSeenAt: string | null }>> {
  if (!await checkDb()) return {};
  try {
    return await getSourceItemStatsImpl();
  } catch (err) {
    console.error("[db-wrapper] getSourceItemStats 失败:", err);
    return {};
  }
}

export async function getInboxSourceCounts() {
  if (!await checkDb()) {
    return getFallbackInboxSourceCounts();
  }
  try {
    return await getInboxSourceCountsImpl();
  } catch (err) {
    console.error("[db-wrapper] getInboxSourceCounts 失败，使用降级数据:", err);
    return getFallbackInboxSourceCounts();
  }
}

export async function getDailySeries(days: number): Promise<Array<{ date: string; count: number; urgent: number; highlight: number }>> {
  if (!await checkDb()) {
    return getFallbackDailySeries(days);
  }
  try {
    return await getDailySeriesImpl(days);
  } catch (err) {
    console.error("[db-wrapper] getDailySeries 失败，使用降级数据:", err);
    return getFallbackDailySeries(days);
  }
}

export async function getGroupedInboxSummary(params?: {
  q?: string;
  onlyUnread?: boolean;
  onlyStarred?: boolean;
  departmentName?: string;
  perChannelLimit?: number;
}): Promise<GroupedInboxSummary[]> {
  if (!await checkDb()) {
    return getFallbackGroupedInboxSummary();
  }
  try {
    return await getGroupedInboxSummaryImpl(params);
  } catch (err) {
    console.error("[db-wrapper] getGroupedInboxSummary 失败，使用降级数据:", err);
    return getFallbackGroupedInboxSummary();
  }
}

export { isDbAvailable } from "@/lib/db";

export type { DeleteSourceResult, DeleteDepartmentResult } from "@/lib/monitor/db";

export {
  insertRunStarted,
  updateRunFinished,
  getAutoMonitorSources,
  createMonitorSource,
  updateMonitorSource,
  deleteMonitorSource,
  deleteDepartmentByName,
  findExistingUrls,
  insertNewItems,
  getInboxItems,
  scanAndApplyKeywords,
  updateItemStructuredDates,
  upsertItemDetail,
  seedDefaultKeywordsIfEmpty,
  ensureMonitorSchema as ensureMonitorSchemaDirect,
} from "@/lib/monitor/db";