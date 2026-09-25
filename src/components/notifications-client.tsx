"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  getAllNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  checkNotifications,
  type NotificationItem,
} from "@/lib/notifications";
import { SubscriptionBadgeList } from "@/components/subscription-badge";
import { setFollowUpStatus } from "@/lib/personal-research";
import {
  Bell, BookOpen, Mailbox, RadioTower, Star,
} from "lucide-react";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${month}月${day}日 ${hours}:${mins}`;
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const time = new Date(iso).getTime();
  const diff = now - time;

  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`;
  return formatDate(iso);
}

export function NotificationsClient() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const todayDate = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const yesterdayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const refresh = useCallback(() => {
    setNotifications(getAllNotifications());
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    async function init() {
      try {
        await checkNotifications(abortController.signal);
      } catch (e) {
        const err = e as Error;
        if (err.name === "AbortError" || err.message.includes("ERR_ABORTED")) {
          console.debug("[Notifications] 通知初始化被取消（导航切换）");
        } else {
          console.warn("[Notifications] 生成通知失败:", e);
        }
      }

      if (!abortController.signal.aborted) {
        setNotifications(getAllNotifications());
        setLoading(false);
      }
    }

    init();
    return () => {
      abortController.abort();
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    markAllAsRead();
    refresh();
  };

  const handleClearAll = () => {
    clearAllNotifications();
    refresh();
  };

  const handleMarkRead = (id: string) => {
    markAsRead(id);
    refresh();
  };

  const handleAddToRead = (notif: NotificationItem) => {
    setFollowUpStatus(notif.policySourceId, notif.policyUrl, notif.policyTitle, "to_read");
    setAddedIds((prev) => new Set(prev).add(notif.id));
    markAsRead(notif.id);
    refresh();
  };

  const groupedByDate = notifications.reduce((acc, notif) => {
    const date = notif.publishedAt?.split("T")[0] || notif.createdAt.split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(notif);
    return acc;
  }, {} as Record<string, NotificationItem[]>);

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === todayDate) return "今天";
    if (dateStr === yesterdayDate) return "昨天";
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="h-4 w-32 bg-slate-100 rounded" />
            <div className="mt-2 h-5 w-full bg-slate-100 rounded" />
            <div className="mt-1 h-4 w-2/3 bg-slate-50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 py-16 text-center">
        <Bell className="mx-auto mb-3 h-9 w-9 text-slate-300" aria-hidden />
        <p className="text-sm font-medium text-slate-700">暂无通知</p>
        <p className="mt-1 text-xs text-slate-500">
          关注机构或关键词后，有新政策会在这里提醒你
        </p>
        <Link
          href="/subscribe"
          className="inline-flex items-center gap-1 mt-4 text-sm text-sky-600 hover:text-sky-700"
        >
          去设置关注 →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          共 <span className="font-semibold text-slate-900">{notifications.length}</span> 条通知
          {unreadCount > 0 && (
            <span className="ml-2 text-xs text-rose-500">
              {unreadCount} 条未读
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-slate-500 hover:text-slate-700 transition"
            >
              全部标为已读
            </button>
          )}
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-rose-400 hover:text-rose-600 transition"
          >
            一键清除
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedByDate).map(([date, items]) => (
          <div key={date}>
            <div className="mb-2 text-xs font-medium text-slate-500">
              {formatDateLabel(date)}
            </div>
            <div className="space-y-2">
              {items.map((notif) => {
                const isAdded = addedIds.has(notif.id);
                return (
                  <div
                    key={notif.id}
                    className={`rounded-2xl border p-4 transition ${
                      notif.read
                        ? "border-slate-200 bg-white"
                        : "border-sky-100 bg-sky-50/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        {notif.read ? (
                          <Mailbox className="h-4 w-4 text-slate-400" aria-hidden />
                        ) : (
                          <span className="relative">
                            <Bell className="h-4 w-4" aria-hidden />
                            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {notif.departmentName}
                          </span>
                          {notif.type === "high_priority" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <Star className="mr-1 inline h-3.5 w-3.5" aria-hidden />{notif.priorityLevel}
                            </span>
                          )}
                          {notif.type === "strong_signal" && notif.signalTypes && notif.signalTypes.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <RadioTower className="mr-1 inline h-3.5 w-3.5" aria-hidden />{notif.signalTypes.join(", ")}
                            </span>
                          )}
                          <SubscriptionBadgeList
                            matches={notif.matchedSubscriptions.slice(0, 2)}
                            totalCount={notif.matchedSubscriptions.length}
                          />
                          <span className="text-xs text-slate-400">
                            {formatRelativeTime(notif.publishedAt || notif.createdAt)}
                          </span>
                        </div>
                        <Link
                          href={`/items/${encodeURIComponent(notif.policySourceId)}?url=${encodeURIComponent(notif.policyUrl)}`}
                          className="mt-1 block line-clamp-2 text-sm font-medium text-slate-900 hover:text-slate-700"
                          onClick={() => handleMarkRead(notif.id)}
                        >
                          {notif.policyTitle}
                        </Link>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddToRead(notif)}
                            disabled={isAdded}
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                              isAdded
                                ? "bg-slate-100 text-slate-400 cursor-default"
                                : "bg-sky-100 text-sky-700 hover:bg-sky-200"
                            }`}
                          >
                            <BookOpen className="h-4 w-4" aria-hidden />
                            <span>{isAdded ? "已加入待读" : "加入待读"}</span>
                          </button>
                          {!notif.read && (
                            <button
                              type="button"
                              onClick={() => handleMarkRead(notif.id)}
                              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs text-slate-500 hover:text-slate-700 transition"
                            >
                              标为已读
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
