import { getPgPool } from "@/lib/db";

export type SubscriptionRecord = {
  id: string;
  userId: string;
  type: "department" | "keyword" | "category";
  target: string;
  targetName: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function getSubscriptionsByUser(userId: string = "default") {
  const pool = getPgPool();
  const res = await pool.query<{
    id: string;
    user_id: string;
    type: string;
    target: string;
    target_name: string | null;
    enabled: boolean;
    created_at: Date | string;
    updated_at: Date | string;
  }>(
    `select id, user_id, type, target, target_name, enabled, created_at, updated_at
     from monitor_subscriptions
     where user_id = $1
     order by type, target`,
    [userId],
  );
  return res.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type as SubscriptionRecord["type"],
    target: row.target,
    targetName: row.target_name ?? null,
    enabled: row.enabled,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }));
}

export async function getSubscriptionsByType(userId: string = "default", type: SubscriptionRecord["type"]) {
  const pool = getPgPool();
  const res = await pool.query<{
    id: string;
    user_id: string;
    type: string;
    target: string;
    target_name: string | null;
    enabled: boolean;
    created_at: Date | string;
    updated_at: Date | string;
  }>(
    `select id, user_id, type, target, target_name, enabled, created_at, updated_at
     from monitor_subscriptions
     where user_id = $1 and type = $2
     order by target`,
    [userId, type],
  );
  return res.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type as SubscriptionRecord["type"],
    target: row.target,
    targetName: row.target_name ?? null,
    enabled: row.enabled,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }));
}

export async function upsertSubscription(
  userId: string,
  type: SubscriptionRecord["type"],
  target: string,
  targetName?: string,
  enabled: boolean = true,
) {
  const pool = getPgPool();
  const trimmedTarget = target.trim();
  if (!trimmedTarget) return;
  const id = `${userId}:${type}:${trimmedTarget.toLowerCase()}`;
  await pool.query(
    `insert into monitor_subscriptions (id, user_id, type, target, target_name, enabled)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update set target_name = $5, enabled = $6, updated_at = now()`,
    [id, userId, type, trimmedTarget, targetName?.trim() || null, enabled],
  );
}

export async function deleteSubscription(id: string) {
  const pool = getPgPool();
  await pool.query(`delete from monitor_subscriptions where id = $1`, [id]);
}

export async function deleteSubscriptionByTarget(userId: string, type: SubscriptionRecord["type"], target: string) {
  const pool = getPgPool();
  const id = `${userId}:${type}:${target.trim().toLowerCase()}`;
  await pool.query(`delete from monitor_subscriptions where id = $1`, [id]);
}

export async function toggleSubscription(id: string) {
  const pool = getPgPool();
  await pool.query(
    `update monitor_subscriptions set enabled = not enabled, updated_at = now() where id = $1`,
    [id],
  );
}