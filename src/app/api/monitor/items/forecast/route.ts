import { getPgPool, isDbAvailable } from "@/lib/db";
import { normalizeItemUrl } from "@/lib/monitor/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isDbAvailable()) {
    return Response.json({ ok: true, message: "演示模式，预估判断不会持久化" });
  }
  try {
    const body = await req.json();
    const {
      sourceId,
      url,
      forecastHigh,
      forecastMidHigh,
      forecastMid,
      forecastLow,
      forecastNotes,
    } = body;

    if (!sourceId || !url) {
      return Response.json({ ok: false, message: "缺少 sourceId 或 url 参数" });
    }

    const pool = getPgPool();
    const targetUrl = normalizeItemUrl(url);

    // 更新字段（URL 必须规范化，与 monitor_items 中存储的值一致）
    const res = await pool.query(
      `update monitor_items
       set forecast_high = $1,
           forecast_mid_high = $2,
           forecast_mid = $3,
           forecast_low = $4,
           forecast_notes = $5,
           forecast_updated_at = now()
       where source_id = $6 and url = $7`,
      [
        forecastHigh || null,
        forecastMidHigh || null,
        forecastMid || null,
        forecastLow || null,
        forecastNotes || null,
        sourceId,
        targetUrl,
      ],
    );

    if (res.rowCount === 0) {
      return Response.json({ ok: false, message: "未找到对应条目" });
    }

    return Response.json({ ok: true, message: "预估判断已更新" });
  } catch (e) {
    return Response.json({ ok: false, message: `服务器错误：${e}` });
  }
}
