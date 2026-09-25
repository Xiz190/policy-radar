import { getPgPool } from "@/lib/db";

export type MonitorKeywordRow = {
  id: string;
  department_name: string;
  keyword: string;
  weight: number;
  created_at: Date | string;
};

export async function getKeywordsByDepartment(departmentName: string) {
  const pool = getPgPool();
  const res = await pool.query<MonitorKeywordRow>(
    `select id, department_name, keyword, weight, created_at from monitor_keywords where department_name = $1 order by weight desc, created_at desc`,
    [departmentName],
  );
  return res.rows.map((row) => ({
    id: row.id,
    departmentName: row.department_name,
    keyword: row.keyword,
    weight: Number(row.weight),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

const RESERVED_DEPARTMENT_KEYS = new Set(["__global__", "__domain__", "global", "default", "other", ""]);

/**
 * 领域主题词（department_name = '__domain__'）：入库前的"这条属不属于本台领域"白名单门槛。
 * 与 __global__ 信号词（进库后算强度分）语义分开。返回小写词数组；空数组表示不过滤。
 * 换领域 = 换这一张 __domain__ 词表 + 换激活源清单，代码不动（可复用套壳的落点）。
 */
export async function getDomainKeywords(): Promise<string[]> {
  const pool = getPgPool();
  const res = await pool.query<{ keyword: string }>(
    `select keyword from monitor_keywords where department_name = '__domain__'`,
  );
  return res.rows.map((r) => r.keyword.trim().toLowerCase()).filter((k) => k.length > 0);
}

export function isReservedDepartmentKey(key: string): boolean {
  return RESERVED_DEPARTMENT_KEYS.has(key.trim().toLowerCase());
}

export async function getAllDepartments(): Promise<Array<{ slug: string; name: string }>> {
  const pool = getPgPool();
  const res = await pool.query<{ department_name: string }>(
    `select distinct department_name from monitor_sources where department_name is not null order by department_name`,
  );
  return res.rows
    .map((row) => ({ slug: row.department_name, name: row.department_name }))
    .filter((d) => !isReservedDepartmentKey(d.slug));
}

export async function getGlobalKeywords() {
  const pool = getPgPool();
  const res = await pool.query<MonitorKeywordRow>(
    `select id, department_name, keyword, weight, created_at from monitor_keywords where department_name = '__global__' order by weight desc, created_at desc`,
  );
  return res.rows.map((row) => ({
    id: row.id,
    keyword: row.keyword,
    weight: Number(row.weight),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

export async function getAllKeywordsGrouped() {
  const pool = getPgPool();
  const res = await pool.query<MonitorKeywordRow>(
    `select id, department_name, keyword, weight, created_at from monitor_keywords where department_name != '__global__' order by department_name, weight desc, created_at desc`,
  );
  const groups = new Map<string, Array<{ id: string; keyword: string; weight: number }>>();
  res.rows.forEach((row) => {
    if (isReservedDepartmentKey(row.department_name)) return;
    const arr = groups.get(row.department_name) ?? [];
    arr.push({ id: row.id, keyword: row.keyword, weight: Number(row.weight) });
    groups.set(row.department_name, arr);
  });
  return groups;
}

export async function upsertKeyword(departmentName: string, keyword: string, weight: number = 1) {
  const pool = getPgPool();
  const trimmed = keyword.trim();
  if (!trimmed) return;
  const id = `${departmentName}:${trimmed.toLowerCase()}`;
  await pool.query(
    `insert into monitor_keywords (id, department_name, keyword, weight) values ($1, $2, $3, $4)
     on conflict (id) do update set weight = $4`,
    [id, departmentName, trimmed, weight],
  );
}

export async function deleteKeywordById(id: string) {
  const pool = getPgPool();
  await pool.query(`delete from monitor_keywords where id = $1`, [id]);
}

export async function deleteKeywordByText(departmentName: string, keyword: string) {
  const pool = getPgPool();
  await pool.query(`delete from monitor_keywords where department_name = $1 and lower(keyword) = lower($2)`, [
    departmentName,
    keyword.trim(),
  ]);
}