"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { usePrefs } from "@/contexts/prefs-context";
import {
  Bell,
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
  const en = usePrefs().language === "en";
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
        const done: Record<string, [string, string]> = {
          markAllRead: ["已全部标记为已读", "Marked all as read"],
          markAllUnread: ["已全部标记为未读", "Marked all as unread"],
          markAllStarred: ["已全部收藏", "Starred all"],
          markAllUnstarred: ["已批量取消收藏", "Unstarred all"],
        };
        const [zh, enLabel] = done[action] ?? done.markAllUnstarred;
        notify(en ? `${enLabel} · ${data.updated ?? 0} updated` : `${zh} · 更新 ${data.updated ?? 0} 条`);
        if (action === "markAllRead" || action === "markAllUnread" || action === "markAllStarred" || action === "markAllUnstarred") {
          onMarkAll?.(action as "markAllRead" | "markAllStarred" | "markAllUnstarred");
        }
        if (!data.mock) onRefetch?.();
      } catch (e) {
        notify(`${en ? "Failed: " : "操作失败："}${String((e as Error).message ?? e)}`);
      } finally {
        setBusy(null);
      }
    },
    [onRefetch, onMarkAll, en],
  );

  const filterPayload = useMemo(() => {
    const payload: Record<string, unknown> = { ...filter };
    return payload;
  }, [filter]);

  // 放在收件箱「⋯」菜单里：竖排纯文字项，与其他菜单项一致（不再自带卡片外框）
  const itemCls = "flex w-full items-center rounded px-1 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60";
  const busyText = en ? "Working…" : "处理中…";
  return (
    <div className="relative">
      <button data-owner-only type="button" className={itemCls} disabled={busy === "markAllRead"}
        onClick={() => runAction("markAllRead", { ...filterPayload, isRead: true, onlyUnread: true })}>
        {busy === "markAllRead" ? busyText : en ? "Mark all as read" : "全部标为已读"}
      </button>
      <button data-owner-only type="button" className={itemCls} disabled={busy === "markAllUnread"}
        onClick={() => runAction("markAllUnread", { ...filterPayload, isRead: false })}>
        {busy === "markAllUnread" ? busyText : en ? "Mark all as unread" : "全部标为未读"}
      </button>
      <button data-owner-only type="button" className={itemCls} disabled={busy === "markAllStarred"}
        onClick={() => runAction("markAllStarred", { ...filterPayload, isStarred: true })}>
        {busy === "markAllStarred" ? busyText : en ? "Star all" : "全部收藏"}
      </button>
      <button data-owner-only type="button" className={itemCls} disabled={busy === "markAllUnstarred"}
        onClick={() => runAction("markAllUnstarred", { ...filterPayload, isStarred: false, onlyStarred: true })}>
        {busy === "markAllUnstarred" ? busyText : en ? "Unstar all" : "全部取消收藏"}
      </button>
      <p className="px-1 pt-1 text-xs text-slate-500">
        {en ? "Applies to everything matching the current filters." : "作用于当前筛选下的全部条目。"}
      </p>
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
