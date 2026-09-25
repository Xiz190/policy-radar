import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";
import { scanAndApplyKeywords } from "@/lib/monitor/db";

export const dynamic = "force-dynamic";

/**
 * 优先级调试接口（**无鉴权**，仅供本地开发和调试）：
 *
 *   GET /api/monitor/items/debug-priority?limit=30
 *     - 只读，不写库
 *     - 返回最近 N 条内容的：当前 DB 中 importance_level / keyword_score / signal_hits._meta
 *
 *   POST /api/monitor/items/debug-priority
 *     Body: { sourceId: string, url: string }
 *     - 针对单条：重新跑关键词+优先级逻辑并写入 DB
 *     - 返回 before / after 对比
 *
 *   POST /api/monitor/items/debug-priority
 *     Body: { rescoreAll: true, limit?: number }
 *     - 批量重新打分：对最多 limit 条条目重新跑一次关键词逻辑
 *     - 返回重算后各等级计数
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));
  const onlyCore = url.searchParams.get("onlyCore") === "1";
  const pool = getPgPool();

  const where = onlyCore ? `where mi.importance_level in ('核心关注', '加急推荐')` : "";

  const res = await pool.query<{
    source_id: string;
    url: string;
    title: string | null;
    keyword_score: string;
    importance_level: string | null;
    signal_meta: string | null;
  }>(
    `select mi.source_id, mi.url, mi.title,
            coalesce(mi.keyword_score, 0)::text as keyword_score,
            coalesce(mi.importance_level, '普通内容') as importance_level,
            coalesce((mi.signal_hits->'_meta')::text, '') as signal_meta
     from monitor_items mi
     ${where}
     order by mi.first_seen_at desc
     limit $1`,
    [limit],
  );

  return NextResponse.json({
    ok: true,
    count: res.rows.length,
    items: res.rows.map((r) => {
      let meta: Record<string, unknown> | null = null;
      try {
        if (r.signal_meta) meta = JSON.parse(r.signal_meta) as Record<string, unknown>;
      } catch {
        // ignore
      }
      return {
        sourceId: r.source_id,
        url: r.url,
        title: r.title,
        keyword_score: Number(r.keyword_score) || 0,
        importance_level: r.importance_level,
        signal_meta: meta,
      };
    }),
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const pool = getPgPool();

  if (body.rescoreAll) {
    const limit = Math.min(5000, Math.max(1, typeof body.limit === "number" ? body.limit : 2000));
    const rows = await pool.query<{ source_id: string; url: string }>(
      `select source_id, url from monitor_items order by first_seen_at desc limit $1`,
      [limit],
    );
    let ok = 0;
    let failed = 0;
    for (const r of rows.rows) {
      try {
        await scanAndApplyKeywords(r.source_id, r.url);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    const counts = await pool.query<{ level: string; count: string }>(
      `select coalesce(importance_level, '普通内容') as level, count(*)::text as count
       from monitor_items group by 1 order by 2 desc`,
    );
    return NextResponse.json({
      ok: true,
      rescanned: ok,
      failed,
      total: rows.rows.length,
      levelCounts: counts.rows.map((r) => ({
        level: r.level,
        count: Number(r.count),
      })),
    });
  }

  const sourceId = String(body.sourceId ?? "").trim();
  const url = String(body.url ?? "").trim();
  if (!sourceId || !url) {
    return NextResponse.json(
      { ok: false, error: "sourceId and url required, or { rescoreAll: true, limit?: number }" },
      { status: 400 },
    );
  }

  const before = await pool.query<{
    keyword_score: string;
    importance_level: string | null;
  }>(
    `select coalesce(keyword_score,0)::text as keyword_score,
            coalesce(importance_level,'') as importance_level
     from monitor_items where source_id = $1 and url = $2`,
    [sourceId, url],
  );
  if (before.rows.length === 0) {
    return NextResponse.json({ ok: false, error: "monitor_items: row not found" }, { status: 404 });
  }

  await scanAndApplyKeywords(sourceId, url);

  const after = await pool.query<{
    keyword_score: string;
    importance_level: string | null;
    signal_hits: string | null;
  }>(
    `select coalesce(i.keyword_score,0)::text as keyword_score,
            coalesce(i.importance_level,'') as importance_level,
            coalesce(i.signal_hits::text, '') as signal_hits
     from monitor_items i
     where source_id = $1 and url = $2`,
    [sourceId, url],
  );

  let signalMeta: Record<string, unknown> | null = null;
  try {
    if (after.rows[0].signal_hits) {
      const parsed = JSON.parse(after.rows[0].signal_hits || "{}") as Record<string, unknown>;
      const meta = parsed._meta;
      signalMeta = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
    }
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    before: {
      keyword_score: Number(before.rows[0].keyword_score) || 0,
      importance_level: before.rows[0].importance_level,
    },
    after: {
      keyword_score: Number(after.rows[0].keyword_score) || 0,
      importance_level: after.rows[0].importance_level,
    },
    signal_meta: signalMeta,
  });
}
