/**
 * 关键词扫描性能测试（单文件全流程）
 *
 * 用法:
 *   npx tsx scripts/perf_test_keyword_scan_full.ts [选项]
 *
 * 选项:
 *   --global <数量>       场景2: 新增全局关键词数量 (默认: 200)
 *   --dept <数量>         场景2: 新增部委关键词数量 (默认: 100)
 *   --extreme-global <数量>  场景3: 额外新增全局关键词数量 (默认: 1000)
 *   --extreme-dept <数量>    场景3: 额外新增部委关键词数量 (默认: 300)
 *   --items <数量>        测试用的政策数量 (默认: 30)
 *   --dept-name <名称>    测试用的部委名称 (默认: 工业和信息化部)
 *   --scenes <数量>       测试场景数: 1=仅基线, 2=基线+上限, 3=全部 (默认: 3)
 *   --no-cleanup          测试后不清理数据 (默认: 清理)
 *   --help                显示帮助
 *
 * 示例:
 *   # 默认三场景测试
 *   npx tsx scripts/perf_test_keyword_scan_full.ts
 *
 *   # 只测基线和上限场景，自定义关键词数量
 *   npx tsx scripts/perf_test_keyword_scan_full.ts --global 500 --dept 200 --scenes 2
 *
 *   # 测 5000 个关键词的极端情况
 *   npx tsx scripts/perf_test_keyword_scan_full.ts --extreme-global 4000 --extreme-dept 500
 *
 *   # 用 100 条政策测试，结果更准
 *   npx tsx scripts/perf_test_keyword_scan_full.ts --items 100
 *
 * 测试完成后自动清理所有测试数据（除非传 --no-cleanup）。
 */

import {
  ensureMonitorSchema,
  scanAndApplyKeywords,
} from "../src/lib/monitor/db";
import { getPgPool } from "../src/lib/db";

interface TestConfig {
  deptName: string;
  itemCount: number;
  scene2Global: number;
  scene2Dept: number;
  scene3ExtraGlobal: number;
  scene3ExtraDept: number;
  scenes: 1 | 2 | 3;
  cleanup: boolean;
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config: TestConfig = {
    deptName: "工业和信息化部",
    itemCount: 30,
    scene2Global: 200,
    scene2Dept: 100,
    scene3ExtraGlobal: 1000,
    scene3ExtraDept: 300,
    scenes: 3,
    cleanup: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      case "--global":
        config.scene2Global = parseInt(args[++i], 10);
        break;
      case "--dept":
        config.scene2Dept = parseInt(args[++i], 10);
        break;
      case "--extreme-global":
        config.scene3ExtraGlobal = parseInt(args[++i], 10);
        break;
      case "--extreme-dept":
        config.scene3ExtraDept = parseInt(args[++i], 10);
        break;
      case "--items":
        config.itemCount = parseInt(args[++i], 10);
        break;
      case "--dept-name":
        config.deptName = args[++i];
        break;
      case "--scenes":
        const s = parseInt(args[++i], 10) as 1 | 2 | 3;
        if (s >= 1 && s <= 3) config.scenes = s;
        break;
      case "--no-cleanup":
        config.cleanup = false;
        break;
    }
  }

  return config;
}

function printHelp(): void {
  const helpText = `
关键词扫描性能测试

用法:
  npx tsx scripts/perf_test_keyword_scan_full.ts [选项]

选项:
  --global <数量>           场景2新增全局关键词数量 (默认: 200)
  --dept <数量>             场景2新增部委关键词数量 (默认: 100)
  --extreme-global <数量>   场景3额外新增全局关键词数量 (默认: 1000)
  --extreme-dept <数量>     场景3额外新增部委关键词数量 (默认: 300)
  --items <数量>            测试用的政策数量 (默认: 30)
  --dept-name <名称>        测试用的部委名称 (默认: 工业和信息化部)
  --scenes <1|2|3>          测试场景数 (默认: 3)
                              1 = 仅基线
                              2 = 基线 + 上限场景
                              3 = 全部三个场景
  --no-cleanup              测试后不清理数据
  --help, -h                显示帮助

示例:
  # 默认三场景测试
  npx tsx scripts/perf_test_keyword_scan_full.ts

  # 只测基线和上限，自定义关键词数
  npx tsx scripts/perf_test_keyword_scan_full.ts --global 500 --dept 200 --scenes 2

  # 测 5000 关键词的极端情况
  npx tsx scripts/perf_test_keyword_scan_full.ts --extreme-global 4000 --extreme-dept 500

  # 用 100 条政策测试，结果更准确
  npx tsx scripts/perf_test_keyword_scan_full.ts --items 100
`;
  console.log(helpText);
}

const config = parseArgs();
const TEST_DEPT = config.deptName;
const TEST_ITEM_COUNT = config.itemCount;

function randomWord(minLen = 2, maxLen = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function getKeywordCount(deptName: string): Promise<number> {
  const pool = getPgPool();
  const res = await pool.query(
    `SELECT COUNT(*)::integer as cnt FROM monitor_keywords WHERE department_name = $1`,
    [deptName],
  );
  return res.rows[0].cnt;
}

async function getTestItems(limit = 30): Promise<Array<{ source_id: string; url: string }>> {
  const pool = getPgPool();
  const res = await pool.query(
    `SELECT mi.source_id, mi.url
     FROM monitor_items mi
     WHERE mi.content_json IS NOT NULL
     ORDER BY mi.first_seen_at DESC
     LIMIT $1`,
    [limit],
  );
  return res.rows;
}

async function insertTestKeywords(departmentName: string, count: number, prefix: string): Promise<number> {
  const pool = getPgPool();
  const keywords: Array<{
    id: string;
    department_name: string;
    keyword: string;
    weight: number;
    category: string;
    match_mode: string;
  }> = [];

  for (let i = 0; i < count; i++) {
    const kw = `${prefix}_${randomWord(3, 6)}_${i}`;
    const weight = Math.floor(Math.random() * 10) + 1;
    const categories = ["perf_test·A", "perf_test·B", "perf_test·C", "perf_test·D", "perf_test·E"];
    const category = categories[Math.floor(Math.random() * categories.length)];
    keywords.push({
      id: `${departmentName}:${kw.toLowerCase()}`,
      department_name: departmentName,
      keyword: kw,
      weight,
      category,
      match_mode: "phrase",
    });
  }

  await pool.query("BEGIN");
  try {
    for (const kw of keywords) {
      await pool.query(
        `INSERT INTO monitor_keywords (id, department_name, keyword, weight, category, match_mode)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET weight = EXCLUDED.weight, category = EXCLUDED.category`,
        [kw.id, kw.department_name, kw.keyword, kw.weight, kw.category, kw.match_mode],
      );
    }
    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }

  return keywords.length;
}

async function cleanupTestKeywords(): Promise<void> {
  const pool = getPgPool();
  const patterns = ["perf_global_%", "perf_dept_%", "perf_extreme_global_%", "perf_extreme_dept_%"];
  for (const pattern of patterns) {
    await pool.query(
      `DELETE FROM monitor_keywords WHERE keyword LIKE $1 AND department_name = $2`,
      [pattern, pattern.includes("global") ? "__global__" : TEST_DEPT],
    );
  }
}

async function measureScan(
  items: Array<{ source_id: string; url: string }>,
  label: string,
): Promise<{ avg: number; p50: number; p90: number; min: number; max: number; hitRate: number }> {
  console.log(`\n🔬 ${label}`);
  console.log(`   测试政策数量: ${items.length} 条`);

  const times: number[] = [];
  let hitCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const start = process.hrtime.bigint();
    const result = await scanAndApplyKeywords(item.source_id, item.url);
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    times.push(ms);
    if (result && result.length > 0) hitCount++;
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p90 = times[Math.floor(times.length * 0.9)];
  const max = times[times.length - 1];
  const min = times[0];

  console.log(`   平均耗时:   ${avg.toFixed(2)} ms/条`);
  console.log(`   P50 (中位): ${p50.toFixed(2)} ms/条`);
  console.log(`   P90:        ${p90.toFixed(2)} ms/条`);
  console.log(`   最快:       ${min.toFixed(2)} ms/条`);
  console.log(`   最慢:       ${max.toFixed(2)} ms/条`);
  console.log(`   命中率:     ${((hitCount / items.length) * 100).toFixed(1)}% (${hitCount}/${items.length})`);
  console.log(`   1000条预估:  ${((avg * 1000) / 1000).toFixed(1)} 秒`);
  console.log(`   10000条预估: ${((avg * 10000) / 1000).toFixed(1)} 秒 (约 ${((avg * 10000) / 60000).toFixed(1)} 分钟)`);

  return { avg, p50, p90, min, max, hitRate: hitCount / items.length };
}

async function main(): Promise<void> {
  console.log("🚀 关键词扫描性能测试");
  console.log("=".repeat(60));

  console.log(`\n⚙️  测试配置:`);
  console.log(`   测试部委:     ${config.deptName}`);
  console.log(`   政策数量:     ${config.itemCount} 条`);
  console.log(`   测试场景:     ${config.scenes} 个`);
  console.log(`   场景2全局:    +${config.scene2Global} 个`);
  console.log(`   场景2部委:    +${config.scene2Dept} 个`);
  if (config.scenes >= 3) {
    console.log(`   场景3全局:    +${config.scene3ExtraGlobal} 个 (额外)`);
    console.log(`   场景3部委:    +${config.scene3ExtraDept} 个 (额外)`);
  }
  console.log(`   测试后清理:   ${config.cleanup ? "是" : "否"}`);

  await ensureMonitorSchema();

  const testItems = await getTestItems(TEST_ITEM_COUNT);
  console.log(`\n📋 找到 ${testItems.length} 条测试政策`);

  if (testItems.length === 0) {
    console.error("❌ 没有找到测试用的政策数据");
    process.exit(1);
  }

  let globalBase = 0;
  const results: Array<{ label: string; totalKws: number; avg: number; p50: number }> = [];

  try {
    await cleanupTestKeywords();

    globalBase = await getKeywordCount("__global__");
    const deptBase = await getKeywordCount(TEST_DEPT);
    const totalBase = globalBase + deptBase;

    console.log(`\n📊 基线关键词数量:`);
    console.log(`   全局 (__global__): ${globalBase} 个`);
    console.log(`   ${TEST_DEPT}: ${deptBase} 个`);
    console.log(`   合计: ${totalBase} 个`);

    const baseline = await measureScan(testItems, `场景 1: 基线 (${totalBase} 个关键词)`);
    results.push({ label: "基线", totalKws: totalBase, avg: baseline.avg, p50: baseline.p50 });

    let lastResult = baseline;
    let lastTotal = totalBase;

    if (config.scenes >= 2) {
      console.log(`\n➕ 插入 ${config.scene2Global} 个全局测试关键词 + ${config.scene2Dept} 个部委测试关键词...`);
      const g1 = await insertTestKeywords("__global__", config.scene2Global, "perf_global");
      const d1 = await insertTestKeywords(TEST_DEPT, config.scene2Dept, "perf_dept");
      console.log(`   已插入: 全局 ${g1} 个, 部委 ${d1} 个`);

      const total2 = (await getKeywordCount("__global__")) + (await getKeywordCount(TEST_DEPT));
      const result2 = await measureScan(
        testItems,
        `场景 2: 场景2 (${total2} 个关键词, +${config.scene2Global}全局 +${config.scene2Dept}部委)`,
      );
      results.push({ label: "场景2", totalKws: total2, avg: result2.avg, p50: result2.p50 });
      lastResult = result2;
      lastTotal = total2;
    }

    if (config.scenes >= 3) {
      console.log(`\n➕ 再插入 ${config.scene3ExtraGlobal} 个全局 + ${config.scene3ExtraDept} 个部委 (场景3)...`);
      const g2 = await insertTestKeywords("__global__", config.scene3ExtraGlobal, "perf_extreme_global");
      const d2 = await insertTestKeywords(TEST_DEPT, config.scene3ExtraDept, "perf_extreme_dept");
      console.log(`   已插入: 全局 ${g2} 个, 部委 ${d2} 个`);

      const total3 = (await getKeywordCount("__global__")) + (await getKeywordCount(TEST_DEPT));
      const result3 = await measureScan(
        testItems,
        `场景 3: 场景3 (${total3} 个关键词, +${config.scene2Global + config.scene3ExtraGlobal}全局 +${config.scene2Dept + config.scene3ExtraDept}部委)`,
      );
      results.push({ label: "场景3", totalKws: total3, avg: result3.avg, p50: result3.p50 });
      lastResult = result3;
      lastTotal = total3;
    }

    console.log(`\n`);
    console.log("=".repeat(60));
    console.log("📊 性能对比汇总");
    console.log("-".repeat(60));
    console.log(`  场景        关键词数   平均耗时   P50       1000条预估`);
    for (const r of results) {
      console.log(
        `  ${r.label.padEnd(8)}  ${String(r.totalKws).padEnd(6)}    ${r.avg.toFixed(2).padEnd(7)}ms  ${r.p50.toFixed(2).padEnd(7)}ms  ${((r.avg * 1000) / 1000).toFixed(1)}s`,
      );
    }
    console.log("-".repeat(60));

    if (results.length >= 2) {
      const first = results[0];
      const last = results[results.length - 1];
      const overheadPerKw = (last.avg - first.avg) / (last.totalKws - first.totalKws);
      console.log(`  每增加 100 个关键词，单条耗时约增加: ${(overheadPerKw * 100).toFixed(2)} ms`);
      for (let i = 1; i < results.length; i++) {
        const increase = ((results[i].avg - results[0].avg) / results[0].avg) * 100;
        console.log(`  ${results[i].label}相比基线增加: ${increase.toFixed(1)}%`);
      }
    }

    console.log(`\n✅ 测试完成，${lastTotal} 个关键词时平均耗时 ${lastResult.avg.toFixed(2)} ms/条`);

  } finally {
    if (config.cleanup) {
      console.log(`\n🧹 清理测试数据...`);
      await cleanupTestKeywords();
      const afterClean = await getKeywordCount("__global__");
      console.log(`   清理后全局关键词数: ${afterClean} (基线: ${globalBase})`);
      console.log(`   清理完成 ✅`);
    } else {
      console.log(`\n⏭️  跳过清理（--no-cleanup），测试数据保留在数据库中`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
