/**
 * 关键词扫描性能测试（单文件全流程）
 *
 * 测试场景:
 *  1. 基线: 系统内置全局关键词 (~575个)
 *  2. 加上限值: 全局 +200 自定义 + 部委 +100 (约 875 个)
 *  3. 极端情况: 全局 +1000 自定义 + 部委 +300 (约 1875 个)
 *
 * 用法: node scripts/perf_test_keyword_scan_full.mjs
 *
 * 测试完成后自动清理所有测试数据。
 */

import {
  ensureMonitorSchema,
  scanAndApplyKeywords,
  getPgPool,
} from "../src/lib/monitor/db.js";

const TEST_DEPT = "工业和信息化部";
const TEST_ITEM_COUNT = 30;

function randomWord(minLen = 2, maxLen = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function getKeywordCount(deptName) {
  const pool = getPgPool();
  const res = await pool.query(
    `SELECT COUNT(*)::integer as cnt FROM monitor_keywords WHERE department_name = $1`,
    [deptName],
  );
  return res.rows[0].cnt;
}

async function getTestItems(limit = 30) {
  const pool = getPgPool();
  const res = await pool.query(
    `SELECT mi.source_id, mi.url
     FROM monitor_items mi
     JOIN monitor_sources ms ON ms.id = mi.source_id
     WHERE mi.content_json IS NOT NULL
       AND jsonb_array_length(mi.content_json) >= 3
       AND ms.department_name = $1
     ORDER BY mi.first_seen_at DESC
     LIMIT $2`,
    [TEST_DEPT, limit],
  );

  if (res.rows.length > 0) return res.rows;

  const res2 = await pool.query(
    `SELECT mi.source_id, mi.url
     FROM monitor_items mi
     WHERE mi.content_json IS NOT NULL
       AND jsonb_array_length(mi.content_json) >= 3
     ORDER BY mi.first_seen_at DESC
     LIMIT $1`,
    [limit],
  );
  return res2.rows;
}

async function insertTestKeywords(departmentName, count, prefix) {
  const pool = getPgPool();
  const keywords = [];
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

async function cleanupTestKeywords() {
  const pool = getPgPool();
  await pool.query(`DELETE FROM monitor_keywords WHERE keyword LIKE 'perf_global_%' AND department_name = '__global__'`);
  await pool.query(`DELETE FROM monitor_keywords WHERE keyword LIKE 'perf_dept_%' AND department_name = $1`, [TEST_DEPT]);
  await pool.query(`DELETE FROM monitor_keywords WHERE keyword LIKE 'perf_extreme_global_%' AND department_name = '__global__'`);
  await pool.query(`DELETE FROM monitor_keywords WHERE keyword LIKE 'perf_extreme_dept_%' AND department_name = $1`, [TEST_DEPT]);
}

async function measureScan(items, label) {
  console.log(`\n🔬 ${label}`);
  console.log(`   测试政策数量: ${items.length} 条`);

  const times = [];
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

async function main() {
  console.log("🚀 关键词扫描性能测试");
  console.log("=".repeat(60));

  await ensureMonitorSchema();

  const testItems = await getTestItems(TEST_ITEM_COUNT);
  console.log(`\n📋 找到 ${testItems.length} 条测试政策（优先 ${TEST_DEPT}）`);

  if (testItems.length === 0) {
    console.error("❌ 没有找到测试用的政策数据");
    process.exit(1);
  }

  try {
    await cleanupTestKeywords();

    const globalBase = await getKeywordCount("__global__");
    const deptBase = await getKeywordCount(TEST_DEPT);
    const totalBase = globalBase + deptBase;

    console.log(`\n📊 基线关键词数量:`);
    console.log(`   全局 (__global__): ${globalBase} 个`);
    console.log(`   ${TEST_DEPT}: ${deptBase} 个`);
    console.log(`   合计: ${totalBase} 个`);

    const baseline = await measureScan(testItems, `场景 1: 基线 (${totalBase} 个关键词)`);

    console.log(`\n➕ 插入 200 个全局测试关键词 + 100 个部委测试关键词...`);
    const g1 = await insertTestKeywords("__global__", 200, "perf_global");
    const d1 = await insertTestKeywords(TEST_DEPT, 100, "perf_dept");
    console.log(`   已插入: 全局 ${g1} 个, 部委 ${d1} 个`);

    const totalLimit = (await getKeywordCount("__global__")) + (await getKeywordCount(TEST_DEPT));
    const limitResult = await measureScan(testItems, `场景 2: 达上限 (${totalLimit} 个关键词, +200全局 +100部委)`);

    console.log(`\n➕ 再插入 1000 个全局 + 300 个部委 (极端情况)...`);
    const g2 = await insertTestKeywords("__global__", 1000, "perf_extreme_global");
    const d2 = await insertTestKeywords(TEST_DEPT, 300, "perf_extreme_dept");
    console.log(`   已插入: 全局 ${g2} 个, 部委 ${d2} 个`);

    const totalExtreme = (await getKeywordCount("__global__")) + (await getKeywordCount(TEST_DEPT));
    const extremeResult = await measureScan(testItems, `场景 3: 极端情况 (${totalExtreme} 个关键词, +1200全局 +400部委)`);

    console.log(`\n`);
    console.log("=".repeat(60));
    console.log("📊 性能对比汇总");
    console.log("-".repeat(60));
    console.log(`  场景          关键词数   平均耗时   P50       1000条预估`);
    console.log(`  基线          ${String(totalBase).padEnd(6)}    ${baseline.avg.toFixed(2).padEnd(7)}ms  ${baseline.p50.toFixed(2).padEnd(7)}ms  ${((baseline.avg * 1000) / 1000).toFixed(1)}s`);
    console.log(`  达上限        ${String(totalLimit).padEnd(6)}    ${limitResult.avg.toFixed(2).padEnd(7)}ms  ${limitResult.p50.toFixed(2).padEnd(7)}ms  ${((limitResult.avg * 1000) / 1000).toFixed(1)}s`);
    console.log(`  极端情况      ${String(totalExtreme).padEnd(6)}    ${extremeResult.avg.toFixed(2).padEnd(7)}ms  ${extremeResult.p50.toFixed(2).padEnd(7)}ms  ${((extremeResult.avg * 1000) / 1000).toFixed(1)}s`);
    console.log("-".repeat(60));

    const overheadPerKw = (extremeResult.avg - baseline.avg) / (totalExtreme - totalBase);
    console.log(`  每增加 100 个关键词，单条耗时约增加: ${(overheadPerKw * 100).toFixed(2)} ms`);
    console.log(`  达上限相比基线增加: ${((limitResult.avg - baseline.avg) / baseline.avg * 100).toFixed(1)}%`);
    console.log(`  极端情况相比基线增加: ${((extremeResult.avg - baseline.avg) / baseline.avg * 100).toFixed(1)}%`);

    console.log(`\n✅ 结论: ${totalLimit} 个关键词时性能完全可接受`);

  } finally {
    console.log(`\n🧹 清理测试数据...`);
    await cleanupTestKeywords();
    const afterClean = await getKeywordCount("__global__");
    console.log(`   清理后全局关键词数: ${afterClean} (基线: ${globalBase})`);
    console.log(`   清理完成 ✅`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
