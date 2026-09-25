"use client";

import { useState } from "react";
import { HelpPopover } from "@/components/help-popover";
import { KEYWORDS_HELP_CONTENT } from "@/lib/monitor/keywords-help-content";
import { Lightbulb } from "lucide-react";

interface KeywordItem {
  id: string;
  keyword: string;
  weight: number;
  department_name: string;
  created_at: string;
}

interface KeywordGroup {
  department: string;
  keywords: KeywordItem[];
}

interface DepartmentOption {
  slug: string;
  name: string;
}

interface KeywordsClientProps {
  initialGroups: KeywordGroup[];
  departments: DepartmentOption[];
  globalKeywords: KeywordItem[];
}

const AI_PRESETS: { keyword: string; weight: number }[] = [
  { keyword: "人工智能", weight: 3 },
  { keyword: "大模型", weight: 3 },
  { keyword: "生成式", weight: 3 },
  { keyword: "智能体", weight: 2 },
  { keyword: "算力", weight: 3 },
  { keyword: "算力网络", weight: 2 },
  { keyword: "数据要素", weight: 3 },
  { keyword: "高质量数据集", weight: 2 },
  { keyword: "数字经济", weight: 2 },
  { keyword: "平台经济", weight: 2 },
  { keyword: "数据安全", weight: 3 },
  { keyword: "数据出境", weight: 3 },
  { keyword: "备案", weight: 2 },
  { keyword: "征求意见", weight: 2 },
  { keyword: "专项资金", weight: 2 },
  { keyword: "政府采购", weight: 2 },
  { keyword: "试点", weight: 2 },
  { keyword: "信创", weight: 3 },
  { keyword: "数字政府", weight: 2 },
  { keyword: "科技伦理", weight: 3 },
];

const RESERVED_KEYS = new Set(["__global__", "global", "default", "other", ""]);

function isReservedKey(key: string): boolean {
  return RESERVED_KEYS.has(key.trim().toLowerCase());
}

function getDepartmentName(slug: string, deptList: DepartmentOption[]): string {
  if (isReservedKey(slug)) {
    return "";
  }
  const found = deptList.find((d) => d.slug === slug);
  if (found) return found.name;
  return slug;
}

export function KeywordsClient({ initialGroups, departments, globalKeywords }: KeywordsClientProps) {
  const safeDepartments = departments ?? [];
  const safeGroups = initialGroups ?? [];
  const safeGlobalKeywords = globalKeywords ?? [];

  if (safeDepartments.length === 0) {
    console.warn("[KeywordsClient] 部委列表为空，请检查 getAllDepartments 是否正常返回数据");
  }

  const validDepartments = safeDepartments.filter((d) => !isReservedKey(d.slug));

  const validGroups = safeGroups.filter((g) => !isReservedKey(g.department));

  const [localGroups, setLocalGroups] = useState<KeywordGroup[]>(validGroups);
  const [localGlobalKeywords, setLocalGlobalKeywords] = useState<KeywordItem[]>(safeGlobalKeywords);
  const [newKeyword, setNewKeyword] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newWeight, setNewWeight] = useState(1);
  const [activeTab, setActiveTab] = useState<"department" | "global">("department");
  const [newGlobalKeyword, setNewGlobalKeyword] = useState("");
  const [newGlobalWeight, setNewGlobalWeight] = useState(1);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddDepartmentKeyword = async () => {
    if (!newKeyword.trim() || !newDepartment.trim()) {
      showMessage("error", "请选择机构并填写关键词");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/monitor/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentName: newDepartment.trim(),
          keyword: newKeyword.trim(),
          weight: newWeight,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "添加失败");
      }

      const newItem: KeywordItem = {
        id: `${Date.now()}`,
        keyword: newKeyword.trim(),
        weight: newWeight,
        department_name: newDepartment.trim(),
        created_at: new Date().toISOString(),
      };

      setLocalGroups((prev) => {
        const existing = prev.find((g) => g.department === newDepartment.trim());
        if (existing) {
          return prev.map((g) =>
            g.department === newDepartment.trim()
              ? { ...g, keywords: [...g.keywords, newItem] }
              : g
          );
        }
        return [...prev, { department: newDepartment.trim(), keywords: [newItem] }];
      });

      setNewKeyword("");
      setNewWeight(1);
      showMessage("success", "关键词添加成功");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "添加失败";
      showMessage("error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddGlobalKeyword = async () => {
    if (!newGlobalKeyword.trim()) {
      showMessage("error", "请填写关键词");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/monitor/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentName: "__global__",
          keyword: newGlobalKeyword.trim(),
          weight: newGlobalWeight,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "添加失败");
      }

      const newItem: KeywordItem = {
        id: `__global__:${newGlobalKeyword.trim().toLowerCase()}`,
        keyword: newGlobalKeyword.trim(),
        weight: newGlobalWeight,
        department_name: "__global__",
        created_at: new Date().toISOString(),
      };

      setLocalGlobalKeywords((prev) => [...prev, newItem]);
      setNewGlobalKeyword("");
      setNewGlobalWeight(1);
      showMessage("success", "全局关键词添加成功");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "添加失败";
      showMessage("error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKeyword = async (id: string, department: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/monitor/keywords", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "删除失败");
      }

      if (department === "__global__") {
        setLocalGlobalKeywords((prev) => prev.filter((k) => k.id !== id));
      } else {
        setLocalGroups((prev) =>
          prev
            .map((g) => ({
              ...g,
              keywords: g.keywords.filter((k) => k.id !== id),
            }))
            .filter((g) => g.keywords.length > 0)
        );
      }
      showMessage("success", "关键词删除成功");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "删除失败";
      showMessage("error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateWeight = async (id: string, department: string, newWeightValue: number) => {
    let keywordText = "";
    if (department === "__global__") {
      keywordText = localGlobalKeywords.find((k) => k.id === id)?.keyword || "";
    } else {
      const group = localGroups.find((g) => g.department === department);
      keywordText = group?.keywords.find((k) => k.id === id)?.keyword || "";
    }
    if (!keywordText) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/monitor/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentName: department,
          keyword: keywordText,
          weight: newWeightValue,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "更新失败");
      }

      if (department === "__global__") {
        setLocalGlobalKeywords((prev) =>
          prev.map((k) => (k.id === id ? { ...k, weight: newWeightValue } : k))
        );
      } else {
        setLocalGroups((prev) =>
          prev.map((g) => ({
            ...g,
            keywords: g.keywords.map((k) =>
              k.id === id ? { ...k, weight: newWeightValue } : k
            ),
          }))
        );
      }
      showMessage("success", "权重更新成功");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "更新失败";
      showMessage("error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportMusicPresets = async () => {
    const existing = new Set(localGlobalKeywords.map((k) => k.keyword));
    const toImport = AI_PRESETS.filter((p) => !existing.has(p.keyword));
    if (toImport.length === 0) {
      showMessage("success", "预设关键词已全部存在，无需重复导入");
      return;
    }
    setImporting(true);
    let added = 0;
    try {
      for (const p of toImport) {
        const res = await fetch("/api/monitor/keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ departmentName: "__global__", keyword: p.keyword, weight: p.weight }),
        });
        if (res.ok) {
          const newItem: KeywordItem = {
            id: `__global__:${p.keyword.toLowerCase()}`,
            keyword: p.keyword,
            weight: p.weight,
            department_name: "__global__",
            created_at: new Date().toISOString(),
          };
          setLocalGlobalKeywords((prev) => [...prev, newItem]);
          added++;
        }
      }
      showMessage("success", `已导入 ${added} 个 AI／数字经济关键词`);
    } catch {
      showMessage("error", "导入失败，请重试");
    } finally {
      setImporting(false);
    }
  };

  const sortedGroups = [...localGroups].sort((a, b) => {
    const nameA = getDepartmentName(a.department, validDepartments);
    const nameB = getDepartmentName(b.department, validDepartments);
    return nameA.localeCompare(nameB, "zh-CN");
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                管理后台
              </span>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">关键词库</h1>
              <p className="mt-2 text-sm text-slate-600">
                维护全局和机构级关键词库，用于系统信号识别、分类匹配和优先级计算
              </p>
            </div>
            <HelpPopover
              triggerLabel="使用说明"
              triggerIcon={Lightbulb}
              title="关键词是怎么工作的？"
              content={KEYWORDS_HELP_CONTENT}
              theme="amber"
            />
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

        {/* Tab 切换 */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            onClick={() => setActiveTab("department")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "department"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            机构关键词
          </button>
          <button
            onClick={() => setActiveTab("global")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "global"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            全局关键词
          </button>
        </div>

        {/* 机构关键词 Tab */}
        {activeTab === "department" && (
          <>
            <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-900">添加机构关键词</h2>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">机构名称</label>
                  <select
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  >
                    <option value="">请选择部委</option>
                    {validDepartments.map((d) => (
                      <option key={d.slug} value={d.slug}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">关键词</label>
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="输入关键词"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">权重</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value) || 1)}
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddDepartmentKeyword}
                    disabled={isLoading}
                    className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {sortedGroups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  暂无机构关键词，请在上方添加
                </div>
              ) : (
                sortedGroups.map((group) => {
                  const displayName = getDepartmentName(group.department, validDepartments);
                  if (!displayName) return null;
                  return (
                    <div key={group.department} className="rounded-2xl border border-slate-200 bg-white p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-slate-900">
                          {displayName}
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                            {group.keywords.length} 个关键词
                          </span>
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="w-1/2 px-4 py-3 text-left font-medium text-slate-500">关键词</th>
                              <th className="w-24 px-4 py-3 text-left font-medium text-slate-500">权重</th>
                              <th className="w-24 px-4 py-3 text-right font-medium text-slate-500">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.keywords.map((keyword) => (
                              <tr key={keyword.id} className="group">
                                <td className="px-4 py-3">
                                  <span className="text-slate-900">{keyword.keyword}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="range"
                                      min="1"
                                      max="10"
                                      value={keyword.weight}
                                      onChange={(e) =>
                                        handleUpdateWeight(keyword.id, group.department, Number(e.target.value))
                                      }
                                      disabled={isLoading}
                                      className="w-24 accent-sky-600"
                                    />
                                    <span className="w-8 text-right text-slate-600">{keyword.weight}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => handleDeleteKeyword(keyword.id, group.department)}
                                    disabled={isLoading}
                                    className="rounded-lg px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    删除
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* 全局关键词 Tab */}
        {activeTab === "global" && (
          <>
            {/* AI／数字经济预设 */}
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">AI／数字经济关键词预设</h3>
                  <p className="mt-1 text-xs text-amber-700">一键导入 {AI_PRESETS.length} 个常用词：人工智能、大模型、算力、数据要素、数据出境等</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {AI_PRESETS.map((p) => (
                      <span key={p.keyword} className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${localGlobalKeywords.some((k) => k.keyword === p.keyword) ? "bg-amber-200 text-amber-800 line-through opacity-60" : "bg-white text-amber-800"}`}>
                        {p.keyword}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleImportMusicPresets}
                  disabled={importing || isLoading}
                  className="shrink-0 rounded-full bg-amber-700 px-4 py-2 text-xs font-medium text-white transition hover:bg-amber-800 disabled:opacity-50"
                >
                  {importing ? "导入中…" : "一键导入"}
                </button>
              </div>
            </div>

            <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-900">添加全局关键词</h2>
              <p className="mb-4 text-xs text-slate-500">
                全局关键词适用于所有部委的政策匹配，优先级低于部委专属关键词
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[300px]">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">关键词</label>
                  <input
                    type="text"
                    value={newGlobalKeyword}
                    onChange={(e) => setNewGlobalKeyword(e.target.value)}
                    placeholder="输入全局关键词"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">权重</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newGlobalWeight}
                    onChange={(e) => setNewGlobalWeight(Number(e.target.value) || 1)}
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddGlobalKeyword}
                    disabled={isLoading}
                    className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">
                  全局关键词列表
                  <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-normal text-violet-600">
                    {localGlobalKeywords.length} 个关键词
                  </span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="w-1/2 px-4 py-3 text-left font-medium text-slate-500">关键词</th>
                      <th className="w-24 px-4 py-3 text-left font-medium text-slate-500">权重</th>
                      <th className="w-24 px-4 py-3 text-right font-medium text-slate-500">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localGlobalKeywords.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                          暂无全局关键词
                        </td>
                      </tr>
                    ) : (
                      localGlobalKeywords.map((keyword) => (
                        <tr key={keyword.id} className="group">
                          <td className="px-4 py-3">
                            <span className="text-slate-900">{keyword.keyword}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="1"
                                max="10"
                                value={keyword.weight}
                                onChange={(e) =>
                                  handleUpdateWeight(keyword.id, "__global__", Number(e.target.value))
                                }
                                disabled={isLoading}
                                className="w-24 accent-violet-600"
                              />
                              <span className="w-8 text-right text-slate-600">{keyword.weight}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteKeyword(keyword.id, "__global__")}
                              disabled={isLoading}
                              className="rounded-lg px-3 py-1 text-xs text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
