import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/db";
import {
  ensureAutoMonitorBootstrapped,
  getSchedulerState,
  isSchedulerRunning,
  stopAutoMonitorScheduler,
  SCHEDULE_INTERVAL_MS,
} from "@/lib/monitor/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = getSchedulerState();
  return NextResponse.json({
    running: isSchedulerRunning(),
    intervalMs: SCHEDULE_INTERVAL_MS,
    scheduler: state,
  });
}

export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const bootstrapped = await ensureAutoMonitorBootstrapped();
  return NextResponse.json({
    running: isSchedulerRunning(),
    intervalMs: SCHEDULE_INTERVAL_MS,
    scheduler: bootstrapped,
    action: "start",
  });
}

export async function DELETE(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  stopAutoMonitorScheduler();
  return NextResponse.json({
    running: isSchedulerRunning(),
    scheduler: getSchedulerState(),
    action: "stop",
  });
}
