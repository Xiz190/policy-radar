"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { categoryDisplayLabel, categoryTooltip } from "@/lib/monitor/content-meta";
import { formatDateShortSlash } from "@/lib/date-utils";
import type { ContentItem } from "@/hooks/use-item-list";
import {
  Bot, RadioTower, Sparkles, Target,
} from "lucide-react";

interface AIAnalysisResult {
  forecastHigh: string;
  forecastMidHigh: string;
  forecastMid: string;
  forecastLow: string;
  reasoning: string;
  confidence: number;
  keySignals: string[];
}

type SignalDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  item: ContentItem | null;
  detail?: Record<string, unknown>;
};

const getDefaultValues = (detail?: Record<string, unknown>) => {
    if (!detail) {
      return { high: "", midHigh: "", mid: "", low: "", notes: "" };
    }
    return {
      high: (detail as { forecastHigh?: string }).forecastHigh || "",
      midHigh: (detail as { forecastMidHigh?: string }).forecastMidHigh || "",
      mid: (detail as { forecastMid?: string }).forecastMid || "",
      low: (detail as { forecastLow?: string }).forecastLow || "",
      notes: (detail as { forecastNotes?: string }).forecastNotes || "",
    };
  };

export function SignalDrawer({ isOpen, onClose, item, detail }: SignalDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [values, setValues] = useState(() => getDefaultValues(detail));
  const [aiHint, setAiHint] = useState<string | null>(null);

  useEffect(() => {
    if (detail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(getDefaultValues(detail));
    }
  }, [detail]);

  const hasForecast = Boolean(
    values.high || values.midHigh || values.mid || values.low,
  );

  async function handleSave() {
    if (!item) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/monitor/items/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: item.sourceId,
          url: item.url,
          forecastHigh: values.high.trim() || null,
          forecastMidHigh: values.midHigh.trim() || null,
          forecastMid: values.mid.trim() || null,
          forecastLow: values.low.trim() || null,
          forecastNotes: values.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setIsEditing(false);
      }
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAnalyzeWithAI() {
    if (!item) return;
    setIsAnalyzing(true);
    setAiHint(null);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "analyze-item",
          title: item.title,
          content: (detail as { summary?: string })?.summary || item.title,
          summary: (detail as { summary?: string })?.summary,
          matchedSignals: item.categories.map((c) => c.category),
        }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        setAiResult(data.result);
        const source = data.result.source || "rule";
        if (source === "rule") {
          setAiHint(
            "提示：当前返回的是关键词规则结果。配置 API KEY 后可接入大模型。",
          );
          setTimeout(() => setAiHint(null), 12000);
        } else {
          setAiHint(
            source === "doubao"
              ? "已通过豆包生成分析结果。可点击应用到预估判断。"
              : "已通过大模型生成分析结果。",
          );
          setTimeout(() => setAiHint(null), 10000);
        }
      } else {
        setAiHint(`⚠ AI 分析失败：${data.message || "未知错误"}`);
        setTimeout(() => setAiHint(null), 6000);
      }
    } catch {
      setAiHint("⚠ AI 分析失败：网络错误");
      setTimeout(() => setAiHint(null), 6000);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleToggleEdit() {
    if (isEditing) {
      setValues({
        high: (detail as { forecastHigh?: string }).forecastHigh || "",
        midHigh: (detail as { forecastMidHigh?: string }).forecastMidHigh || "",
        mid: (detail as { forecastMid?: string }).forecastMid || "",
        low: (detail as { forecastLow?: string }).forecastLow || "",
        notes: (detail as { forecastNotes?: string }).forecastNotes || "",
      });
    }
    setIsEditing(!isEditing);
  }

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 right-0 top-0 flex w-full max-w-lg flex-col overflow-hidden bg-white shadow-xl sm:bottom-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><RadioTower className="h-4 w-4" aria-hidden />信号分析</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {item.title.slice(0, 40)}{item.title.length > 40 ? "..." : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
              {item.departmentName}
            </span>
            <span>{item.channelName}</span>
            <span>· {formatDateShortSlash(item.listPublishedAt)}</span>
            {item.keywordScore > 0 ? (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                关键词得分 {item.keywordScore}
              </span>
            ) : null}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Target className="h-4 w-4" aria-hidden />结构化信号提取</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div
                className={`rounded-2xl border p-3 text-center ${
                  item.hasFunding ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="text-xs text-slate-500">资金支持</div>
                <div className={`mt-1 text-sm font-medium ${item.hasFunding ? "text-amber-700" : "text-slate-500"}`}>
                  {item.hasFunding ? "✓ 已检测" : "—"}
                </div>
              </div>
              <div
                className={`rounded-2xl border p-3 text-center ${
                  item.hasProcurement ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="text-xs text-slate-500">采购机会</div>
                <div className={`mt-1 text-sm font-medium ${item.hasProcurement ? "text-rose-700" : "text-slate-500"}`}>
                  {item.hasProcurement ? "✓ 已检测" : "—"}
                </div>
              </div>
              <div
                className={`rounded-2xl border p-3 text-center ${
                  item.hasPilot ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="text-xs text-slate-500">试点示范</div>
                <div className={`mt-1 text-sm font-medium ${item.hasPilot ? "text-indigo-700" : "text-slate-500"}`}>
                  {item.hasPilot ? "✓ 已检测" : "—"}
                </div>
              </div>
              <div
                className={`rounded-2xl border p-3 text-center ${
                  item.hasStandards ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="text-xs text-slate-500">标准规范</div>
                <div className={`mt-1 text-sm font-medium ${item.hasStandards ? "text-violet-700" : "text-slate-500"}`}>
                  {item.hasStandards ? "✓ 已检测" : "—"}
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            {item.categories.map((cat, idx) => (
              <span
                key={`${cat.category}-${idx}`}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                title={categoryTooltip(cat.category)}
              >
                {categoryDisplayLabel(cat.category)}
              </span>
            ))}
          </div>

          {detail?.summary ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">内容摘要</h3>
              <p className="mt-2 text-xs leading-6 text-slate-700">{String(detail.summary)}</p>
            </section>
          ) : null}

          <section className="rounded-2xl border border-emerald-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Sparkles className="h-4 w-4" aria-hidden />预估判断（可编辑）</h3>
                {aiHint ? <div className="mt-1 text-xs text-amber-700">{aiHint}</div> : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={handleAnalyzeWithAI}
                  disabled={isAnalyzing || isEditing}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    isAnalyzing
                      ? "border border-amber-300 bg-amber-100 text-amber-700 cursor-wait"
                      : "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  {isAnalyzing ? "AI分析中…" : "AI分析"}
                </button>
                <button
                  type="button"
                  onClick={handleToggleEdit}
                  disabled={isSaving}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    isEditing
                      ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {isEditing ? "取消编辑" : "编辑预估"}
                </button>
                {isEditing ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isSaving ? "保存中…" : "保存"}
                  </button>
                ) : null}
              </div>
            </div>

            {isEditing || hasForecast ? (
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-emerald-700">高确定性</div>
                  {isEditing ? (
                    <textarea
                      value={values.high}
                      onChange={(e) => setValues((v) => ({ ...v, high: e.target.value }))}
                      rows={3}
                      placeholder="高确定性的判断依据（公告明确写出的内容、数字、范围、截止日期等）"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  ) : values.high ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm leading-6 text-slate-700">
                      {values.high}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-emerald-600">中高确定性</div>
                  {isEditing ? (
                    <textarea
                      value={values.midHigh}
                      onChange={(e) => setValues((v) => ({ ...v, midHigh: e.target.value }))}
                      rows={3}
                      placeholder="中高确定性的判断依据（方向明确，但具体数字/时间还不确定）"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  ) : values.midHigh ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {values.midHigh}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">中确定性</div>
                  {isEditing ? (
                    <textarea
                      value={values.mid}
                      onChange={(e) => setValues((v) => ({ ...v, mid: e.target.value }))}
                      rows={2}
                      placeholder="中确定性的判断依据（有趋势信号，但具体方案尚不明朗）"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                    />
                  ) : values.mid ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {values.mid}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">低确定性</div>
                  {isEditing ? (
                    <textarea
                      value={values.low}
                      onChange={(e) => setValues((v) => ({ ...v, low: e.target.value }))}
                      rows={2}
                      placeholder="低确定性的判断依据（走向存在争议，或尚未有具体信号）"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                    />
                  ) : values.low ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {values.low}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">判断依据/备注</div>
                  {isEditing ? (
                    <textarea
                      value={values.notes}
                      onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
                      rows={4}
                      placeholder="支撑上述预估判断的依据"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                    />
                  ) : values.notes ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                      {values.notes}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {aiResult ? (
              <section className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5" aria-hidden />
                  <h4 className="text-sm font-semibold text-amber-900">AI 智能分析结果</h4>
                  <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                    置信度 {aiResult.confidence}%
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {aiResult.forecastHigh ? (
                    <div>
                      <div className="text-xs font-medium text-emerald-700">高确定性</div>
                      <div className="rounded-xl border border-emerald-100 bg-white p-2 text-sm leading-5 text-slate-700">
                        {aiResult.forecastHigh}
                      </div>
                    </div>
                  ) : null}
                  {aiResult.forecastMidHigh ? (
                    <div>
                      <div className="text-xs font-medium text-emerald-600">中高确定性</div>
                      <div className="rounded-xl border border-slate-100 bg-white p-2 text-sm leading-5 text-slate-700">
                        {aiResult.forecastMidHigh}
                      </div>
                    </div>
                  ) : null}
                  {aiResult.forecastMid ? (
                    <div>
                      <div className="text-xs font-medium text-slate-600">中确定性</div>
                      <div className="rounded-xl border border-slate-100 bg-white p-2 text-sm leading-5 text-slate-700">
                        {aiResult.forecastMid}
                      </div>
                    </div>
                  ) : null}
                  {aiResult.forecastLow ? (
                    <div>
                      <div className="text-xs font-medium text-slate-500">低确定性</div>
                      <div className="rounded-xl border border-slate-100 bg-white p-2 text-sm leading-5 text-slate-700">
                        {aiResult.forecastLow}
                      </div>
                    </div>
                  ) : null}
                </div>
                {aiResult.reasoning ? (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-slate-600">推理依据</div>
                    <div className="rounded-xl border border-slate-100 bg-white p-2 text-xs leading-5 text-slate-600">
                      {aiResult.reasoning}
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setValues({
                      high: aiResult.forecastHigh || "",
                      midHigh: aiResult.forecastMidHigh || "",
                      mid: aiResult.forecastMid || "",
                      low: aiResult.forecastLow || "",
                      notes: aiResult.reasoning || "",
                    });
                    setAiResult(null);
                  }}
                  className="mt-3 w-full rounded-full bg-amber-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500"
                >
                  将 AI 分析结果应用到预估判断
                </button>
              </section>
            ) : null}
          </section>
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          <div className="flex gap-2">
            <Link
              href={`/items/${encodeURIComponent(item.sourceId)}?sourceId=${encodeURIComponent(item.sourceId)}&url=${encodeURIComponent(item.url)}`}
              className="flex-1 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={onClose}
            >
              查看详情页 →
            </Link>
            <a
              href={item.finalUrl || item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
            >
              打开原网址 →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
