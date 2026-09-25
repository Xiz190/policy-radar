import { runMonitorOnce } from "@/lib/monitor/runner";

export const SCHEDULE_INTERVAL_MS = 30 * 60 * 1000;

type SchedulerState = {
  startedAt: string;
  intervalMs: number;
  lastRunAt: string | null;
  lastRunId: string | null;
  nextRunAt: string;
  runningNow: boolean;
};

let timer: NodeJS.Timeout | null = null;
let state: SchedulerState | null = null;
let isBooting = false;
let bootstrapped = false;

function nowIso() {
  return new Date().toISOString();
}

function computeNextRunAt(lastRunAtIso: string | null, intervalMs: number) {
  const base = lastRunAtIso ? new Date(lastRunAtIso).getTime() : Date.now();
  return new Date(base + intervalMs).toISOString();
}

export async function startAutoMonitorScheduler(intervalMs: number = SCHEDULE_INTERVAL_MS) {
  if (timer) {
    return getSchedulerState();
  }

  if (isBooting) {
    return getSchedulerState();
  }
  isBooting = true;

  state = {
    startedAt: nowIso(),
    intervalMs,
    lastRunAt: null,
    lastRunId: null,
    nextRunAt: computeNextRunAt(null, intervalMs),
    runningNow: false,
  };

  timer = setInterval(async () => {
    if (!state) return;
    if (state.runningNow) return;
    state.runningNow = true;
    try {
      const run = await runMonitorOnce();
      state.lastRunAt = run.startedAt;
      state.lastRunId = run.id;
      state.nextRunAt = computeNextRunAt(run.startedAt, state.intervalMs);
    } catch (error) {
      console.error("[scheduler] 定时任务执行失败（下一轮继续）：",
        error instanceof Error ? error.message : String(error));
    } finally {
      state.runningNow = false;
    }
  }, intervalMs);

  // 启动时立刻跑一次（第一轮）
  setImmediate(async () => {
    if (!state) return;
    state.runningNow = true;
    try {
      const run = await runMonitorOnce();
      state.lastRunAt = run.startedAt;
      state.lastRunId = run.id;
      state.nextRunAt = computeNextRunAt(run.startedAt, state.intervalMs);
    } catch (error) {
      console.error("[scheduler] 首次启动任务失败：",
        error instanceof Error ? error.message : String(error));
    } finally {
      state.runningNow = false;
      isBooting = false;
    }
  });

  return state;
}

export function stopAutoMonitorScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (state) {
    state.nextRunAt = "";
  }
}

export function getSchedulerState(): SchedulerState | null {
  if (!state) return null;
  return {
    startedAt: state.startedAt,
    intervalMs: state.intervalMs,
    lastRunAt: state.lastRunAt,
    lastRunId: state.lastRunId,
    nextRunAt: state.nextRunAt,
    runningNow: state.runningNow,
  };
}

export function isSchedulerRunning(): boolean {
  return timer !== null;
}

export async function ensureAutoMonitorBootstrapped(intervalMs: number = SCHEDULE_INTERVAL_MS) {
  if (bootstrapped) {
    return getSchedulerState();
  }
  bootstrapped = true;
  return startAutoMonitorScheduler(intervalMs);
}
