import { NextResponse } from "next/server";
import { getPgPool, requireAdminToken } from "@/lib/db";
import { scanAndApplyKeywords } from "@/lib/monitor/db";

export const dynamic = "force-dynamic";

/**
 * 用最新的关键词体系 + 四层级优先级逻辑，批量重算 monitor_items 的：
 *   keyword_score / matched_keywords / matched_categories / signal_hits / importance_level
 *
 * 调用方式（前端按钮已接入，**无鉴权，仅供本地开发**）：
 *   POST /api/monitor/items/recompute-priority
 *   Body: { limit?: number, sourceId?: string, onlyNullLevel?: boolean }
 *
 * - limit: 最多重算多少条（默认 5000，避免一次卡死）
 * - sourceId: 只重算某个来源下的条目
 * - onlyNullLevel: 只扫 importance_level 为空的条目（增量）
 */
export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const pool = getPgPool();

  const whereClauses: string[] = [];
  const params: unknown[] = [];
  if (body.sourceId) {
    whereClauses.push(`i.source_id = $${params.length + 1}`);
    params.push(typeof body.sourceId === "string" ? body.sourceId : "");
  }
  if (body.onlyNullLevel) {
    whereClauses.push(`i.importance_level is null`);
  }
  const whereSql = whereClauses.length > 0 ? `where ${whereClauses.join(" and ")}` : ``;

  const countRes = await pool.query<{ n: string }>(
    `select count(*)::text as n from monitor_items i ${whereSql}`,
    params,
  );
  const total = Number(countRes.rows[0].n) || 0;

  const defaultLimit = 5000;
  const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 20000) : defaultLimit;

  const itemsRes = await pool.query<{ source_id: string; url: string }>(
    `select i.source_id, i.url
     from monitor_items i
     ${whereSql}
     order by i.first_seen_at desc
     limit $${params.length + 1}`,
    [...params, limit],
  );

  let ok = 0;
  let fail = 0;
  const start = Date.now();

  for (const row of itemsRes.rows) {
    try {
      await scanAndApplyKeywords(row.source_id, row.url);
      ok += 1;
    } catch {
      fail += 1;
    }
  }

  const levelRes = await pool.query<{ level: string; count: string }>(
    `select coalesce(i.importance_level, '普通内容') as level, count(*)::text as count
     from monitor_items i
     group by 1
     order by 2 desc`,
  );

  const levelCounts = levelRes.rows.map((r) => ({ level: r.level, count: Number(r.count) }));
  const durationMs = Date.now() - start;

  return NextResponse.json({
    ok: true,
    total,
    limit,
    rescanned: ok,
    failed: fail,
    durationMs,
    levelCounts,
  });
}
