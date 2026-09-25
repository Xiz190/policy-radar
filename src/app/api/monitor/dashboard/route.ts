import { NextResponse } from "next/server";
import { ensureMonitorSchema, getDashboardSummary } from "@/lib/monitor/db";
import { isDbAvailable } from "@/lib/db";
import { generateMockDashboard } from "@/lib/monitor/mock";
import { mockDelay } from "@/lib/mock";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureMonitorSchema();
  
  if (!isDbAvailable()) {
    await mockDelay();
    const url = new URL(request.url);
    const days = Math.min(60, Math.max(3, Number(url.searchParams.get("days") ?? 14)));
    const topKeywordsLimit = Math.min(50, Math.max(5, Number(url.searchParams.get("topN") ?? 20)));
    return NextResponse.json(generateMockDashboard(days, topKeywordsLimit));
  }

  const url = new URL(request.url);
  const days = Math.min(60, Math.max(3, Number(url.searchParams.get("days") ?? 14)));
  const topKeywordsLimit = Math.min(50, Math.max(5, Number(url.searchParams.get("topN") ?? 20)));

  const summary = await getDashboardSummary(days, topKeywordsLimit);
  return NextResponse.json(summary);
}
