import { getPgPool } from "@/lib/db";
import { normalizeItemUrl } from "../utils";

export async function findExistingUrls(sourceId: string, urls: string[]) {
  if (urls.length === 0) return new Set<string>();
  const normalized = urls.map((u) => normalizeItemUrl(u));
  const pool = getPgPool();
  const res = await pool.query(
    `select url from monitor_items where source_id = $1 and url = any($2::text[])`,
    [sourceId, normalized],
  );
  return new Set<string>(res.rows.map((r) => r.url));
}

export async function insertNewItems(
  sourceId: string,
  firstSeenAtIso: string,
  items: Array<{ url: string; title: string; listPublishedAt: string }>,
) {
  if (items.length === 0) return;
  const pool = getPgPool();
  const values: unknown[] = [];
  const placeholders: string[] = [];
  let departmentName: string | null = null;
  try {
    const srcRes = await pool.query(
      `select department_name from monitor_sources where id = $1 limit 1`,
      [sourceId],
    );
    departmentName = srcRes.rows[0]?.department_name ?? null;
  } catch (e) {
    console.warn("[insertNewItems] 获取 department_name 失败，条目将以 NULL 插入", e instanceof Error ? e.message : String(e));
  }
  items.forEach((item, idx) => {
    const base = idx * 6;
    const url = normalizeItemUrl(item.url);
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::date, $${base + 5}::timestamptz, $${base + 6})`);
    values.push(sourceId, url, item.title, item.listPublishedAt, firstSeenAtIso, departmentName);
  });

  await pool.query(
    `insert into monitor_items (source_id, url, title, list_published_at, first_seen_at, department_name)
     values ${placeholders.join(",")}
     on conflict (source_id, url) do nothing`,
    values,
  );
}

export type MonitorInboxItemRow = {
  source_id: string;
  url: string;
  title: string;
  list_published_at: Date | string;
  first_seen_at: Date | string;
  is_read: boolean;
  is_starred: boolean;
  keyword_score: number | string | null;
  importance_level: string | null;
  matched_categories_json: string | null;
};