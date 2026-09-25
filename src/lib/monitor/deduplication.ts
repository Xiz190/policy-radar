import crypto from "crypto";

export function computeDeduplicationKey(title: string, paragraphs: string[]): string {
  const content = [title, ...paragraphs].join("\n");
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function findDuplicateByKey(
  pool: ReturnType<typeof import("@/lib/db").getPgPool>,
  deduplicationKey: string,
  excludeSourceId?: string,
  excludeUrl?: string,
): Promise<{ sourceId: string; url: string } | null> {
  const params: unknown[] = [deduplicationKey];
  let query = `select source_id, url from monitor_items where deduplication_key = $1`;

  if (excludeSourceId && excludeUrl) {
    query += ` and not (source_id = $2 and url = $3)`;
    params.push(excludeSourceId, excludeUrl);
  }

  query += ` limit 1`;

  const res = await pool.query(query, params);
  if (res.rows.length === 0) return null;

  return {
    sourceId: res.rows[0].source_id,
    url: res.rows[0].url,
  };
}

export async function updateItemDuplicateStatus(
  pool: ReturnType<typeof import("@/lib/db").getPgPool>,
  sourceId: string,
  url: string,
  isDuplicate: boolean,
  duplicateOf: string | null,
) {
  await pool.query(
    `update monitor_items
     set is_duplicate = $3, duplicate_of = $4
     where source_id = $1 and url = $2`,
    [sourceId, url, isDuplicate, duplicateOf],
  );
}