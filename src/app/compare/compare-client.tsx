"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { StatCard } from "@/components/stat-card";
import { FloatingBackButton } from "@/components/back-button";
import {
  runFullComparison,
  getImpactDimensionLabel,
  COMPARE_IMPACT_DIMENSIONS,
  computeTextDiff,
  generateRuleConclusions,
  generateRuleSummary,
  type CompareItemBasic,
} from "@/lib/monitor/compare-analysis";
import { DEMO_POLICIES } from "@/lib/monitor/compare-demo-data";
import {
  AlarmClock, Bot, Calendar, ChartColumn, Circle, CircleCheck, ClipboardList, FileText, Lightbulb, Link as LinkIcon, Megaphone, NotebookPen, Pencil, Route, Search, Sparkles, Tag, Target, TrendingUp, type LucideIcon,
} from "lucide-react";

interface CompareItem {
  sourceId: string;
  url: string;
  title: string;
  departmentName: string;
  channelName: string;
  listPublishedAt: string;
  firstSeenAt: string;
  importanceLevel: string;
  keywordScore: number;
  summary: string | null;
  paragraphs: string[];
  categories: Array<{ category: string; score: number }>;
  matchedKeywords: Array<{ keyword: string; category: string }>;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  deadlineDate: string | null;
  hasFunding: boolean;
  hasPilot: boolean;
  hasProcurement: boolean;
  documentStatus: string | null;
  isRead: boolean;
  isStarred: boolean;
}

interface CompareResult {
  overallSummary: string;
  similarities: string[];
  differences: string[];
  relationships: string;
  impactComparison: Array<{
    policyIndex: number;
    impactLevel: "high" | "medium" | "low";
    impactAreas: string[];
  }>;
  keyFindings: string;
}

function parseItemsParam(param: string): Array<{ sourceId: string; url: string }> {
  const result: Array<{ sourceId: string; url: string }> = [];
  const parts = param.split("|");
  for (const part of parts) {
    if (!part) continue;
    const idx = part.indexOf("::");
    if (idx > 0) {
      const sourceId = part.slice(0, idx);
      const url = part.slice(idx + 2);
      if (sourceId && url) {
        result.push({ sourceId, url });
      }
    }
  }
  if (typeof window !== "undefined") {
    console.log(
      `[ComparePage][parseItemsParam] 解析URL参数: 原始片段=${parts.length}, 有效条目=${result.length}`
    );
  }
  return result;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  } catch {
    return iso;
  }
}

export function getImportanceBadge(level: string) {
  const colors: Record<string, string> = {
    "核心关注": "bg-rose-50 text-rose-700 border-rose-200",
    "加急推荐": "bg-orange-50 text-orange-700 border-orange-200",
    "重点内容": "bg-amber-50 text-amber-700 border-amber-200",
    "中等重点": "bg-sky-50 text-sky-700 border-sky-200",
    "普通": "bg-slate-50 text-slate-600 border-slate-200",
  };
  return colors[level] || colors["普通"];
}

export function getImpactBadge(level: string) {
  switch (level) {
    case "high":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "low":
      return "bg-slate-50 text-slate-600 border-slate-200";
    case "none":
      return "bg-slate-50 text-slate-400 border-slate-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export function getImpactLabel(level: string) {
  switch (level) {
    case "high":
      return "高影响";
    case "medium":
      return "中影响";
    case "low":
      return "低影响";
    case "none":
      return "无影响";
    default:
      return "未知";
  }
}

const TIMELINE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  deadline: { label: "截止", color: "bg-rose-100 text-rose-700", icon: AlarmClock },
  effective: { label: "生效", color: "bg-emerald-100 text-emerald-700", icon: CircleCheck },
  milestone: { label: "里程碑", color: "bg-sky-100 text-sky-700", icon: Target },
  review: { label: "评估", color: "bg-amber-100 text-amber-700", icon: NotebookPen },
  publication: { label: "发布", color: "bg-violet-100 text-violet-700", icon: Megaphone },
};

type MainViewType = "core" | "evolution";

export function CompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemsParam = searchParams.get("items") || "";

  const [items, setItems] = useState<CompareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<CompareResult | null>(null);
  const [aiSource, setAiSource] = useState<string>("");
  const [activeView, setActiveView] = useState<MainViewType>("core");
  const [error, setError] = useState<string>("");
  const [showOnlyDiff, setShowOnlyDiff] = useState(false);
  const [textDiffIndex, setTextDiffIndex] = useState<[number, number]>([0, 1]);
  const [textDiffMode, setTextDiffMode] = useState<"summary" | "full">("summary");
  const [demoMode, setDemoMode] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(true);
  
  const loadRequestIdRef = useRef(0);
  const loadAbortControllerRef = useRef<AbortController | null>(null);
  const aiRequestIdRef = useRef(0);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const AI_COMPARE_TIMEOUT_MS = 60000;

  const itemRefs = useMemo(() => parseItemsParam(itemsParam), [itemsParam]);

  useEffect(() => {
    if (itemRefs.length > 0) return;
    try {
      const raw = window.localStorage.getItem("compare_items");
      if (!raw) return;
      const saved = JSON.parse(raw) as Array<{ sourceId: string; url: string }>;
      if (saved.length > 0) {
        const newParam = saved.map((r) => `${r.sourceId}::${r.url}`).join("|");
        router.replace(`/compare?items=${encodeURIComponent(newParam)}`);
      }
    } catch {
      // localStorage 不可用时忽略
    }
  }, [itemRefs.length, router]);

  const handleEnterDemoMode = useCallback(() => {
    console.log("[ComparePage] 进入演示模式，使用模拟数据");
    setDemoMode(true);
    setItems(DEMO_POLICIES as CompareItem[]);
    setError("");
    setLoading(false);
  }, []);

  const deepCompare = useMemo(() => {
    if (items.length < 2) return null;
    return runFullComparison(items as unknown as CompareItemBasic[]);
  }, [items]);

  const ruleConclusions = useMemo(() => {
    if (!deepCompare || items.length < 2) return [];
    return generateRuleConclusions(items as unknown as CompareItemBasic[], deepCompare);
  }, [deepCompare, items]);

  const ruleSummary = useMemo(() => {
    if (!deepCompare || items.length < 2) return null;
    return generateRuleSummary(items as unknown as CompareItemBasic[], deepCompare);
  }, [deepCompare, items]);

  const textDiff = useMemo(() => {
    if (items.length < 2) return null;
    const [a, b] = textDiffIndex;
    if (a >= items.length || b >= items.length) return null;

    let textA = "";
    let textB = "";

    if (textDiffMode === "summary") {
      textA = items[a]?.summary || "";
      textB = items[b]?.summary || "";
    } else {
      textA = (items[a]?.paragraphs || []).join("\n");
      textB = (items[b]?.paragraphs || []).join("\n");
    }

    if (!textA && !textB) return null;
    return computeTextDiff(textA, textB);
  }, [items, textDiffIndex, textDiffMode]);

  useEffect(() => {
    if (itemRefs.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("至少需要选择 2 条内容才能对比");
      setLoading(false);
      return;
    }

    loadRequestIdRef.current += 1;
    const myRequestId = loadRequestIdRef.current;
    console.debug(`[ComparePage] 加载对比数据 requestId=${myRequestId} items=${itemRefs.length}条`);

    if (loadAbortControllerRef.current) {
      console.debug(`[ComparePage] 取消上一次加载请求 requestId=${myRequestId - 1}`);
      loadAbortControllerRef.current.abort();
    }
    const myController = new AbortController();
    loadAbortControllerRef.current = myController;

    async function loadItems() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/monitor/compare?items=${encodeURIComponent(itemsParam)}`,
          { signal: myController.signal }
        );
        if (myController.signal.aborted) {
          console.debug(`[ComparePage] 请求被取消（fetch 返回后检查 signal） requestId=${myRequestId}`);
          return;
        }
        const data = await res.json();
        if (myController.signal.aborted) {
          console.debug(`[ComparePage] 请求被取消（json 解析后检查 signal） requestId=${myRequestId}`);
          return;
        }
        if (myRequestId !== loadRequestIdRef.current) {
          console.debug(`[ComparePage] 结果被丢弃（有更新的请求） requestId=${myRequestId} current=${loadRequestIdRef.current}`);
          return;
        }
        if (data.ok) {
          console.debug(`[ComparePage] 加载成功 requestId=${myRequestId} items=${data.items?.length ?? 0}条`);
          setItems(data.items || []);
          setError("");
        } else {
          console.error(`[ComparePage] 加载失败 requestId=${myRequestId} error=${data.error}`);
          setError(data.error || "加载失败");
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          console.debug(`[ComparePage] 请求被取消（catch AbortError） requestId=${myRequestId}`);
          return;
        }
        if (myRequestId !== loadRequestIdRef.current) {
          console.debug(`[ComparePage] 错误被丢弃（有更新的请求） requestId=${myRequestId}`);
          return;
        }
        console.error(`[ComparePage] 加载异常 requestId=${myRequestId} error=${(e as Error).message}`);
        setError("加载失败，请重试");
      } finally {
        if (myRequestId === loadRequestIdRef.current) {
          setLoading(false);
          if (loadAbortControllerRef.current === myController) {
            loadAbortControllerRef.current = null;
          }
        }
      }
    }

    loadItems();

    return () => {
      if (loadAbortControllerRef.current === myController) {
        console.debug(`[ComparePage] 组件卸载或依赖变化，取消请求 requestId=${myRequestId}`);
        myController.abort();
        loadAbortControllerRef.current = null;
      }
    };
  }, [itemsParam, itemRefs.length]);

  async function handleAiCompare() {
    if (items.length < 2) return;

    aiRequestIdRef.current += 1;
    const myRequestId = aiRequestIdRef.current;
    console.debug(`[ComparePage] AI对比开始 requestId=${myRequestId} items=${items.length}条`);

    if (aiAbortControllerRef.current) {
      console.debug(`[ComparePage] 取消上一次AI对比请求 requestId=${myRequestId - 1}`);
      aiAbortControllerRef.current.abort();
    }
    const myController = new AbortController();
    aiAbortControllerRef.current = myController;

    const timeoutId = setTimeout(() => {
      if (myController.signal.aborted) return;
      console.warn(`[ComparePage] AI对比超时（${AI_COMPARE_TIMEOUT_MS}ms），取消请求 requestId=${myRequestId}`);
      myController.abort();
    }, AI_COMPARE_TIMEOUT_MS);

    setAiLoading(true);
    setError("");

    try {
      const res = await fetch("/api/monitor/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: myController.signal,
        body: JSON.stringify({
          items: items.map((item) => ({
            title: item.title,
            content: (item.paragraphs || []).join("\n"),
            summary: item.summary,
            department: item.departmentName,
            publishedAt: item.listPublishedAt,
          })),
        }),
      });

      if (myController.signal.aborted) {
        console.debug(`[ComparePage] AI对比被取消（fetch返回后检查signal） requestId=${myRequestId}`);
        return;
      }

      const data = await res.json();

      if (myController.signal.aborted) {
        console.debug(`[ComparePage] AI对比被取消（json解析后检查signal） requestId=${myRequestId}`);
        return;
      }

      if (myRequestId !== aiRequestIdRef.current) {
        console.debug(`[ComparePage] AI对比结果被丢弃（有更新的请求） requestId=${myRequestId} current=${aiRequestIdRef.current}`);
        return;
      }

      if (data.ok) {
        console.debug(
          `[ComparePage] AI对比成功 requestId=${myRequestId} 来源=${data.source} 共同点=${data.result?.similarities?.length ?? 0}条 差异点=${data.result?.differences?.length ?? 0}条`
        );
        setAiResult(data.result);
        setAiSource(data.source);
      } else {
        console.error(`[ComparePage] AI对比失败 requestId=${myRequestId} error=${data.error}`);
        setError(data.error || "AI 分析失败");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        console.debug(`[ComparePage] AI对比被取消（catch AbortError） requestId=${myRequestId}`);
        return;
      }
      if (myRequestId !== aiRequestIdRef.current) {
        console.debug(`[ComparePage] AI对比错误被丢弃（有更新的请求） requestId=${myRequestId}`);
        return;
      }
      console.error(`[ComparePage] AI对比异常 requestId=${myRequestId} error=${(e as Error).message}`);
      setError("AI 分析失败，请重试");
    } finally {
      clearTimeout(timeoutId);
      if (myRequestId === aiRequestIdRef.current) {
        setAiLoading(false);
        if (aiAbortControllerRef.current === myController) {
          aiAbortControllerRef.current = null;
        }
      }
    }
  }

  function handleRemove(index: number) {
    const newRefs = itemRefs.filter((_, i) => i !== index);
    if (newRefs.length < 2) {
      router.push("/inbox");
      return;
    }
    const newParam = newRefs.map((r) => `${r.sourceId}::${r.url}`).join("|");
    router.push(`/compare?items=${encodeURIComponent(newParam)}`);
  }

  const handleViewChange = useCallback((view: MainViewType) => {
    setActiveView(view);
  }, []);

  const handleExportReport = useCallback(() => {
    if (!deepCompare) return;
    const blob = new Blob([deepCompare.markdownReport], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `内容对比报告_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [deepCompare]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="text-center py-20 text-slate-500">加载中...</div>
        </div>
        <FloatingBackButton />
      </main>
    );
  }

  if (error && items.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="rounded-3xl border border-slate-200 bg-white p-8">
            <div className="text-lg font-semibold">加载失败</div>
            <p className="mt-2 text-slate-600">{error}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleEnterDemoMode}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                查看演示数据
              </button>
              <Link
                href="/inbox"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                返回列表
              </Link>
            </div>
          </div>
        </div>
        <FloatingBackButton />
      </main>
    );
  }

  const diffCount = deepCompare?.summaryStats.diffFields || 0;
  const sameCount = deepCompare?.summaryStats.sameFields || 0;
  const totalFields = deepCompare?.summaryStats.totalFields || 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        {/* 面包屑 */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/inbox" className="hover:text-slate-900">
            动态资讯
          </Link>
          <span>/</span>
          <span className="text-slate-700">内容对比 ({items.length} 条)</span>
        </div>

        {/* 顶部标题栏 */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900 lg:text-2xl">
              深度对比分析
            </h1>
            {demoMode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                <Sparkles className="h-4 w-4" aria-hidden />
                演示模式
              </span>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-500">
              共 {items.length} 条内容 · {diffCount} 个差异字段 · {sameCount} 个相同字段
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!demoMode && (
              <button
                onClick={handleEnterDemoMode}
                className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-4 py-2 text-sm text-violet-700 hover:bg-violet-100"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                查看演示
              </button>
            )}
            <button
              onClick={handleExportReport}
              disabled={!deepCompare}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText className="h-4 w-4" aria-hidden />
              导出报告
            </button>
            <Link
              href="/inbox"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              返回列表
            </Link>
          </div>
        </div>

        {/* 对比统计卡片 */}
        {deepCompare && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <StatCard label="对比内容" value={items.length} variant="default" />
            <StatCard label="差异字段" value={diffCount} variant="danger" />
            <StatCard label="相同字段" value={sameCount} variant="success" />
            <StatCard label="时间节点" value={deepCompare.summaryStats.totalEvents} variant="info" />
            <StatCard label="共同分类" value={deepCompare.summaryStats.commonCategories} variant="violet" />
            <StatCard label="共同关键词" value={deepCompare.summaryStats.commonKeywords} variant="warning" />
          </div>
        )}

        {/* 内容卡片栏 */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map((item, idx) => (
            <div
              key={`${item.sourceId}-${idx}`}
              className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <button
                onClick={() => handleRemove(idx)}
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[var(--muted-foreground)] opacity-100 transition hover:bg-rose-100 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
                title="移除"
              >
                ✕
              </button>
              <div className="mb-2 text-xs font-medium text-slate-400">
                内容 {idx + 1}
              </div>
              <div className="mb-2 line-clamp-3 text-sm font-medium leading-snug text-slate-900">
                {item.title}
              </div>
              <div className="text-xs text-slate-500">{item.departmentName}</div>
              <Link
                href={`/items/${encodeURIComponent(item.sourceId)}?sourceId=${encodeURIComponent(item.sourceId)}&url=${encodeURIComponent(item.url)}`}
                className="mt-2 inline-block text-xs text-sky-600 hover:text-sky-700"
                target="_blank"
              >
                查看详情 →
              </Link>
            </div>
          ))}
        </div>

        {/* 主视图切换 */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {[
            { key: "core", label: "核心对比", desc: "基本信息·差异分析·影响评估·AI分析" },
            { key: "evolution", label: "演变趋势", desc: "时间线·演进路径·趋势指标" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleViewChange(tab.key as MainViewType)}
              className={`flex-1 min-w-[120px] rounded-lg px-3 py-2.5 text-xs font-medium transition sm:px-4 sm:text-sm ${
                activeView === tab.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* ===== 核心对比视图 ===== */}
          {activeView === "core" && deepCompare && (
            <div className="flex gap-0">
              {/* 左侧锚点导航 */}
              <aside className="hidden w-48 shrink-0 border-r border-slate-200 p-4 lg:block">
                <div className="sticky top-24">
                  <div className="mb-3 text-xs font-semibold text-slate-400">页面导航</div>
                  <nav className="space-y-1 text-sm">
                    {[
                      { id: "core-summary", label: "核心结论摘要", icon: Search },
                      { id: "core-ai", label: "AI 深度分析", icon: Bot },
                      { id: "core-fields", label: "基本信息差异", icon: ClipboardList },
                      { id: "core-textdiff", label: "关键条款对比", icon: Pencil },
                      { id: "core-impact", label: "影响评估", icon: ChartColumn },
                      { id: "core-categories", label: "分类与关键词", icon: Tag },
                    ].map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                      >
                        <item.icon className="h-4 w-4" aria-hidden />
                        <span>{item.label}</span>
                      </a>
                    ))}
                  </nav>
                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                    <div className="text-xs font-medium text-slate-500">对比概览</div>
                    <div className="mt-2 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">差异字段</span>
                        <span className="font-semibold text-rose-600">{diffCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">相同字段</span>
                        <span className="font-semibold text-emerald-600">{sameCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">时间节点</span>
                        <span className="font-semibold text-sky-600">{deepCompare.summaryStats.totalEvents}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">共同分类</span>
                        <span className="font-semibold text-violet-600">{deepCompare.summaryStats.commonCategories}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              {/* 右侧主内容区 */}
              <div className="flex-1 min-w-0">
                {/* 区块0：核心结论摘要 */}
                <section id="core-summary" className="scroll-mt-20">
                  <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-slate-900">
                          <Search className="h-4 w-4 mr-2 inline" aria-hidden />
                          核心结论摘要
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          一眼看懂这 {items.length} 份内容的核心差异和影响
                        </p>
                      </div>
                      {!aiResult && !aiLoading && (
                        <button
                          onClick={handleAiCompare}
                          disabled={items.length < 2}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                        >
                          <Bot className="h-4 w-4" aria-hidden />
                          生成 AI 深度分析
                        </button>
                      )}
                    </div>

                    {aiResult && !aiLoading ? (
                      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Bot className="h-4 w-4" aria-hidden />
                          <span className="text-xs font-medium text-violet-700">
                            AI 总体结论
                            {aiSource && (
                              <span className="ml-1 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-normal text-violet-600">
                                {aiSource === "doubao" ? "豆包 AI" : aiSource === "llm" ? "LLM" : "规则分析"}
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-700">
                          {aiResult.overallSummary}
                        </p>
                        {aiResult.keyFindings && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                            <div className="flex items-center gap-1 text-xs font-medium text-amber-700"><Lightbulb className="h-3.5 w-3.5" aria-hidden />关键发现</div>
                            <p className="mt-1 text-xs leading-relaxed text-amber-800">
                              {aiResult.keyFindings}
                            </p>
                          </div>
                        )}
                        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {aiResult.similarities?.length || 0} 个共同点
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            {aiResult.differences?.length || 0} 个差异点
                          </span>
                          <button
                            onClick={() => setShowAiAnalysis(!showAiAnalysis)}
                            className="ml-auto text-violet-600 hover:text-violet-700"
                          >
                            {showAiAnalysis ? "收起详情" : "查看完整分析 →"}
                          </button>
                        </div>
                      </div>
                    ) : aiLoading ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-center">
                        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
                        <p className="text-sm text-slate-500">AI 正在深度对比分析，请稍候...</p>
                      </div>
                    ) : ruleSummary ? (
                      <>
                        {/* 规则版三句话摘要卡 */}
                        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/40 p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <ChartColumn className="h-4 w-4" aria-hidden />
                            <span className="text-xs font-medium text-sky-700">
                              规则分析摘要
                              <span className="ml-1 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-normal text-sky-600">
                                自动生成
                              </span>
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            <div className="flex gap-2">
                              <span className="mt-0.5 shrink-0 text-xs text-sky-600">①</span>
                              <p className="text-sm leading-relaxed text-slate-700">
                                {ruleSummary.overallSentence}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <span className="mt-0.5 shrink-0 text-xs text-rose-500">②</span>
                              <p className="text-sm leading-relaxed text-slate-700">
                                {ruleSummary.differenceSentence}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <span className="mt-0.5 shrink-0 text-xs text-amber-600">③</span>
                              <p className="text-sm leading-relaxed text-slate-700">
                                {ruleSummary.suggestionSentence}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {sameCount} 个相同字段
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              {diffCount} 个差异字段
                            </span>
                            <button
                              onClick={handleAiCompare}
                              className="ml-auto inline-flex items-center gap-1 text-violet-600 hover:text-violet-700"
                            >
                              <Bot className="h-4 w-4" aria-hidden />
                              生成 AI 深度分析 →
                            </button>
                          </div>
                        </div>

                        {/* 分项结论卡片 */}
                        <div className="mt-4">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-500">分项结论</span>
                            <div className="flex-1 h-px bg-slate-200" />
                          </div>
                          <div className="space-y-3">
                            {ruleConclusions.map((conclusion) => {
                              const typeStyles: Record<string, { icon: LucideIcon; bg: string; border: string; text: string }> = {
                                summary: { icon: ChartColumn, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
                                difference: { icon: Search, bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
                                similarity: { icon: CircleCheck, bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
                                trend: { icon: TrendingUp, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
                              };
                              const style = typeStyles[conclusion.type] || typeStyles.summary;
                              return (
                                <div
                                  key={conclusion.id}
                                  className={`rounded-xl border ${style.border} ${style.bg} p-4`}
                                >
                                  <div className="flex items-start gap-2">
                                    <style.icon className="mt-0.5 h-4 w-4" aria-hidden />
                                    <div className="min-w-0 flex-1">
                                      <div className={`text-xs font-medium ${style.text}`}>
                                        {conclusion.title}
                                      </div>
                                      <p className="mt-1 text-sm leading-relaxed text-slate-700">
                                        {conclusion.content}
                                      </p>
                                      {conclusion.evidence.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          {conclusion.evidence.slice(0, 3).map((ev, idx) => (
                                            <span
                                              key={idx}
                                              className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] text-slate-500"
                                            >
                                              {ev}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 text-center py-6 text-slate-500 text-sm">
                        暂无对比数据
                      </div>
                    )}
                  </div>
                </section>

                {/* 区块0.5：AI 深度分析（可展开） */}
                {showAiAnalysis && aiResult && !aiLoading && (
                  <section id="core-ai" className="scroll-mt-20 border-t border-slate-200">
                    <div className="p-4 sm:p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-slate-900">
                          <Bot className="h-4 w-4 mr-2 inline" aria-hidden />
                          AI 深度分析
                          {aiSource && (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
                              {aiSource === "doubao" ? "豆包 AI" : aiSource === "llm" ? "LLM" : "规则分析"}
                            </span>
                          )}
                        </h3>
                        <button
                          onClick={handleAiCompare}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          重新分析
                        </button>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5">
                          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                            <Circle className="h-5 w-5 text-emerald-500" aria-hidden />
                            共同点
                          </h4>
                          <ul className="space-y-2">
                            {(aiResult.similarities || []).map((s, i) => (
                              <li
                                key={i}
                                className="flex gap-2 text-sm leading-relaxed text-slate-700"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-5">
                          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-900">
                            <Circle className="h-5 w-5 text-rose-500" aria-hidden />
                            差异点
                          </h4>
                          <ul className="space-y-2">
                            {(aiResult.differences || []).map((d, i) => (
                              <li
                                key={i}
                                className="flex gap-2 text-sm leading-relaxed text-slate-700"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500" />
                                {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {aiResult.impactComparison && aiResult.impactComparison.length > 0 && (
                        <div className="mt-4 rounded-xl border border-slate-200 p-5">
                          <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <ChartColumn className="h-5 w-5" aria-hidden />
                            影响强度对比
                          </h4>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            {aiResult.impactComparison.map((imp, idx) => {
                              const item = items[imp.policyIndex];
                              return (
                                <div
                                  key={idx}
                                  className="rounded-xl border border-slate-200 p-4"
                                >
                                  <div className="mb-2 text-xs text-slate-400">
                                    内容 {imp.policyIndex + 1}
                                  </div>
                                  <div className="mb-2 line-clamp-2 text-sm font-medium text-slate-900">
                                    {item?.title?.slice(0, 40)}...
                                  </div>
                                  <div
                                    className={`mb-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getImpactBadge(imp.impactLevel)}`}
                                  >
                                    {getImpactLabel(imp.impactLevel)}
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {(imp.impactAreas || []).slice(0, 3).map((area, ai) => (
                                      <span
                                        key={ai}
                                        className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                                      >
                                        {area}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {aiResult.relationships && (
                        <div className="mt-4 rounded-xl border border-slate-200 p-5">
                          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <LinkIcon className="h-5 w-5" aria-hidden />
                            相互关系分析
                          </h4>
                          <p className="text-sm leading-relaxed text-slate-700">
                            {aiResult.relationships}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* 区块1：基本信息差异 */}
                <section id="core-fields" className="scroll-mt-20">
                  <div className="flex items-center justify-between border-b border-slate-200 p-4 sm:p-6">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        <ClipboardList className="h-4 w-4 mr-2 inline" aria-hidden />
                        基本信息差异
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        共 {totalFields} 个字段 · {diffCount} 个差异 · {sameCount} 个相同
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showOnlyDiff}
                        onChange={(e) => setShowOnlyDiff(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-slate-600">仅显示差异</span>
                    </label>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="sticky left-0 z-10 w-20 shrink-0 bg-slate-50 p-3 text-left text-xs font-medium text-slate-500 sm:w-28 sm:p-4 sm:text-sm md:w-36">
                            对比项
                          </th>
                          {items.map((_, idx) => (
                            <th
                              key={idx}
                              className="min-w-40 p-3 text-left text-xs font-medium text-slate-700 sm:min-w-52 sm:p-4 sm:text-sm"
                            >
                              <span className="text-xs text-slate-400">内容 {idx + 1}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {deepCompare.fieldDiffs
                          .filter((field) => !showOnlyDiff || field.type === "different")
                          .map((field) => (
                            <tr
                              key={field.key}
                              className={`border-b border-slate-100 last:border-0 ${
                                field.type === "different" ? "bg-rose-50/30" : "hover:bg-slate-50"
                              }`}
                            >
                              <td className={`sticky left-0 w-20 shrink-0 p-3 text-xs font-medium sm:w-28 sm:p-4 sm:text-sm md:w-36 ${
                                field.type === "different"
                                  ? "bg-rose-50/30 text-rose-700"
                                  : "bg-white text-slate-500"
                              }`}>
                                <div className="flex items-center gap-2">
                                  {field.type === "different" && (
                                    <span className="inline-block h-2 w-2 rounded-full bg-rose-500" title="存在差异" />
                                  )}
                                  {field.label}
                                </div>
                              </td>
                              {field.displayValues.map((val, idx) => (
                                <td
                                  key={idx}
                                  className={`p-3 text-xs sm:p-4 sm:text-sm ${
                                    field.type === "different"
                                      ? "text-rose-700 font-medium"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {val}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 区块2：关键条款/文本 diff */}
                <section id="core-textdiff" className="scroll-mt-20 border-t border-slate-200">
                  {items.length >= 2 && (
                    <div className="p-4 sm:p-6">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-900">
                          <Pencil className="mr-2 inline h-4 w-4" aria-hidden />
                          关键条款对比
                        </h3>
                        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                          <button
                            onClick={() => setTextDiffMode("summary")}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                              textDiffMode === "summary"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            摘要对比
                          </button>
                          <button
                            onClick={() => setTextDiffMode("full")}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                              textDiffMode === "full"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            全文对比
                          </button>
                        </div>
                      </div>
                      
                      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">内容 A：</span>
                          <select
                            value={textDiffIndex[0]}
                            onChange={(e) => setTextDiffIndex([parseInt(e.target.value), textDiffIndex[1]])}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                          >
                            {items.map((item, idx) => (
                              <option key={idx} value={idx}>
                                内容 {idx + 1}: {item.title.slice(0, 30)}...
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">内容 B：</span>
                          <select
                            value={textDiffIndex[1]}
                            onChange={(e) => setTextDiffIndex([textDiffIndex[0], parseInt(e.target.value)])}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                          >
                            {items.map((item, idx) => (
                              <option key={idx} value={idx}>
                                内容 {idx + 1}: {item.title.slice(0, 30)}...
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 p-4">
                          <div className="mb-2 text-xs font-medium text-slate-400">内容 {textDiffIndex[0] + 1}</div>
                          <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                            {textDiff
                              ?.filter((seg) => seg.type !== "added")
                              .map((seg, i) => (
                                <span
                                  key={i}
                                  className={
                                    seg.type === "removed"
                                      ? "bg-rose-100 text-rose-700 line-through"
                                      : ""
                                  }
                                >
                                  {seg.text}
                                </span>
                              )) || (
                                textDiffMode === "summary"
                                  ? (items[textDiffIndex[0]]?.summary || "暂无摘要")
                                  : ((items[textDiffIndex[0]]?.paragraphs || []).join("\n") || "暂无正文")
                              )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4">
                          <div className="mb-2 text-xs font-medium text-slate-400">内容 {textDiffIndex[1] + 1}</div>
                          <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                            {textDiff
                              ?.filter((seg) => seg.type !== "removed")
                              .map((seg, i) => (
                                <span
                                  key={i}
                                  className={
                                    seg.type === "added"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : ""
                                  }
                                >
                                  {seg.text}
                                </span>
                              )) || (
                                textDiffMode === "summary"
                                  ? (items[textDiffIndex[1]]?.summary || "暂无摘要")
                                  : ((items[textDiffIndex[1]]?.paragraphs || []).join("\n") || "暂无正文")
                              )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-3 w-3 rounded bg-rose-100 line-through" />
                          内容 A 删除
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-3 w-3 rounded bg-emerald-100" />
                          内容 B 新增
                        </span>
                      </div>
                    </div>
                  )}
                </section>

                {/* 区块3：影响评估 */}
                <section id="core-impact" className="scroll-mt-20 border-t border-slate-200">
                  <div className="p-4 sm:p-6">
                    <div className="mb-6">
                      <h3 className="text-base font-semibold text-slate-900">
                        <ChartColumn className="h-4 w-4 mr-2 inline" aria-hidden />
                        影响评估
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        从 7 个维度对比各内容对我们业务的影响程度
                      </p>
                    </div>

                    <div className="mb-8 overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="w-28 p-3 text-left text-xs font-medium text-slate-500 sm:w-36 sm:p-4 sm:text-sm">
                              影响维度
                            </th>
                            {items.map((_, idx) => (
                              <th
                                key={idx}
                                className="min-w-36 p-3 text-left text-xs font-medium text-slate-700 sm:p-4 sm:text-sm"
                              >
                                <span className="text-xs text-slate-400">内容 {idx + 1}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {COMPARE_IMPACT_DIMENSIONS.map((dim) => (
                            <tr
                              key={dim}
                              className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                            >
                              <td className="w-28 p-3 text-xs font-medium text-slate-500 sm:w-36 sm:p-4 sm:text-sm">
                                {getImpactDimensionLabel(dim)}
                              </td>
                              {deepCompare.impactComparison.map((imp, idx) => {
                                const dimData = imp.dimensions[dim];
                                return (
                                  <td key={idx} className="p-3 text-xs sm:p-4 sm:text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getImpactBadge(
                                          dimData?.level || "none"
                                        )}`}
                                      >
                                        {getImpactLabel(dimData?.level || "none")}
                                      </span>
                                      <span className="text-slate-500">{dimData?.description}</span>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                            <td className="p-3 text-xs font-semibold text-slate-700 sm:p-4 sm:text-sm">
                              综合影响
                            </td>
                            {deepCompare.impactComparison.map((imp, idx) => (
                              <td key={idx} className="p-3 text-xs sm:p-4 sm:text-sm">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getImpactBadge(
                                      imp.overallLevel
                                    )}`}
                                  >
                                    {imp.overallLevel === "high" ? "高影响" : imp.overallLevel === "medium" ? "中影响" : "低影响"}
                                  </span>
                                  <span className="text-slate-500">得分 {imp.overallScore}</span>
                                </div>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                      {deepCompare.impactComparison.map((imp, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-200 p-5"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <div>
                              <div className="text-xs text-slate-400">内容 {idx + 1}</div>
                              <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">
                                {imp.title}
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getImpactBadge(
                                imp.overallLevel
                              )}`}
                            >
                              {imp.overallLevel === "high" ? "高影响" : imp.overallLevel === "medium" ? "中影响" : "低影响"}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {COMPARE_IMPACT_DIMENSIONS.map((dim) => {
                              const dimData = imp.dimensions[dim];
                              if (!dimData || dimData.level === "none") return null;
                              return (
                                <div key={dim} className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-700">
                                      {getImpactDimensionLabel(dim)}
                                    </span>
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                                        dimData.level === "high"
                                          ? "bg-rose-100 text-rose-700"
                                          : dimData.level === "medium"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-emerald-100 text-emerald-700"
                                      }`}
                                    >
                                      {getImpactLabel(dimData.level)}
                                    </span>
                                  </div>
                                  {dimData.evidence.length > 0 && (
                                    <ul className="mt-1 space-y-1 pl-4 text-slate-500">
                                      {dimData.evidence.slice(0, 2).map((e, ei) => (
                                        <li key={ei} className="list-disc">
                                          {e}...
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* 区块4：分类与关键词差异 */}
                <section id="core-categories" className="scroll-mt-20 border-t border-slate-200">
                  <div className="p-4 sm:p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          <Tag className="mr-2 inline h-4 w-4" aria-hidden />
                          分类与关键词对比
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          从分类体系和关键词角度，分析内容的关注点差异
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      {/* 分类对比 */}
                      <div className="rounded-xl border border-slate-200 p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-900">分类对比</h4>
                          <div className="flex gap-2 text-xs">
                            <span className="flex items-center gap-1 text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              共同 {deepCompare.summaryStats.commonCategories}
                            </span>
                            <span className="flex items-center gap-1 text-amber-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              独有 {items.length}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {items.map((item, idx) => (
                            <div key={item.sourceId} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                              <div className="mb-2 text-xs font-medium text-slate-500">
                                内容 {idx + 1}：{item.title.slice(0, 30)}...
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {(item.categories || []).slice(0, 6).map((cat, ci) => {
                                  const isCommon = items.some(
                                    (o, oi) => oi !== idx && o.categories?.some((c) => c.category === cat.category)
                                  );
                                  return (
                                    <span
                                      key={ci}
                                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                                        isCommon
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-amber-50 text-amber-700"
                                      }`}
                                    >
                                      {cat.category}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
                          <Lightbulb className="h-4 w-4" aria-hidden />
                          <span>
                            绿色标签为内容间共有的分类，琥珀色为各内容独有分类
                          </span>
                        </div>
                      </div>

                      {/* 关键词对比 */}
                      <div className="rounded-xl border border-slate-200 p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-900">关键词对比</h4>
                          <div className="flex gap-2 text-xs">
                            <span className="flex items-center gap-1 text-violet-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                              共同关键词 {deepCompare.summaryStats.commonKeywords}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {items.map((item, idx) => (
                            <div key={item.sourceId} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                              <div className="mb-2 text-xs font-medium text-slate-500">
                                内容 {idx + 1}：{item.title.slice(0, 30)}...
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {(item.matchedKeywords || []).slice(0, 12).map((kw, ki) => {
                                  const isCommon = items.every(
                                    (o) =>
                                      o.sourceId === item.sourceId ||
                                      o.matchedKeywords?.some((k) => k.keyword.toLowerCase() === kw.keyword.toLowerCase())
                                  );
                                  return (
                                    <span
                                      key={ki}
                                      className={`rounded px-1.5 py-0.5 text-xs ${
                                        isCommon
                                          ? "bg-violet-50 text-violet-700 font-medium"
                                          : "bg-slate-100 text-slate-600"
                                      }`}
                                    >
                                      {kw.keyword}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
                          <Lightbulb className="h-4 w-4" aria-hidden />
                          <span>
                            紫色加粗为所有内容共有的核心关键词
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
          {/* ===== 演变趋势视图 ===== */}
          {activeView === "evolution" && deepCompare && (
            <div className="flex gap-0">
              {/* 左侧锚点导航 */}
              <aside className="hidden w-48 shrink-0 border-r border-slate-200 p-4 lg:block">
                <div className="sticky top-24">
                  <div className="mb-3 text-xs font-semibold text-slate-400">页面导航</div>
                  <nav className="space-y-1 text-sm">
                    {[
                      { id: "evo-timeline", label: "时间线", icon: Calendar },
                      { id: "evo-path", label: "演进路径", icon: Route },
                      { id: "evo-metrics", label: "趋势指标", icon: TrendingUp },
                    ].map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                      >
                        <item.icon className="h-4 w-4" aria-hidden />
                        <span>{item.label}</span>
                      </a>
                    ))}
                  </nav>
                  <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50/30 p-3">
                    <div className="text-xs font-medium text-violet-700">趋势摘要</div>
                    <div className="mt-2 text-xs leading-relaxed text-violet-600">
                      {deepCompare.evolutionTrend.overallTrend}
                    </div>
                  </div>
                </div>
              </aside>

              {/* 右侧主内容区 */}
              <div className="flex-1 min-w-0 p-4 sm:p-6">
                {/* 区块1：时间线 */}
                <section id="evo-timeline" className="scroll-mt-20">
                  <div className="mb-6">
                    <h3 className="text-base font-semibold text-slate-900">
                      <Calendar className="h-4 w-4 mr-2 inline" aria-hidden />
                      时间线
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {deepCompare.timeline.timeSpan.totalDays > 0
                        ? `时间跨度：${deepCompare.timeline.timeSpan.earliest} 至 ${deepCompare.timeline.timeSpan.latest}，共 ${deepCompare.timeline.timeSpan.totalDays} 天`
                        : "对比各内容的关键时间节点"}
                    </p>
                  </div>

                  {/* 政策时间范围条 */}
                  <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <h4 className="mb-3 text-sm font-medium text-slate-700">关键日期分布</h4>
                    <div className="space-y-3">
                      {deepCompare.timeline.policyTimeframes.map((tf, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-20 shrink-0 text-xs text-slate-500">
                            内容 {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="relative h-6 rounded-full bg-slate-200">
                              {tf.startDate && tf.endDate && deepCompare.timeline.timeSpan.totalDays > 0 && (() => {
                                const start = new Date(tf.startDate).getTime();
                                const end = new Date(tf.endDate).getTime();
                                const earliest = new Date(deepCompare.timeline.timeSpan.earliest).getTime();
                                const latest = new Date(deepCompare.timeline.timeSpan.latest).getTime();
                                const totalSpan = latest - earliest;
                                if (totalSpan <= 0) return null;
                                const left = Math.max(0, ((start - earliest) / totalSpan) * 100);
                                const width = Math.min(100 - left, ((end - start) / totalSpan) * 100);
                                const colors = [
                                  "bg-violet-500",
                                  "bg-sky-500",
                                  "bg-emerald-500",
                                  "bg-amber-500",
                                  "bg-rose-500",
                                ];
                                return (
                                  <div
                                    className={`absolute top-0 h-full rounded-full ${colors[idx % colors.length]}`}
                                    style={{ left: `${left}%`, width: `${width}%` }}
                                  />
                                );
                              })()}
                            </div>
                            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                              <span>{tf.startDate || "—"}</span>
                              <span>{tf.endDate || "长期有效"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 时间线事件列表 */}
                  <div className="mb-8">
                    <h4 className="mb-4 text-sm font-medium text-slate-700">关键时间节点</h4>
                    <div className="relative">
                      <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-slate-200" />
                      <div className="space-y-3">
                        {deepCompare.timeline.events.map((event, idx) => {
                          const config = TIMELINE_TYPE_CONFIG[event.type] || TIMELINE_TYPE_CONFIG.publication;
                          const policyColors = [
                            "border-violet-300 bg-violet-50",
                            "border-sky-300 bg-sky-50",
                            "border-emerald-300 bg-emerald-50",
                            "border-amber-300 bg-amber-50",
                            "border-rose-300 bg-rose-50",
                          ];
                          return (
                            <div key={idx} className="relative pl-10">
                              <div
                                className={`absolute left-0 top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                                  policyColors[event.policyIndex % policyColors.length]
                                }`}
                              >
                                <config.icon className="h-3.5 w-3.5" aria-hidden />
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}>
                                    {config.label}
                                  </span>
                                  <span className="text-xs font-medium text-slate-700">{event.date}</span>
                                  <span className="text-xs text-slate-400">· 内容 {event.policyIndex + 1}</span>
                                </div>
                                <div className="mt-1.5 text-sm text-slate-700">{event.event}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 区块2：演进路径 */}
                <section id="evo-path" className="scroll-mt-20 border-t border-slate-200 pt-8">
                  <h4 className="mb-4 text-sm font-medium text-slate-700">
                    <Route className="mr-2 inline h-4 w-4" aria-hidden />
                    内容发布时序
                  </h4>
                  <div className="relative">
                    <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-[var(--brand)]/30" />
                    <div className="space-y-4">
                      {deepCompare.evolutionTrend.stages.map((stage, idx) => {
                        const relationLabels: Record<string, { label: string; color: string }> = {
                          initial: { label: "初始版本", color: "bg-violet-100 text-violet-700" },
                          revision: { label: "修订完善", color: "bg-sky-100 text-sky-700" },
                          upgrade: { label: "升级加强", color: "bg-emerald-100 text-emerald-700" },
                          expansion: { label: "范围扩大", color: "bg-amber-100 text-amber-700" },
                          new: { label: "新增内容", color: "bg-rose-100 text-rose-700" },
                        };
                        const relation = relationLabels[stage.relationToPrev] || relationLabels.revision;
                        
                        return (
                          <div key={idx} className="relative pl-12">
                            <div className="absolute left-0 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-slate-200 shadow-sm">
                              <span className="text-xs font-semibold text-slate-600">V{idx + 1}</span>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-900">{stage.versionLabel}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${relation.color}`}>
                                      {relation.label}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">{stage.publishedAt}</div>
                                  <div className="mt-2 text-sm text-slate-700 line-clamp-2">
                                    {stage.policyTitle}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-3 border-t border-slate-100 pt-3">
                                <div className="mb-2 text-xs font-medium text-slate-600">主要变化</div>
                                <ul className="space-y-1">
                                  {stage.keyChanges.map((change, changeIdx) => (
                                    <li key={changeIdx} className="flex items-start gap-2 text-xs text-slate-600">
                                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                                      <span>{change}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="mt-3 border-t border-slate-100 pt-3">
                                <div className="mb-2 text-xs font-medium text-slate-600">关键指标</div>
                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    { key: "funding", label: "资金" },
                                    { key: "pilot", label: "试点" },
                                    { key: "risk", label: "监管" },
                                  ].map(({ key, label }) => {
                                    const val = stage.highlightMetrics[key] || 0;
                                    const percent = Math.min(100, val * 10);
                                    return (
                                      <div key={key}>
                                        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                                          <span>{label}</span>
                                          <span>{val.toFixed(1)}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-slate-200">
                                          <div
                                            className="h-full rounded-full bg-[var(--brand)]"
                                            style={{ width: `${percent}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* 区块3：趋势指标 */}
                <section id="evo-metrics" className="scroll-mt-20 border-t border-slate-200 pt-8">
                  {/* 总体趋势摘要卡片 */}
                  <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {deepCompare.evolutionTrend.trendMetrics.map((metric, idx) => {
                      const dataPoints = metric.dataPoints;
                      const firstVal = dataPoints[0]?.metrics[metric.name] || 0;
                      const lastVal = dataPoints[dataPoints.length - 1]?.metrics[metric.name] || 0;
                      const change = lastVal - firstVal;
                      const changePercent = firstVal > 0 ? Math.round((change / firstVal) * 100) : 0;
                      
                      return (
                        <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                          <div className="text-xs text-slate-500">{metric.label}</div>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl font-semibold text-slate-900">{lastVal.toFixed(1)}</span>
                            <span className="text-xs">/ 10</span>
                          </div>
                          <div className="mt-2 flex items-center gap-1 text-xs">
                            {change > 0 ? (
                              <>
                                <span className="text-emerald-600">↑ {changePercent}%</span>
                                <span className="text-slate-400">相比首版</span>
                              </>
                            ) : change < 0 ? (
                              <>
                                <span className="text-rose-600">↓ {Math.abs(changePercent)}%</span>
                                <span className="text-slate-400">相比首版</span>
                              </>
                            ) : (
                              <span className="text-slate-400">基本持平</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 关键指标趋势对比 */}
                  <div>
                    <h4 className="mb-4 text-sm font-medium text-slate-700">
                      <TrendingUp className="h-4 w-4 mr-2 inline" aria-hidden />
                      关键指标趋势对比
                    </h4>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                      <div className="space-y-4">
                        {deepCompare.evolutionTrend.trendMetrics.map((metric, metricIdx) => (
                          <div key={metricIdx}>
                            <div className="mb-2 flex justify-between text-xs">
                              <span className="font-medium text-slate-600">{metric.label}</span>
                            </div>
                            <div className="space-y-2">
                              {metric.dataPoints.map((point, pointIdx) => {
                                const val = point.metrics[metric.name] || 0;
                                const percent = Math.min(100, val * 10);
                                const colors = [
                                  "bg-violet-400",
                                  "bg-sky-400",
                                  "bg-emerald-400",
                                  "bg-amber-400",
                                  "bg-rose-400",
                                ];
                                return (
                                  <div key={pointIdx} className="flex items-center gap-3">
                                    <div className="w-16 shrink-0 text-[10px] text-slate-500">
                                      {deepCompare.evolutionTrend.stages[pointIdx]?.versionLabel || `V${pointIdx + 1}`}
                                    </div>
                                    <div className="flex-1">
                                      <div className="h-6 rounded-md bg-white border border-slate-200 overflow-hidden">
                                        <div
                                          className={`h-full ${colors[pointIdx % colors.length]} transition-all duration-500`}
                                          style={{ width: `${percent}%` }}
                                        />
                                      </div>
                                    </div>
                                    <div className="w-10 text-right text-xs font-medium text-slate-600">
                                      {val.toFixed(1)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

        </div>
      </div>

      <FloatingBackButton />
    </main>
  );
}
