import { NextResponse } from "next/server";
import { getMonitorStatus } from "@/lib/monitor/runner";
import { ensureAutoMonitorBootstrapped } from "@/lib/monitor/scheduler";
import { isDbAvailable } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbAvailable()) {
    return NextResponse.json({ status: "idle", mock: true });
  }
  await ensureAutoMonitorBootstrapped();
  const status = await getMonitorStatus();
  return NextResponse.json(status);
}

