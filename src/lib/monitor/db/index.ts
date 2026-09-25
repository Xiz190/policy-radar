export { getPgPool } from "@/lib/db";

export {
  SCHEMA_ENSURE_TTL_MS,
  SOURCES_SYNC_TTL_MS,
  COUNT_CACHE_TTL_MS,
  getCountCacheKey,
} from "@/lib/monitor/db/utils";

export {
  ensureMonitorSchema,
  seedDefaultKeywordsIfEmpty,
} from "@/lib/monitor/db/schema";

export { normalizeItemUrl } from "@/lib/monitor/utils";

export {
  insertRunStarted,
  updateRunFinished,
  getLatestRun,
  getRecentRuns,
} from "./runs";

export {
  getMonitorSources,
  getAutoMonitorSources,
  createMonitorSource,
  updateMonitorSource,
  deleteMonitorSource,
  deleteDepartmentByName,
  type DeleteSourceResult,
  type DeleteDepartmentResult,
} from "./sources";

export {
  findExistingUrls,
  insertNewItems,
  type MonitorInboxItemRow,
} from "./items";

export {
  getInboxItems,
  getInboxSourceCounts,
  type GroupedInboxChannelItem,
  type GroupedInboxSummary,
  getGroupedInboxSummary,
  getInboxItemsByFilter,
  setItemRead,
  setItemStarred,
  markAllReadByDepartment,
} from "./inbox";

export {
  getSourcesTree,
  getCategoriesWithCounts,
  getGenresWithCounts,
} from "./categories";

export {
  type DailySeriesRow,
  getDailySeries,
  getByDepartment,
  getByChannel,
  signalPush,
  getLastPushSignal,
  type DailySummaryData,
  getDailySummaryData,
  type BatchFilter,
  batchUpdateItems,
  getUrgentUnreadCount,
  getDailyTopItems,
} from "./analytics";

export {
  ensureNotificationSchema,
  upsertNotificationState,
  getLastNotificationState,
} from "./notifications";

export {
  getDepartmentNamesWithItems,
  type MonitorItemDetail,
  getItemDetailBySourceAndUrl,
  getItemDetailBySourceId,
  type ForecastItem,
  getForecastItems,
  type ChannelSectionItem,
  getItemsByDepartmentAndChannel,
  getRelatedItemsByItem,
  getSameTopicItems,
  getLatestItemsByDepartment,
  upsertItemDetail,
  type StructuredDates,
  updateItemStructuredDates,
} from "./detail";

export {
  type MonitorKeywordRow,
  getKeywordsByDepartment,
  getDomainKeywords,
  isReservedDepartmentKey,
  getAllDepartments,
  getGlobalKeywords,
  getAllKeywordsGrouped,
  upsertKeyword,
  deleteKeywordById,
  deleteKeywordByText,
} from "./keywords";

export {
  type SubscriptionRecord,
  getSubscriptionsByUser,
  getSubscriptionsByType,
  upsertSubscription,
  deleteSubscription,
  deleteSubscriptionByTarget,
  toggleSubscription,
} from "./subscriptions";

export {
  scanAndApplyKeywords,
  scanAndApplyGenres,
  rescanAllGenres,
  rescanKeywordsOnItems,
  getRecentKeywordHits,
} from "./scanner";

export {
  getDepartmentUpdateStats,
  getImportanceDistribution,
  getSignalTrend,
  getTopKeywords,
  getDashboardSummary,
} from "./dashboard";

export {
  type SourceGroupItem,
  getSourceDirectory,
  type SourceChannelStat,
  type SourceDailySeries,
  type SourceCategoryCount,
  type SourceGroupDetail,
  getSourceGroupDetail,
  type SourceTopItem,
  getSourceTopItems,
} from "./source-groups";
