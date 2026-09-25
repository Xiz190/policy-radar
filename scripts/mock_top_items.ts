import { readFileSync } from "fs";
import { join } from "path";

export type TopItem = {
  sourceId: string;
  departmentName: string;
  channelName: string;
  title: string;
  url: string;
  listPublishedAt: string;
  firstSeenAt: string;
  importanceLevel: string;
  keywordScore: number;
  categories: Array<{ category: string; score: number; topKeywords?: string[] }>;
  hasFunding: boolean;
  hasProcurement: boolean;
  hasPilot: boolean;
  hasStandards: boolean;
  isStarred: boolean;
};

export function getMockTopItems(): TopItem[] {
  const filePath = join(__dirname, "mock_top_items.json");
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as TopItem[];
}

export function getMockDailySummaryData() {
  const items = getMockTopItems();
  return {
    date: new Date().toISOString().slice(0, 10),
    sinceHours: 24,
    urgentCount: items.filter((i) => i.importanceLevel === "核心关注").length,
    dailySeries: [
      { date: "2026-06-20", count: 5, urgent: 1, highlight: 2 },
      { date: "2026-06-21", count: 8, urgent: 2, highlight: 3 },
      { date: "2026-06-22", count: 3, urgent: 0, highlight: 1 },
      { date: "2026-06-23", count: 6, urgent: 1, highlight: 2 },
      { date: "2026-06-24", count: 4, urgent: 0, highlight: 1 },
      { date: "2026-06-25", count: 7, urgent: 1, highlight: 2 },
      { date: "2026-06-26", count: 10, urgent: 2, highlight: 3 },
    ],
    departmentStats: [
      { departmentName: "工业和信息化部", todayCount: 3, last7DaysCount: 15, urgentCount: 2, highlightCount: 3, totalCount: 45, channelCount: 5 },
      { departmentName: "财政部", todayCount: 2, last7DaysCount: 8, urgentCount: 1, highlightCount: 2, totalCount: 25, channelCount: 3 },
      { departmentName: "国家互联网信息办公室", todayCount: 1, last7DaysCount: 6, urgentCount: 1, highlightCount: 2, totalCount: 20, channelCount: 4 },
      { departmentName: "北京市人民政府", todayCount: 2, last7DaysCount: 10, urgentCount: 0, highlightCount: 1, totalCount: 30, channelCount: 6 },
    ],
    topItems: items,
  };
}