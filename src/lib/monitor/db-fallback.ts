import type { MonitorRunRecord, MonitorSourceRecord } from "@/lib/monitor/types";
import type { GroupedInboxSummary } from "@/lib/monitor/db";

export const fallbackSources: MonitorSourceRecord[] = [];

export const fallbackRunRecord: MonitorRunRecord = {
  id: "fallback-run-001",
  startedAt: new Date(Date.now() - 3600000).toISOString(),
  finishedAt: new Date(Date.now() - 3500000).toISOString(),
  status: "success",
  errorMessage: undefined,
  results: [],
};

export const fallbackInboxSourceCounts: Array<{ sourceId: string; count: number; unread: number; starred: number }> = [];

export const fallbackDailySeries = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toISOString().split("T")[0],
    count: 0,
    urgent: 0,
    highlight: 0,
  };
});

export async function getFallbackMonitorSources(): Promise<MonitorSourceRecord[]> {
  return fallbackSources;
}

export async function getFallbackLatestRun(): Promise<MonitorRunRecord | null> {
  return fallbackRunRecord;
}

export async function getFallbackInboxSourceCounts() {
  return fallbackInboxSourceCounts;
}

export async function getFallbackDailySeries(days: number) {
  return fallbackDailySeries.slice(-days);
}

export async function getFallbackGroupedInboxSummary(): Promise<GroupedInboxSummary[]> {
  return [];
}
