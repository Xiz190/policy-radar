import { NextResponse } from "next/server";
import {
  ensureMonitorSchema,
  getDailySeries,
  getByDepartment,
  getByChannel,
} from "@/lib/monitor/db";
import { isDbAvailable } from "@/lib/db";

export const dynamic = "force-dynamic";

// ?mode=daily  : 按日时间序列（count / urgent / highlight / unread / starred）
// ?mode=byDepartment  : 按部委 Top N
// ?mode=byChannel     : 按栏目 Top N，可带 ?departmentName=XXX
// ?days=30            : 天数
// ?topN=20            : Top N
export async function GET(request: Request) {
  await ensureMonitorSchema();

  if (!isDbAvailable()) {
    return NextResponse.json({ mode: "daily", days: 30, rows: [] });
  }

  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") || "daily").toLowerCase();
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 30)));
  const topN = Math.min(200, Math.max(1, Number(url.searchParams.get("topN") || 20)));
  const departmentName = url.searchParams.get("departmentName") || undefined;

  switch (mode) {
    case "daily": {
      const rows = await getDailySeries(days);
      return NextResponse.json({ mode, days, rows });
    }
    case "bydepartment":
    case "by_department": {
      const rows = await getByDepartment(days, topN);
      return NextResponse.json({ mode, days, topN, rows });
    }
    case "bychannel":
    case "by_channel": {
      const rows = await getByChannel(days, topN, departmentName);
      return NextResponse.json({ mode, days, topN, departmentName: departmentName || null, rows });
    }
    default:
      return NextResponse.json(
        { ok: false, error: "unknown mode. allowed: daily, byDepartment, byChannel" },
        { status: 400 },
      );
  }
}
