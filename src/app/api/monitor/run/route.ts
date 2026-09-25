import { NextResponse } from "next/server";
import { getPgPool, requireAdminToken } from "@/lib/db";
import { runMonitorOnce } from "@/lib/monitor/runner";
import { ensureAutoMonitorBootstrapped } from "@/lib/monitor/scheduler";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: {
    sourceIds?: string[];
    departmentNames?: string[];
    force?: boolean; // 强制运行：先清理锁，再跑
    bypassLockWhenScoped?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  await ensureAutoMonitorBootstrapped();

  // force=true：先手动清理锁，再启动任务（用于"被锁阻挡"时强制运行）
  if (body.force) {
    const pool = getPgPool();
    try {
      await pool.query(`delete from monitor_runs where id = $1`, ["__active_run_lock__"]);
    } catch {
      // ignore
    }
  }

  const hasScope = Array.isArray(body.sourceIds) || Array.isArray(body.departmentNames);
  const run = hasScope
    ? await runMonitorOnce({
        scope: {
          sourceIds: Array.isArray(body.sourceIds) ? body.sourceIds : undefined,
          departmentNames: Array.isArray(body.departmentNames) ? body.departmentNames : undefined,
        },
        bypassLockWhenScoped: body.bypassLockWhenScoped ?? true,
      })
    : await runMonitorOnce({ bypassLockWhenScoped: body.force ? true : undefined });

  return NextResponse.json(run);
}
