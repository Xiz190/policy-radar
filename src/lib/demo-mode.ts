// 公开演示模式（PUBLIC_DEMO=1）：线上站给访客只读，作者输一次口令后解锁全部功能。
//
// - 访客：GET 照常（作者专属的诊断/调试/跳板类接口除外，清单见 lib/owner-only.ts）；
//   写操作（POST/PUT/PATCH/DELETE）一律 403，只放行问答助手和登录接口
// - 访客打开管理/个人设置页面（同一清单）会被跳到 /unlock
// - 作者：带 Authorization: Bearer <ADMIN_TOKEN>，或 /unlock 页登录后拿到的 cookie
// - 本地开发不设 PUBLIC_DEMO，一切照旧
//
// cookie 里存的是口令的 sha256，不是口令本身；proxy 和各路由都在 Node 运行时，直接用 node:crypto。

import { createHash, timingSafeEqual } from "node:crypto";
import { isOwnerOnlyApi } from "@/lib/owner-only";

export const OWNER_COOKIE = "owner_session";
export const OWNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 天，一台设备登录一次就够

/** 访客也能发的写请求：问答助手（有每日限额）+ 登录/退出 */
export const VISITOR_WRITE_ALLOWLIST = new Set([
  "/api/chat/search",
  "/api/chat/answer",
  "/api/auth/unlock",
]);

export function isPublicDemo(): boolean {
  return process.env.PUBLIC_DEMO === "1";
}

function adminToken(): string {
  return process.env.ADMIN_TOKEN?.trim() ?? "";
}

export function ownerCookieValue(token: string): string {
  return createHash("sha256").update(`owner:${token}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function isValidAdminToken(provided: string): boolean {
  const token = adminToken();
  return !!token && !!provided && safeEqual(provided, token);
}

function readCookie(request: Request, name: string): string {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

/** 这个请求是不是作者本人（Bearer 口令或登录 cookie）。没设 ADMIN_TOKEN 时永远不是。 */
export function isOwnerRequest(request: Request): boolean {
  const token = adminToken();
  if (!token) return false;
  const bearer = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (bearer && safeEqual(bearer, token)) return true;
  const cookie = readCookie(request, OWNER_COOKIE);
  return !!cookie && safeEqual(cookie, ownerCookieValue(token));
}

export type DemoAccess = "allow" | "deny";

/** proxy 的判定逻辑（纯函数，方便测试） */
export function decideDemoAccess(opts: {
  demo: boolean;
  method: string;
  pathname: string;
  search?: string;
  isOwner: boolean;
}): DemoAccess {
  if (!opts.demo || opts.isOwner) return "allow";
  if (isOwnerOnlyApi(opts.pathname, opts.search)) return "deny";
  const m = opts.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return "allow";
  // 白名单按原始路径匹配：/api/proxy/chat/answer 这类绕一圈的写请求照样挡
  if (VISITOR_WRITE_ALLOWLIST.has(opts.pathname)) return "allow";
  return "deny";
}
