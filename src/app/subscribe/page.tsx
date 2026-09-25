"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import {
  getNotificationPrefs,
  setNotificationPrefs,
  resetLastCheckTime,
  checkNotifications,
  type NotificationPrefs,
} from "@/lib/notifications";
import { cachedFetch, clearFetchCache } from "@/lib/fetch-cache";
import {
  AlarmClock, Bell, Building2, ChartColumn, ClipboardList, House, Icon, Lightbulb, Mail, Mailbox, MapPin, MessageSquare, RadioTower, Rocket, Settings, SlidersVertical, Star, Target, TrendingUp, Zap, type LucideIcon,
} from "lucide-react";

type SubscriptionRecord = {
  id: string;
  userId: string;
  type: "department" | "keyword" | "category";
  target: string;
  targetName: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type DepartmentOption = {
  name: string;
  count: number;
};

type KeywordOption = {
  keyword: string;
  departmentName: string;
  weight: number;
};

type SubscriptionsApiResponse = {
  subscriptions: SubscriptionRecord[];
};

type DimensionsApiResponse = {
  departments: Array<{ departmentName: string; count: number }>;
};

type KeywordsApiResponse = {
  keywords: KeywordOption[];
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value ?? "0000";
    const m = parts.find((p) => p.type === "month")?.value ?? "00";
    const day = parts.find((p) => p.type === "day")?.value ?? "00";
    return `${y}-${m}-${day}`;
  } catch {
    return String(iso).slice(0, 10);
  }
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span><Icon className="h-4 w-4" aria-hidden /></span>
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        enabled ? "bg-sky-600" : "bg-slate-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function PrefRuleItem({
  icon: Icon,
  title,
  description,
  enabled,
  onToggle,
  disabled,
  disabledReason,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  disabledReason?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
      <div className="shrink-0"><Icon className="h-5 w-5" aria-hidden /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-slate-900">{title}</div>
          {badge && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">{description}</div>
        {disabled && disabledReason && (
          <div className="mt-1 text-[11px] text-slate-400">{disabledReason}</div>
        )}
      </div>
      <div className="shrink-0 pt-0.5">
        <ToggleSwitch enabled={enabled} onChange={onToggle} disabled={disabled} />
      </div>
    </div>
  );
}

type ImpactItem = {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  linkText?: string;
};

function SubscriptionImpactCard({
  icon: Icon,
  title,
  subtitle,
  items,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  items: ImpactItem[];
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-lg">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 rounded-xl border border-sky-100 bg-white/60 p-3"
          >
            <div className="shrink-0"><item.icon className="h-4 w-4" aria-hidden /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-800">{item.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{item.description}</div>
              {item.href && item.linkText && (
                <Link
                  href={item.href}
                  className="mt-1.5 inline-flex items-center gap-0.5 text-xs text-sky-600 hover:text-sky-700"
                >
                  {item.linkText}
                  <span className="transition group-hover:translate-x-0.5">→</span>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SubscribePage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [keywords, setKeywords] = useState<KeywordOption[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [activeTab, setActiveTab] = useState<"department" | "keyword" | "notify">("department");

  const [newDepartment, setNewDepartment] = useState("");
  const [newDeptName, setNewDeptName] = useState("");

  const [newKeyword, setNewKeyword] = useState("");
  const [newKwName, setNewKwName] = useState("");

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [notifTestLoading, setNotifTestLoading] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const [subRes, deptRes, kwRes] = await Promise.all([
          cachedFetch<SubscriptionsApiResponse>("/api/monitor/subscriptions", { signal: abortController.signal }),
          cachedFetch<DimensionsApiResponse>("/api/monitor/items?view=dimensions", { signal: abortController.signal }),
          cachedFetch<KeywordsApiResponse>("/api/monitor/keywords?departmentName=__global__", { signal: abortController.signal }),
        ]);

        if (cancelled || abortController.signal.aborted) return;

        const subList: SubscriptionRecord[] = Array.isArray(subRes?.subscriptions) ? subRes.subscriptions : [];
        setSubscriptions(subList);

        const deptList: DepartmentOption[] = Array.isArray(deptRes?.departments)
          ? deptRes.departments.map((d) => ({
              name: d.departmentName,
              count: d.count,
            }))
          : [];
        setDepartments(deptList);

        const kwList: KeywordOption[] = Array.isArray(kwRes?.keywords)
          ? kwRes.keywords.map((k) => ({
              keyword: k.keyword,
              departmentName: k.departmentName,
              weight: k.weight,
            }))
          : [];
        setKeywords(kwList);

        setNotifPrefs(getNotificationPrefs());
      } catch (e) {
        if (cancelled || abortController.signal.aborted) return;
        const err = e as Error;
        setMessage({ type: "error", text: err.message || "加载失败" });
        setTimeout(() => setMessage(null), 3000);
      }
    })();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, []);

  const groupedSubscriptions = useMemo(() => {
    const byType = new Map<"department" | "keyword" | "category", SubscriptionRecord[]>();
    byType.set("department", []);
    byType.set("keyword", []);
    byType.set("category", []);

    for (const sub of subscriptions) {
      const list = byType.get(sub.type)!;
      list.push(sub);
    }

    return {
      departments: byType.get("department")!,
      keywords: byType.get("keyword")!,
      categories: byType.get("category")!,
    };
  }, [subscriptions]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePrefToggle = useCallback(
    (key: keyof NotificationPrefs) => {
      if (!notifPrefs) return;
      const newPrefs = setNotificationPrefs({ [key]: !notifPrefs[key] });
      setNotifPrefs(newPrefs);
      showMessage("success", "设置已保存");
    },
    [notifPrefs],
  );

  const handleTestNotification = async () => {
    if (notifTestLoading) return;
    setNotifTestLoading(true);
    try {
      resetLastCheckTime();
      const result = await checkNotifications(undefined, true);
      showMessage(
        "success",
        result.newCount > 0
          ? `检查完成，新增 ${result.newCount} 条提醒`
          : "检查完成，暂无新提醒",
      );
    } catch (e) {
      showMessage("error", "检查失败，请稍后重试");
    } finally {
      setNotifTestLoading(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDepartment.trim()) {
      showMessage("error", "请选择机构");
      return;
    }

    try {
      const res = await fetch("/api/monitor/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "department",
          target: newDepartment.trim(),
          targetName: newDeptName.trim() || undefined,
          enabled: true,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "添加失败");

      clearFetchCache("/api/monitor/subscriptions");

      const updated = await fetch("/api/monitor/subscriptions").then((r) => r.json());
      setSubscriptions(Array.isArray(updated?.subscriptions) ? updated.subscriptions : []);
      setNewDepartment("");
      setNewDeptName("");
      showMessage("success", "关注成功");
    } catch (e) {
      showMessage("error", e instanceof Error ? e.message : "添加失败");
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      showMessage("error", "请选择或输入关键词");
      return;
    }

    try {
      const res = await fetch("/api/monitor/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "keyword",
          target: newKeyword.trim(),
          targetName: newKwName.trim() || undefined,
          enabled: true,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "添加失败");

      clearFetchCache("/api/monitor/subscriptions");

      const updated = await fetch("/api/monitor/subscriptions").then((r) => r.json());
      setSubscriptions(Array.isArray(updated?.subscriptions) ? updated.subscriptions : []);
      setNewKeyword("");
      setNewKwName("");
      showMessage("success", "关注成功");
    } catch (e) {
      showMessage("error", e instanceof Error ? e.message : "添加失败");
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    try {
      const res = await fetch("/api/monitor/subscriptions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "删除失败");

      clearFetchCache("/api/monitor/subscriptions");

      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      showMessage("success", "已取消关注");
    } catch (e) {
      showMessage("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleToggleSubscription = async (id: string) => {
    try {
      const res = await fetch("/api/monitor/subscriptions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "toggle", id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "操作失败");

      clearFetchCache("/api/monitor/subscriptions");

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
      );
    } catch (e) {
      showMessage("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  const popularKeywords = useMemo(() => {
    return keywords.slice(0, 12).map((k) => k.keyword);
  }, [keywords]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">关注设置</h1>
            <p className="mt-2 text-sm text-slate-600">
              配置你关心的来源、领域和关键词，获取更精准的内容推送
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const data = {
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  subscriptions: subscriptions.map(({ id: _id, ...rest }) => rest),
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
            >
              ↓ 导出关注
            </button>
            <button
              type="button"
              onClick={() => {
                const depts = subscriptions.filter((s) => s.type === "department");
                const kws = subscriptions.filter((s) => s.type === "keyword");
                const deptsXml = depts.map((s) => `      <outline type="rss" text="${escXml(s.targetName ?? s.target)}" title="${escXml(s.targetName ?? s.target)}" />`).join("\n");
                const kwsXml = kws.map((s) => `      <outline text="${escXml(s.target)}" title="${escXml(s.target)}" />`).join("\n");
                const opml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>政策雷达 订阅列表</title></head>\n  <body>\n    <outline text="关注机构" title="关注机构">\n${deptsXml}\n    </outline>\n    <outline text="关注关键词" title="关注关键词">\n${kwsXml}\n    </outline>\n  </body>\n</opml>`;
                const blob = new Blob([opml], { type: "text/x-opml" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.opml`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
            >
              ↓ OPML
            </button>
            <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50">
              ↑ 导入 OPML
              <input
                type="file"
                accept=".opml,.xml"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, "text/xml");
                    const outlines = Array.from(doc.querySelectorAll("outline"));
                    const targets = outlines
                      .map((el) => el.getAttribute("text") || el.getAttribute("title") || "")
                      .filter((t) => t.trim().length > 0);
                    if (targets.length === 0) throw new Error("未找到可导入的订阅项");
                    let added = 0;
                    for (const target of targets) {
                      try {
                        const res = await fetch("/api/monitor/subscriptions", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ type: "department", target: target.trim(), enabled: true }),
                        });
                        const json = await res.json();
                        if (json.ok) added++;
                      } catch {}
                    }
                    const updated = await fetch("/api/monitor/subscriptions").then((r) => r.json());
                    setSubscriptions(Array.isArray(updated?.subscriptions) ? updated.subscriptions : []);
                    showMessage("success", `从 OPML 导入 ${added} 个机构订阅`);
                  } catch (err) {
                    showMessage("error", `导入失败：${(err as Error).message}`);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50">
              ↑ 导入关注
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const parsed = JSON.parse(text) as { subscriptions?: Array<{ type: string; target: string; targetName?: string; enabled?: boolean }> };
                    if (!Array.isArray(parsed.subscriptions)) throw new Error("格式错误");
                    let added = 0;
                    for (const sub of parsed.subscriptions) {
                      if (!sub.type || !sub.target) continue;
                      try {
                        const res = await fetch("/api/monitor/subscriptions", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ type: sub.type, target: sub.target, targetName: sub.targetName, enabled: sub.enabled ?? true }),
                        });
                        const json = await res.json();
                        if (json.ok) added++;
                      } catch {}
                    }
                    const updated = await fetch("/api/monitor/subscriptions").then((r) => r.json());
                    setSubscriptions(Array.isArray(updated?.subscriptions) ? updated.subscriptions : []);
                    showMessage("success", `导入完成，新增 ${added} 条关注`);
                  } catch (err) {
                    showMessage("error", `导入失败：${(err as Error).message}`);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-8 flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5">
          <TabButton
            active={activeTab === "department"}
            onClick={() => setActiveTab("department")}
            icon={Building2}
            label="关注的机构"
            count={groupedSubscriptions.departments.length}
          />
          <TabButton
            active={activeTab === "keyword"}
            onClick={() => setActiveTab("keyword")}
            icon={Bell}
            label="关注的领域关键词"
            count={groupedSubscriptions.keywords.length}
          />
          <TabButton
            active={activeTab === "notify"}
            onClick={() => setActiveTab("notify")}
            icon={Settings}
            label="通知与推送"
          />
        </div>

        {activeTab === "department" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-900">添加关注的机构</h2>
              <p className="mb-4 text-xs text-slate-500">
                关注后，该来源发布的内容会在信号雷达和工作台中优先展示
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">选择机构</label>
                  <select
                    value={newDepartment}
                    onChange={(e) => {
                      setNewDepartment(e.target.value);
                      const dept = departments.find((d) => d.name === e.target.value);
                      setNewDeptName(dept?.name || "");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">请选择机构</option>
                    {departments.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name}（{d.count} 条）
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">显示名称（可选）</label>
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="输入备注名称"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddDepartment}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    添加关注
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">
                  已关注的机构
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                    {groupedSubscriptions.departments.length} 个
                  </span>
                </h3>
                <Link
                  href="/inbox?view=byDepartment"
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  浏览全部机构 →
                </Link>
              </div>
              {groupedSubscriptions.departments.length > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ChartColumn className="h-5 w-5" aria-hidden />
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        预计覆盖 {groupedSubscriptions.departments.reduce((sum, sub) => {
                          const dept = departments.find((d) => d.name === sub.target);
                          return sum + (dept?.count || 0);
                        }, 0)} 条内容
                      </div>
                      <div className="text-xs text-slate-500">
                        来自 {groupedSubscriptions.departments.filter((s) => s.enabled).length} 个已启用的关注机构
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/inbox"
                    className="shrink-0 rounded-full bg-sky-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700"
                  >
                    查看效果 →
                  </Link>
                </div>
              )}
              {groupedSubscriptions.departments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  暂无关注的机构，在上方添加
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="w-1/3 px-4 py-3 text-left font-medium text-slate-500">机构名称</th>
                        <th className="w-24 px-4 py-3 text-center font-medium text-slate-500">状态</th>
                        <th className="w-32 px-4 py-3 text-left font-medium text-slate-500">添加时间</th>
                        <th className="w-24 px-4 py-3 text-right font-medium text-slate-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedSubscriptions.departments.map((sub) => (
                        <tr key={sub.id}>
                          <td className="px-4 py-3">
                            <span className="text-slate-900">{sub.targetName || sub.target}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleSubscription(sub.id)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                sub.enabled
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              {sub.enabled ? "已关注" : "已暂停"}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDate(sub.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteSubscription(sub.id)}
                              className="rounded-lg px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50"
                            >
                              取消关注
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <SubscriptionImpactCard
              icon={Lightbulb}
              title="关注机构后，你会在这些地方看到它们"
              subtitle="设置关注后，系统会自动帮你优先呈现相关内容"
              items={[
                {
                  icon: RadioTower,
                  title: "信号雷达优先展示",
                  description: "你关注的来源发布的内容，会在信号雷达中优先排序并标记",
                  href: "/signals",
                  linkText: "查看信号雷达",
                },
                {
                  icon: House,
                  title: "工作台重点提醒",
                  description: '来自关注来源的高优先级内容，会出现在工作台的"今日重点"中',
                  href: "/",
                  linkText: "查看工作台",
                },
                {
                  icon: Bell,
                  title: "站内通知提醒",
                  description: "关注的来源有新内容发布时，会在通知中心中提醒你",
                  href: "#notify",
                  linkText: "查看通知设置",
                },
              ]}
            />
          </div>
        )}

        {activeTab === "keyword" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-900">添加关注的关键词</h2>
              <p className="mb-4 text-xs text-slate-500">
                关注后，包含这些关键词的内容会优先展示和提醒。也可以从下方热门关键词中快速选择
              </p>

              {popularKeywords.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 text-xs font-medium text-slate-600">热门关键词：</div>
                  <div className="flex flex-wrap gap-2">
                    {popularKeywords.map((kw) => {
                      const alreadyAdded = groupedSubscriptions.keywords.some(
                        (s) => s.target === kw
                      );
                      return (
                        <button
                          key={kw}
                          onClick={() => {
                            if (!alreadyAdded) {
                              setNewKeyword(kw);
                              setNewKwName(kw);
                            }
                          }}
                          disabled={alreadyAdded}
                          className={`rounded-full px-3 py-1 text-xs transition ${
                            alreadyAdded
                              ? "bg-emerald-50 text-emerald-600 cursor-default"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {alreadyAdded && "✓ "}
                          {kw}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">关键词</label>
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="输入或选择关键词"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">显示名称（可选）</label>
                  <input
                    type="text"
                    value={newKwName}
                    onChange={(e) => setNewKwName(e.target.value)}
                    placeholder="输入备注名称"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddKeyword}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    添加关注
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">
                  已关注的关键词
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                    {groupedSubscriptions.keywords.length} 个
                  </span>
                </h3>
              </div>
              {groupedSubscriptions.keywords.length > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5" aria-hidden />
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        已设置 {groupedSubscriptions.keywords.filter((s) => s.enabled).length} 个关注关键词
                      </div>
                      <div className="text-xs text-slate-500">
                        动态资讯支持关注优先排序，命中越多越靠前
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/inbox?sort=follow"
                    className="shrink-0 rounded-full bg-sky-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700"
                  >
                    查看效果 →
                  </Link>
                </div>
              )}
              {groupedSubscriptions.keywords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  暂无关注的关键词，在上方添加或从热门关键词中选择
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="w-1/3 px-4 py-3 text-left font-medium text-slate-500">关键词</th>
                        <th className="w-24 px-4 py-3 text-center font-medium text-slate-500">状态</th>
                        <th className="w-32 px-4 py-3 text-left font-medium text-slate-500">添加时间</th>
                        <th className="w-24 px-4 py-3 text-right font-medium text-slate-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedSubscriptions.keywords.map((sub) => (
                        <tr key={sub.id}>
                          <td className="px-4 py-3">
                            <span className="text-slate-900">{sub.targetName || sub.target}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleSubscription(sub.id)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                sub.enabled
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              {sub.enabled ? "已关注" : "已暂停"}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDate(sub.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteSubscription(sub.id)}
                              className="rounded-lg px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50"
                            >
                              取消关注
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {groupedSubscriptions.categories.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">
                    关注的分类
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                      {groupedSubscriptions.categories.length} 个
                    </span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="w-1/3 px-4 py-3 text-left font-medium text-slate-500">分类名称</th>
                        <th className="w-24 px-4 py-3 text-center font-medium text-slate-500">状态</th>
                        <th className="w-32 px-4 py-3 text-left font-medium text-slate-500">添加时间</th>
                        <th className="w-24 px-4 py-3 text-right font-medium text-slate-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedSubscriptions.categories.map((sub) => (
                        <tr key={sub.id}>
                          <td className="px-4 py-3">
                            <span className="text-slate-900">{sub.targetName || sub.target}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleSubscription(sub.id)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                sub.enabled
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              {sub.enabled ? "已关注" : "已暂停"}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDate(sub.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteSubscription(sub.id)}
                              className="rounded-lg px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50"
                            >
                              取消关注
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <SubscriptionImpactCard
              icon={Target}
              title="关注关键词后，你会在这些地方看到它们"
              subtitle="匹配到你关注关键词的内容，会获得更高的曝光优先级"
              items={[
                {
                  icon: ChartColumn,
                  title: "动态资讯排序优先",
                  description: "包含关注关键词的内容，在动态资讯中会排在更靠前的位置",
                  href: "/inbox",
                  linkText: "查看动态资讯",
                },
                {
                  icon: TrendingUp,
                  title: "信号强度提升",
                  description: "关键词匹配越多，内容的信号强度越高，越容易被识别为重点",
                  href: "/signals",
                  linkText: "查看信号雷达",
                },
                {
                  icon: Bell,
                  title: "站内通知提醒",
                  description: "高匹配度的新内容，会在通知中心中提醒你关注",
                  href: "#notify",
                  linkText: "查看通知设置",
                },
              ]}
            />
          </div>
        )}

        {activeTab === "notify" && notifPrefs && (
          <div className="space-y-6">
            {/* MVP 版本提示 */}
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <div><Zap className="h-5 w-5" aria-hidden /></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-amber-900">
                  当前为站内提醒 MVP 版本
                </div>
                <div className="mt-0.5 text-xs text-amber-700">
                  提醒数据保存在本地浏览器中，仅保留最近 7 天。邮件、企微等外部通道将在后续版本开放。
                </div>
              </div>
            </div>

            {/* 站内提醒总开关 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                    <Bell className="h-5 w-5 text-sky-600" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900">站内提醒</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      关注内容有更新时，在站内通知中心提醒你
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  enabled={notifPrefs.inAppEnabled}
                  onChange={() => handlePrefToggle("inAppEnabled")}
                />
              </div>
            </div>

            {/* 提醒触发规则 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">提醒触发规则</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    满足以下条件之一时，会给你发送站内提醒
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={notifTestLoading || !notifPrefs.inAppEnabled}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {notifTestLoading ? "检查中..." : "立即检查更新"}
                </button>
              </div>

              <div className="space-y-2">
                <PrefRuleItem
                  icon={Building2}
                  title="命中关注机构"
                  description="你关注的来源发布新内容时提醒"
                  enabled={notifPrefs.notifyOnDepartment}
                  onToggle={() => handlePrefToggle("notifyOnDepartment")}
                  disabled={!notifPrefs.inAppEnabled}
                />
                <PrefRuleItem
                  icon={Target}
                  title="命中关注关键词"
                  description="内容匹配到你关注的关键词时提醒"
                  enabled={notifPrefs.notifyOnKeyword}
                  onToggle={() => handlePrefToggle("notifyOnKeyword")}
                  disabled={!notifPrefs.inAppEnabled}
                />
                <PrefRuleItem
                  icon={Star}
                  title="高优先级内容"
                  description="标注为核心关注或重点内容的提醒"
                  enabled={notifPrefs.notifyOnHighPriority}
                  onToggle={() => handlePrefToggle("notifyOnHighPriority")}
                  disabled={!notifPrefs.inAppEnabled}
                />
                <PrefRuleItem
                  icon={RadioTower}
                  title="强信号内容"
                  description="包含强执行、强支持、申报截止等强信号的内容提醒"
                  enabled={notifPrefs.notifyOnStrongSignal}
                  onToggle={() => handlePrefToggle("notifyOnStrongSignal")}
                  disabled={!notifPrefs.inAppEnabled}
                />
              </div>
            </div>

            {/* 提醒在哪里可以看到 */}
            <SubscriptionImpactCard
              icon={MapPin}
              title="提醒会出现在这些地方"
              subtitle="打开应用就能看到，不会错过重要更新"
              items={[
                {
                  icon: Bell,
                  title: "顶部通知铃铛",
                  description: "未读提醒会在顶部铃铛旁显示数字角标",
                  href: "/notifications",
                  linkText: "查看通知中心",
                },
                {
                  icon: House,
                  title: "首页工作台",
                  description: "新提醒会在工作台顶部聚合展示",
                  href: "/",
                  linkText: "查看工作台",
                },
                {
                  icon: ClipboardList,
                  title: "通知中心列表",
                  description: "所有提醒按时间汇总在通知中心，支持一键加入待读",
                  href: "/notifications",
                  linkText: "查看全部提醒",
                },
              ]}
            />

            {/* 其他通道占位 */}
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/60">
                  <Mailbox className="h-5 w-5 text-slate-500" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900">更多通知方式</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    以下通道正在规划中，将在后续版本逐步开放
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Mail className="h-4 w-4" aria-hidden />
                      <span>邮件推送</span>
                    </div>
                    <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[10px] text-slate-500">
                      规划中
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">重要内容直接发送到邮箱</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <MessageSquare className="h-4 w-4" aria-hidden />
                      <span>企微/飞书机器人</span>
                    </div>
                    <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[10px] text-slate-500">
                      规划中
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">通过群机器人实时推送</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <AlarmClock className="h-4 w-4" aria-hidden />
                      <span>每日摘要</span>
                    </div>
                    <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[10px] text-slate-500">
                      规划中
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">每天早上推送昨日动态汇总</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <SlidersVertical className="h-4 w-4" aria-hidden />
                      <span>免打扰时段</span>
                    </div>
                    <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[10px] text-slate-500">
                      规划中
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">设置不希望被打扰的时间段</div>
                </div>
              </div>
            </div>

            {/* 版本规划 */}
            <div id="roadmap" className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/50 to-indigo-50/30 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600">
                  <Rocket className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900">版本规划 (V2.0)</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    了解即将上线的功能，管理你的预期
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-medium text-emerald-700">
                    1
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">用户体系与数据持久化</span>
                      <span className="rounded-full bg-emerald-100/60 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        最高优先级
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      当前数据保存在本地浏览器，换设备或清缓存会丢失。V2.0 将支持账号登录和云端同步，确保数据安全持久。
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-medium text-sky-700">
                    2
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">邮件/企微推送</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      将开放邮件、企业微信、飞书等外部通知通道，重要内容及时送达，不再错过关键信息。
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-medium text-indigo-700">
                    3
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">团队协作能力</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      支持多人共享关注配置、协作标注和内容对比，提升团队信息同步效率。
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Lightbulb className="h-4 w-4" aria-hidden />
                  <span>注：以上为规划内容，具体上线时间以实际发布为准。</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
