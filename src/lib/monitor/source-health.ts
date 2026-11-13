/**
 * 来源健康检查：每次定时抓取后，用 monitor_runs 里最近几轮的逐来源结果判断哪些来源坏了。
 *
 * 为什么需要：单个来源出错或"悄悄变成 0"不会让整轮抓取失败，Actions 一直是绿的、不发邮件。
 * 2026-10-28 起 Suno 博客改版、解析器连续 18 轮"扫描 0"，就是这样一周没人发现。
 *
 * 两条规则（只看最近一轮仍在抓的来源）：
 * - 连续出错：最近 ERROR_STREAK 轮都是 error → 告警（偶发 fetch failed 不算）
 * - 悄悄变 0：最近连续若干轮成功但扫描 0，且已持续 ZERO_HOURS 小时以上 → 告警。
 *   正常来源没新文章时"新增"是 0，但列表页"扫描"不会是 0；扫描 0 基本等于页面结构变了。
 *   出错的轮次不打断也不计入这个连续段（被拒一次不代表恢复了）。
 *   若这个来源在记录里从没扫到过任何条目，只记为警告、不告警——那是老问题，不是新故障，
 *   否则每轮都会重复发同一封邮件。
 */

export const ERROR_STREAK = 3;
export const ZERO_STREAK = 3;
export const ZERO_HOURS = 72;

export type HealthRun = {
  startedAt: string;
  results: { sourceId: string; displayName: string; status: string; scannedCount: number; errorMessage?: string }[];
};

export type HealthIssue = {
  sourceId: string;
  displayName: string;
  level: "alert" | "warning";
  reason: string;
};

/** runs 按时间倒序（最新在前） */
export function assessSourceHealth(runs: HealthRun[], now: Date = new Date()): HealthIssue[] {
  if (runs.length === 0) return [];
  const issues: HealthIssue[] = [];

  for (const latest of runs[0].results) {
    const history = runs.flatMap((run) =>
      run.results
        .filter((r) => r.sourceId === latest.sourceId)
        .map((r) => ({ ...r, startedAt: run.startedAt })),
    );

    // 规则 1：连续出错
    const errors = [];
    for (const h of history) {
      if (h.status !== "error") break;
      errors.push(h);
    }
    if (errors.length >= ERROR_STREAK) {
      issues.push({
        sourceId: latest.sourceId,
        displayName: latest.displayName,
        level: "alert",
        reason: `连续 ${errors.length} 轮出错：${errors[0].errorMessage ?? "未知错误"}`,
      });
      continue;
    }

    // 规则 2：悄悄变 0（跳过出错轮次，遇到扫描 > 0 的成功轮次为止）
    let zeroCount = 0;
    let oldestZero: string | null = null;
    let everScanned = false;
    for (const h of history) {
      if (h.status === "error") continue;
      if (h.scannedCount > 0) {
        everScanned = true;
        break;
      }
      zeroCount++;
      oldestZero = h.startedAt;
    }
    if (zeroCount < ZERO_STREAK || !oldestZero) continue;
    const hours = (now.getTime() - new Date(oldestZero).getTime()) / 3_600_000;
    if (hours < ZERO_HOURS) continue;

    const since = oldestZero.slice(0, 10);
    issues.push(
      everScanned
        ? {
            sourceId: latest.sourceId,
            displayName: latest.displayName,
            level: "alert",
            reason: `自 ${since} 起连续 ${zeroCount} 轮扫描到 0 条（之前正常），多半是页面改版、解析规则失效`,
          }
        : {
            sourceId: latest.sourceId,
            displayName: latest.displayName,
            level: "warning",
            reason: `记录里（自 ${since}）从未扫到过任何条目，可能从一开始就没接通`,
          },
    );
  }

  return issues;
}
