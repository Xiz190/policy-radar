import { NextResponse } from "next/server";
import { ensureMonitorSchema, getLastPushSignal, getUrgentUnreadCount } from "@/lib/monitor/db";

// Vercel Node runtime 默认 10s，Pro 计划可到 300s。
// 我们声明 300s，并在即将超时前主动断开 SSE，让浏览器 EventSource 自动重连。
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  await ensureMonitorSchema();

  const url = new URL(request.url);
  const accepts = (request.headers.get("accept") ?? "").toLowerCase().includes("text/event-stream");

  // 不带 Accept: text/event-stream 的请求（例如浏览器调试、JSON 客户端）返回最新 JSON。
  if (!accepts && url.searchParams.get("accept") !== "sse") {
    const sinceHours = Number(url.searchParams.get("sinceHours") ?? 24);
    const count = await getUrgentUnreadCount(sinceHours);
    const sig = getLastPushSignal();
    return NextResponse.json({ count, sinceHours, signalAt: sig.lastSignalAt, signalReason: sig.lastReason });
  }

  const sinceHours = Number(url.searchParams.get("sinceHours") ?? 24);
  const tickMs = Math.min(Math.max(Number(url.searchParams.get("tickMs") ?? 5000), 2000), 30_000);
  const heartbeatMs = Math.min(Math.max(Number(url.searchParams.get("heartbeatMs") ?? 15000), 5000), 120_000);

  // 最大保持时长：比 maxDuration 短 10s，提前主动断开，触发浏览器自动重连
  const maxKeepMs = (maxDuration - 10) * 1000;

  const encoder = new TextEncoder();
  let lastCount = -1;
  let lastSignalSeen = 0;
  let lastHeartbeatSent = 0;
  let aborted = false;
  let inFlight = false; // 避免 setInterval 多次触发时累计数据库并发

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();

      // 发送 retry 提示 + 首条数据
      controller.enqueue(encoder.encode(`retry: 5000\n\n`));
      try {
        const count = await getUrgentUnreadCount(sinceHours);
        lastCount = count;
        controller.enqueue(
          encoder.encode(`event: urgentCount\ndata: ${JSON.stringify({ count, sinceHours, t: Date.now() })}\n\n`),
        );
      } catch (e) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`));
      }

      const id = setInterval(async () => {
        if (aborted) return;
        // 上一轮尚未结束 → 跳过本轮，避免累计数据库压力
        if (inFlight) return;
        inFlight = true;
        try {
          // 即将超时 → 主动断开，让浏览器 EventSource 自动重连
          if (Date.now() - startedAt >= maxKeepMs) {
            controller.enqueue(encoder.encode(`event: goodbye\ndata: ${JSON.stringify({ reason: "timeout" })}\n\n`));
            clearInterval(id);
            try {
              controller.close();
            } catch {
              // ignore
            }
            return;
          }
          try {
            const now = Date.now();
            const sig = getLastPushSignal();
            const signalChanged = sig.lastSignalAt > lastSignalSeen;
            const count = await getUrgentUnreadCount(sinceHours);
            const countChanged = count !== lastCount;
            const isDailySummarySignal = sig.lastReason === "daily_summary_ready";

            if (countChanged || signalChanged) {
              lastCount = count;
              lastSignalSeen = sig.lastSignalAt;
              controller.enqueue(
                encoder.encode(
                  `event: urgentCount\ndata: ${JSON.stringify({
                    count,
                    sinceHours,
                    t: now,
                    signalAt: sig.lastSignalAt,
                    signalChanged,
                    signalReason: sig.lastReason,
                  })}\n\n`,
                ),
              );
            }

            // 单独事件：让浏览器可以选择性监听 "dailySummaryReady"
            if (isDailySummarySignal && signalChanged) {
              controller.enqueue(
                encoder.encode(
                  `event: dailySummaryReady\ndata: ${JSON.stringify({
                    t: now,
                    signalAt: sig.lastSignalAt,
                    urgentCount: count,
                    sinceHours,
                  })}\n\n`,
                ),
              );
            } else if (!countChanged && !signalChanged && now - lastHeartbeatSent >= heartbeatMs) {
              lastHeartbeatSent = now;
              controller.enqueue(encoder.encode(`: heartbeat ${now}\n\n`));
            }
          } catch (e) {
            try {
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`));
            } catch {
              // stream already closed by abort handler
            }
          }
        } finally {
          inFlight = false;
        }
      }, tickMs);

      request.signal.addEventListener(
        "abort",
        () => {
          aborted = true;
          clearInterval(id);
          try {
            controller.close();
          } catch {
            // ignore
          }
        },
        { once: true },
      );
    },
    cancel() {
      aborted = true;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
