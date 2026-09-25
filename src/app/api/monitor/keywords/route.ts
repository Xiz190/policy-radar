import { NextResponse } from "next/server";
import { requireAdminToken, isDbAvailable } from "@/lib/db";
import {
  ensureMonitorSchema,
  getKeywordsByDepartment,
  upsertKeyword,
  deleteKeywordById,
  deleteKeywordByText,
} from "@/lib/monitor/db";

export const dynamic = "force-dynamic";

/**
 * 取某部委的关键词列表，或批量取所有部委关键词（未提供 departmentName 时）
 *   GET /api/monitor/keywords?departmentName=文化和旅游部
 *   GET /api/monitor/keywords
 */
export async function GET(request: Request) {
  await ensureMonitorSchema();
  const url = new URL(request.url);
  const departmentName = url.searchParams.get("departmentName");

  if (!isDbAvailable()) {
    return NextResponse.json({ departmentName: departmentName ?? "__global__", keywords: [] });
  }

  if (departmentName) {
    const rows = await getKeywordsByDepartment(departmentName);
    return NextResponse.json({ departmentName, keywords: rows });
  }
  return NextResponse.json({ error: "departmentName required" }, { status: 400 });
}

/**
 * 新增或更新关键词：
 *   POST /api/monitor/keywords  body: { departmentName, keyword, weight? }
 *   POST /api/monitor/keywords  body: { departmentName, keywords: [{ keyword, weight? }] }
 */
export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  const body = await request.json();
  const departmentName = String(body?.departmentName ?? "").trim();
  if (!departmentName) {
    return NextResponse.json({ ok: false, error: "departmentName required" }, { status: 400 });
  }

  const keywordsRaw = body?.keywords;
  if (Array.isArray(keywordsRaw)) {
    for (const entry of keywordsRaw) {
      const kw = String(entry?.keyword ?? "").trim();
      if (!kw) continue;
      const weight = Number(entry?.weight ?? 1) || 1;
      await upsertKeyword(departmentName, kw, weight);
    }
    return NextResponse.json({ ok: true, departmentName });
  }

  const keyword = String(body?.keyword ?? "").trim();
  if (!keyword) {
    return NextResponse.json({ ok: false, error: "keyword required" }, { status: 400 });
  }
  const weight = Number(body?.weight ?? 1) || 1;
  await upsertKeyword(departmentName, keyword, weight);
  return NextResponse.json({ ok: true, departmentName, keyword, weight });
}

/**
 * 删除关键词：
 *   DELETE /api/monitor/keywords  body: { departmentName, keyword }  或 { id }
 */
export async function DELETE(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  const body = await request.json();
  if (body?.id) {
    await deleteKeywordById(String(body.id));
    return NextResponse.json({ ok: true });
  }
  const departmentName = String(body?.departmentName ?? "").trim();
  const keyword = String(body?.keyword ?? "").trim();
  if (!departmentName || !keyword) {
    return NextResponse.json({ ok: false, error: "departmentName + keyword required, or id" }, { status: 400 });
  }
  await deleteKeywordByText(departmentName, keyword);
  return NextResponse.json({ ok: true });
}
