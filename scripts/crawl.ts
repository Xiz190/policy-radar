// 线上定时抓取入口（GitHub Actions: .github/workflows/crawl.yml 每 6 小时跑一次）：
// 抓全部启用的来源 → 退出。政策雷达没有创作者视角这一步，不调用大模型。
// 本地也能手动跑：npx tsx --env-file=.env.local scripts/crawl.ts
import { runMonitorOnce } from "@/lib/monitor/runner";

async function main() {
  const started = Date.now();
  // runMonitorOnce 会等整轮（列表 → 入库 → 正文 → 关键词扫描）跑完才返回
  const run = await runMonitorOnce();
  console.log(`抓取状态: ${run.status}${run.errorMessage ? `（${run.errorMessage}）` : ""}`);
  let newTotal = 0;
  let failed = 0;
  for (const r of run.results ?? []) {
    newTotal += r.newCount ?? 0;
    if (r.status === "error") failed++;
    if (r.newCount || r.errorMessage) {
      console.log(
        `  ${r.displayName}: 扫描 ${r.scannedCount} / 新增 ${r.newCount}` +
          (r.errorMessage ? `  [错误] ${r.errorMessage}` : ""),
      );
    }
  }
  console.log(`共 ${run.results?.length ?? 0} 个来源，新增 ${newTotal} 条，失败 ${failed} 个来源`);
  console.log(`完成，用时 ${Math.round((Date.now() - started) / 1000)} 秒`);

  // 单个来源失败（如境外 IP 被拒）不算整体失败；拿不到锁、数据库异常时让 Actions 标红
  process.exit(run.status === "error" ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
