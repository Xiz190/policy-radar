import { NextResponse } from "next/server";
import { getPgPool, requireAdminToken } from "@/lib/db";
import { seedDefaultKeywordsIfEmpty, scanAndApplyKeywords } from "@/lib/monitor/db";

export const dynamic = "force-dynamic";

// 旧分类名 → 新分类名 的映射（与 diagnose 路由保持一致）
const OLD_TO_NEW_CATEGORY: Record<string, string> = {
  ai: "topic_ai",
  data: "topic_data",
  platform: "topic_computing",
  innovation: "topic_industry",
  gov_service: "topic_gov",
  regulations: "topic_regulation",
  signal_pre: "signal_explore",
  signal_start: "signal_launch",
  signal_opportunity: "signal_support",
  signal_risk: "signal_risk",
  signal_launch: "signal_launch",
  region_bjj: "region_general",
  security: "signal_risk",
  byte_related: "__DELETE__",
};

const OLD_CATEGORIES = Object.keys(OLD_TO_NEW_CATEGORY);

export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  let body: {
    cleanKeywords?: boolean;
    rescanItems?: boolean;
    limit?: number;
    sourceId?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const pool = getPgPool();
  const result: {
    keywordsDeleted?: number;
    keywordsRetained?: number;
    globalSeedInserted?: number;
    itemsRescanned?: number;
    itemsFailed?: number;
    totalItemsAffected?: number;
    deletedCategoryMap?: Record<string, string>;
  } = {};

  // —— 1) 清理旧分类关键词 ——
  if (body.cleanKeywords !== false) {
    // 先把"部委自定义"里的旧分类关键词也清掉（保留到新映射后的版本不自动创建，因为旧分类可能不精确）
    // 策略：
    //   - department_name = '__global__' 且 category 是旧的：删掉（seed 会重新写入新分类版本）
    //   - department_name != '__global__' 且 category 是旧的：
    //       · 如果映射到新分类（不是 __DELETE__），就 UPDATE 成新分类名（保留用户自定义的词）
    //       · 如果是 __DELETE__，就 DELETE
    // 先处理部委自定义的：UPDATE 映射
    const retained: { category: string; newCategory: string; count: string }[] = [];
    for (const [oldCat, newCat] of Object.entries(OLD_TO_NEW_CATEGORY)) {
      if (newCat === "__DELETE__") continue;
      const r = await pool.query(
        `update monitor_keywords set category = $1 where category = $2 and department_name <> '__global__'`,
        [newCat, oldCat],
      );
      const c = Number(r.rowCount ?? 0);
      if (c > 0) retained.push({ category: oldCat, newCategory: newCat, count: String(c) });
    }

    // 对旧分类里需要删除的（byte_related 等）直接 DELETE
    const deletedCategories: Record<string, string> = {};
    for (const [oldCat, newCat] of Object.entries(OLD_TO_NEW_CATEGORY)) {
      if (newCat !== "__DELETE__") continue;
      const r = await pool.query(
        `delete from monitor_keywords where category = $1`,
        [oldCat],
      );
      const c = Number(r.rowCount ?? 0);
      if (c > 0) deletedCategories[oldCat] = String(c);
    }

    // 统计所有清理的旧关键词（包括马上 seed 会覆盖的 global）
    const oldCategoryTotal = await pool.query(
      `select count(*)::text as n from monitor_keywords where category = any($1::text[])`,
      [OLD_CATEGORIES],
    );

    // 重新 seed 全局关键词（会 DELETE __global__ 的全部 + INSERT 最新版）
    await seedDefaultKeywordsIfEmpty();

    const afterGlobal = await pool.query(
      `select count(*)::text as n from monitor_keywords where department_name = '__global__'`,
    );

    result.keywordsDeleted = Number(oldCategoryTotal.rows[0].n);
    result.keywordsRetained = retained.reduce((s, r) => s + Number(r.count), 0);
    result.globalSeedInserted = Number(afterGlobal.rows[0].n);
    result.deletedCategoryMap = deletedCategories;
  }

  // —— 2) 重扫条目的关键词 ——
  if (body.rescanItems !== false) {
    // 找出需要重扫的条目：如果指定了 sourceId，则只扫该来源；否则扫所有
    const whereClause = body.sourceId
      ? `where i.source_id = $1`
      : ``;
    const params = body.sourceId ? [body.sourceId] : [];

    // 先看总数
    const countRes = await pool.query<{ n: string }>(
      `select count(*)::text as n from monitor_items i ${whereClause}`,
      params,
    );
    const total = Number(countRes.rows[0].n);

    // 加个默认 limit 避免一次太重
    const limit = body.limit && body.limit > 0 ? body.limit : Math.min(total, 5000);

    const itemsRes = await pool.query<{ source_id: string; url: string }>(
      `select source_id, url from monitor_items i ${whereClause} order by i.first_seen_at desc limit $${params.length + 1}`,
      [...params, limit],
    );

    let okCount = 0;
    let failCount = 0;
    for (const row of itemsRes.rows) {
      try {
        await scanAndApplyKeywords(row.source_id, row.url);
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }

    result.itemsRescanned = okCount;
    result.itemsFailed = failCount;
    result.totalItemsAffected = total;
  }

  return NextResponse.json({ ok: true, ...result });
}
