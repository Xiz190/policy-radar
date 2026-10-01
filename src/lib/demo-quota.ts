// 演示站上访客调用 LLM 的全站每日限额。作者本人、以及本地开发（非演示模式）不计数。
// 超额时调用方应回落到不花钱的规则模式，而不是报错。

import type { Pool } from "pg";
import { isOwnerRequest, isPublicDemo } from "@/lib/demo-mode";

export const DEMO_LLM_DAILY_LIMIT_DEFAULT = 100;

function dailyLimit(): number {
  const n = Number(process.env.DEMO_LLM_DAILY_LIMIT);
  return Number.isFinite(n) && n >= 0 ? n : DEMO_LLM_DAILY_LIMIT_DEFAULT;
}

/** 本次请求能不能调 LLM。能的话顺便记一次数。数据库出错时保守地不让调。 */
export async function consumeDemoLlmQuota(request: Request, pool: Pool): Promise<boolean> {
  if (!isPublicDemo() || isOwnerRequest(request)) return true;
  try {
    await pool.query(
      `create table if not exists demo_usage (
         day date not null,
         kind text not null,
         count integer not null default 0,
         primary key (day, kind)
       )`,
    );
    const { rows } = await pool.query<{ count: number }>(
      `insert into demo_usage (day, kind, count)
       values ((now() at time zone 'Asia/Shanghai')::date, 'llm', 1)
       on conflict (day, kind) do update set count = demo_usage.count + 1
       returning count`,
    );
    return (rows[0]?.count ?? Infinity) <= dailyLimit();
  } catch (error) {
    console.error("[demo-quota] 计数失败，本次不调 LLM：",
      error instanceof Error ? error.message : String(error));
    return false;
  }
}
