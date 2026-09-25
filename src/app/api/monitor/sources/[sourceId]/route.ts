import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/db";
import { deleteMonitorSource, ensureMonitorSchema, updateMonitorSource } from "@/lib/monitor/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  const { sourceId } = await params;
  const body = await request.json();

  await updateMonitorSource(sourceId, {
    departmentName: body.departmentName ?? "",
    channelName: body.channelName ?? "",
    displayName: body.displayName ?? "",
    type: body.type ?? "mct_zwgk_genre",
    listUrl: body.listUrl ?? "",
    enabled: Boolean(body.enabled),
    autoMonitor: Boolean(body.autoMonitor),
    isKey: Boolean(body.isKey),
    startDate: body.startDate ?? "2026-05-05",
    maxItems: Number(body.maxItems ?? 10),
    notes: body.notes ?? "",
    language: body.language ?? "zh",
    region: body.region ?? "domestic",
    contentCategory: body.contentCategory ?? "general",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  const { sourceId } = await params;

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "true";

  const result = await deleteMonitorSource(sourceId, { dryRun });
  return NextResponse.json({
    ok: true,
    deletedSource: result.deletedSource,
    deletedCountsByTable: result.deletedCountsByTable,
    dryRun: result.dryRun,
    durationMs: result.durationMs,
  });
}
