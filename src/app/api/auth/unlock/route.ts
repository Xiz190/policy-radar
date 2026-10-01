import { NextResponse } from "next/server";
import {
  OWNER_COOKIE,
  OWNER_COOKIE_MAX_AGE,
  isValidAdminToken,
  ownerCookieValue,
} from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

// 作者登录：口令对了就种一个 180 天的 httpOnly cookie（存的是口令的哈希）
export async function POST(request: Request) {
  let token = "";
  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    // 空 body 按口令错误处理
  }

  if (!isValidAdminToken(token)) {
    // 放慢一点，别让人暴力试口令
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ ok: false, error: "口令不正确" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, ownerCookieValue(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OWNER_COOKIE_MAX_AGE,
  });
  return res;
}

// 退出：清掉 cookie
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
