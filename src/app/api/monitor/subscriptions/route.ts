import { NextResponse } from "next/server";
import { requireAdminToken, isDbAvailable } from "@/lib/db";
import {
  ensureMonitorSchema,
  getSubscriptionsByUser,
  getSubscriptionsByType,
  upsertSubscription,
  deleteSubscription,
  deleteSubscriptionByTarget,
  toggleSubscription,
} from "@/lib/monitor/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureMonitorSchema();
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "default";
  const type = url.searchParams.get("type") as "department" | "keyword" | "category" | null;

  if (!isDbAvailable()) {
    if (type) return NextResponse.json({ userId, type, subscriptions: [] });
    return NextResponse.json({ userId, subscriptions: [] });
  }

  if (type) {
    const rows = await getSubscriptionsByType(userId, type);
    return NextResponse.json({ userId, type, subscriptions: rows });
  }
  const rows = await getSubscriptionsByUser(userId);
  return NextResponse.json({ userId, subscriptions: rows });
}

export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  const body = await request.json();
  const userId = String(body?.userId ?? "default").trim();
  const type = body?.type as "department" | "keyword" | "category";
  const target = String(body?.target ?? "").trim();

  if (!type || !["department", "keyword", "category"].includes(type)) {
    return NextResponse.json({ ok: false, error: "type must be department/keyword/category" }, { status: 400 });
  }
  if (!target) {
    return NextResponse.json({ ok: false, error: "target required" }, { status: 400 });
  }

  const targetName = String(body?.targetName ?? "").trim() || undefined;
  const enabled = body?.enabled !== false;

  await upsertSubscription(userId, type, target, targetName, enabled);
  return NextResponse.json({ ok: true, userId, type, target });
}

export async function DELETE(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  const body = await request.json();

  if (body?.id) {
    await deleteSubscription(String(body.id));
    return NextResponse.json({ ok: true });
  }

  const userId = String(body?.userId ?? "default").trim();
  const type = body?.type as "department" | "keyword" | "category";
  const target = String(body?.target ?? "").trim();

  if (!type || !target) {
    return NextResponse.json({ ok: false, error: "id required, or userId + type + target" }, { status: 400 });
  }

  await deleteSubscriptionByTarget(userId, type, target);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  const body = await request.json();

  if (body?.action === "toggle") {
    if (!body?.id) {
      return NextResponse.json({ ok: false, error: "id required for toggle" }, { status: 400 });
    }
    await toggleSubscription(String(body.id));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}