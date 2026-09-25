import { NextResponse } from "next/server";
import { getRecentRuns } from "@/lib/monitor/db/runs";
import { isDbAvailable } from "@/lib/monitor/db-wrapper";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isDbAvailable()) return NextResponse.json([]);
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, Number(url.searchParams.get("limit") ?? "12"));
    const runs = await getRecentRuns(limit);
    return NextResponse.json(runs);
  } catch (e) {
    console.error("[GET /api/monitor/runs]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
