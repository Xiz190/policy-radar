import { NextResponse } from "next/server";
import { requireAdminToken, isDbAvailable } from "@/lib/db";
import {
  batchUpdateItems,
  ensureMonitorSchema,
  ensureNotificationSchema,
  getUrgentUnreadCount,
  upsertNotificationState,
  getLastNotificationState,
  signalPush,
} from "@/lib/monitor/db";
import { createApiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const apiLog = createApiLogger("api/monitor/items/batch");

export async function POST(request: Request) {
  const startTime = apiLog.start("POST", request.url);
  try {
    const auth = requireAdminToken(request);
    if (!auth.ok) {
      apiLog.warn(`认证失败: ${auth.message}`, { status: auth.status });
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

    await ensureMonitorSchema();

    if (!isDbAvailable()) {
      const url = new URL(request.url);
      const action = url.searchParams.get("action") ?? "batch";
      apiLog.success(startTime, "POST", request.url, 200, { action, mock: true });
      return NextResponse.json({ ok: true, updated: 0, action, mock: true });
    }
    await ensureNotificationSchema();

    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "batch";

    if (action === "markAllRead") {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const { isRead = true, ...filter } = body as { isRead?: boolean; [k: string]: unknown };
      const res = await batchUpdateItems({
        ...pickFilter(filter),
        isRead: Boolean(isRead),
      });
      if (res.updated > 0) signalPush(`markAllRead:${res.updated}`);
      apiLog.success(startTime, "POST", request.url, 200, { action, updated: res.updated });
      return NextResponse.json({ ok: true, updated: res.updated, action: "markAllRead" });
    }

    if (action === "markAllUnread") {
      const res = await batchUpdateItems({ isRead: false });
      apiLog.success(startTime, "POST", request.url, 200, { action, updated: res.updated });
      return NextResponse.json({ ok: true, updated: res.updated, action: "markAllUnread" });
    }

    if (action === "markAllStarred") {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const { isStarred = true, ...filter } = body as { isStarred?: boolean; [k: string]: unknown };
      const res = await batchUpdateItems({
        ...pickFilter(filter),
        isStarred: Boolean(isStarred),
      });
      if (res.updated > 0) signalPush(`markAllStarred:${res.updated}`);
      apiLog.success(startTime, "POST", request.url, 200, { action, updated: res.updated });
      return NextResponse.json({ ok: true, updated: res.updated, action: "markAllStarred" });
    }

    // 默认走通用 batchUpdate
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
      if (!body || typeof body !== "object") throw new Error("invalid body");
    } catch {
      apiLog.warn("无效的 JSON 请求体", { status: 400 });
      return NextResponse.json({ ok: false, error: "invalid_json_body" }, { status: 400 });
    }
    const { isRead, isStarred, ...rest } = body as {
      isRead?: boolean;
      isStarred?: boolean;
      [k: string]: unknown;
    };
    const res = await batchUpdateItems({
      ...pickFilter(rest),
      isRead: typeof isRead === "boolean" ? isRead : undefined,
      isStarred: typeof isStarred === "boolean" ? isStarred : undefined,
    });
    if ((res as { error?: string }).error === "no_filter") {
      apiLog.warn("缺少过滤条件", { status: 400 });
      return NextResponse.json(
        { ok: false, error: "no_filter", message: "必须至少提供一个过滤条件（如 onlyUnread/sourceIds/importanceLevels/fromDate 等）" },
        { status: 400 },
      );
    }
    if (res.updated > 0) signalPush(`batch:${res.updated}`);
    apiLog.success(startTime, "POST", request.url, 200, { action, updated: res.updated });
    return NextResponse.json({ ok: true, updated: res.updated });
  } catch (err) {
    apiLog.requestError(startTime, "POST", request.url, 500, err);
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV === "development") {
      const stack = err instanceof Error ? (err.stack || "").slice(0, 500) : "";
      return NextResponse.json({ error: "batch_failed", detail: message, stack }, { status: 500 });
    }
    return NextResponse.json({ error: "batch_failed", detail: "服务器内部错误，请稍后重试" }, { status: 500 });
  }
}

function pickFilter(rest: Record<string, unknown>): import("@/lib/monitor/db").BatchFilter {
  const parseList = (value: unknown): string[] | undefined => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map((x) => String(x)).filter(Boolean);
    if (typeof value !== "string") return undefined;
    const items = value.split(",").map((x) => x.trim()).filter(Boolean);
    return items.length ? items : undefined;
  };
  const parseDate = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    return value;
  };
  const df = typeof rest.dateField === "string" && (rest.dateField === "list_published_at" || rest.dateField === "first_seen_at")
    ? rest.dateField
    : undefined;
  return {
    departmentName: typeof rest.departmentName === "string" ? rest.departmentName : undefined,
    sourceId: typeof rest.sourceId === "string" ? rest.sourceId : undefined,
    url: typeof rest.url === "string" ? rest.url : undefined,
    sourceIds: parseList(rest.sourceIds),
    channelNames: parseList(rest.channelNames),
    importanceLevels: parseList(rest.importanceLevels),
    categories: parseList(rest.categories),
    q: typeof rest.q === "string" && rest.q.trim() ? rest.q.trim() : undefined,
    onlyUnread: rest.onlyUnread === true || String(rest.onlyUnread) === "1",
    onlyStarred: rest.onlyStarred === true || String(rest.onlyStarred) === "1",
    fromDate: parseDate(rest.fromDate),
    toDate: parseDate(rest.toDate),
    dateField: df as "list_published_at" | "first_seen_at" | undefined,
  };
}

// ===== GET 用于轮询加急数量 =====
export async function GET(request: Request) {
  const startTime = apiLog.start("GET", request.url);
  try {
    await ensureMonitorSchema();
    await ensureNotificationSchema();
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "urgentCount";
    const sinceHours = Number(url.searchParams.get("sinceHours") ?? 24);

    if (action === "urgentCount") {
      const count = await getUrgentUnreadCount(sinceHours);
      const last = await getLastNotificationState("urgent_alert");
      apiLog.success(startTime, "GET", request.url, 200, { action, count, sinceHours });
      return NextResponse.json({ count, sinceHours, lastSeenCount: last?.lastSeenCount ?? 0, lastSentAt: last?.lastSentAt });
    }

    if (action === "markUrgentSeen") {
      const count = await getUrgentUnreadCount(sinceHours);
      await upsertNotificationState("urgent_alert", { at: new Date().toISOString(), sinceHours }, count);
      apiLog.success(startTime, "GET", request.url, 200, { action, seenCount: count });
      return NextResponse.json({ ok: true, seenCount: count });
    }

    apiLog.warn(`未知操作: ${action}`, { status: 400 });
    return NextResponse.json({ ok: false, error: `unknown action ${action}` }, { status: 400 });
  } catch (err) {
    apiLog.requestError(startTime, "GET", request.url, 500, err);
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV === "development") {
      const stack = err instanceof Error ? (err.stack || "").slice(0, 500) : "";
      return NextResponse.json({ error: "query_failed", detail: message, stack }, { status: 500 });
    }
    return NextResponse.json({ error: "query_failed", detail: "服务器内部错误，请稍后重试" }, { status: 500 });
  }
}
