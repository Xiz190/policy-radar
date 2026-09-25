"use client";

import { useState, useTransition } from "react";
import { formatDateTimeFull } from "@/lib/date-utils";
import {
  Bookmark, Bot, ClipboardList, Sparkles, Target,
} from "lucide-react";

type AIAnalysisResult = {
  forecastHigh: string;
  forecastMidHigh: string;
  forecastMid: string;
  forecastLow: string;
  reasoning: string;
  confidence: number;
  keySignals: string[];
};

type Props = {
  sourceId: string;
  url: string;
  title: string;
  summary?: string | null;
  // 结构化信号
  documentStatus: string | null;
  hasFunding: boolean;
  hasProcurement: boolean;
  hasPilot: boolean;
  hasStandards: boolean;
  // 预估判断（可编辑）
  forecastHigh: string | null;
  forecastMidHigh: string | null;
  forecastMid: string | null;
  forecastLow: string | null;
  forecastNotes: string | null;
  // 预估更新时间
  forecastUpdatedAt: string | null;
  // 主题分类（用于 AI 分析 + 提示）
  categories: Array<{ category: string; score: number; topKeywords?: string[] }>;
};

export function ItemForecastPanel({
  sourceId,
  url,
  title,
  summary,
  documentStatus,
  hasFunding,
  hasProcurement,
  hasPilot,
  hasStandards,
  forecastHigh,
  forecastMidHigh,
  forecastMid,
  forecastLow,
  forecastNotes,
  forecastUpdatedAt,
  categories,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [high, setHigh] = useState(forecastHigh ?? "");
  const [midHigh, setMidHigh] = useState(forecastMidHigh ?? "");
  const [mid, setMid] = useState(forecastMid ?? "");
  const [low, setLow] = useState(forecastLow ?? "");
  const [notes, setNotes] = useState(forecastNotes ?? "");
  const [, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 自动提取的信号，用于提示用户该政策可能的影响
  const detectedSignals: string[] = [];
  if (hasFunding) detectedSignals.push("检测到资金支持信号");
  if (hasProcurement) detectedSignals.push("检测到采购信号");
  if (hasPilot) detectedSignals.push("检测到试点/示范信号");
  if (hasStandards) detectedSignals.push("检测到标准/规范信号");

  const hasAnyForecast = Boolean(forecastHigh || forecastMidHigh || forecastMid || forecastLow);
  const displayDocStatus = documentStatus ?? "正式文件";

  async function handleAnalyzeWithAI() {
    setIsAnalyzing(true);
    setAiResult(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "analyze-item",
          title,
          content: summary || title,
          summary: summary || null,
          matchedSignals: categories.map((c) => c.category),
        }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        setAiResult(data.result);
        // 关键词降级模式（confidence < 60 且来自规则引擎）→ 给个友好提示
        if (typeof data.result.confidence === "number" && data.result.confidence <= 50) {
          setSaveMessage("⚠ 当前未配置豆包 API key，已使用关键词规则生成的建议内容，可编辑后保存。");
          setTimeout(() => setSaveMessage(null), 5000);
        }
      } else {
        setSaveMessage(`⚠ AI 分析失败：${data.message || "未知错误"}`);
        setTimeout(() => setSaveMessage(null), 5000);
      }
    } catch {
      setSaveMessage("⚠ AI 分析失败：网络错误");
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleApplyAI() {
    if (!aiResult) return;
    setHigh(aiResult.forecastHigh || "");
    setMidHigh(aiResult.forecastMidHigh || "");
    setMid(aiResult.forecastMid || "");
    setLow(aiResult.forecastLow || "");
    setNotes(aiResult.reasoning || "");
    setIsEditing(true);
    setAiResult(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/monitor/items/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          url,
          forecastHigh: high.trim() || null,
          forecastMidHigh: midHigh.trim() || null,
          forecastMid: mid.trim() || null,
          forecastLow: low.trim() || null,
          forecastNotes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveMessage("预估判断已保存");
        setIsEditing(false);
      } else {
        setSaveMessage(`保存失败：${data.message || "未知错误"}`);
      }
    } catch {
      setSaveMessage("保存失败：网络错误");
    } finally {
      setIsSaving(false);
      startTransition(() => {});
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {/* 结构化信号提取面板 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Target className="h-4 w-4 text-slate-400" aria-hidden />
结构化信号提取
          <span className="text-xs font-normal text-slate-500">（自动检测）</span>
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
            <div className="text-xs text-slate-500">文档状态</div>
            <div className="mt-1 text-sm font-medium text-slate-800">{displayDocStatus}</div>
          </div>
          <div
            className={`rounded-2xl border p-3 text-center ${
              hasFunding ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-xs text-slate-500">资金支持</div>
            <div className={`mt-1 text-sm font-medium ${hasFunding ? "text-emerald-700" : "text-slate-500"}`}>
              {hasFunding ? "✓ 已检测" : "—"}
            </div>
          </div>
          <div
            className={`rounded-2xl border p-3 text-center ${
              hasProcurement ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-xs text-slate-500">采购机会</div>
            <div className={`mt-1 text-sm font-medium ${hasProcurement ? "text-amber-700" : "text-slate-500"}`}>
              {hasProcurement ? "✓ 已检测" : "—"}
            </div>
          </div>
          <div
            className={`rounded-2xl border p-3 text-center ${
              hasPilot ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-xs text-slate-500">试点/示范</div>
            <div className={`mt-1 text-sm font-medium ${hasPilot ? "text-indigo-700" : "text-slate-500"}`}>
              {hasPilot ? "✓ 已检测" : "—"}
            </div>
          </div>
          <div
            className={`rounded-2xl border p-3 text-center ${
              hasStandards ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-xs text-slate-500">标准/规范</div>
            <div className={`mt-1 text-sm font-medium ${hasStandards ? "text-violet-700" : "text-slate-500"}`}>
              {hasStandards ? "✓ 已检测" : "—"}
            </div>
          </div>
        </div>

        {detectedSignals.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-sm text-slate-700">
            <div className="font-medium text-slate-800"><ClipboardList className="mr-1 inline h-3.5 w-3.5" aria-hidden />基于检测到的信号，建议重点关注：</div>
            <ul className="mt-2 space-y-1 text-slate-700">
              {detectedSignals.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
              {categories.length > 0 ? (
                <li className="text-slate-600">
                  <Bookmark className="mr-1 inline h-3.5 w-3.5" aria-hidden />命中标签：{categories.slice(0, 3).map((c) => c.category).join("、")}
                  {categories.length > 3 ? `等 ${categories.length} 项` : ""}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </section>

      {/* 预估判断面板 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-slate-400" aria-hidden />
预估判断
              <span className="text-xs font-normal text-slate-500">（按确定性分层记录）</span>
            </h2>
            {forecastUpdatedAt ? (
              <div className="mt-1 text-xs text-slate-500">上次更新：{formatDateTimeFull(forecastUpdatedAt)}</div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleAnalyzeWithAI}
                  disabled={isAnalyzing}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isAnalyzing
                      ? "cursor-wait border border-amber-300 bg-amber-100 text-amber-700"
                      : "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  {isAnalyzing ? "AI 分析中…" : "AI 分析"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  {hasAnyForecast ? "编辑预估" : "添加预估"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setHigh(forecastHigh ?? "");
                    setMidHigh(forecastMidHigh ?? "");
                    setMid(forecastMid ?? "");
                    setLow(forecastLow ?? "");
                    setNotes(forecastNotes ?? "");
                    setIsEditing(false);
                  }}
                  disabled={isSaving}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSaving ? "保存中…" : "保存预估"}
                </button>
              </>
            )}
          </div>
        </div>

        {saveMessage ? (
          <div className="mt-3 text-xs text-emerald-700">{saveMessage}</div>
        ) : null}

        {/* AI 分析结果展示（在编辑区上方） */}
        {aiResult ? (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" aria-hidden />
                <h3 className="text-sm font-semibold text-amber-900">AI 智能分析结果</h3>
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                  置信度 {aiResult.confidence}%
                </span>
              </div>
              <button
                type="button"
                onClick={handleApplyAI}
                className="shrink-0 rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-500"
              >
                应用到预估判断
              </button>
            </div>

            {aiResult.keySignals && aiResult.keySignals.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {aiResult.keySignals.map((signal, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                  >
                    {signal}
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
          </section>
        ) : null}

        {/* 编辑/展示区：仅在编辑状态或已保存过内容时显示 */}
        {isEditing || hasAnyForecast ? (
          <div className="mt-4 space-y-3">
            {/* 高确定性 */}
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-medium text-white">高确定性</span>
                <span className="text-xs text-slate-600">依据明确，已有执行信号或配套文件</span>
              </div>
              {isEditing ? (
                <textarea
                  value={high}
                  onChange={(e) => setHigh(e.target.value)}
                  placeholder="例：该公告后续大概率会在近1-2个月内启动报名，建议提前准备作品集和申请材料..."
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-rose-200 bg-white p-3 text-sm text-slate-800 focus:border-rose-400 focus:outline-none"
                />
              ) : high ? (
                <div className="mt-2 text-sm leading-6 text-slate-800">{high}</div>
              ) : null}
            </div>

            {/* 中高确定性 */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">中高确定性</span>
                <span className="text-xs text-slate-600">有较强信号支持，但缺少细则或正式文件</span>
              </div>
              {isEditing ? (
                <textarea
                  value={midHigh}
                  onChange={(e) => setMidHigh(e.target.value)}
                  placeholder="例：全国一体化算力网调度后续可能扩大至更多省份，但时间表仍需观察..."
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-3 text-sm text-slate-800 focus:border-amber-400 focus:outline-none"
                />
              ) : midHigh ? (
                <div className="mt-2 text-sm leading-6 text-slate-800">{midHigh}</div>
              ) : null}
            </div>

            {/* 中确定性 */}
            <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sky-500 px-2 py-0.5 text-xs font-medium text-white">中确定性</span>
                <span className="text-xs text-slate-600">逻辑上成立，但更多基于趋势判断</span>
              </div>
              {isEditing ? (
                <textarea
                  value={mid}
                  onChange={(e) => setMid(e.target.value)}
                  placeholder="例：高质量数据集建设后续可能催生更多行业联合体合作项目，但具体落地时间不确定..."
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-sky-200 bg-white p-3 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
                />
              ) : mid ? (
                <div className="mt-2 text-sm leading-6 text-slate-800">{mid}</div>
              ) : null}
            </div>

            {/* 低确定性 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-500 px-2 py-0.5 text-xs font-medium text-white">低确定性</span>
                <span className="text-xs text-slate-600">可以提示，但不能当结论写</span>
              </div>
              {isEditing ? (
                <textarea
                  value={low}
                  onChange={(e) => setLow(e.target.value)}
                  placeholder="例：Token相关机制短期内更可能停留在试点与探索阶段..."
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                />
              ) : low ? (
                <div className="mt-2 text-sm leading-6 text-slate-800">{low}</div>
              ) : null}
            </div>

            {/* 判断依据 */}
            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-violet-500 px-2 py-0.5 text-xs font-medium text-white">判断依据</span>
                <span className="text-xs text-slate-600">记录为什么这么判断</span>
              </div>
              {isEditing ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="记录支撑你上述判断的依据，例如：公告原文中的哪些表述、历史上类似机会的处理方式、已出现的配套信号等..."
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-violet-200 bg-white p-3 text-sm text-slate-800 focus:border-violet-400 focus:outline-none"
                />
              ) : notes ? (
                <div className="mt-2 text-sm leading-6 text-slate-800">{notes}</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
