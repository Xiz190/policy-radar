import { NextResponse } from "next/server";
import { createApiLogger } from "@/lib/logger";
import { isOwnerRequest, isPublicDemo } from "@/lib/demo-mode";

const apiLog = createApiLogger("api/proxy");

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

export async function PUT(request: Request) {
  return handleRequest(request);
}

export async function DELETE(request: Request) {
  return handleRequest(request);
}

export async function PATCH(request: Request) {
  return handleRequest(request);
}

async function handleRequest(request: Request): Promise<Response> {
  const startTime = apiLog.start(request.method, request.url);
  const url = new URL(request.url);
  
  const handlerMap: Record<string, string> = {
    "/api/monitor/items": "./../../monitor/items/route",
    "/api/monitor/items/batch": "./../../monitor/items/batch/route",
    "/api/monitor/items/recapture": "./../../monitor/items/recapture/route",
    "/api/monitor/sources": "./../../monitor/sources/route",
    "/api/monitor/sources/batch": "./../../monitor/sources/batch/route",
    "/api/monitor/sources/groups": "./../../monitor/sources/departments/route",
    "/api/monitor/subscriptions": "./../../monitor/subscriptions/route",
    "/api/monitor/keywords": "./../../monitor/keywords/route",
    "/api/monitor/keywords/clean": "./../../monitor/keywords/clean/route",
    "/api/monitor/daily-summary": "./../../monitor/daily-summary/route",
  };
  
  apiLog.debug("代理请求入口", {
    originalPath: url.pathname,
    searchParams: url.search,
    method: request.method,
  });
  
  const proxyPath = "/api" + url.pathname.replace("/api/proxy", "");
  
  apiLog.debug("路径映射", {
    proxyPath,
    handlerFound: !!handlerMap[proxyPath],
    availableHandlers: Object.keys(handlerMap),
  });
  
  const body = request.body ? await request.text() : undefined;
  
  const augmentedRequest = new Request(url.origin + proxyPath + url.search, {
    method: request.method,
    headers: new Headers(request.headers),
    body,
  } as RequestInit);
  
  // 只替作者本人注入管理员口令。演示站上若对所有人注入，访客经这里转发的请求就等于带着管理员身份
  // （写操作虽然在 proxy.ts 已被挡，读也不该越权）。本地开发不是演示模式，照旧注入。
  const token = process.env.ADMIN_TOKEN;
  if (token && (!isPublicDemo() || isOwnerRequest(request))) {
    augmentedRequest.headers.set("Authorization", `Bearer ${token}`);
    apiLog.debug("已注入 ADMIN_TOKEN");
  }
  
  const handlerPath = handlerMap[proxyPath];
  if (!handlerPath) {
    apiLog.warn(`未配置代理路径: ${proxyPath}`, { status: 404 });
    return NextResponse.json({ error: "proxy_not_found", path: proxyPath }, { status: 404 });
  }
  
  try {
    const proxyModule = await import(handlerPath);
    const method = request.method as keyof typeof proxyModule;
    const handler = proxyModule[method];
    
    if (!handler) {
      apiLog.warn(`方法不支持: ${request.method}`, { path: proxyPath, status: 405 });
      return NextResponse.json({ error: "method_not_supported", method: request.method }, { status: 405 });
    }
    
    const response = await handler(augmentedRequest);
    apiLog.success(startTime, request.method, request.url, response.status, { target: proxyPath });
    return response;
  } catch (error) {
    apiLog.requestError(startTime, request.method, request.url, 500, error, { target: proxyPath });
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === "development") {
      const stack = error instanceof Error ? (error.stack || "").slice(0, 500) : "";
      return NextResponse.json({ error: "proxy_error", detail: message, stack }, { status: 500 });
    }
    return NextResponse.json({ error: "proxy_error", detail: "服务器内部错误" }, { status: 500 });
  }
}