import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MonitorState } from "@/lib/monitor/types";

function getMonitorDataDir() {
  // 注意：这是服务端运行时落盘目录，用于最小可用的"任务层"状态保存（去重/最后运行记录）
  // 已加入 .gitignore
  return path.join(process.cwd(), "data", "monitor");
}

function getStatePath() {
  return path.join(getMonitorDataDir(), "state.json");
}

function getTmpPath() {
  // 临时写入路径（写入完成后再 rename，保证原子性，避免进程被 kill 后产生半截 JSON）
  return path.join(getMonitorDataDir(), "state.json.tmp");
}

export async function readMonitorState(): Promise<MonitorState> {
  const statePath = getStatePath();
  try {
    const raw = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw) as MonitorState;
    return {
      seenUrlsBySource: parsed.seenUrlsBySource ?? {},
      lastRun: parsed.lastRun,
    };
  } catch (err) {
    // 文件不存在 / JSON 损坏 / 无权限等，统一重置为默认状态并打印一次信息（方便排查）
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      console.warn(`[monitor/storage] 读取/解析 state.json 失败，已重置（code=${code}）：`,
        err instanceof Error ? err.message : String(err));
    }
    return { seenUrlsBySource: {} };
  }
}

export async function writeMonitorState(state: MonitorState) {
  const dir = getMonitorDataDir();
  await mkdir(dir, { recursive: true });

  const tmp = getTmpPath();
  const target = getStatePath();

  // 1) 先写入临时文件（即便中途 crash，也只会是 tmp 损坏，不会破坏正式 state.json）
  await writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
  // 2) 原子 rename：在 POSIX 系统上是原子操作；Windows 上 Node.js 也会尽力做覆盖式替换
  await rename(tmp, target);
}
