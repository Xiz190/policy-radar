import { NextResponse } from "next/server";
import { deleteDepartmentByName, ensureMonitorSchema } from "@/lib/monitor/db";
import { requireAdminToken } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  const url = new URL(request.url);
  const departmentName = url.searchParams.get("departmentName")?.trim();
  const dryRun = url.searchParams.get("dryRun") === "true";

  if (!departmentName) {
    return NextResponse.json({ error: "missing departmentName" }, { status: 400 });
  }

  const result = await deleteDepartmentByName(departmentName, { dryRun });
  return NextResponse.json({
    ok: true,
    deletedMinistry: result.deletedMinistry,
    deletedCountsByTable: result.deletedCountsByTable,
    dryRun: result.dryRun,
    durationMs: result.durationMs,
  });
}
