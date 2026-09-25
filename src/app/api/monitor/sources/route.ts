import { NextResponse } from "next/server";
import { requireAdminToken, isDbAvailable } from "@/lib/db";
import { createMonitorSource, ensureMonitorSchema, getMonitorSources } from "@/lib/monitor/db";
import { getSourceItemStats } from "@/lib/monitor/db/sources";
import { generateMockSources } from "@/lib/monitor/mock";
import { mockDelay } from "@/lib/mock";
import type { SourceLanguage, SourceRegion, SourceContentCategory } from "@/lib/monitor/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureMonitorSchema();

  if (!isDbAvailable()) {
    await mockDelay();
    return NextResponse.json(generateMockSources());
  }

  const url = new URL(request.url);
  const withStats = url.searchParams.get("stats") === "1";

  const sources = await getMonitorSources();
  if (!withStats) return NextResponse.json(sources);

  const stats = await getSourceItemStats();
  const enriched = sources.map((s) => ({
    ...s,
    itemStats: stats[s.id] ?? { totalCount: 0, lastSeenAt: null },
  }));
  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }
  const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
  const id = await createMonitorSource({
    departmentName: str(body.departmentName),
    channelName: str(body.channelName),
    displayName: str(body.displayName),
    type: str(body.type, "mct_zwgk_genre"),
    listUrl: str(body.listUrl),
    enabled: Boolean(body.enabled),
    autoMonitor: Boolean(body.autoMonitor),
    isKey: Boolean(body.isKey),
    startDate: str(body.startDate, "2026-05-05"),
    maxItems: Number(body.maxItems ?? 10),
    notes: str(body.notes),
    language: str(body.language, "zh") as SourceLanguage,
    region: str(body.region, "domestic") as SourceRegion,
    contentCategory: str(body.contentCategory, "general") as SourceContentCategory,
  });
  return NextResponse.json({ ok: true, id });
}

