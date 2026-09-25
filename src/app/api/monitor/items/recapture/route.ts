import { NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/db";
import { ensureMonitorSchema, upsertItemDetail, scanAndApplyKeywords } from "@/lib/monitor/db";
import { captureDetailPage } from "@/lib/monitor/detail";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = requireAdminToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureMonitorSchema();
  const body = await request.json();
  const sourceId = String(body?.sourceId ?? "").trim();
  const url = String(body?.url ?? "").trim();
  if (!sourceId || !url) {
    return NextResponse.json({ ok: false, error: "sourceId and url required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  try {
    const detail = await captureDetailPage(url);
    await upsertItemDetail(sourceId, url, {
      pageTitle: detail.pageTitle,
      paragraphs: detail.paragraphs,
      attachments: detail.attachments.map((a) => ({ url: a.url, text: a.text, kind: a.kind })),
      externalLinks: (detail.externalLinks ?? []).map((l) => ({ text: l.text, url: l.url })),
      contentQuality: detail.contentQuality,
      captureNote: detail.captureNote,
      capturedAtIso: now,
    });
    try {
      await scanAndApplyKeywords(sourceId, url);
    } catch {
      // 关键词扫描失败不阻塞主流程
    }
    return NextResponse.json({
      ok: true,
      pageTitle: detail.pageTitle,
      paragraphCount: detail.paragraphs.length,
      attachmentCount: detail.attachments.length,
      externalLinkCount: (detail.externalLinks ?? []).length,
      contentQuality: detail.contentQuality,
      finalUrl: detail.finalUrl,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "recapture failed" }, { status: 500 });
  }
}
