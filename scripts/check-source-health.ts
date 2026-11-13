// 来源健康检查（GitHub Actions: crawl.yml 抓取之后跑）：有来源坏了就退出码 1，让 Actions 标红、GitHub 发失败邮件。
// 规则见 src/lib/monitor/source-health.ts。本地：npx tsx --env-file=.env.deploy.local scripts/check-source-health.ts
import { appendFileSync } from "node:fs";
import { getPgPool } from "@/lib/db";
import { assessSourceHealth, type HealthRun } from "@/lib/monitor/source-health";

const RUN_LIMIT = 120;

async function main() {
  const pool = getPgPool();
  // 只取判断要用的字段，不把 newItems 等整份结果拉下来
  const res = await pool.query<{ started_at: Date; results: HealthRun["results"] }>(
    `select r.started_at,
            coalesce(jsonb_agg(jsonb_build_object(
              'sourceId', x->>'sourceId',
              'displayName', x->>'displayName',
              'status', x->>'status',
              'scannedCount', coalesce((x->>'scannedCount')::int, 0),
              'errorMessage', x->>'errorMessage'
            )) filter (where x is not null), '[]') as results
       from (select id, started_at, results from monitor_runs
              where results is not null and status in ('success', 'error')
              order by started_at desc limit $1) r
       left join lateral jsonb_array_elements(r.results) x on true
      group by r.id, r.started_at
      order by r.started_at desc`,
    [RUN_LIMIT],
  );
  await pool.end();

  const runs: HealthRun[] = res.rows.map((row) => ({
    startedAt: new Date(row.started_at).toISOString(),
    results: row.results,
  }));
  const issues = assessSourceHealth(runs);
  const alerts = issues.filter((i) => i.level === "alert");
  const warnings = issues.filter((i) => i.level === "warning");

  const lines = [
    `## 来源健康检查`,
    `看了最近 ${runs.length} 轮、${runs[0]?.results.length ?? 0} 个来源：告警 ${alerts.length} 个，警告 ${warnings.length} 个。`,
    ...alerts.map((i) => `- [告警] **${i.displayName}**（${i.sourceId}）：${i.reason}`),
    ...warnings.map((i) => `- [警告] ${i.displayName}（${i.sourceId}）：${i.reason}`),
  ];
  console.log(lines.join("\n"));
  // GitHub Actions 运行页面的摘要 + 标注（失败邮件点进去第一眼就能看到是哪个来源）
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  if (process.env.GITHUB_ACTIONS) {
    for (const i of alerts) console.log(`::error title=来源异常：${i.displayName}::${i.reason}`);
    for (const i of warnings) console.log(`::warning title=来源从未接通：${i.displayName}::${i.reason}`);
  }

  process.exit(alerts.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
