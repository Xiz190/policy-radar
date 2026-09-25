"use client";

import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import {
  CircleHelp, FileText, FolderOpen, Lightbulb, Link, NotebookPen, Package, Trash2,
} from "lucide-react";

type MonitorSourceRecord = {
  id: string;
  departmentName: string;
  channelGroup: string | null;
  channelName: string;
  displayName: string;
  type: string;
  listUrl: string;
  enabled: boolean;
  autoMonitor: boolean;
  isKey: boolean;
  startDate: string;
  maxItems: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SourceFormValue = {
  departmentName: string;
  channelGroup: string;
  channelName: string;
  displayName: string;
  type: string;
  listUrl: string;
  enabled: boolean;
  autoMonitor: boolean;
  isKey: boolean;
  startDate: string;
  maxItems: number;
  notes: string;
};

const EMPTY_FORM: SourceFormValue = {
  departmentName: "",
  channelGroup: "",
  channelName: "",
  displayName: "",
  type: "",
  listUrl: "",
  enabled: true,
  autoMonitor: false,
  isKey: false,
  startDate: "",
  maxItems: 30,
  notes: "",
};

// 通用 emoji 图标包一层，确保在深色/浅色背景都正常渲染
function Icon({ children, invert }: { children: React.ReactNode; invert?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block align-text-bottom leading-none opacity-100 ${invert ? "text-slate-900" : ""}`}
      style={{ fontVariant: "no-common-ligatures", WebkitTextFillColor: "initial" }}
    >
      {children}
    </span>
  );
}

// 折叠箭头
function Chevron({ open }: { open: boolean }) {
  return (
    <span aria-hidden className="inline-block text-slate-400 transition-transform" style={{ WebkitTextFillColor: "currentColor" }}>
      {open ? "▾" : "▸"}
    </span>
  );
}

function buildGroupedByDepartment(filteredSources: readonly MonitorSourceRecord[]) {
  const deptMap: Record<string, Array<{ groupKey: string | null; source: MonitorSourceRecord }>> = {};
  const deptOrder: string[] = [];
  for (const s of filteredSources) {
    const deptKey = s.departmentName || "未分类来源";
    const groupKey = s.channelGroup && s.channelGroup.trim() ? s.channelGroup : null;
    let list = deptMap[deptKey];
    if (!list) {
      list = [];
      deptMap[deptKey] = list;
      deptOrder.push(deptKey);
    }
    list.push({ groupKey, source: s });
  }
  const sorted = deptOrder.slice().sort((a, b) => a.localeCompare(b));
  return sorted.map((deptName) => {
    const groupMap: Record<string, MonitorSourceRecord[]> = {};
    const groupOrder: Array<string | null> = [];
    for (const it of deptMap[deptName]) {
      const k = it.groupKey;
      const keyStr = k === null ? "__null__" : String(k);
      let gList = groupMap[keyStr];
      if (!gList) {
        gList = [];
        groupMap[keyStr] = gList;
        groupOrder.push(k);
      }
      gList.push(it.source);
    }
    const sortedGroups = groupOrder
      .slice()
      .sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return String(a).localeCompare(String(b));
      })
      .map((k) => {
        const keyStr = k === null ? "__null__" : String(k);
        return [k, groupMap[keyStr]] as const;
      });
    return [deptName, sortedGroups] as const;
  });
}

function buildSourcesStats(sources: readonly MonitorSourceRecord[]) {
  let enabled = 0;
  let auto = 0;
  let key = 0;
  for (const s of sources) {
    if (s.enabled) enabled++;
    if (s.enabled && s.autoMonitor) auto++;
    if (s.isKey) key++;
  }
  return { total: sources.length, enabled, auto, key };
}

function buildDepartmentsList(sources: readonly MonitorSourceRecord[]) {
  const set = new Set<string>();
  for (const s of sources) set.add(s.departmentName || "未分类来源");
  return Array.from(set).sort();
}

function buildFilteredSources(
  sources: readonly MonitorSourceRecord[],
  q: string,
  activeDepartment: string | "ALL",
) {
  const ql = q.trim().toLowerCase();
  const list: MonitorSourceRecord[] = [];
  for (const s of sources) {
    if (activeDepartment !== "ALL" && s.departmentName !== activeDepartment) continue;
    if (!ql) {
      list.push(s);
      continue;
    }
    const notes = (s.notes ?? "").toLowerCase();
    if (
      s.departmentName.toLowerCase().includes(ql) ||
      s.channelName.toLowerCase().includes(ql) ||
      s.displayName.toLowerCase().includes(ql) ||
      s.listUrl.toLowerCase().includes(ql) ||
      notes.includes(ql)
    ) {
      list.push(s);
    }
  }
  return list;
}

export default function MonitorSourcesPage() {
  const [sources, setSources] = useState<MonitorSourceRecord[]>([]);
  const [q, setQ] = useState("");
  const [activeDepartment, setActiveDepartment] = useState<string | "ALL">("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<SourceFormValue>(EMPTY_FORM);
  const [createForm, setCreateForm] = useState<SourceFormValue>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [keywordsByDept, setKeywordsByDept] = useState<Record<string, Array<{ id: string; keyword: string; weight: number }>>>({});
  const [keywordInputByDept, setKeywordInputByDept] = useState<Record<string, string>>({});

  // 批量导入相关状态
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchTab, setBatchTab] = useState<"text" | "csv" | "urls">("text");
  const [batchText, setBatchText] = useState("");
  const [batchFileName, setBatchFileName] = useState("");
  const [batchResult, setBatchResult] = useState<{
    total: number; created: number; skipped: number; errors: number;
    createdItems?: Array<{ id: string; displayName: string }>;
    skippedItems?: Array<{ line: number; reason: string }>;
    errorItems?: Array<{ line: number; reason: string }>;
  } | null>(null);

  // 折叠状态：来源折叠 Set，以及每个来源下「大板块」的折叠 Set
  const [collapsedDepartments, setCollapsedDepartments] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, Set<string>>>({});

  function toggleDepartment(deptName: string) {
    setCollapsedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(deptName)) next.delete(deptName);
      else next.add(deptName);
      return next;
    });
  }

  function toggleGroup(deptName: string, groupKey: string) {
    setCollapsedGroups((prev) => {
      const existing = prev[deptName] ? new Set(prev[deptName]) : new Set<string>();
      if (existing.has(groupKey)) existing.delete(groupKey);
      else existing.add(groupKey);
      return { ...prev, [deptName]: existing };
    });
  }

  function expandAll() {
    setCollapsedDepartments(new Set());
    setCollapsedGroups({});
  }

  function collapseAll() {
    setCollapsedDepartments(new Set(groupedByDepartment.map(([d]) => d)));
  }

  async function refreshDepartmentKeywords(departmentName: string) {
    try {
      const res = await fetch(`/api/monitor/keywords?departmentName=${encodeURIComponent(departmentName)}`, { cache: "no-store" });
      const json = await res.json();
      setKeywordsByDept((prev) => ({ ...prev, [departmentName]: json.keywords ?? [] }));
    } catch (e) {
      console.error(e);
    }
  }

  async function addKeyword(departmentName: string, rawInput: string) {
    const parts = rawInput
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setBusy(true);
    try {
      await fetch("/api/monitor/keywords", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          departmentName,
          keywords: parts.map((k) => ({ keyword: k, weight: 1 })),
        }),
      });
      await refreshDepartmentKeywords(departmentName);
      setKeywordInputByDept((prev) => ({ ...prev, [departmentName]: "" }));
    } finally {
      setBusy(false);
    }
  }

  async function deleteKeyword(departmentName: string, keyword: string) {
    setBusy(true);
    try {
      await fetch("/api/monitor/keywords", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ departmentName, keyword }),
      });
      await refreshDepartmentKeywords(departmentName);
    } finally {
      setBusy(false);
    }
  }

  const refreshSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/monitor/sources", { cache: "no-store" });
      const json = await res.json();
      setSources(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      refreshSources();
    });
    return () => {
      cancelled = true;
    };
  }, [refreshSources]);

  const filteredSources = buildFilteredSources(sources, q, activeDepartment);

  const groupedByDepartment = buildGroupedByDepartment(filteredSources);

  const stats = buildSourcesStats(sources);
  const departments = buildDepartmentsList(sources);

  async function submitCreate() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/monitor/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) throw new Error(`新增失败：${res.status}`);
      await refreshSources();
      setCreateForm(EMPTY_FORM);
      setMessage("已新增来源配置。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitUpdate(sourceId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/monitor/sources/${encodeURIComponent(sourceId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingForm),
      });
      if (!res.ok) throw new Error(`更新失败：${res.status}`);
      await refreshSources();
      setEditingId(null);
      setMessage("已保存来源配置。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitDelete(sourceId: string) {
    if (!confirm(`确认删除该来源？只删配置，不删入库的历史监测结果。`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/monitor/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`删除失败：${res.status}`);
      await refreshSources();
      if (editingId === sourceId) setEditingId(null);
      setMessage("已删除来源配置。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteDepartment(departmentName: string, sourceCount: number, keywordCount: number) {
    const msg =
      `确认删除来源「${departmentName}」下的所有配置？\n\n` +
      `· 来源配置：${sourceCount} 条\n` +
      `· 自定义关键词：${keywordCount} 条\n\n` +
      `（已入库的历史监测结果不会删除）`;
    if (!confirm(msg)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/monitor/sources/departments?departmentName=${encodeURIComponent(departmentName)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`删除失败：${res.status}`);
      await refreshSources();
      setMessage(`已删除来源「${departmentName}」的配置。`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function quickToggle(sourceId: string, field: "enabled" | "autoMonitor" | "isKey", next: boolean) {
    const current = sources.find((s) => s.id === sourceId);
    if (!current) return;
    setBusy(true);
    try {
      const body = {
        departmentName: current.departmentName,
        channelGroup: current.channelGroup ?? "",
        channelName: current.channelName,
        displayName: current.displayName,
        type: current.type,
        listUrl: current.listUrl,
        enabled: field === "enabled" ? next : current.enabled,
        autoMonitor: field === "autoMonitor" ? next : current.autoMonitor,
        isKey: field === "isKey" ? next : current.isKey,
        startDate: current.startDate,
        maxItems: current.maxItems,
        notes: current.notes ?? "",
      };
      const res = await fetch(`/api/monitor/sources/${encodeURIComponent(sourceId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`更新失败：${res.status}`);
      await refreshSources();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitBatch(batchMode: "text" | "csv" | "urls", content: string, file?: File) {
    setBusy(true);
    setMessage(null);
    setBatchResult(null);
    try {
      const form = new FormData();
      form.append("mode", batchMode);
      if (file) form.append("file", file);
      else form.append("content", content);

      const res = await fetchWithAuth("/api/monitor/sources/batch", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `请求失败：${res.status}` }));
        throw new Error(body.error || `请求失败：${res.status}`);
      }
      const json = await res.json();
      setBatchResult(json);
      await refreshSources();
      setMessage(
        `批量导入完成：新增 ${json.created} 条，跳过 ${json.skipped} 条，错误 ${json.errors} 条`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
        <SettingsBreadcrumb current="来源管理" className="mb-2 px-2" />
        <section className="px-2 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <span className="text-sm text-slate-500">Source Config</span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 lg:text-5xl">来源配置中心</h1>
              <p className="text-base leading-7 text-slate-600">
                这里配置的是监测网站的<strong className="font-semibold text-slate-900">栏目列表页来源</strong>，不是正文内容。系统会定期抓取这些栏目下的最新内容链接，入库后出现在收件箱中。
              </p>
            </div>
            <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">来源总数</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.total}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">已启用 / 自动监测</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.enabled} / {stats.auto}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs text-slate-500">重点关注</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{stats.key}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 批量导入 ============ */}
        <section className="mt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Package className="h-5 w-5" aria-hidden /> 批量导入</h2>
              <div className="mt-1 space-y-2 text-xs text-slate-500 leading-relaxed">
                <p><span className="font-semibold text-slate-700"><Package className="mr-1 inline h-3.5 w-3.5" aria-hidden />批量导入是什么？</span></p>
                <p>批量导入是一种快速录入工具，帮你一次性添加多个栏目网址，提高配置效率。AI 会辅助整理数据：自动识别来源平台和栏目名称、整理格式、去重补全。</p>
                <p><span className="font-semibold text-slate-700">⚠ 批量导入不是什么？</span></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>不代表系统会自动适配任意新网站</li>
                  <li>不保证所有导入的网址都能成功抓取</li>
                  <li>AI 只负责数据整理，不参与底层抓取规则</li>
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBatchOpen((v) => !v)}
              className="inline-flex h-9 items-center text-xs text-slate-700 transition hover:text-slate-900"
            >
              {batchOpen ? "收起批量导入" : "展开批量导入"}
            </button>
          </div>

          {batchOpen ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <BatchTab active={batchTab === "text"} onClick={() => setBatchTab("text")}><NotebookPen className="mr-1 inline h-3.5 w-3.5" aria-hidden />文本粘贴</BatchTab>
                <BatchTab active={batchTab === "csv"} onClick={() => setBatchTab("csv")}><FileText className="mr-1 inline h-3.5 w-3.5" aria-hidden />CSV / TSV 上传</BatchTab>
                <BatchTab active={batchTab === "urls"} onClick={() => setBatchTab("urls")}><Link className="mr-1 inline h-3.5 w-3.5" aria-hidden />URL 批量粘贴</BatchTab>
              </div>

              {batchTab === "text" ? (
                <div className="space-y-3">
                  <p className="text-xs leading-6 text-slate-600">
                    每行一条，列之间用 <code className="rounded bg-slate-100 px-1">|</code>、制表符、逗号或分号分隔，列顺序：
                    <code className="mx-1 rounded bg-slate-100 px-1">来源 | 大板块 | 栏目 | 网址 [ | 类型 | 起始日期 | 最大条数 | 启用 | 自动监测 | 重点关注 ]</code>。
                    若你还不想填大板块，也可以写 <code className="mx-1 rounded bg-slate-100 px-1">来源 | 栏目 | 网址</code> 三列。
                    可用 <code className="rounded bg-slate-100 px-1">#</code> 开头写注释行。
                  </p>
                  <textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder={
                      '工业和信息化部 | 政策文件 | 政策 | https://www.miit.gov.cn/zwgk/zcwj/index.html\n国家互联网信息办公室 | 政策法规 | 法规 | http://www.cac.gov.cn/wxzw/A0937index_1.htm\n国家发展和改革委员会 | 政策发布 | 发布 | https://www.ndrc.gov.cn/xxgk/zcfb/\n# 下面这行是未填大板块的兼容写法\n文化和旅游部 | 时政要闻 | https://www.mct.gov.cn/whzx/szyw/'
                    }
                    className="min-h-[180px] w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-6 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:bg-white"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={busy || !batchText.trim()}
                      onClick={() => submitBatch("text", batchText)}
                      className="inline-flex h-10 items-center text-sm font-medium text-slate-900 transition hover:text-slate-700 disabled:opacity-50"
                    >
                      {busy ? "提交中…" : "导入文本"}
                    </button>
                  </div>
                </div>
              ) : null}

              {batchTab === "csv" ? (
                <div className="space-y-3">
                  <p className="text-xs leading-6 text-slate-600">
                    上传 CSV / TSV，第一行为表头。支持列名（英文中文均可，大小写不敏感）：
                    <code className="mx-1 rounded bg-slate-100 px-1">departmentName, channelName, listUrl, type, startDate, maxItems, enabled, autoMonitor, isKey, displayName, notes</code>
                    。最少只需 来源 / 栏目 / 网址 三列，其他列使用默认值。
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex h-10 cursor-pointer items-center rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-700 transition hover:bg-slate-50">
                      <input
                        type="file"
                        accept=".csv,.tsv,.txt"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setBatchFileName(f.name);
                          const text = await f.text();
                          setBatchText(text);
                        }}
                      />
                      选择 CSV/TSV 文件
                    </label>
                    {batchFileName ? <span className="text-xs text-slate-600">已选择：{batchFileName}</span> : null}
                    <button
                      type="button"
                      disabled={busy || !batchText.trim()}
                      onClick={() => submitBatch("csv", batchText)}
                      className="inline-flex h-10 items-center text-sm font-medium text-slate-900 transition hover:text-slate-700 disabled:opacity-50"
                    >
                      {busy ? "提交中…" : "导入 CSV"}
                    </button>
                  </div>
                  {batchText ? (
                    <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <summary className="cursor-pointer select-none">预览内容（前 1200 字符）</summary>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-slate-700">
                        {batchText.slice(0, 1200)}
                        {batchText.length > 1200 ? "…" : ""}
                      </pre>
                    </details>
                  ) : null}
                </div>
              ) : null}

              {batchTab === "urls" ? (
                <div className="space-y-3">
                  <p className="text-xs leading-6 text-slate-600">
                    每行一个 URL。AI 会尝试从 URL 中识别来源和栏目信息，帮助你快速整理；未识别的会创建为「待补充来源 / 待补充栏目」，方便你之后在列表里再编辑。
                  </p>
                  <textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder={"https://suno.com/blog\nhttps://elevenlabs.io/blog\nhttps://newsroom.spotify.com"}
                    className="min-h-[180px] w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-6 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:bg-white"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={busy || !batchText.trim()}
                      onClick={() => submitBatch("text", batchText)}
                      className="inline-flex h-10 items-center text-sm font-medium text-slate-900 transition hover:text-slate-700 disabled:opacity-50"
                    >
                      {busy ? "提交中…" : "导入 URL 列表"}
                    </button>
                  </div>
                </div>
              ) : null}

              {batchResult ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-semibold text-slate-900">导入结果</span>
                    <span>总数 <b>{batchResult.total}</b></span>
                    <span className="text-emerald-700">新增 <b>{batchResult.created}</b></span>
                    <span className="text-amber-700">跳过 <b>{batchResult.skipped}</b></span>
                    <span className="text-rose-700">错误 <b>{batchResult.errors}</b></span>
                  </div>
                  {batchResult.createdItems?.length ? (
                    <div className="mt-2">
                      <div className="text-[11px] text-slate-500">新增（最多显示前 50 条）：</div>
                      <ul className="mt-1 max-h-28 list-inside list-disc overflow-auto text-[11px] text-slate-600">
                        {batchResult.createdItems.map((it: { id: string; displayName: string }) => (
                          <li key={it.id}>{it.displayName}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {batchResult.skippedItems?.length ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none text-[11px] text-slate-500">查看跳过行（{batchResult.skippedItems.length}）</summary>
                      <ul className="mt-1 max-h-24 list-inside list-disc overflow-auto text-[11px] text-amber-700">
                        {batchResult.skippedItems.map((it: { line: number; reason: string }, i: number) => (
                          <li key={i}>第 {it.line} 行 · {it.reason}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {batchResult.errorItems?.length ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none text-[11px] text-slate-500">查看错误行（{batchResult.errorItems.length}）</summary>
                      <ul className="mt-1 max-h-24 list-inside list-disc overflow-auto text-[11px] text-rose-700">
                        {batchResult.errorItems.map((it: { line: number; reason: string }, i: number) => (
                          <li key={i}>第 {it.line} 行 · {it.reason}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
        {/* ============ / 批量导入 ============ */}

        <section className="mt-6">
          <h2 className="text-lg font-semibold">新增来源</h2>
          <p className="mt-1 text-xs text-slate-500">
            层级为「来源 · 大板块 · 栏目」，大板块可留空；类型默认是 RSS 或博客。
          </p>
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <p className="flex items-center gap-1.5 font-semibold mb-2"><Lightbulb className="h-4 w-4" aria-hidden />接入方式选择提示</p>
            <ul className="list-disc list-inside space-y-1">
              <li>如果要添加的网站和已有来源结构类似，可以直接录入试跑</li>
              <li>如果是全新类型的网站，可能需要联系研发同学开发适配解析器</li>
              <li>建议先启用但不开自动监测，单条测试抓取效果后再批量开启</li>
            </ul>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              value={createForm.departmentName}
              onChange={(e) => setCreateForm({ ...createForm, departmentName: e.target.value })}
              placeholder="来源名称，例如：文化和旅游部"
              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={createForm.channelGroup}
              onChange={(e) => setCreateForm({ ...createForm, channelGroup: e.target.value })}
              placeholder="大板块（可留空），例如：时政要闻 / 公告通知"
              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={createForm.channelName}
              onChange={(e) => setCreateForm({ ...createForm, channelName: e.target.value })}
              placeholder="栏目名称，例如：焦点新闻 / 通知"
              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
            />
            <input
              value={createForm.displayName}
              onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
              placeholder="显示名（可留空自动生成）"
              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
            />
            <select
              value={createForm.type}
              onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
            >
              <option value="rss_feed">RSS / Atom Feed</option>
              <option value="html_blog">HTML 博客列表页</option>
            </select>
            <input
              value={createForm.listUrl}
              onChange={(e) => setCreateForm({ ...createForm, listUrl: e.target.value })}
              placeholder="原栏目列表页网址"
              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400 md:col-span-2"
            />
            <input
              type="date"
              value={createForm.startDate}
              onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
            />
            <input
              type="number"
              min={1}
              max={200}
              value={createForm.maxItems}
              onChange={(e) => setCreateForm({ ...createForm, maxItems: Number(e.target.value) })}
              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
              placeholder="最大条数"
            />
            <textarea
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              placeholder="备注"
              className="min-h-[72px] rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm md:col-span-2"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <FormCheckbox label="启用" checked={createForm.enabled} onChange={(v) => setCreateForm({ ...createForm, enabled: v })} />
            <FormCheckbox label="自动监测" checked={createForm.autoMonitor} onChange={(v) => setCreateForm({ ...createForm, autoMonitor: v })} />
            <FormCheckbox label="重点关注" checked={createForm.isKey} onChange={(v) => setCreateForm({ ...createForm, isKey: v })} />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={submitCreate}
              disabled={busy}
              className="inline-flex h-10 items-center text-sm font-medium text-slate-900 transition hover:text-slate-700 disabled:opacity-50"
            >
              {busy ? "提交中…" : "新增来源"}
            </button>
            {message ? <div className="text-xs text-slate-500">{message}</div> : null}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索来源、栏目、显示名、网址、备注…"
              className="h-10 flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-slate-500 focus:bg-white"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveDepartment("ALL")}
                className={`rounded-full px-3 py-1.5 transition ${activeDepartment === "ALL" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
              >
                全部来源（{sources.length}）
              </button>
              {departments.map((d) => {
                const count = sources.filter((s) => (s.departmentName || "未分类来源") === d).length;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setActiveDepartment(d)}
                    className={`rounded-full px-3 py-1.5 transition ${activeDepartment === d ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                  >
                    {d}（{count}）
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="inline-flex h-8 items-center rounded-full border border-slate-300 px-3 text-slate-700 transition hover:bg-slate-50"
              >
                全部展开
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="inline-flex h-8 items-center rounded-full border border-slate-300 px-3 text-slate-700 transition hover:bg-slate-50"
              >
                全部折叠
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">加载中…</div>
        ) : groupedByDepartment.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            还没有来源配置。先用上方「新增来源」录入第一个平台。
          </div>
        ) : (
          <section className="mt-6 space-y-4">
            {groupedByDepartment.map(([departmentName, groupsArr]) => {
              const totalInDept = groupsArr.reduce((sum, [, list]) => sum + list.length, 0);
              const totalKeywordsInDept = (keywordsByDept[departmentName] ?? []).length;
              const departmentCollapsed = collapsedDepartments.has(departmentName);
              const groupCollapsedFor = collapsedGroups[departmentName] ?? new Set<string>();
              return (
                <article key={departmentName} className="pt-6">
                  <header
                    className="flex cursor-pointer flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                    onClick={() => toggleDepartment(departmentName)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-1 inline-flex items-center justify-center text-slate-500" aria-hidden>
                        <span className={`inline-block leading-none transition-transform ${departmentCollapsed ? "" : "rotate-90"}`} style={{ WebkitTextFillColor: "currentColor" }}>▸</span>
                      </span>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{departmentName}</h2>
                        <div className="mt-0.5 text-xs text-slate-500">
                          共 {totalInDept} 个栏目 · {groupsArr.filter(([g]) => g !== null).length} 个大板块
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDepartment(departmentName, totalInDept, totalKeywordsInDept);
                      }}
                      className="inline-flex h-9 items-center justify-self-start text-xs text-rose-700 hover:text-rose-800 lg:justify-self-end"
                    >
                      <Trash2 className="mr-1 inline h-3.5 w-3.5" aria-hidden /> 删除整个来源
                    </button>
                  </header>

                  {!departmentCollapsed ? (
                    <div>
                      <section className="py-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-700">关注关键词（命中会自动标为重点并出现在收件箱顶部）</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              {(keywordsByDept[departmentName] ?? []).length === 0 ? (
                                <span className="text-slate-400">暂时没有关键词。新增后，监测到的新条目命中关键词会被标记为重点。</span>
                              ) : (
                                (keywordsByDept[departmentName] ?? []).map((kw) => (
                                  <span key={kw.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-slate-700">
                                    <span>{kw.keyword}</span>
                                    <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => deleteKeyword(departmentName, kw.keyword)} aria-label={`删除关键词 ${kw.keyword}`}>×</button>
                                  </span>
                                ))
                              )}
                            </div>
                            <div className="mt-3 flex gap-2 text-xs">
                              <input
                                type="text"
                                value={keywordInputByDept[departmentName] ?? ""}
                                onChange={(e) => setKeywordInputByDept((prev) => ({ ...prev, [departmentName]: e.target.value }))}
                                onFocus={() => keywordsByDept[departmentName] === undefined && refreshDepartmentKeywords(departmentName)}
                                placeholder="输入关键词，多个用逗号分隔，例如：人工智能,数据要素,算力"
                                className="h-9 flex-1 rounded-2xl border border-slate-300 bg-white px-3 outline-none transition placeholder:text-slate-400 focus:border-slate-500"
                              />
                              <button
                                type="button"
                                onClick={() => addKeyword(departmentName, keywordInputByDept[departmentName] ?? "")}
                                className="inline-flex h-9 items-center rounded-2xl border border-slate-300 bg-white px-3 text-slate-700 transition hover:bg-slate-100"
                              >
                                添加
                              </button>
                              <button type="button" onClick={() => refreshDepartmentKeywords(departmentName)} className="inline-flex h-9 items-center rounded-2xl border border-slate-300 bg-white px-3 text-slate-700 transition hover:bg-slate-100">
                                刷新
                              </button>
                            </div>
                          </div>
                        </div>
                      </section>

                      {groupsArr.map(([groupName, list]) => {
                        const groupKey = groupName ?? "__ungrouped__";
                        const groupCollapsed = groupCollapsedFor.has(groupKey);
                        return (
                          <div key={groupKey} className="border-b border-slate-100 last:border-b-0">
                            <div
                              className="flex cursor-pointer items-center justify-between gap-2 px-6 py-2 text-xs"
                              onClick={() => toggleGroup(departmentName, groupKey)}
                            >
                              <div className="flex items-center gap-2">
                                <Chevron open={!groupCollapsed} />
                                {groupName ? (
                                  <span className="font-semibold text-amber-800">
                                    <FolderOpen className="mr-1 inline h-3.5 w-3.5" aria-hidden />{groupName} · {list.length} 个栏目
                                  </span>
                                ) : (
                                  <span className="font-medium text-slate-500">
                                    未分类 · {list.length} 个栏目
                                  </span>
                                )}
                              </div>
                              <span className="text-slate-400">{groupCollapsed ? "已折叠" : "点击折叠"}</span>
                            </div>
                            {!groupCollapsed ? (
                              <ul className="divide-y divide-slate-100">
                                {list.map((source) => {
                                  const editing = editingId === source.id;
                                  return (
                                    <li key={source.id} className="px-6 py-5">
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                          <div className="text-xs text-slate-500">{source.id}</div>
                                          <div className="mt-1 text-base font-semibold text-slate-900">{source.displayName}</div>
                                          <div className="mt-1 text-xs text-slate-500">
                                            {source.departmentName || "未分类来源"}
                                            {source.channelGroup ? ` · ${source.channelGroup}` : ""} / {source.channelName} · 起始日期 {source.startDate} · 最大条数 {source.maxItems}
                                          </div>
                                          <a
                                            href={source.listUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 block break-all text-xs text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                                          >
                                            {source.listUrl}
                                          </a>
                                          {source.notes ? <div className="mt-2 text-xs leading-5 text-slate-600">{source.notes}</div> : null}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                          <Pill active={source.enabled} onClick={() => quickToggle(source.id, "enabled", !source.enabled)}>
                                            {source.enabled ? "已启用" : "未启用"}
                                          </Pill>
                                          <Pill active={source.enabled && source.autoMonitor} onClick={() => quickToggle(source.id, "autoMonitor", !source.autoMonitor)}>
                                            {source.autoMonitor ? "自动监测" : "手动刷新"}
                                          </Pill>
                                          <Pill active={source.isKey} onClick={() => quickToggle(source.id, "isKey", !source.isKey)}>
                                            {source.isKey ? "重点关注" : "普通关注"}
                                          </Pill>
                                          <button
                                            type="button"
                                            className="inline-flex h-8 items-center rounded-full border border-slate-300 px-3 text-slate-700 transition hover:bg-slate-50"
                                            onClick={() => {
                                              setEditingId(source.id);
                                              setEditingForm({
                                                departmentName: source.departmentName,
                                                channelGroup: source.channelGroup ?? "",
                                                channelName: source.channelName,
                                                displayName: source.displayName,
                                                type: source.type,
                                                listUrl: source.listUrl,
                                                enabled: source.enabled,
                                                autoMonitor: source.autoMonitor,
                                                isKey: source.isKey,
                                                startDate: source.startDate,
                                                maxItems: source.maxItems,
                                                notes: source.notes ?? "",
                                              });
                                              setMessage(null);
                                            }}
                                          >
                                            编辑
                                          </button>
                                          <button
                                            type="button"
                                            className="inline-flex h-8 items-center rounded-full border border-rose-300 px-3 text-rose-700 transition hover:bg-rose-50"
                                            onClick={() => submitDelete(source.id)}
                                          >
                                            删除
                                          </button>
                                        </div>
                                      </div>

                                      {editing ? (
                                        <div className="mt-5 border-t border-slate-100 pt-5">
                                          <div className="grid gap-3 md:grid-cols-3">
                                            <input
                                              value={editingForm.departmentName}
                                              onChange={(e) => setEditingForm({ ...editingForm, departmentName: e.target.value })}
                                              placeholder="来源名称"
                                              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
                                            />
                                            <input
                                              value={editingForm.channelGroup}
                                              onChange={(e) => setEditingForm({ ...editingForm, channelGroup: e.target.value })}
                                              placeholder="大板块（可留空）"
                                              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
                                            />
                                            <input
                                              value={editingForm.channelName}
                                              onChange={(e) => setEditingForm({ ...editingForm, channelName: e.target.value })}
                                              placeholder="栏目名称"
                                              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
                                            />
                                            <input
                                              value={editingForm.displayName}
                                              onChange={(e) => setEditingForm({ ...editingForm, displayName: e.target.value })}
                                              placeholder="显示名"
                                              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
                                            />
                                            <select
                                              value={editingForm.type}
                                              onChange={(e) => setEditingForm({ ...editingForm, type: e.target.value })}
                                              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
                                            >
                                              <option value="rss_feed">RSS / Atom Feed</option>
              <option value="html_blog">HTML 博客列表页</option>
                                            </select>
                                            <input
                                              value={editingForm.listUrl}
                                              onChange={(e) => setEditingForm({ ...editingForm, listUrl: e.target.value })}
                                              placeholder="原栏目网址"
                                              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400 md:col-span-2"
                                            />
                                            <input
                                              type="date"
                                              value={editingForm.startDate}
                                              onChange={(e) => setEditingForm({ ...editingForm, startDate: e.target.value })}
                                              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
                                            />
                                            <input
                                              type="number"
                                              min={1}
                                              max={200}
                                              value={editingForm.maxItems}
                                              onChange={(e) => setEditingForm({ ...editingForm, maxItems: Number(e.target.value) })}
                                              className="h-9 border-0 border-b border-slate-200 bg-transparent px-0 text-sm outline-none focus:border-slate-400"
                                            />
                                            <textarea
                                              value={editingForm.notes}
                                              onChange={(e) => setEditingForm({ ...editingForm, notes: e.target.value })}
                                              placeholder="备注"
                                              className="min-h-[72px] rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm md:col-span-2"
                                            />
                                          </div>
                                          <div className="mt-3 flex flex-wrap gap-3 text-xs">
                                            <FormCheckbox label="启用" checked={editingForm.enabled} onChange={(v) => setEditingForm({ ...editingForm, enabled: v })} />
                                            <FormCheckbox label="自动监测" checked={editingForm.autoMonitor} onChange={(v) => setEditingForm({ ...editingForm, autoMonitor: v })} />
                                            <FormCheckbox label="重点关注" checked={editingForm.isKey} onChange={(v) => setEditingForm({ ...editingForm, isKey: v })} />
                                          </div>
                                          <div className="mt-4 flex flex-wrap gap-3">
                                            <button
                                              type="button"
                                              onClick={() => submitUpdate(source.id)}
                                              disabled={busy}
                                              className="inline-flex h-9 items-center rounded-full bg-slate-900 px-5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                                            >
                                              保存
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingId(null)}
                                              className="inline-flex h-9 items-center rounded-full border border-slate-300 px-5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                            >
                                              取消
                                            </button>
                                          </div>
                                        </div>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        )}

        {/* ============ 帮助提示 / FAQ ============ */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><CircleHelp className="h-5 w-5" aria-hidden />常见问题</h2>
          <div className="mt-4 space-y-4 text-xs text-slate-600">
            <details className="group">
              <summary className="cursor-pointer font-medium text-slate-800 transition">
                Q：我自己手动填的网址会参与监测吗？
              </summary>
              <div className="mt-2 ml-4 text-slate-600">
                A：会的。无论是手动新增还是批量导入，只要启用了{"\"自动监测\""}，都会按计划参与抓取。
              </div>
            </details>
            <details className="group">
              <summary className="cursor-pointer font-medium text-slate-800 transition">
                Q：批量导入后为什么有的网站抓不到？
              </summary>
              <div className="mt-2 ml-4 text-slate-600">
                A：系统依赖 <code className="rounded bg-slate-100 px-1 text-slate-800">type</code> 字段匹配解析器。通用模板不一定能适配所有网站，特别是动态加载或有反爬机制的站点，需要开发专用解析器。
              </div>
            </details>
            <details className="group">
              <summary className="cursor-pointer font-medium text-slate-800 transition">
                Q：AI 能不能自动识别一批网站并接入？
              </summary>
              <div className="mt-2 ml-4 text-slate-600">
                A：AI 可以帮助识别网址中的来源和栏目信息，但不能自动生成抓取规则。系统仍需要匹配已有的解析器类型。
              </div>
            </details>
            <details className="group">
              <summary className="cursor-pointer font-medium text-slate-800 transition">
                Q：什么情况下需要开发适配？
              </summary>
              <div className="mt-2 ml-4 text-slate-600">
                A：当网站使用动态渲染（JS/Ajax）、有反爬机制（HTTP 412）、页面结构特殊，或者通用模板抓取效果很差时，需要开发专用解析器。
              </div>
            </details>
          </div>
        </section>
        {/* ============ / 帮助提示 / FAQ ============ */}
      </div>
    </main>
  );
}

function FormCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition ${
        active ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function BatchTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-full border px-4 text-xs font-medium transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
