import { NextResponse, type NextRequest } from "next/server";
import { decideDemoAccess, isOwnerRequest, isPublicDemo } from "@/lib/demo-mode";
import { isOwnerOnlyPage } from "@/lib/owner-only";

// 公开演示站的闸门（规则见 lib/demo-mode.ts 与 lib/owner-only.ts）：
// - 接口：访客的写请求、作者专属接口 → 403
// - 页面：访客打开管理/个人设置页 → 跳到 /unlock，登录后回到原页面
// 本地开发没设 PUBLIC_DEMO 时直接放行。
export function proxy(request: NextRequest) {
  if (!isPublicDemo()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    if (isOwnerOnlyPage(pathname) && !isOwnerRequest(request)) {
      const unlock = new URL("/unlock", request.url);
      unlock.searchParams.set("next", pathname + search);
      return NextResponse.redirect(unlock);
    }
    return NextResponse.next();
  }

  const access = decideDemoAccess({
    demo: true,
    method: request.method,
    pathname,
    search,
    isOwner: isOwnerRequest(request),
  });
  if (access === "allow") return NextResponse.next();

  return NextResponse.json(
    { ok: false, error: "演示站只读：这是作者本人的工作台，访客可以浏览、搜索和使用问答助手。", demoReadonly: true },
    { status: 403, headers: { "x-demo-readonly": "1" } },
  );
}

export const config = {
  matcher: [
    "/api/:path*",
    "/monitor/:path*",
    "/keywords/:path*",
    "/alerts/:path*",
    "/digest/:path*",
    "/settings/:path*",
    "/stats/:path*",
    "/readinglist/:path*",
  ],
};
