import crypto from "node:crypto";
import { getPgPool } from "@/lib/db";
import type {
  MonitorListItem,
  MonitorRunRecord,
  MonitorSourceConfig,
  MonitorSourceRunResult,
} from "@/lib/monitor/types";
import { fetchMctSzywLatest } from "@/lib/monitor/mct-szyw-list";
import { fetchMctZwgkGenreLatest } from "@/lib/monitor/mct-zwgk-list";
import { fetchMofZhengwuxinxiLatest } from "@/lib/monitor/mof-zhengwuxinxi-list";
import { fetchBeijingGovListLatest } from "@/lib/monitor/beijing-gov-list";
import {
  fetchGovcnYaowen,
  fetchGovcnZuixin,
  fetchGovcnZhongyang,
} from "@/lib/monitor/govcn-list";
import { fetchMotListLatest } from "@/lib/monitor/mot-list";
import { fetchMwrListLatest } from "@/lib/monitor/mwr-list";
import { fetchTobaccoListLatest } from "@/lib/monitor/tobacco-list";
import { fetchGenericGovernmentListLatest } from "@/lib/monitor/generic-government-list";
import { fetchMiitListLatest } from "@/lib/monitor/miit-list";
import { fetchCacColumnLatest } from "@/lib/monitor/cac-list";
import { fetchNcacColumnLatest } from "@/lib/monitor/ncac-list";
import { captureDetailPage } from "@/lib/monitor/detail";
import {
  ensureMonitorSchema,
  findExistingUrls,
  getAutoMonitorSources,
  getDomainKeywords,
  getLatestRun,
  getMonitorSources,
  insertNewItems,
  insertRunStarted,
  normalizeItemUrl,
  scanAndApplyKeywords,
  updateItemStructuredDates,
  updateRunFinished,
  upsertItemDetail,
} from "@/lib/monitor/db";

function nowIso() {
  return new Date().toISOString();
}

function newRunId() {
  return crypto.randomUUID();
}

function resolveListItems(source: MonitorSourceConfig, limit: number): Promise<MonitorListItem[]> {
  const t = String(source.type || "").trim().toLowerCase();
  if (t === "mct_szyw") {
    return fetchMctSzywLatest(limit);
  }
  if (t === "mct_zwgk_genre") {
    return fetchMctZwgkGenreLatest(source.listUrl, limit);
  }
  if (t === "mof_zhengwuxinxi" || t === "govcn_shizheng") {
    return fetchMofZhengwuxinxiLatest(source.listUrl, limit);
  }
  // 北京市财政局栏目列表（通用 HTML 列表页，走通用抓取器）
  if (t === "bjczj_list") {
    return fetchMofZhengwuxinxiLatest(source.listUrl, limit);
  }
  // 北京市人民政府（www.beijing.gov.cn）新闻/政策/专题 各栏目
  if (t === "beijing_gov_list") {
    return fetchBeijingGovListLatest(source.listUrl, limit);
  }
  // 国务院/中国政府网 JSON 栏目（列表页通过 xxx.json 返回数据）
  if (t === "govcn_yaowen") return fetchGovcnYaowen(limit);
  if (t === "govcn_zuixin") return fetchGovcnZuixin(limit);
  if (t === "govcn_zhongyang") return fetchGovcnZhongyang(limit);

  // —— 以下为新增 6 个部委的抓取入口 ——
  // 交通运输部：主站各新闻栏目 + 数据发布 + 政策解读 + 新闻发布会
  if (t === "mot_list") return fetchMotListLatest(source.listUrl, limit);
  // 规章 / 行政规范性文件（xxgk.mot.gov.cn）
  if (t === "mot_gk_genre") return fetchMotListLatest(source.listUrl, limit);

  // 水利部：主站各新闻/政务栏目 + 政策法规/政策解读/在线访谈/公示/公报 等
  if (t === "mwr_list") return fetchMwrListLatest(source.listUrl, limit);
  // spjc.mwr.gov.cn：通知公告、政策法规、行政法规、部门规章、规范性文件、政策解读
  if (t === "mwr_spjc_list") return fetchMwrListLatest(source.listUrl, limit);

  // 国家烟草专卖局
  if (t === "tobacco_list") return fetchTobaccoListLatest(source.listUrl, limit);

  // 国家林业和草原局
  if (t === "forestry_list") return fetchGenericGovernmentListLatest(source.listUrl, limit);

  // 中华人民共和国生态环境部
  if (t === "mee_list") return fetchGenericGovernmentListLatest(source.listUrl, limit);

  // 北京市交通委员会
  if (t === "beijing_jtw_list") return fetchGenericGovernmentListLatest(source.listUrl, limit);

  // 中华人民共和国工业和信息化部
  if (t === "miit_list") return fetchMiitListLatest(source.listUrl, limit);

  // 国家互联网信息办公室（www.cac.gov.cn）各栏目（政策法规等，AI/数字治理法规主源）
  if (t === "cac_list") return fetchCacColumnLatest(source.listUrl, limit);

  // 国家版权局（www.ncac.gov.cn）各栏目（通知公告/要闻/法律法规，版权监管主源）
  if (t === "ncac_list") return fetchNcacColumnLatest(source.listUrl, limit);

  // 中华人民共和国教育部（使用通用政府列表抓取器）
  if (t === "moe_list") return fetchGenericGovernmentListLatest(source.listUrl, limit);

  // 通用列表类型（用于结构标准的政府网站，如国家税务总局）
  if (t === "generic_list") return fetchGenericGovernmentListLatest(source.listUrl, limit);

  // 丰台区人民政府各栏目（北京市郊区政府统一风格 HTML 列表页）
  if (t === "bjft_list") return fetchBeijingGovListLatest(source.listUrl, limit);

  // 大兴区人民政府各栏目（北京市郊区政府统一风格 HTML 列表页）
  if (t === "bjdx_list") return fetchBeijingGovListLatest(source.listUrl, limit);

  // 通用回退：使用"财政部/国务院时政要闻"风格的抓取器
  return fetchMofZhengwuxinxiLatest(source.listUrl, limit);
}

// 对 listPublishedAt 做宽松解析（详情同上）
function normalizeDateForDb(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const cn = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (cn) return `${cn[1]}-${String(cn[2]).padStart(2, "0")}-${String(cn[3]).padStart(2, "0")}`;
  const slash = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})/);
  if (slash) return `${slash[1]}-${String(slash[2]).padStart(2, "0")}-${String(slash[3]).padStart(2, "0")}`;
  const ym = s.match(/^(\d{4})-(\d{1,2})$/);
  if (ym) return `${ym[1]}-${String(ym[2]).padStart(2, "0")}-01`;
  const yonly = s.match(/^(\d{4})$/);
  if (yonly) return `${yonly[1]}-01-01`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    if (y >= 2000 && y <= new Date().getUTCFullYear() + 1) {
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  return null;
}
function normalizeChineseDate(text: string): string | null {
  // 匹配 "2024 年 3 月 15 日"、"2024年3月15日"、"2024-03-15"、"2024/3/15"
  const t = String(text).replace(/\s+/g, "").trim();
  const patterns: Array<{ re: RegExp; format: (m: RegExpMatchArray) => string | null }> = [
    {
      re: /(\d{4})年(\d{1,2})月(\d{1,2})日/,
      format: (m) => `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`,
    },
    {
      re: /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
      format: (m) => `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`,
    },
  ];
  for (const { re, format } of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const date = format(m);
    if (!date) continue;
    // 基本合法性校验
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const parsed = new Date(date + "T00:00:00Z");
    if (Number.isNaN(parsed.getTime())) continue;
    return date;
  }
  return null;
}

export type ExtractedDates = {
  effectiveFrom: string | null;
  effectiveTo: string | null;
  deadlineDate: string | null;
  allMatches: Array<{ type: string; date: string; raw: string }>;
};

export function extractStructuredDates(paragraphs: string[]): ExtractedDates {
  const result: ExtractedDates = { effectiveFrom: null, effectiveTo: null, deadlineDate: null, allMatches: [] };
  if (!Array.isArray(paragraphs)) return result;
  const blocks: Array<{ type: "effective_from" | "effective_to" | "deadline"; test: (text: string) => boolean }> = [
    {
      type: "effective_from",
      test: (text) =>
        /(?:自|从|本办法自|本规定自|本通知自|本方案自|本意见自|本决定自|施行日期：?|自发布之日起|起施行|起实施|起开始)/.test(text) &&
        /\d{4}[-年/\s]/.test(text),
    },
    {
      type: "deadline",
      test: (text) =>
        /(?:截止(?:日期)?[:：]?|至\d{4}[-年]?\d{1,2}[-月]?\d{1,2}日截止|受理截止|申报截止|截止时间)/.test(text),
    },
    {
      type: "effective_to",
      test: (text) => /(?:有效期至|有效期为|至\d{4}[-年]?\d{1,2}[-月]?\d{1,2}日止|至\d{4}[-年]?\d{1,2}[-月]?\d{1,2}日为止)/.test(text),
    },
  ];
  // 单独匹配"发布日期：YYYY-MM-DD"
  const publishedPattern = /发布(?:日期|时间)?\s*[:：]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}(?:日)?)/;
  for (const p of paragraphs) {
    if (!p || typeof p !== "string") continue;
    // 发布日期单独走
    const pubMatch = p.match(publishedPattern);
    if (pubMatch && pubMatch[1]) {
      const date = normalizeChineseDate(pubMatch[1]);
      if (date) result.allMatches.push({ type: "published", date, raw: pubMatch[0] });
    }
    for (const block of blocks) {
      if (!block.test(p)) continue;
      // 在段落内按句切分，避免"自2024年1月1日起施行，至2026年12月31日截止"被混匹配
      const sentences = p.split(/[。；;]/).map((s) => s.trim()).filter(Boolean);
      for (const s of sentences) {
        if (!block.test(s)) continue;
        const date = normalizeChineseDate(s);
        if (!date) continue;
        result.allMatches.push({ type: block.type, date, raw: s.slice(0, 80) });
        if (block.type === "effective_from" && !result.effectiveFrom) result.effectiveFrom = date;
        if (block.type === "deadline" && !result.deadlineDate) result.deadlineDate = date;
        if (block.type === "effective_to" && !result.effectiveTo) result.effectiveTo = date;
      }
    }
  }
  return result;
}

export type RunMonitorOptions = {
  scope?: {
    sourceIds?: string[];
    departmentNames?: string[];
  };
  // 当有明确 scope 时，是否绕过全局互斥锁（默认 true：手动跑特定部委/栏目时不被自动监测阻挡）
  // 当没有 scope（跑全部自动监测来源）时，强制走互斥锁，避免重复全量扫描
  bypassLockWhenScoped?: boolean;
};

export async function runMonitorOnce(options: RunMonitorOptions = {}) {
  await ensureMonitorSchema();

  const hasScope =
    Array.isArray(options.scope?.sourceIds) ||
    Array.isArray(options.scope?.departmentNames);
  const bypassLock = hasScope && (options.bypassLockWhenScoped ?? true);

  // —— 数据库级互斥锁：同一时刻只允许一个 "全局/无scope" 任务在跑
  //    带 scope 的手动触发（如单独跑某部委、某几个栏目）默认绕过锁，避免被自动监测阻挡
  // 1) 清理"僵尸锁"：超过 LOCK_TIMEOUT_MIN 仍为 running 的锁记录
  // 2) 用一个"特殊 lock 记录"做原子化 acquire：INSERT ... ON CONFLICT DO NOTHING
  // 3) 无论任务成功/失败/异常，在 finally 中都会删除锁记录

  // —— 可调参数：锁超时时间（分钟）
  const LOCK_TIMEOUT_MIN = 5;

  const pool = getPgPool();
  const lockId = "__active_run_lock__";

  try {
    await pool.query(
      `update monitor_runs set status = 'stale', error_message = '被标记为僵尸任务：超过 ' || $1::text || ' 分钟未结束', finished_at = now() where status = 'running' and started_at < now() - $2 * interval '1 minute' and id <> $3`,
      [String(LOCK_TIMEOUT_MIN), LOCK_TIMEOUT_MIN, lockId],
    );
    await pool.query(
      `delete from monitor_runs where id = $1 and started_at < now() - $2 * interval '1 minute'`,
      [lockId, LOCK_TIMEOUT_MIN],
    );
  } catch (err) {
    console.debug("[runner] 清理僵尸锁 SQL 失败（表可能尚未建好）：",
      err instanceof Error ? err.message : String(err));
  }

  const nowTs = nowIso();
  let acquired = bypassLock; // 带 scope 默认视为"已获取锁"
  if (!acquired) {
    try {
      const r = await pool.query(
        `insert into monitor_runs (id, started_at, status) values ($1, $2::timestamptz, 'running') on conflict (id) do nothing`,
        [lockId, nowTs],
      );
      acquired = (r.rowCount ?? 0) > 0;
    } catch (err) {
      console.debug("[runner] 获取互斥锁时 SQL 异常，标记为已获得以避免阻塞：",
        err instanceof Error ? err.message : String(err));
      acquired = true;
    }

    // 二次保护：无 scope 但获取锁失败时，若锁记录已超时也强制抢占
    if (!acquired) {
      try {
        const stale = await pool.query(
          `select id, started_at from monitor_runs where id = $1 and started_at < now() - $2 * interval '1 minute'`,
          [lockId, LOCK_TIMEOUT_MIN],
        );
        if (stale.rows.length > 0) {
          await pool.query(`delete from monitor_runs where id = $1`, [lockId]);
          const r2 = await pool.query(
            `insert into monitor_runs (id, started_at, status) values ($1, $2::timestamptz, 'running') on conflict (id) do nothing`,
            [lockId, nowIso()],
          );
          acquired = (r2.rowCount ?? 0) > 0;
        }
      } catch (err) {
        console.debug("[runner] 抢占超时锁失败：",
          err instanceof Error ? err.message : String(err));
      }
    }
  }

  if (!acquired) {
    const skipped: MonitorRunRecord = {
      id: `skipped-${Date.now()}`,
      startedAt: nowTs,
      finishedAt: nowTs,
      status: "success",
      errorMessage: `检测到另一个监控任务正在运行，本次调用被跳过（数据库级互斥锁，锁超时 ${LOCK_TIMEOUT_MIN} 分钟）。如需立即运行，请等待几分钟后重试，或手动执行 SQL：delete from monitor_runs where id='${lockId}'；若只想跑特定部委/栏目，使用页面"按部委多选"或各部委的"监测该部委"按钮可直接绕过锁。`,
      results: [],
    };
    return skipped;
  }

  const run: MonitorRunRecord = {
    id: newRunId(),
    startedAt: nowTs,
    status: "running",
  };

  try {
    await insertRunStarted(run);
  } catch (err) {
    console.debug("[runner] 记录 run 起始状态失败（不阻塞）：",
      err instanceof Error ? err.message : String(err));
  }

  let enabledSources: MonitorSourceConfig[] = [];
  const allSources = await getMonitorSources();

  if (options.scope && (options.scope.sourceIds || options.scope.departmentNames)) {
    const ids = new Set(options.scope.sourceIds ?? []);
    const names = new Set((options.scope.departmentNames ?? []).map((s) => s.trim()));
    enabledSources = allSources.filter(
      (s) => s.enabled && (ids.has(s.id) || names.has(s.departmentName ?? "")),
    );
  } else {
    enabledSources = await getAutoMonitorSources();
  }

  // 领域主题门槛：标题须命中 __domain__ 词表至少一个词才入库（空表=不过滤，保持旧行为）。
  // 每次 run 加载一次；换领域只改这张词表，不改代码。
  const domainKeywords = await getDomainKeywords();
  const passesDomainGate = (title: string | null | undefined) => {
    if (domainKeywords.length === 0) return true;
    const t = (title ?? "").toLowerCase();
    return domainKeywords.some((k) => t.includes(k));
  };

  const results: MonitorSourceRunResult[] = [];

  // 任务跑完或异常退出时，都把 lock 记录清掉（放在 finally 中保证执行）
  // 注意：只有真正"拿到过锁"（非 bypassLock 且 确实 INSERT 成功）的任务才会去删锁，
  //       避免手动跑特定部委时把同时在跑的自动监测的锁给误删
  const reallyHeldLock = acquired && !bypassLock;
  const releaseLock = async () => {
    if (!reallyHeldLock) return;
    try {
      await pool.query(`delete from monitor_runs where id = $1`, [lockId]);
    } catch (err) {
      console.debug("[runner] 释放互斥锁失败：",
        err instanceof Error ? err.message : String(err));
    }
  };

  try {
    for (const source of enabledSources) {
      const result: MonitorSourceRunResult = {
        sourceId: source.id,
        displayName: source.displayName,
        listUrl: source.listUrl,
        status: "success",
        scannedCount: 0,
        visibleCount: 0,
        newCount: 0,
        newestItems: [],
        newItems: [],
      };

      try {
        const rawItems = await resolveListItems(source, Math.max(30, source.maxItems * 3));
        // —— URL 规范化：避免 utm_ 等参数差异导致同一条目重复入库
        const normalizedRawItems = rawItems.map((item) => ({
          ...item,
          url: normalizeItemUrl(item.url),
        }));
        result.scannedCount = normalizedRawItems.length;

        // 1) 对 listPublishedAt 做宽松归一化：中文日期 / 不完整日期做归一化
        //    · 若解析失败（为空字符串）: 丢弃
        //    · 若早于 source.startDate: 丢弃
        //    · 并把归一化后的值写回 item.listPublishedAt（DB 存的就是 YYYY-MM-DD）
        const visibleItems = normalizedRawItems
          .flatMap((item) => {
            const n = normalizeDateForDb(item.listPublishedAt);
            if (!n || n < source.startDate) return [];
            // 领域主题门槛：标题未命中 __domain__ 词表则不入库（滤掉人事/采购/时政等杂务）
            if (!passesDomainGate(item.title)) return [];
            return [{ ...item, listPublishedAt: n }];
          })
          .slice(0, source.maxItems);

        result.visibleCount = visibleItems.length;
        result.newestItems = visibleItems;

        const existing = await findExistingUrls(source.id, visibleItems.map((i) => i.url));
        const newlyFound = visibleItems.filter((item) => !existing.has(item.url));

        const firstSeenAt = nowIso();
        await insertNewItems(source.id, firstSeenAt, newlyFound);

        for (const item of newlyFound) {
          try {
            const detail = await captureDetailPage(item.url);
            await upsertItemDetail(source.id, item.url, {
              pageTitle: detail.pageTitle,
              paragraphs: detail.paragraphs,
              attachments: detail.attachments.map((a) => ({ url: a.url, text: a.text, kind: a.kind })),
              externalLinks: (detail.externalLinks ?? []).map((l) => ({ text: l.text, url: l.url })),
              contentQuality: detail.contentQuality,
              captureNote: detail.captureNote,
              capturedAtIso: nowIso(),
            });
            // 结构化日期抽取
            try {
              const dates = extractStructuredDates(detail.paragraphs ?? []);
              if (dates.effectiveFrom || dates.effectiveTo || dates.deadlineDate || dates.allMatches.length > 0) {
                await updateItemStructuredDates(source.id, item.url, dates);
              }
            } catch {
              // 日期抽取失败不阻塞主流程
            }
          } catch {
            await upsertItemDetail(source.id, item.url, {
              pageTitle: null,
              paragraphs: [],
              attachments: [],
              externalLinks: [],
              contentQuality: "empty",
              captureNote: "正文抓取异常，建议打开原网址查看。",
              capturedAtIso: nowIso(),
            });
          }
          try {
            await scanAndApplyKeywords(source.id, item.url);
          } catch (err) {
            console.debug(`[runner] 关键词扫描失败（${source.id} ${item.url}）：`,
              err instanceof Error ? err.message : String(err));
          }
        }

        // 对已经存在但本次又出现在 visibleItems 的文章，也重扫关键词（词库升级后也能看到新标签）
        for (const item of visibleItems) {
          if (existing.has(item.url)) {
            try {
              await scanAndApplyKeywords(source.id, item.url);
            } catch (err) {
              console.debug(`[runner] 补扫关键词失败（${source.id} ${item.url}）：`,
                err instanceof Error ? err.message : String(err));
            }
          }
        }

        result.newItems = newlyFound.map((item) => ({ ...item, firstSeenAt }));
        result.newCount = result.newItems.length;
      } catch (error) {
        result.status = "error";
        result.errorMessage = error instanceof Error ? error.message : String(error);
      }

      results.push(result);
    }

    run.status = "success";
    run.finishedAt = nowIso();
    run.results = results;
    await updateRunFinished(run);
    return run;
  } catch (error) {
    run.status = "error";
    run.finishedAt = nowIso();
    run.errorMessage = error instanceof Error ? error.message : String(error);
    await updateRunFinished(run);
    return run;
  } finally {
    // 无论成功/失败/异常，确保锁被释放，否则下次永远无法获取锁
    await releaseLock();
  }
}

export async function getMonitorStatus() {
  await ensureMonitorSchema();
  return await getLatestRun();
}
