"use client";

import { useState } from "react";
import type { ForecastItem } from "@/lib/monitor/types";
import { categoryDisplayLabel, categoryTooltip } from "@/lib/monitor/content-meta";
import { formatDateShortSlash, formatDateTimeFull } from "@/lib/date-utils";
import {
  Bot, Lightbulb, Paperclip, Rocket, Ruler, Search, ShoppingCart, Sparkles, Target,
} from "lucide-react";

type ForecastItemData = ForecastItem;

interface AIAnalysisResult {
  forecastHigh: string;
  forecastMidHigh: string;
  forecastMid: string;
  forecastLow: string;
  reasoning: string;
  confidence: number;
  keySignals: string[];
}

export function ForecastItemCard({ item }: { item: ForecastItemData }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [values, setValues] = useState({
    high: item.forecastHigh || "",
    midHigh: item.forecastMidHigh || "",
    mid: item.forecastMid || "",
    low: item.forecastLow || "",
    notes: item.forecastNotes || "",
  });
  const [localUpdatedAt, setLocalUpdatedAt] = useState<string | null>(item.forecastUpdatedAt);

  const hasForecast = Boolean(
    item.forecastHigh || item.forecastMidHigh || item.forecastMid || item.forecastLow,
  );

  async function handleSave() {
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
        setLocalUpdatedAt(new Date().toISOString());
      }
    } catch {
      // 忽略
    } finally {
      setIsSaving(false);
    }
  }

  const [aiHint, setAiHint] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<{
    source: "doubao" | "llm" | "rule";
    confidence: number;
    keySignals: string[];
  } | null>(null);

  async function handleAnalyzeWithAI() {
    setIsAnalyzing(true);
    setAiHint(null);
    setAiMeta(null);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "analyze-item",
          title: item.title,
          content: item.summary || item.title,
          summary: item.summary,
          matchedSignals: item.topCategories.map((c) => c.category),
        }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        setAiResult(data.result);
        const source: "doubao" | "llm" | "rule" = data.result.source || "rule";
        const confidence =
          typeof data.result.confidence === "number" ? data.result.confidence : null;
        const keySignals: string[] = Array.isArray(data.result.keySignals)
          ? data.result.keySignals
          : [];
        setAiMeta({ source, confidence: confidence ?? 0, keySignals: keySignals.slice(0, 4) });

        if (source === "rule") {
          setAiHint(
            "提示：当前返回的是关键词规则结果。在 .env.local 中配置 LLM_API_KEY / DOUBAO_API_KEY 后可接入大模型，自动生成更高质量的判断。",
          );
          setTimeout(() => setAiHint(null), 12000);
        } else {
          setAiHint(
            source === "doubao"
              ? "已通过豆包生成分析结果。可直接点击「编辑预估」进行调整后保存。"
              : "已通过大模型（LLM_*）生成分析结果。可直接点击「编辑预估」进行调整后保存。",
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
      // 取消编辑：重置为原始值
      setValues({
        high: item.forecastHigh || "",
        midHigh: item.forecastMidHigh || "",
        mid: item.forecastMid || "",
        low: item.forecastLow || "",
        notes: item.forecastNotes || "",
      });
    }
    setIsEditing(!isEditing);
  }

  return (
    <article
      className={`rounded-3xl border transition ${
        isExpanded ? "border-slate-300 bg-slate-50 shadow-sm" : "border-slate-200 bg-white hover:shadow-sm"
      }`}
    >
      {/* 点击展开区域 */}
      <div className="cursor-pointer p-5" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-start gap-2 text-base font-medium text-slate-900">
              <span className="min-w-0 flex-1 break-words">{item.title}</span>
              <span className={`shrink-0 text-slate-400 transition ${isExpanded ? "rotate-180" : ""}`}>▾</span>
            </h3>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                {item.departmentName}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{item.channelName}</span>
              <span>· 发现于 {formatDateShortSlash(item.firstSeenAt)}</span>
              {item.keywordScore > 0 ? (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                  关键词得分 {item.keywordScore}
                </span>
              ) : null}
              {item.documentStatus ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                  {item.documentStatus}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {item.hasFunding ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                  <Lightbulb className="mr-1 inline h-3.5 w-3.5" aria-hidden />资金支持
                </span>
              ) : null}
              {item.hasProcurement ? (
                <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800">
                  <ShoppingCart className="mr-1 inline h-3.5 w-3.5" aria-hidden />采购机会
                </span>
              ) : null}
              {item.hasPilot ? (
                <span className="rounded-full border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800">
                  <Rocket className="mr-1 inline h-3.5 w-3.5" aria-hidden />试点示范
                </span>
              ) : null}
              {item.hasStandards ? (
                <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800">
                  <Ruler className="mr-1 inline h-3.5 w-3.5" aria-hidden />标准规范
                </span>
              ) : null}
              {item.topCategories.map((cat, idx) => (
                <span
                  key={`${cat.category}-${idx}`}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  title={categoryTooltip(cat.category)}
                >
                  {categoryDisplayLabel(cat.category)}
                </span>
              ))}
            </div>

            {hasForecast ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="text-xs font-medium text-emerald-700">✓ 已有预估判断</div>
                {values.high ? (
                  <div className="mt-1 text-xs leading-5 text-slate-700">
                    【高确定性】{values.high}
                  </div>
                ) : null}
                {values.midHigh && !values.high ? (
                  <div className="mt-1 text-xs leading-5 text-slate-700">
                    【中高确定性】{values.midHigh}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
                <Search className="mr-1 inline h-3.5 w-3.5" aria-hidden />该条目已检测到结构化信号，但尚未添加预估判断（展开可添加）
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              onClick={(e) => e.stopPropagation()}
            >
              打开原网址 →
            </a>
            {hasForecast ? (
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                ✓ 已有预估
              </span>
            ) : (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                待添加预估
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 展开后的详情 */}
      {isExpanded ? (
        <div className="border-t border-slate-200 bg-white/70 p-5">
          {/* 结构化信号提取 */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-900"><Target className="mr-1 inline h-3.5 w-3.5" aria-hidden />结构化信号提取（自动检测）</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="text-xs text-slate-500">文档状态</div>
                <div className="mt-1 text-sm font-medium text-slate-800">{item.documentStatus || "—"}</div>
              </div>
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

          {/* 参考网页（支撑预估判断的具体信息源） */}
          {item.forecastSources && item.forecastSources.length > 0 ? (
            <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-900">
                <Paperclip className="mr-1 inline h-3.5 w-3.5" aria-hidden />参考网页（支撑预估判断的 {item.forecastSources.length} 个具体信息源）
              </h4>
              <div className="mt-3 space-y-2">
                {item.forecastSources.map((src, idx) => (
                  <a
                    key={`src-${idx}`}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm transition hover:border-sky-300 hover:bg-sky-50/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900">{src.title}</div>
                        {src.note ? (
                          <div className="mt-1 text-xs leading-5 text-slate-600">{src.note}</div>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-sky-700">↗</span>
                    </div>
                    <div className="mt-2 truncate text-xs text-slate-400">{src.url}</div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {/* 预估判断 */}
          <section className="rounded-2xl border border-emerald-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-slate-900"><Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden />预估判断（可编辑）</h4>
                {aiMeta ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        aiMeta.source === "rule"
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : aiMeta.source === "doubao"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {aiMeta.source === "rule"
                        ? "关键词规则"
                        : aiMeta.source === "doubao"
                        ? "豆包"
                        : "LLM"}
                    </span>
                    {aiMeta.confidence > 0 ? (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                        置信度 {aiMeta.confidence}
                      </span>
                    ) : null}
                    {aiMeta.keySignals && aiMeta.keySignals.length > 0 ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                        信号：{aiMeta.keySignals.join(" / ")}
                      </span>
                    ) : null}
                  </div>
                ) : null}
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

            {localUpdatedAt ? (
              <div className="mb-3 text-xs text-slate-500">最近更新：{formatDateTimeFull(localUpdatedAt)}</div>
            ) : null}

            {/* 编辑/展示区：仅在编辑状态或已保存过内容时显示，避免与 AI 结果卡片重复 */}
            {isEditing || hasForecast ? (
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-emerald-700">高确定性</div>
                  {isEditing ? (
                    <textarea
                      value={values.high}
                      onChange={(e) => setValues((v) => ({ ...v, high: e.target.value }))}
                      rows={3}
                      placeholder="高确定性的判断依据（例如：公告明确写出的内容、数字、范围、截止日期等）"
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
                      placeholder="中高确定性的判断依据（例如：方向明确，但具体数字/时间还不确定）"
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
                      placeholder="中确定性的判断依据（例如：有趋势信号，但具体方案尚不明朗）"
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
                      placeholder="低确定性的判断依据（例如：走向存在争议，或尚未有具体信号）"
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
                      placeholder="支撑上述预估判断的依据（例如：历史上类似机会的处理方式、平台公告规律、相关社区讨论信号等）"
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

            {/* AI 分析结果 */}
            {aiResult ? (
              <section className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5" aria-hidden />
                  <h4 className="text-sm font-semibold text-amber-900">AI 智能分析结果</h4>
                  <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                    置信度 {aiResult.confidence}%
                  </span>
                </div>

                {aiResult.keySignals && aiResult.keySignals.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {aiResult.keySignals.map((signal, idx) => (
                      <span
                        key={idx}
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                        title={categoryTooltip(signal)}
                      >
                        {categoryDisplayLabel(signal)}
                      </span>
                    ))}
                  </div>
                ) : null}

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
      ) : null}
    </article>
  );
}
