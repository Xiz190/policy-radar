/**
 * 一次性脚本：插入 3 条不同重要性等级的测试条目，
 * 验证"中等重点/普通内容不再显示徽章、仅重点内容/核心关注显示徽章"的门槛。
 *
 * 用法：
 *   npx tsx scripts/seed-low-score-fixtures.ts
 *
 * 执行后会：
 *   1) 保证存在一个测试用 source（部委=测试部委, 栏目=测试栏目）
 *   2) 插入 3 条 monitor_items：
 *        - "[测试·低] 普通内容示例条目"   —  importance_level = "普通内容"
 *        - "[测试·低] 中等重点示例条目"   —  importance_level = "中等重点"
 *        - "[测试·高] 重点内容示例条目"   —  importance_level = "重点内容"
 *   3) 打印 getImportanceBadgeMeta(level) 的返回值，核对门槛是否生效。
 */

import { readFileSync, existsSync } from "fs";
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
import { getPgPool } from "../src/lib/db";
import { getImportanceBadgeMeta, shouldShowImportanceBadge } from "../src/lib/monitor/priority-levels";

const TEST_DEPT = "测试部委";
const TEST_CHANNEL = "测试栏目";
const TEST_SOURCE_ID = "__test_source_low_score_fixtures__";

const FIXTURES = [
  { level: "普通内容", title: "[测试·低] 普通内容示例条目", score: 0, starred: false },
  { level: "中等重点", title: "[测试·低] 中等重点示例条目", score: 20, starred: false },
  { level: "重点内容", title: "[测试·高] 重点内容示例条目", score: 60, starred: true },
  { level: "核心关注", title: "[测试·高] 核心关注示例条目", score: 120, starred: true },
];

async function ensureSource(pool: ReturnType<typeof getPgPool>) {
  await pool.query(
    `insert into monitor_sources (id, department_name, channel_name, display_name, type, list_url)
     values ($1, $2, $3, $4, 'manual', 'https://example.invalid/manual-fixtures')
     on conflict (id) do update
        set department_name = excluded.department_name,
            channel_name = excluded.channel_name,
            display_name = excluded.display_name,
            updated_at = now()`,
    [TEST_SOURCE_ID, TEST_DEPT, TEST_CHANNEL, `${TEST_DEPT}·${TEST_CHANNEL}`],
  );
  const existing = await pool.query(
    `select id, department_name, channel_name from monitor_sources where id = $1`,
    [TEST_SOURCE_ID],
  );
  console.log("[info] 测试 source：", existing.rows[0]);
}

async function insertFixtures(pool: ReturnType<typeof getPgPool>) {
  const today = new Date().toISOString().slice(0, 10);
  for (const f of FIXTURES) {
    const url = `https://example.invalid/fixtures/${encodeURIComponent(f.level)}/${Date.now()}`;
    const q = `
      insert into monitor_items
        (source_id, url, title, list_published_at, first_seen_at,
         is_read, is_starred, keyword_score, importance_level, matched_categories)
      values ($1, $2, $3, $4::date, $5::timestamptz, $6, $7, $8, $9, $10::jsonb)
      on conflict (source_id, url) do update
        set title = excluded.title,
            keyword_score = excluded.keyword_score,
            importance_level = excluded.importance_level,
            is_starred = excluded.is_starred,
            first_seen_at = excluded.first_seen_at
    `;
    await pool.query(q, [
      TEST_SOURCE_ID,
      url,
      f.title,
      today,
      new Date().toISOString(),
      false,
      f.starred,
      f.score,
      f.level,
      JSON.stringify(["测试体裁·"]),
    ]);
    console.log(`[insert] level=${f.level} score=${f.score} title=${f.title}`);
  }
}

function verifyBadgeHelpers() {
  console.log("\n== helper 结果核对 ==");
  const levels = ["普通内容", "中等重点", "重点内容", "核心关注", "未知等级", null, ""];
  for (const lv of levels) {
    const show = shouldShowImportanceBadge(lv);
    const meta = getImportanceBadgeMeta(lv);
    console.log(
      `  importance_level=${JSON.stringify(lv)}  shouldShow=${show}  badge=${
        meta ? JSON.stringify({ level: meta.level, label: meta.label, className: meta.className }) : "null"
      }`,
    );
  }
  console.log("\n期望：普通内容 / 中等重点 / null / ''  badge=null；重点内容 / 核心关注 badge 非 null。\n");
}

async function main() {
  verifyBadgeHelpers();
  const pool = getPgPool();
  try {
    await ensureSource(pool);
    await insertFixtures(pool);
  } finally {
    await pool.end();
  }
  console.log("[done] 测试数据已插入。在 /inbox 按「测试部委」筛选，或直接打开条目详情页，可核对徽章显示。");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
