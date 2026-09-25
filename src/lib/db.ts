import { Pool } from "pg";

declare global {
  var __publicInfoSyncPgPool: Pool | undefined;
  var __publicInfoSyncDbAvailable: boolean | undefined;
}

export function requireAdminToken(request: Request): { ok: true } | { ok: false; status: number; message: string } {
  const token = process.env.ADMIN_TOKEN?.trim();
  if (!token) return { ok: true };
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  const provided = match ? match[1] : "";
  if (!provided || provided !== token) {
    return { ok: false, status: 401, message: "缺少或不正确的 ADMIN_TOKEN（Authorization: Bearer <token>）" };
  }
  return { ok: true };
}

export function isDbAvailable(): boolean {
  if (process.env.FORCE_MOCK_API === "1" || process.env.FORCE_MOCK_API === "true") {
    return false;
  }
  return global.__publicInfoSyncDbAvailable !== false;
}

export function markDbUnavailable() {
  global.__publicInfoSyncDbAvailable = false;
}

export function getPgPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    markDbUnavailable();
    throw new Error("缺少 DATABASE_URL 环境变量（请在 .env.local 中配置）");
  }

  if (!global.__publicInfoSyncPgPool) {
    const envMax = Number(process.env.PG_POOL_MAX);
    const poolMax = Number.isFinite(envMax) && envMax > 0 ? envMax : 5;
    global.__publicInfoSyncPgPool = new Pool({
      connectionString,
      max: poolMax,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 60000,
    });

    global.__publicInfoSyncPgPool.on("error", (err) => {
      console.error("[pg] pool 连接异常：", err.message);
      markDbUnavailable();
    });
  }

  global.__publicInfoSyncDbAvailable = true;
  return global.__publicInfoSyncPgPool;
}

export async function tryGetPgPool(): Promise<Pool | null> {
  try {
    const pool = getPgPool();
    await pool.query("SELECT 1");
    return pool;
  } catch {
    markDbUnavailable();
    return null;
  }
}