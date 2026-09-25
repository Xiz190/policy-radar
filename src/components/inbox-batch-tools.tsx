"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  Bell, Mailbox,
} from "lucide-react";

export type InboxFilter = {
  q?: string;
  onlyUnread?: boolean;
  onlyStarred?: boolean;
  departmentName?: string;
  sourceIds?: string[];
  channelNames?: string[];
  importanceLevels?: string[];
  categories?: string[];
  fromDate?: string;
  toDate?: string;
  dateField?: "list_published_at" | "first_seen_at";
};

export function BatchToolbar({
  filter,
  onRefetch,
  onMarkAll,
}: {
  filter: InboxFilter;
  onRefetch?: () => void;
  onMarkAll?: (action: "markAllRead" | "markAllUnread" | "markAllStarred" | "markAllUnstarred") => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const runAction = useCallback(
    async (action: "markAllRead" | "markAllUnread" | "markAllStarred" | "markAllUnstarred", payload: Record<string, unknown>) => {
      setBusy(action);
      try {
        const res = await fetchWithAuth(`/api/monitor/items/batch?action=${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { ok?: boolean; updated?: number; error?: string; mock?: boolean };
        if (!data.ok) throw new Error(data.error ?? "failed");
        const label =
          action === "markAllRead"
            ? "已全部标记为已读"
            : action === "markAllUnread"
              ? "已全部标记为未读"
              : action === "markAllStarred"
                ? "已全部标记为重点"
                : "已批量取消重点";
        notify(`${label} · 更新 ${data.updated ?? 0} 条`);
        if (action === "markAllRead" || action === "markAllUnread" || action === "markAllStarred" || action === "markAllUnstarred") {
          onMarkAll?.(action as "markAllRead" | "markAllStarred" | "markAllUnstarred");
        }
        if (!data.mock) onRefetch?.();
      } catch (e) {
        notify(`操作失败：${String((e as Error).message ?? e)}`);
      } finally {
        setBusy(null);
      }
    },
    [onRefetch, onMarkAll],
  );

  const filterPayload = useMemo(() => {
    const payload: Record<string, unknown> = { ...filter };
    return payload;
  }, [filter]);

  return (
    <div className="relative flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className="text-xs text-slate-500">批量操作：</span>
      <button
        type="button"
        onClick={() => runAction("markAllRead", { ...filterPayload, isRead: true, onlyUnread: true })}
        disabled={busy === "markAllRead"}
        className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {busy === "markAllRead" ? "处理中…" : "全部标记为已读"}
      </button>
      <button
        type="button"
        onClick={() => runAction("markAllUnread", { ...filterPayload, isRead: false })}
        disabled={busy === "markAllUnread"}
        className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {busy === "markAllUnread" ? "处理中…" : "全部标记为未读"}
      </button>
      <button
        type="button"
        onClick={() => runAction("markAllStarred", { ...filterPayload, isStarred: true })}
        disabled={busy === "markAllStarred"}
        className="inline-flex h-8 items-center rounded-full border border-amber-300 bg-amber-50 px-3 text-xs text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
      >
        {busy === "markAllStarred" ? "处理中…" : "全部标记为重点"}
      </button>
      <button
        type="button"
        onClick={() => runAction("markAllUnstarred", { ...filterPayload, isStarred: false, onlyStarred: true })}
        disabled={busy === "markAllUnstarred"}
        className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {busy === "markAllUnstarred" ? "处理中…" : "批量取消重点"}
      </button>
      <span className="ml-auto text-[11px] text-slate-400">
        基于当前筛选条件 · 全部标记已读仅作用于未读项
      </span>
      {toast ? (
        <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

// ===== 浏览器通知：优先 SSE，EventSource 不可用时退化到轮询 =====
export function UrgentBrowserNotifier({
  pollIntervalMs = 60_000,
  minAlertIntervalMs = 5 * 60 * 1000,
  onDailySummaryReady,
}: {
  pollIntervalMs?: number;
  minAlertIntervalMs?: number;
  onDailySummaryReady?: () => void;
}) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [latestCount, setLatestCount] = useState<number | null>(null);
  const [mode, setMode] = useState<"sse" | "poll" | "off">("off");
  const lastAlertAtRef = useRef<number>(0);
  const lastSeenCountRef = useRef<number>(-1);
  const lastSummaryAlertRef = useRef<number>(0);
  const stableOnSummaryReadyRef = useRef<typeof onDailySummaryReady | undefined>(onDailySummaryReady);

  useEffect(() => {
    stableOnSummaryReadyRef.current = onDailySummaryReady;
  }, [onDailySummaryReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      queueMicrotask(() => setPermission("unsupported"));
      return;
    }
    queueMicrotask(() => setPermission(Notification.permission));
  }, []);

  const pushNotification = useCallback((title: string, body: string) => {
    try {
      const n = new Notification(title, { body, icon: "/favicon.ico" });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // ignore
    }
  }, []);

  const handleCount = useCallback(
    async (countIn: number) => {
      const count = Number(countIn ?? 0);
      setLatestCount(count);
      if (count <= 0) {
        lastSeenCountRef.current = count;
        return;
      }
      const now = Date.now();
      const shouldAlert =
        lastSeenCountRef.current === -1
          ? count > 0
          : count > lastSeenCountRef.current || now - lastAlertAtRef.current > minAlertIntervalMs;
      if (!shouldAlert) {
        lastSeenCountRef.current = count;
        return;
      }

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const title = `${count} 条新加急`;
        pushNotification(title, `近 24 小时加急未读内容：${count} 条。去动态资讯查看。`);
        lastAlertAtRef.current = now;
        await fetch("/api/monitor/items/batch?action=markUrgentSeen", { method: "GET" });
      }
      lastSeenCountRef.current = count;
    },
    [minAlertIntervalMs, pushNotification],
  );

  // 启动 SSE（EventSource）或轮询
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (permission !== "granted") return;

    const supportEventSource =
      typeof (globalThis as unknown as { EventSource?: unknown }).EventSource !== "undefined";

    let stopped = false;

    async function pollOnce() {
      if (stopped) return;
      try {
        const res = await fetch("/api/monitor/items/batch?action=urgentCount");
        const data = (await res.json()) as { count: number };
        await handleCount(Number(data.count ?? 0));
      } catch {
        // ignore
      }
    }

    if (supportEventSource) {
      queueMicrotask(() => setMode("sse"));
      const es = new (globalThis as unknown as { EventSource: typeof EventSource }).EventSource(
        "/api/monitor/items/stream?accept=sse&sinceHours=24&tickMs=5000&heartbeatMs=15000",
        { withCredentials: false },
      );
      es.addEventListener("urgentCount", (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data) as { count: number };
          void handleCount(Number(data.count ?? 0));
        } catch {
          // ignore
        }
      });
      es.addEventListener("dailySummaryReady", () => {
        const now = Date.now();
        stableOnSummaryReadyRef.current?.();
        if (
          Notification.permission === "granted" &&
          now - lastSummaryAlertRef.current > 5 * 60 * 1000
        ) {
          lastSummaryAlertRef.current = now;
          pushNotification("新的每日汇总已就绪", "监测系统刚刚生成了新的每日政策内容汇总。");
        }
      });
      es.addEventListener("open", () => {
        setMode("sse");
      });
      es.addEventListener("error", () => {
        setMode("poll");
      });
      void pollOnce();
      return () => {
        stopped = true;
        es.close();
      };
    }

    // Fallback：轮询
    queueMicrotask(() => setMode("poll"));
    void pollOnce();
    const id = window.setInterval(pollOnce, pollIntervalMs);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [permission, pollIntervalMs, handleCount, pushNotification]);

  async function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      const res = await fetch("/api/monitor/items/batch?action=urgentCount");
      const data = (await res.json()) as { count: number };
      await handleCount(Number(data.count ?? 0));
    }
  }

  if (permission === "unsupported") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 shadow-sm">
        当前浏览器不支持 Notification
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 shadow-sm">
        通知权限被禁用 · 请在浏览器设置中允许通知
      </div>
    );
  }

  if (permission === "granted") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 shadow-sm">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500 align-middle" />
        加急通知已开启（{mode === "sse" ? "实时 SSE" : "轮询"}）· 当前未读加急{" "}
        {latestCount === null ? "…" : latestCount}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={requestPermission}
      className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50"
    >
      <Bell className="mr-1 inline h-3.5 w-3.5" aria-hidden />开启「加急」浏览器通知
    </button>
  );
}

// ===== 每日汇总邮件 UI：一键生成 + 预览 + 发送 =====
export function DailySummaryCard() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{
    date: string | null;
    urgentCount: number | null;
    itemCount: number | null;
    subject: string | null;
    lastSentAt: string | null;
  } | null>(null);
  const [preview, setPreview] = useState<{ html?: string } | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor/daily-summary?mode=status");
      const data = (await res.json()) as {
        date: string | null;
        urgentCount: number | null;
        itemCount: number | null;
        subject: string | null;
        lastSentAt: string | null;
      };
      setStatus(data);
    } catch {
      // ignore
    }
  }, []);

  // 初次挂载拉一次状态；每 60s 刷新一次；同时暴露给 SSE 通知回调
  useEffect(() => {
    queueMicrotask(() => void refreshStatus());
    const id = window.setInterval(() => void refreshStatus(), 60_000);
    return () => window.clearInterval(id);
  }, [refreshStatus]);

  // 通过 UrgentBrowserNotifier 监听 "dailySummaryReady" 事件，触发 UI 刷新
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as { __onDailySummaryReady?: () => void }).__onDailySummaryReady = () =>
      void refreshStatus();
  }, [refreshStatus]);

  const previewSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/monitor/daily-summary?limit=10&sinceHours=24&format=html");
      const data = (await res.json()) as {
        date: string;
        html: string;
        urgentCount: number;
        itemCount: number;
      };
      setPreview({ html: data.html });
      setStatus((s) => ({
        date: data.date,
        urgentCount: data.urgentCount,
        itemCount: data.itemCount,
        subject: `每日汇总 · ${data.date} · 加急 ${data.urgentCount} · Top ${data.itemCount}`,
        lastSentAt: s?.lastSentAt ?? null,
      }));
    } finally {
      setLoading(false);
    }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const res = await fetchWithAuth("/api/monitor/daily-summary?limit=10&sinceHours=24", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = (await res.json()) as {
        subject?: string;
        sent?: boolean;
        lastSentAt?: string | null;
        itemCount?: number;
        urgentCount?: number;
        html?: string;
        date?: string;
        webhookError?: string | null;
      };
      if (data.html) setPreview({ html: data.html });
      await refreshStatus();
    } finally {
      setSending(false);
    }
  };

  const statusLine = (() => {
    if (!status) return "尚未生成每日汇总";
    const parts: string[] = [];
    if (status.date) parts.push(`生成日期：${status.date}`);
    if (status.urgentCount !== null) parts.push(`加急 ${status.urgentCount}`);
    if (status.itemCount !== null) parts.push(`Top ${status.itemCount} 条`);
    if (status.lastSentAt) {
      const dtParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date(status.lastSentAt));
      const y = dtParts.find((p) => p.type === "year")?.value ?? "0000";
      const m = dtParts.find((p) => p.type === "month")?.value ?? "00";
      const d = dtParts.find((p) => p.type === "day")?.value ?? "00";
      const h = dtParts.find((p) => p.type === "hour")?.value ?? "00";
      const min = dtParts.find((p) => p.type === "minute")?.value ?? "00";
      parts.push(`最近发送：${y}-${m}-${d} ${h}:${min}`);
    }
    return parts.join(" · ") || "暂无状态";
  })();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Mailbox className="h-4 w-4" aria-hidden />每日汇总邮件</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            自动生成 Top 10 关键内容；通过 <code>DAILY_SUMMARY_WEBHOOK</code> 发送到你的邮箱或 IM。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={previewSummary}
            disabled={loading}
            className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "生成中…" : "生成/预览本次"}
          </button>
          <button
            type="button"
            onClick={sendNow}
            disabled={sending}
            className="inline-flex h-8 items-center rounded-full bg-slate-900 px-3 text-xs text-white transition hover:bg-slate-700 disabled:bg-slate-400"
          >
            {sending ? "发送中…" : "立即发送"}
          </button>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-slate-500">{statusLine}</div>

      {preview?.html ? (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>邮件预览（iframe 内）：</span>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="text-slate-500 underline underline-offset-2 hover:text-slate-700"
            >
              关闭预览
            </button>
          </div>
          <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
            <iframe
              title="daily-summary-preview"
              srcDoc={preview.html}
              className="h-[400px] w-full rounded-lg border border-slate-200 bg-white"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
