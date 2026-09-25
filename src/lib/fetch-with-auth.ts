import { createLogger } from "@/lib/logger";

const logger = createLogger("fetch-with-auth");

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  
  const proxyUrl = url.startsWith("/api/") ? `/api/proxy${url.slice(4)}` : url;
  
  logger.debug("构造代理请求", {
    originalUrl: url,
    proxyUrl,
    method: options.method || "GET",
    hasBody: !!options.body,
  });
  
  const signal = options.signal ?? AbortSignal.timeout(30_000);
  return fetch(proxyUrl, { ...options, headers, signal });
}