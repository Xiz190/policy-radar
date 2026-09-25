import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ ok: false, error: "missing url" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MusicSearch-Monitor/1.0)" },
      redirect: "follow",
    }).finally(() => clearTimeout(timer));

    return NextResponse.json({ ok: res.ok || res.status < 400, status: res.status, url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = msg.includes("abort") || msg.includes("timeout");
    return NextResponse.json({ ok: false, status: timedOut ? 408 : 0, error: msg, url });
  }
}
