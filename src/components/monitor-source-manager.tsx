"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  MonitorSourceRecord,
  MonitorSourceType,
  SourceLanguage,
  SourceRegion,
  SourceContentCategory,
} from "@/lib/monitor/types";
import {
  SOURCE_LANGUAGE_LABELS,
  SOURCE_REGION_LABELS,
  SOURCE_CATEGORY_LABELS,
} from "@/lib/monitor/types";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  Clock, Package, RadioTower,
} from "lucide-react";

type Props = {
  initialSources: MonitorSourceRecord[];
};

type SourceFormValue = {
  departmentName: string;
  channelName: string;
  displayName: string;
  type: MonitorSourceType;
  listUrl: string;
  enabled: boolean;
  autoMonitor: boolean;
  isKey: boolean;
  startDate: string;
  maxItems: number;
  notes: string;
  language: SourceLanguage;
  region: SourceRegion;
  contentCategory: SourceContentCategory;
};

function toFormValue(source: MonitorSourceRecord): SourceFormValue {
  return {
    departmentName: source.departmentName ?? "",
    channelName: source.channelName ?? "",
    displayName: source.displayName,
    type: source.type,
    listUrl: source.listUrl,
    enabled: source.enabled,
    autoMonitor: source.autoMonitor ?? false,
    isKey: source.isKey ?? false,
    startDate: source.startDate,
    maxItems: source.maxItems,
    notes: source.notes ?? "",
    language: source.language ?? "zh",
    region: source.region ?? "domestic",
    contentCategory: source.contentCategory ?? "general",
  };
}

const EMPTY_FORM: SourceFormValue = {
  departmentName: "",
  channelName: "",
  displayName: "",
  type: "mct_zwgk_genre",
  listUrl: "",
  enabled: true,
  autoMonitor: false,
  isKey: false,
  startDate: "2026-05-05",
  maxItems: 10,
  notes: "",
  language: "zh",
  region: "domestic",
  contentCategory: "general",
};

export function MonitorSourceManager({ initialSources }: Props) {
  const [sources, setSources] = useState(initialSources);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<SourceFormValue>(EMPTY_FORM);
  const [createForm, setCreateForm] = useState<SourceFormValue>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const enabledCount = sources.filter((source) => source.enabled).length;
    const autoCount = sources.filter((source) => source.enabled && source.autoMonitor).length;
    const keyCount = sources.filter((source) => source.isKey).length;
    return { enabledCount, autoCount, keyCount };
  }, [sources]);

  const [categoryFilter, setCategoryFilter] = useState<"all" | SourceContentCategory>("all");
  const [regionFilter, setRegionFilter] = useState<"all" | "domestic" | "global">("all");
  const [sourceQ, setSourceQ] = useState("");
  const [pingStatus, setPingStatus] = useState<Record<string, "ok" | "fail" | "checking">>({});
  const [healthCache, setHealthCache] = useState<{ ok: number; total: number } | null>(null);

  // 按部委分组（departmentName 相同的放一起），同时统计每个部委的数量/启用数/重点数
  const groupedSources = useMemo(() => {
    let filtered = sources;
    if (categoryFilter !== "all") filtered = filtered.filter((s) => (s.contentCategory ?? "general") === categoryFilter);
    if (regionFilter !== "all") filtered = filtered.filter((s) => (s.region ?? "domestic") === regionFilter);
    if (sourceQ.trim()) {
      const q = sourceQ.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        (s.departmentName ?? "").toLowerCase().includes(q) ||
        (s.displayName ?? "").toLowerCase().includes(q) ||
        (s.channelName ?? "").toLowerCase().includes(q) ||
        s.listUrl.toLowerCase().includes(q)
      );
    }
    const groups = new Map<string, MonitorSourceRecord[]>();
    for (const source of filtered) {
      const key = source.departmentName?.trim() || "未分类";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(source);
    }
    // 按组内数量倒序，使大的部委在前面
    const entries = Array.from(groups.entries()).sort((a, b) => {
      // 把"国务院"放到最前（如果存在）
      if (a[0] === "国务院") return -1;
      if (b[0] === "国务院") return 1;
      return b[1].length - a[1].length;
    });
    return entries;
  }, [sources, categoryFilter, regionFilter, sourceQ]);

  // 默认折叠状态：部委下 source 数 > 8 的默认折叠；其他默认展开
  const [collapsedDepartments, setCollapsedDepartments] = useState<Set<string>>(() => {
    const set = new Set<string>();
    return set;
  });

  function toggleDepartment(department: string) {
    setCollapsedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(department)) next.delete(department);
      else next.add(department);
      return next;
    });
  }

  function expandAll() {
    setCollapsedDepartments(new Set());
  }

  function collapseAll() {
    setCollapsedDepartments(new Set(groupedSources.map(([name]) => name)));
  }

  function updateEditingField<K extends keyof SourceFormValue>(key: K, value: SourceFormValue[K]) {
    setEditingForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateCreateField<K extends keyof SourceFormValue>(key: K, value: SourceFormValue[K]) {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  }

  // 挂载后异步加载每个来源的入库统计（totalCount + lastSeenAt）+ 读取 ping 缓存
  useEffect(() => {
    fetch("/api/monitor/sources?stats=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: unknown) => { if (Array.isArray(data)) setSources(data); })
      .catch(() => {});
    try {
      const raw = localStorage.getItem("ping_cache");
      if (raw) {
        const parsed = JSON.parse(raw) as { ok: number; total: number };
        if (typeof parsed.ok === "number" && typeof parsed.total === "number") {
          setHealthCache(parsed);
        }
      }
    } catch {}
  }, []);

  async function refreshSources() {
    const res = await fetch("/api/monitor/sources?stats=1", { cache: "no-store" });
    const json = await res.json();
    setSources(json);
  }

  async function submitCreate() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchWithAuth("/api/monitor/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        throw new Error(`新增失败：${res.status}`);
      }
      await refreshSources();
      setCreateForm(EMPTY_FORM);
      setMessage("已新增来源配置。");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitUpdate(sourceId: string) {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchWithAuth(`/api/monitor/sources/${encodeURIComponent(sourceId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingForm),
      });
      if (!res.ok) {
        throw new Error(`更新失败：${res.status}`);
      }
      await refreshSources();
      setEditingId(null);
      setMessage("已保存来源配置。");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function batchSetEnabled(sourceIds: string[], enabled: boolean) {
    setSubmitting(true);
    try {
      await Promise.all(
        sourceIds.map((id) =>
          fetchWithAuth(`/api/monitor/sources/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enabled }),
          })
        )
      );
      await refreshSources();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDelete(sourceId: string, displayName: string) {
    const confirmed = window.confirm(`确认删除来源“${displayName}”吗？\n\n默认只删除来源配置，不会删除已经入库的历史监测结果。`);
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchWithAuth(`/api/monitor/sources/${encodeURIComponent(sourceId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`删除失败：${res.status}`);
      }
      await refreshSources();
      if (editingId === sourceId) {
        setEditingId(null);
      }
      setMessage("已删除来源配置。历史入库内容保留不动。");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">来源总数</div>
            <div className="mt-1 text-3xl font-semibold">{sources.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">已启用</div>
            <div className="mt-1 text-3xl font-semibold">{stats.enabledCount}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">自动监测 / 重点</div>
            <div className="mt-1 text-3xl font-semibold">
              {stats.autoCount} / {stats.keyCount}
            </div>
          </div>
          <div className={`rounded-2xl p-4 ${
            healthCache
              ? healthCache.ok === healthCache.total
                ? "bg-emerald-50"
                : healthCache.ok < healthCache.total / 2
                ? "bg-rose-50"
                : "bg-amber-50"
              : "bg-slate-50"
          }`}>
            <div className="text-sm text-slate-500">URL 可用</div>
            <div className={`mt-1 text-3xl font-semibold ${
              healthCache
                ? healthCache.ok === healthCache.total
                  ? "text-emerald-700"
                  : healthCache.ok < healthCache.total / 2
                  ? "text-rose-700"
                  : "text-amber-700"
                : "text-slate-400"
            }`}>
              {healthCache ? `${healthCache.ok}/${healthCache.total}` : "—"}
            </div>
            {healthCache && (
              <div className="mt-0.5 text-xs text-slate-400">点击"检查可用性"刷新</div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              setSubmitting(true);
              setError(null);
              setMessage(null);
              try {
                const res = await fetchWithAuth("/api/monitor/seed", { method: "POST" });
                const data = await res.json();
                if (data.ok) {
                  setMessage(data.message);
                  const refreshRes = await fetchWithAuth("/api/monitor/sources");
                  const refreshData = await refreshRes.json();
                  if (Array.isArray(refreshData)) setSources(refreshData);
                } else {
                  setError(data.message || "写入失败");
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            写入 AI／数字经济示例来源
          </button>
          <span className="text-xs text-slate-400">（工信部 · 网信办 · 发改委 · 科技部 · 国家数据局，默认禁用，确认 URL 后启用）</span>
        </div>
        {message ? <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      </section>

      {sources.length === 0 && (
        <section className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <RadioTower className="mx-auto h-9 w-9 text-slate-300" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">还没有监测来源</h2>
          <p className="mt-2 text-sm text-slate-500">先写入 AI／数字经济示例来源，或者在下方手动添加</p>
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetchWithAuth("/api/monitor/seed", { method: "POST" });
                const data = await res.json();
                if (data.ok) {
                  const refreshRes = await fetchWithAuth("/api/monitor/sources");
                  const refreshData = await refreshRes.json();
                  if (Array.isArray(refreshData)) setSources(refreshData);
                }
              } catch {
                // ignore
              }
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            写入 AI／数字经济示例来源
          </button>
          <p className="mt-3 text-xs text-slate-400">工信部 · 网信办 · 发改委 · 科技部 · 国家数据局（默认禁用，确认 URL 后启用）</p>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">新增来源</h2>
        <p className="mt-1 text-sm text-slate-500">
          这里先录部委、栏目名和原栏目网址。重点关注、自动监测可以随时调整，不要求你一次性梳理完所有来源。
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <input
            value={createForm.departmentName}
            onChange={(e) => updateCreateField("departmentName", e.target.value)}
            placeholder="部委名称，例如：文化和旅游部"
            className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
          />
          <input
            value={createForm.channelName}
            onChange={(e) => updateCreateField("channelName", e.target.value)}
            placeholder="栏目名称，例如：通知"
            className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
          />
          <input
            value={createForm.displayName}
            onChange={(e) => updateCreateField("displayName", e.target.value)}
            placeholder="显示名，可留空自动生成"
            className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
          />
          <select
            value={createForm.type}
            onChange={(e) => updateCreateField("type", e.target.value as MonitorSourceType)}
            className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
          >
            <option value="govcn_zuixin">国务院 JSON 栏目（yaowen/zuixin/zhongyang）</option>
            <option value="mct_szyw">时政要闻型</option>
            <option value="mct_zwgk_genre">政府公开栏目</option>
            <option value="mof_zhengwuxinxi">财政部政务信息型</option>
            <option value="rss">RSS 订阅源</option>
            <option value="html_list">HTML 列表页（自定义爬虫）</option>
          </select>
          <select
            value={createForm.language}
            onChange={(e) => updateCreateField("language", e.target.value as SourceLanguage)}
            className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
          >
            <option value="zh">中文</option>
            <option value="en">英文</option>
            <option value="both">双语</option>
          </select>
          <select
            value={createForm.region}
            onChange={(e) => updateCreateField("region", e.target.value as SourceRegion)}
            className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
          >
            <option value="domestic">国内</option>
            <option value="global">全球</option>
          </select>
          <select
            value={createForm.contentCategory}
            onChange={(e) => updateCreateField("contentCategory", e.target.value as SourceContentCategory)}
            className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
          >
            <option value="general">综合</option>
            <option value="policy">政策法规</option>
            <option value="notice">通知公告</option>
            <option value="regulation">行政规范</option>
            <option value="procurement">招标采购</option>
          </select>
          <input
            value={createForm.listUrl}
            onChange={(e) => updateCreateField("listUrl", e.target.value)}
            placeholder="原栏目网址"
            className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm md:col-span-2"
          />
          <input
            type="date"
            value={createForm.startDate}
            onChange={(e) => updateCreateField("startDate", e.target.value)}
            className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
          />
          <input
            type="number"
            min={1}
            max={100}
            value={createForm.maxItems}
            onChange={(e) => updateCreateField("maxItems", Number(e.target.value))}
            className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
          />
          <textarea
            value={createForm.notes}
            onChange={(e) => updateCreateField("notes", e.target.value)}
            placeholder="备注，例如：重点关注文化产业、预算、试点政策"
            className="min-h-24 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm md:col-span-2"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2">
            <input
              type="checkbox"
              checked={createForm.enabled}
              onChange={(e) => updateCreateField("enabled", e.target.checked)}
            />
            启用
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2">
            <input
              type="checkbox"
              checked={createForm.autoMonitor}
              onChange={(e) => updateCreateField("autoMonitor", e.target.checked)}
            />
            自动监测
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2">
            <input
              type="checkbox"
              checked={createForm.isKey}
              onChange={(e) => updateCreateField("isKey", e.target.checked)}
            />
            重点关注
          </label>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={submitCreate}
            disabled={submitting}
            className="inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white"
          >
            {submitting ? "提交中…" : "新增来源"}
          </button>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">按部委分组</h2>
            {/* 内容分类筛选 */}
            <div className="inline-flex overflow-hidden rounded-full border border-slate-200 text-xs">
              {([
                ["all", "全部"],
                ["policy", "政策法规"],
                ["notice", "通知公告"],
                ["regulation", "行政规范"],
                ["procurement", "招标采购"],
                ["general", "综合"],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCategoryFilter(val)}
                  className={`px-3 py-1.5 transition ${
                    categoryFilter === val
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* 地区筛选 */}
            <div className="inline-flex overflow-hidden rounded-full border border-slate-200 text-xs">
              {(["all", "domestic", "global"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegionFilter(r)}
                  className={`px-3 py-1.5 transition ${
                    regionFilter === r
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {r === "all" ? "全部地区" : r === "domestic" ? "国内" : "全球"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={expandAll}
              className="inline-flex rounded-full border border-slate-300 px-4 py-1.5 text-slate-700"
            >
              全部展开
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="inline-flex rounded-full border border-slate-300 px-4 py-1.5 text-slate-700"
            >
              全部折叠
            </button>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([JSON.stringify(sources, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `sources-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex rounded-full border border-slate-300 px-4 py-1.5 text-slate-700"
            >
              导出 JSON
            </button>
            <button
              type="button"
              onClick={async () => {
                const enabled = sources.filter((s) => s.enabled);
                if (enabled.length === 0) return;
                setPingStatus(Object.fromEntries(enabled.map((s) => [s.id, "checking"])));
                const results = await Promise.allSettled(
                  enabled.map(async (s) => {
                    try {
                      const res = await fetch(`/api/monitor/sources/ping?url=${encodeURIComponent(s.listUrl)}`, { signal: AbortSignal.timeout(8000) });
                      const json = await res.json();
                      return { id: s.id, ok: json.ok === true };
                    } catch {
                      return { id: s.id, ok: false };
                    }
                  })
                );
                const next: Record<string, "ok" | "fail"> = {};
                for (const r of results) {
                  if (r.status === "fulfilled") next[r.value.id] = r.value.ok ? "ok" : "fail";
                }
                setPingStatus(next);
                const okCount = Object.values(next).filter((v) => v === "ok").length;
                const health = { ok: okCount, total: enabled.length };
                setHealthCache(health);
                try { localStorage.setItem("ping_cache", JSON.stringify(health)); } catch {}
              }}
              className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 text-amber-700 hover:bg-amber-100"
            >
              检查可用性
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        <input
          type="search"
          value={sourceQ}
          onChange={(e) => setSourceQ(e.target.value)}
          placeholder="搜索机构名、栏目名、URL…"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
        />

        {groupedSources.map(([department, list]) => {
          const collapsed = collapsedDepartments.has(department);
          const enabled = list.filter((s) => s.enabled).length;
          const key = list.filter((s) => s.isKey).length;
          const auto = list.filter((s) => s.autoMonitor && s.enabled).length;
          return (
            <section
              key={department}
              className="rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex w-full items-center gap-2 px-6 py-4">
                <button
                  type="button"
                  onClick={() => toggleDepartment(department)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  aria-expanded={!collapsed}
                >
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{department}</h3>
                    <span className="text-sm text-slate-500">
                      共 {list.length} 个栏目 · 已启用 {enabled} · 自动监测 {auto} · 重点 {key}
                    </span>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => batchSetEnabled(list.map((s) => s.id), true)}
                    disabled={submitting || list.every((s) => s.enabled)}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
                  >
                    全部启用
                  </button>
                  <button
                    type="button"
                    onClick={() => batchSetEnabled(list.map((s) => s.id), false)}
                    disabled={submitting || list.every((s) => !s.enabled)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
                  >
                    全部停用
                  </button>
                  <span
                    aria-hidden
                    onClick={() => toggleDepartment(department)}
                    className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform ${
                      collapsed ? "" : "rotate-180"
                    }`}
                  >
                    ▾
                  </span>
                </div>
              </div>

              {!collapsed ? (
                <div className="space-y-3 border-t border-slate-100 px-6 py-4">
                  {list.map((source) => {
                    const editing = editingId === source.id;
                    const form = editing ? editingForm : toFormValue(source);

                    return (
                      <div
                        key={source.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-xs text-slate-500">{source.id}</div>
                            <h2 className="mt-1 text-xl font-semibold">{source.displayName}</h2>
                            <p className="mt-1 text-sm text-slate-500">
                              {source.channelName
                                ? `${source.channelName}`
                                : ""}
                              {source.channelGroup
                                ? ` · ${source.channelGroup}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span
                              className={`rounded-full px-3 py-1 ${
                                source.enabled
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {source.enabled ? "已启用" : "未启用"}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 ${
                                source.autoMonitor
                                  ? "bg-sky-50 text-sky-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {source.autoMonitor ? "自动监测" : "手动刷新"}
                            </span>
                            <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">
                              {SOURCE_REGION_LABELS[source.region ?? "domestic"]}
                            </span>
                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
                              {SOURCE_LANGUAGE_LABELS[source.language ?? "zh"]}
                            </span>
                            <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">
                              {SOURCE_CATEGORY_LABELS[source.contentCategory ?? "general"]}
                            </span>
                            {pingStatus[source.id] && (
                              <span className={`rounded-full px-3 py-1 ${
                                pingStatus[source.id] === "checking"
                                  ? "bg-slate-100 text-slate-500 animate-pulse"
                                  : pingStatus[source.id] === "ok"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}>
                                {pingStatus[source.id] === "checking" ? "检查中…" : pingStatus[source.id] === "ok" ? "可访问" : "不可达"}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-3 py-1 ${
                                source.isKey
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {source.isKey ? "重点关注" : "普通关注"}
                            </span>
                          </div>
                        </div>

                        {editing ? (
                          <div className="mt-5 space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <input
                                value={form.departmentName}
                                onChange={(e) =>
                                  updateEditingField("departmentName", e.target.value)
                                }
                                className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
                              />
                              <input
                                value={form.channelName}
                                onChange={(e) =>
                                  updateEditingField("channelName", e.target.value)
                                }
                                className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
                              />
                              <input
                                value={form.displayName}
                                onChange={(e) =>
                                  updateEditingField("displayName", e.target.value)
                                }
                                className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
                              />
                              <select
                                value={form.type}
                                onChange={(e) =>
                                  updateEditingField("type", e.target.value as MonitorSourceType)
                                }
                                className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
                              >
                                <option value="govcn_zuixin">国务院 JSON 栏目</option>
                                <option value="mct_szyw">时政要闻型</option>
                                <option value="mct_zwgk_genre">政府公开栏目</option>
                                <option value="mof_zhengwuxinxi">财政部政务信息型</option>
                                <option value="rss">RSS 订阅源</option>
                                <option value="html_list">HTML 列表页（自定义爬虫）</option>
                              </select>
                              <select
                                value={form.language}
                                onChange={(e) =>
                                  updateEditingField("language", e.target.value as SourceLanguage)
                                }
                                className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
                              >
                                <option value="zh">中文</option>
                                <option value="en">英文</option>
                                <option value="both">双语</option>
                              </select>
                              <select
                                value={form.region}
                                onChange={(e) =>
                                  updateEditingField("region", e.target.value as SourceRegion)
                                }
                                className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
                              >
                                <option value="domestic">国内</option>
                                <option value="global">全球</option>
                              </select>
                              <select
                                value={form.contentCategory}
                                onChange={(e) =>
                                  updateEditingField("contentCategory", e.target.value as SourceContentCategory)
                                }
                                className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
                              >
                                <option value="general">综合</option>
                                <option value="policy">政策法规</option>
                                <option value="notice">通知公告</option>
                                <option value="regulation">行政规范</option>
                                <option value="procurement">招标采购</option>
                              </select>
                              <input
                                value={form.listUrl}
                                onChange={(e) =>
                                  updateEditingField("listUrl", e.target.value)
                                }
                                className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm md:col-span-2"
                              />
                              <input
                                type="date"
                                value={form.startDate}
                                onChange={(e) =>
                                  updateEditingField("startDate", e.target.value)
                                }
                                className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
                              />
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={form.maxItems}
                                onChange={(e) =>
                                  updateEditingField("maxItems", Number(e.target.value))
                                }
                                className="h-11 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm"
                              />
                              <textarea
                                value={form.notes}
                                onChange={(e) =>
                                  updateEditingField("notes", e.target.value)
                                }
                                className="min-h-24 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm md:col-span-2"
                              />
                            </div>

                            <div className="flex flex-wrap gap-3 text-sm">
                              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={form.enabled}
                                  onChange={(e) =>
                                    updateEditingField("enabled", e.target.checked)
                                  }
                                />
                                启用
                              </label>
                              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={form.autoMonitor}
                                  onChange={(e) =>
                                    updateEditingField("autoMonitor", e.target.checked)
                                  }
                                />
                                自动监测
                              </label>
                              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={form.isKey}
                                  onChange={(e) =>
                                    updateEditingField("isKey", e.target.checked)
                                  }
                                />
                                重点关注
                              </label>
                            </div>

                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => submitUpdate(source.id)}
                                disabled={submitting}
                                className="inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white"
                              >
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="inline-flex rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => submitDelete(source.id, source.displayName)}
                                disabled={submitting}
                                className="inline-flex rounded-full border border-rose-300 px-5 py-2.5 text-sm font-medium text-rose-700"
                              >
                                删除来源
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                          {source.itemStats && (
                            <div className="mt-3 flex flex-wrap gap-3 text-xs">
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                <Package className="mr-1 inline h-3.5 w-3.5" aria-hidden />已入库 {source.itemStats.totalCount} 条
                              </span>
                              {source.itemStats.lastSeenAt ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                                  <Clock className="mr-1 inline h-3.5 w-3.5" aria-hidden />最近入库：{new Date(source.itemStats.lastSeenAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-400">
                                  暂无入库记录
                                </span>
                              )}
                            </div>
                          )}

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl bg-white p-4">
                              <div className="text-sm text-slate-500">原栏目网址</div>
                              <a
                                href={source.listUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 block break-all text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
                              >
                                {source.listUrl}
                              </a>
                            </div>
                            <div className="rounded-2xl bg-white p-4">
                              <div className="text-sm text-slate-500">监测规则</div>
                              <div className="mt-2 text-sm text-slate-700">
                                起始日期：{source.startDate} · 最大条数：{source.maxItems}
                              </div>
                              <div className="mt-1 text-sm text-slate-700">
                                类型：{source.type}
                              </div>
                            </div>
                            {source.notes ? (
                              <div className="rounded-2xl bg-white p-4 md:col-span-2">
                                <div className="text-sm text-slate-500">备注</div>
                                <div className="mt-2 text-sm leading-6 text-slate-700">
                                  {source.notes}
                                </div>
                              </div>
                            ) : null}
                            <div className="md:col-span-2">
                              <div className="flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(source.id);
                                    setEditingForm(toFormValue(source));
                                    setError(null);
                                    setMessage(null);
                                  }}
                                  className="inline-flex rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700"
                                >
                                  编辑来源配置
                                </button>
                                <button
                                  type="button"
                                  onClick={() => submitDelete(source.id, source.displayName)}
                                  disabled={submitting}
                                  className="inline-flex rounded-full border border-rose-300 px-5 py-2.5 text-sm font-medium text-rose-700"
                                >
                                  删除来源
                                </button>
                              </div>
                            </div>
                          </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </section>
    </div>
  );
}
