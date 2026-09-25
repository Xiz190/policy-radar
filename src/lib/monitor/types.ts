// 共享数据类型定义（无任何服务器/数据库依赖，可安全导入到 Client Component 中）
// 所有类型都只定义数据形状，不包含任何运行时代码

export type SourceLanguage = "zh" | "en" | "both";
export type SourceRegion = "domestic" | "global";
export type SourceContentCategory =
  | "policy"
  | "notice"
  | "regulation"
  | "procurement"
  | "general";

export const SOURCE_LANGUAGE_LABELS: Record<SourceLanguage, string> = {
  zh: "中文",
  en: "英文",
  both: "双语",
};
export const SOURCE_REGION_LABELS: Record<SourceRegion, string> = {
  domestic: "国内",
  global: "全球",
};
export const SOURCE_CATEGORY_LABELS: Record<SourceContentCategory, string> = {
  policy: "政策法规",
  notice: "通知公告",
  regulation: "行政规范",
  procurement: "招标采购",
  general: "综合",
};

// —— 监测源配置（config 层使用，同时用于 UI 显示）
export type MonitorSourceConfig = {
  id: string;
  enabled: boolean;
  autoMonitor: boolean;
  isKey: boolean;
  type: string;
  departmentName: string;
  channelGroup?: string | null;
  channelName: string;
  displayName: string;
  listUrl: string;
  startDate: string;
  maxItems: number;
  notes?: string;
  language?: SourceLanguage;
  region?: SourceRegion;
  contentCategory?: SourceContentCategory;
};

// —— 监测源类型（新增来源时在此扩展）
export type MonitorSourceType =
  | "mct_szyw"
  | "mct_zwgk_genre"
  | "mof_zhengwuxinxi"
  | "govcn_shizheng"
  | "govcn_yaowen"
  | "govcn_zhongyang"
  | "beijing_gov_toutiao"
  | "beijing_gov_zfxxgk"
  | "mot_list"
  | "mot_gk_genre"
  | "mwr_list"
  | "mwr_spjc_list"
  | "tobacco_list"
  | "forestry_list"
  | "mee_list"
  | "beijing_jtw_list"
  | "moe_list"
  | "generic_list"
  | string; // 允许自定义类型，runner.ts 的 switch 负责分发

export type MonitorSourceRecord = {
  id: string;
  departmentName: string;
  channelGroup: string | null;
  channelName: string;
  displayName: string;
  type: MonitorSourceType;
  listUrl: string;
  enabled: boolean;
  autoMonitor: boolean;
  isKey: boolean;
  startDate: string;
  maxItems: number;
  notes?: string;
  language?: SourceLanguage;
  region?: SourceRegion;
  contentCategory?: SourceContentCategory;
  createdAt?: string;
  updatedAt?: string;
  itemStats?: { totalCount: number; lastSeenAt: string | null };
};

// —— 从列表页抓取到的单个条目（结构化前的数据）
export type MonitorListItem = {
  title: string;
  url: string;
  listPublishedAt: string;
  // 首次发现时间（列表抓取时可不提供；由 runner 发现"新"条目时补上）
  firstSeenAt?: string;
};

// —— 一次 source 的抓取结果（用于 UI 显示 "本次抓到多少条" 等）
export type MonitorSourceRunResult = {
  sourceId: string;
  displayName: string;
  listUrl: string;
  status: "success" | "error";
  scannedCount: number;
  visibleCount: number;
  newCount: number;
  newItems: MonitorListItem[];
  newestItems: MonitorListItem[];
  errorMessage?: string;
};

// —— 一次完整监测运行的记录（写入 monitor_runs 表，也给 UI 显示状态）
export type MonitorRunRecord = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "error";
  errorMessage?: string;
  results?: MonitorSourceRunResult[];
};

// —— 监测任务运行状态（本地落盘 state.json，用于去重和记录最后运行时间）
export type MonitorState = {
  seenUrlsBySource: Record<string, string[]>;
  lastRun?: string;
};

// ================ 预估中心用：获取有信号/预估的条目 ================
export type ForecastItem = {
  sourceId: string;
  url: string;
  finalUrl?: string | null;
  title: string;
  summary: string | null;
  listPublishedAt: string;
  firstSeenAt: string;
  departmentName: string;
  channelName: string;
  displayName: string;
  importanceLevel: string;
  keywordScore: number;
  documentStatus: string | null;
  hasFunding: boolean;
  hasProcurement: boolean;
  hasPilot: boolean;
  hasStandards: boolean;
  forecastHigh: string | null;
  forecastMidHigh: string | null;
  forecastMid: string | null;
  forecastLow: string | null;
  forecastNotes: string | null;
  forecastSources: Array<{ title: string; url: string; note?: string }> | null;
  forecastUpdatedAt: string | null;
  topCategories: Array<{ category: string; score: number }>;
};

export type ForecastStats = {
  forecast: number;
  signal: number;
  funding: number;
  procurement: number;
  pilot: number;
  standards: number;
};

export type ForecastSource = {
  title: string;
  url: string;
  note?: string;
};

export type ForecastFilter =
  | "all"
  | "forecast"
  | "signal"
  | "funding"
  | "procurement"
  | "pilot"
  | "standards";
