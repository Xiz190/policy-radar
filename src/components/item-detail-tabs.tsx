"use client";

import { useState } from "react";
import ChatPanel from "@/components/chat-panel";
import ParagraphNavigator from "@/components/paragraph-navigator";
import { CategoryBadge, HighlightedParagraph } from "@/components/highlighted-content";
import { CategoryChip } from "@/components/category-chip";
import { ImportanceBadge } from "@/components/importance-badge";
import { ItemForecastPanel } from "@/components/item-forecast-panel";
import { ExpandableList, ExpandableText } from "@/components/expandable-text";
import { RecaptureButton } from "@/components/recapture-button";
import { RecomputePriorityButton } from "@/components/recompute-priority-button";
import { BackButton } from "@/components/back-button";
import { QuickActionBar } from "@/components/quick-action-bar";
import { StructuredSummary } from "@/components/structured-summary";
import { KeywordBreakdown } from "@/components/keyword-breakdown";
import type { KeywordDetailItem } from "@/components/keyword-breakdown";
import { RelatedItems } from "@/components/related-items";
import type { RelatedItemsData } from "@/components/related-items";
import { ItemHistory } from "@/components/item-history";
import type { PolicyEvolutionData } from "@/components/item-history";
import { normalizePriorityLevel, getPriorityMeta, getImportanceBadgeMeta } from "@/lib/monitor/priority-levels";
import { categoryDisplayLabel, categoryTooltip, pickSmartSummary, buildKeywordBreakdown, getCategoryStyle } from "@/lib/monitor/content-meta";
import { getSourceCapability } from "@/lib/monitor/source-capability";
import {
  type FollowUpStatus,
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_STATUS_OPTIONS,
  setNote as setNoteStorage,
  setFollowUpStatus as setFollowUpStatusStorage,
  getPersonalResearch,
  addTagToItem,
  removeTagFromItem,
  getAllTags,
  getTagColor,
  type ResearchTag,
} from "@/lib/personal-research";
import { computeAllRoleAnalyses } from "@/lib/monitor/role-analysis";
import type { StructuredSummaryData } from "@/components/structured-summary";

type CategoryType = {
  category: string;
  score: number;
  topKeywords?: string[];
};

type MatchedKeywordType = {
  keyword: string;
  category: string;
  weight?: number;
};

type SignalMetaType = {
  thresholds?: { core: number; highlight: number; mid: number };
  thresholdDiscount?: number;
  totalSignalStrength?: number;
  totalStructureScore?: number;
  distinctStrongTopicKeywords?: number;
  bodyParagraphCount?: number;
  strongTopicCategories?: string[];
  hasTitleStructure?: boolean;
  riskHit?: boolean;
  hasStrongTopic?: boolean;
  totalScore?: number;
  level?: string;
};

type ForecastSourceType = {
  url: string;
  title: string;
  note?: string;
};

type RelatedItem = {
  sourceId: string;
  url: string;
  title: string;
  departmentName: string;
  listPublishedAt: string;
};

type ItemDetailTabsProps = {
  structuredSummary: StructuredSummaryData;
  policyEvolution: PolicyEvolutionData;
  relatedPoliciesData: RelatedItemsData;
  item: {
    sourceId: string;
    url: string;
    finalUrl?: string | null;
    title: string;
    pageTitle?: string | null;
    displayName: string;
    departmentName: string;
    channelName: string;
    listPublishedAt: string | null;
    firstSeenAt: string | null;
    capturedAt?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    deadlineDate?: string | null;
    extractedDates?: { type: string; date: string; raw?: string }[];
    contentQuality: string | null;
    importanceLevel: string;
    keywordScore: number;
    isStarred: boolean;
    isRead: boolean;
    categories: CategoryType[];
    matchedKeywords: MatchedKeywordType[];
    paragraphs: string[];
    attachments: Array<{ kind: string; url?: string; name?: string; text?: string; title?: string }>;
    externalLinks?: Array<{ url: string; title?: string; text?: string }> | null;
    signalMeta?: SignalMetaType | null;
    signalHitsRaw?: Record<string, unknown> | null;
    forecastSources?: ForecastSourceType[] | null;
    documentStatus?: string | null;
    hasFunding?: boolean;
    hasProcurement?: boolean;
    hasPilot?: boolean;
    hasStandards?: boolean;
    forecastHigh?: string | null;
    forecastMidHigh?: string | null;
    forecastMid?: string | null;
    forecastLow?: string | null;
    forecastNotes?: string | null;
    forecastUpdatedAt?: string | null;
    captureNote?: string | null;
  };
  docs: Array<{ kind: string; url?: string; name?: string; text?: string; title?: string }>;
  images: Array<{ kind: string; url?: string; name?: string; text?: string; title?: string }>;
  externalLinks: Array<{ url: string; title?: string; text?: string }>;
  contentQualityBadge: { label: string; color: string };
  related: RelatedItem[];
  isMock?: boolean;
};

function pickTopN(texts: string[], n: number): string[] {
  const out: string[] = [];
  for (const t of texts) {
    const clean = t.replace(/\s+/g, " ").trim();
    if (clean.length >= 12 && !out.includes(clean)) out.push(clean);
    if (out.length >= n) break;
  }
  return out;
}

function extractSentences(paragraphs: string[]): string[] {
  const joined = paragraphs.join(" ");
  const raw = joined.split(/(?<=[。！？.!?])\s*/).map((s) => s.trim());
  return raw.filter((s) => s.length >= 8 && s.length <= 140);
}

function summaryFrom(paragraphs: string[], title: string): string {
  if (paragraphs.length === 0) return title;
  const sentences = extractSentences(paragraphs);
  if (sentences.length === 0) {
    const first = paragraphs[0].replace(/\s+/g, " ").trim();
    return first.length > 120 ? first.slice(0, 120) + "…" : first;
  }
  return sentences.slice(0, 3).join(" ");
}

function PersonalResearchCard({
  sourceId,
  url,
  title,
}: {
  sourceId: string;
  url: string;
  title: string;
}) {
  const [note, setNote] = useState(() => {
    const research = getPersonalResearch(sourceId, url);
    return research?.note ?? "";
  });
  const [followUpStatus, setFollowUpStatus] = useState<FollowUpStatus>(() => {
    const research = getPersonalResearch(sourceId, url);
    return research?.followUpStatus ?? "none";
  });
  const [tags, setTags] = useState<string[]>(() => {
    const research = getPersonalResearch(sourceId, url);
    return research?.tags ?? [];
  });
  const [allTags, setAllTags] = useState<ResearchTag[]>(getAllTags);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [newTagName, setNewTagName] = useState("");

  function handleStatusSelect(status: FollowUpStatus) {
    setFollowUpStatusStorage(sourceId, url, title, status);
    setFollowUpStatus(status);
    setShowStatusMenu(false);
  }

  function handleStartEdit() {
    setNoteDraft(note);
    setIsEditingNote(true);
  }

  function handleSaveNote() {
    setNoteStorage(sourceId, url, title, noteDraft);
    setNote(noteDraft);
    setIsEditingNote(false);
  }

  function handleAddTag(tagName: string) {
    const result = addTagToItem(sourceId, url, title, tagName);
    if (result) {
      setTags(result.tags);
      setAllTags(getAllTags());
    }
    setShowTagPicker(false);
    setNewTagName("");
  }

  function handleRemoveTag(tagName: string) {
    const result = removeTagFromItem(sourceId, url, tagName);
    if (result) {
      setTags(result.tags);
    }
  }

  const hasAny = note || followUpStatus !== "none" || tags.length > 0;
  const availableTags = allTags.filter((t) => !tags.includes(t.name));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-base font-semibold text-slate-900">我的研究</h2>
          <p className="mt-1 text-sm text-slate-600">
            记录你的备注、跟进状态和标签，让政策不只是{"\"看过\""}。
          </p>
        </div>
        {hasAny && !isEditingNote && (
          <span className="rounded-full bg-[var(--brand-tint)] px-3 py-1 text-xs text-[var(--brand)]">
            已记录
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {/* 跟进状态 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowStatusMenu(!showStatusMenu);
              setShowTagPicker(false);
            }}
            className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
              followUpStatus !== "none"
                ? "bg-white text-teal-700 ring-1 ring-teal-200"
                : "bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-white"
            }`}
          >
            <span>
              {followUpStatus !== "none" ? FOLLOW_UP_STATUS_LABELS[followUpStatus] : "设置跟进状态"}
            </span>
            <span className="text-[10px]">▾</span>
          </button>

          {showStatusMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowStatusMenu(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {FOLLOW_UP_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleStatusSelect(opt.value)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      followUpStatus === opt.value ? "bg-[var(--brand-tint)] text-[var(--brand)]" : "text-slate-700"
                    }`}
                  >
                    <opt.icon className="mt-0.5 h-4 w-4" aria-hidden />
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 标签按钮 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowTagPicker(!showTagPicker);
              setShowStatusMenu(false);
            }}
            className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
              tags.length > 0
                ? "bg-white text-violet-700 ring-1 ring-violet-200"
                : "bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-white"
            }`}
          >
            <span>{tags.length > 0 ? `${tags.length} 个标签` : "添加标签"}</span>
            <span className="text-[10px]">▾</span>
          </button>

          {showTagPicker && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowTagPicker(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                <div className="px-3 pb-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTagName.trim()) {
                        handleAddTag(newTagName);
                      }
                    }}
                    placeholder="输入标签名，回车创建"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-violet-400 focus:outline-none"
                  />
                </div>
                {availableTags.length > 0 && (
                  <div className="border-t border-slate-100 pt-2">
                    <div className="px-3 pb-1 text-[11px] text-slate-400">推荐标签</div>
                    <div className="max-h-40 overflow-y-auto px-2">
                      {availableTags.map((tag) => (
                        <button
                          key={tag.name}
                          type="button"
                          onClick={() => handleAddTag(tag.name)}
                          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-slate-50"
                        >
                          <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${tag.color} border`}>
                            +
                          </span>
                          <span className="text-slate-700">{tag.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 备注按钮 */}
        {!isEditingNote && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-white"
          >
            <span>{note ? "编辑备注" : "添加备注"}</span>
          </button>
        )}
      </div>

      {/* 标签展示 */}
      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const color = getTagColor(tag);
            return (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${color} border`}
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-0.5 text-xs opacity-60 hover:opacity-100"
                  title="移除标签"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* 备注内容展示 */}
      {note && !isEditingNote && (
        <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
          <div className="mb-1 text-xs text-slate-500">个人备注</div>
          <p className="whitespace-pre-wrap">{note}</p>
        </div>
      )}

      {/* 备注编辑器 */}
      {isEditingNote && (
        <div className="mt-4 space-y-2">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="记录你的想法、重点、行动事项..."
            className="h-28 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditingNote(false)}
              className="inline-flex h-8 items-center rounded-lg px-3 text-sm text-slate-600 hover:bg-white"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveNote}
              className="inline-flex h-8 items-center rounded-lg bg-teal-600 px-3 text-sm text-white hover:bg-teal-700"
            >
              保存
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-slate-500">
        数据仅保存在当前浏览器，清除缓存会丢失。后续支持云端同步。
      </div>
    </section>
  );
}

export function ItemDetailTabs({
  structuredSummary,
  policyEvolution,
  relatedPoliciesData,
  item,
  docs,
  images,
  externalLinks,
  contentQualityBadge,
  related,
  isMock,
}: ItemDetailTabsProps) {
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [showMoreAnalysis, setShowMoreAnalysis] = useState(false);
  const [showCategoryLegend, setShowCategoryLegend] = useState(false);
  const [showSignalWhy, setShowSignalWhy] = useState(false);

  function handleCompareToggle() {
    try {
      const key = "compare_items";
      const raw = window.localStorage.getItem(key);
      let items: Array<{ sourceId: string; url: string; title: string }> = [];
      if (raw) {
        try {
          items = JSON.parse(raw);
        } catch {
          items = [];
        }
      }
      const exists = items.some((i) => i.sourceId === item.sourceId && i.url === item.url);
      if (exists) {
        items = items.filter((i) => !(i.sourceId === item.sourceId && i.url === item.url));
      } else {
        items.push({ sourceId: item.sourceId, url: item.url, title: item.title });
      }
      window.localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // localStorage 不可用时忽略
    }
  }

  function isInCompare(): boolean {
    try {
      const raw = window.localStorage.getItem("compare_items");
      if (!raw) return false;
      const items = JSON.parse(raw) as Array<{ sourceId: string; url: string }>;
      return items.some((i) => i.sourceId === item.sourceId && i.url === item.url);
    } catch {
      return false;
    }
  }

  const summarySentences = pickSmartSummary(item.paragraphs, item.matchedKeywords);
  const matchesByKeyword = item.matchedKeywords.map((m) => ({ keyword: m.keyword, category: m.category }));
  const hasHighlights = matchesByKeyword.length > 0;

  const roleAnalyses = computeAllRoleAnalyses({
    keywordScore: item.keywordScore,
    importanceLevel: item.importanceLevel,
    categories: item.categories || [],
    matchedKeywords: (item.matchedKeywords || []).map((k) => ({
      keyword: k.keyword,
      category: k.category,
      weight: k.weight ?? 0,
    })),
    title: item.title,
  });
  const keywordBreakdown = buildKeywordBreakdown(
    item.categories || [],
    (item.matchedKeywords || []).map((k) => ({
      keyword: k.keyword,
      category: k.category,
      weight: k.weight ?? 0,
    })),
    item.paragraphs || [],
  );

  return (
    <>
      {/* 徽章区：内容质量 + 重要性 + 关键词得分 */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`inline-flex items-center rounded-full border px-3 py-1 ${contentQualityBadge.color}`}>
          {contentQualityBadge.label}
        </span>
        <ImportanceBadge
          level={item.importanceLevel}
          keywordScore={item.keywordScore}
          className="px-3 py-1"
        />
        {item.keywordScore > 0 ? (
          <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-700">
            关键词得分 {item.keywordScore}
          </span>
        ) : null}
        {item.isStarred ? (
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
            ★ 重点
          </span>
        ) : null}
        {!item.isRead ? (
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
            未读
          </span>
        ) : null}
        {item.attachments.length > 0 ? (
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
            附件 {item.attachments.length}（文档 {docs.length} / 图片 {images.length}）
          </span>
        ) : null}
      </div>

      {/* 旧数据 / 标签陈旧 检测 banner */}
      {(() => {
        const isOldUrgent = item.importanceLevel === "加急推荐";
        const hasNewMeta = Boolean(item.signalMeta?.thresholds);
        const newLevel = hasNewMeta ? item.signalMeta?.level : undefined;
        const levelStale =
          hasNewMeta &&
          newLevel &&
          normalizePriorityLevel(item.importanceLevel) !== newLevel;
        const needsRecompute = isOldUrgent || !hasNewMeta || levelStale;
        if (!needsRecompute) return null;
        const reason = isOldUrgent
          ? "重要性标签来自旧版体系（「加急推荐」已被合并到新的「核心关注」，且新体系要求关键词得分 ≥ 60）"
          : !hasNewMeta
            ? "本条目尚未用新的关键词/结构词/风险信号体系扫描"
            : `当前显示的「${normalizePriorityLevel(item.importanceLevel)}」与新逻辑计算结果「${newLevel}」不一致`;
        return (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex-1 text-sm text-rose-800">
              <div className="font-semibold">⚠ 标签可能陈旧</div>
              <div className="mt-0.5 text-xs text-rose-700">{reason}，建议立即重算。</div>
            </div>
            <RecomputePriorityButton
              sourceId={item.sourceId}
              url={item.url}
              variant="banner"
            />
          </div>
        );
      })()}

      {/* 标题 */}
      <h1 className="mt-4 text-2xl font-semibold tracking-tight lg:text-3xl">
        <ExpandableText text={item.title} maxLength={120} />
      </h1>
      {item.pageTitle && item.pageTitle !== item.title ? (
        <div className="mt-1 text-sm text-slate-500">
          页面标题：<ExpandableText text={item.pageTitle} maxLength={120} />
        </div>
      ) : null}

      {/* 元信息 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>部委：{item.departmentName}</span>
        <span className="text-slate-300">·</span>
        <span>栏目：{item.channelName}</span>
        <span className="text-slate-300">·</span>
        <span>列表日期：{item.listPublishedAt}</span>
        {item.effectiveFrom ? (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-700">生效：{item.effectiveFrom}</span>
          </>
        ) : null}
        {item.effectiveTo ? (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-amber-700">至：{item.effectiveTo}</span>
          </>
        ) : null}
        {item.deadlineDate ? (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-rose-700">截止：{item.deadlineDate}</span>
          </>
        ) : null}
        {item.extractedDates && item.extractedDates.length > 0 ? (
          <details className="ml-2 inline-block text-xs text-slate-500">
            <summary className="cursor-pointer select-none">· 文中所有日期 ({item.extractedDates.length})</summary>
            <div className="mt-2 space-y-1">
              {item.extractedDates.slice(0, 20).map((d, idx) => {
                const labelMap: Record<string, string> = {
                  published: "发布",
                  effective_from: "生效",
                  effective_to: "有效期至",
                  deadline: "截止",
                };
                return (
                  <div key={idx} className="whitespace-pre-wrap break-words">
                    {labelMap[d.type] || d.type}：{d.date}
                    {d.raw ? `（${d.raw}）` : ""}
                  </div>
                );
              })}
              {item.extractedDates.length > 20 ? (
                <div className="text-slate-400">（共 {item.extractedDates.length} 条，仅显示前 20 条）</div>
              ) : null}
            </div>
          </details>
        ) : null}
        <span className="text-slate-300">·</span>
        <span>首次发现：{item.firstSeenAt ? new Date(item.firstSeenAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "-"}</span>
        {item.capturedAt ? (
          <>
            <span className="text-slate-300">·</span>
            <span>正文抓取于：{new Date(item.capturedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</span>
          </>
        ) : null}
      </div>

      {/* 快速操作栏 */}
      <div className="mt-5">
        <QuickActionBar
          sourceId={item.sourceId}
          url={item.url}
          title={item.title}
          pageTitle={item.pageTitle}
          departmentName={item.departmentName}
          channelName={item.channelName}
          listPublishedAt={item.listPublishedAt}
          paragraphs={item.paragraphs}
          initialStarred={item.isStarred}
          initialRead={item.isRead}
          onCompareClick={handleCompareToggle}
          isInCompare={isInCompare()}
        />
      </div>

      {/* 原网址和返回按钮 */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <BackButton />
        <a
          href={item.finalUrl || item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          打开原网址 ↗
        </a>
        <RecaptureButton sourceId={item.sourceId} url={item.url} isMock={isMock} />
      </div>

      <div className="mt-6 space-y-6">
        {item.paragraphs.length > 0 ? (
          <section id="full-content" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">政策正文</h2>
                <span className="text-xs text-slate-500">共 {item.paragraphs.length} 段</span>
              </div>
              <button
                type="button"
                onClick={() => setIsBodyExpanded(!isBodyExpanded)}
                aria-expanded={isBodyExpanded}
                aria-controls="policy-body-content"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                {isBodyExpanded ? "收起正文" : "展开正文"}
                <span className="text-[10px]">{isBodyExpanded ? "↑" : "↓"}</span>
              </button>
            </div>

            {!isBodyExpanded ? (
              <div className="mt-3">
                {item.captureNote ? (
                  <div
                    className={`mb-3 rounded-2xl border p-3 text-sm leading-6 ${
                      item.contentQuality === "empty"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : item.contentQuality === "partial"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    <div className="text-xs opacity-80">抓取备注</div>
                    <div className="mt-1">{item.captureNote}</div>
                  </div>
                ) : null}
                <p className="text-sm leading-7 text-slate-700">
                  {hasHighlights ? (
                    <HighlightedParagraph
                      text={
                        item.paragraphs[0].length > 160
                          ? item.paragraphs[0].slice(0, 160) + "…"
                          : item.paragraphs[0]
                      }
                      matches={matchesByKeyword}
                    />
                  ) : (
                    item.paragraphs[0].length > 160
                      ? item.paragraphs[0].slice(0, 160) + "…"
                      : item.paragraphs[0]
                  )}
                </p>
                {item.paragraphs.length > 1 && (
                  <div className="mt-2 text-xs text-slate-400">
                    还有 {item.paragraphs.length - 1} 段未展开
                  </div>
                )}
              </div>
            ) : (
              <div id="policy-body-content">
                {item.captureNote ? (
                  <div
                    className={`mt-3 rounded-2xl border p-3 text-sm leading-6 ${
                      item.contentQuality === "empty"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : item.contentQuality === "partial"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    <div className="text-xs opacity-80">抓取备注</div>
                    <div className="mt-1">{item.captureNote}</div>
                  </div>
                ) : null}
                {hasHighlights ? (
                  <div className="mt-2 text-xs text-slate-500">
                    已按标签高亮（监管风险 / 资金支持 / 人工智能 / 数据要素 等）。
                  </div>
                ) : null}
                <div className="mt-3 space-y-4 text-sm leading-7 text-slate-800">
                  {item.paragraphs.map((p, idx) => (
                    <p key={idx}>
                      {hasHighlights ? <HighlightedParagraph text={p} matches={matchesByKeyword} /> : p}
                    </p>
                  ))}
                </div>
                {item.attachments.length > 0 || externalLinks.length > 0 ? (
                  <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
                    {docs.length > 0 ? (
                      <ExpandableList
                        items={docs.map((d) => ({ text: d.name || d.text || d.url || "", url: d.url || "" }))}
                        itemType={`文档附件`}
                        maxLength={120}
                      />
                    ) : null}
                    {images.length > 0 ? (
                      <ExpandableList
                        items={images.map((d) => ({ text: d.name || d.text || d.url || "", url: d.url || "" }))}
                        itemType={`图片附件`}
                        maxLength={120}
                      />
                    ) : null}
                    {externalLinks.length > 0 ? (
                      <ExpandableList
                        items={externalLinks.map((l) => ({ text: l.title || l.text || l.url, url: l.url }))}
                        itemType="相关外链"
                        maxLength={120}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : (
          (() => {
            // 正文段落为空：常见于动态渲染 / SPA 来源（如数据交易所等平台站点），
            // 列表接口只返回标题与链接，没有可入库的正文。此前这里直接渲染 null，
            // 页面会出现"只有标题、点进来一片空白"的死胡同。改为诚实降级面板。
            const cap = getSourceCapability(item.departmentName);
            const unreliable = !cap || cap.status !== "live";
            const originUrl = item.finalUrl || item.url;
            return (
              <section
                id="full-content"
                className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-amber-900">正文未入库</h2>
                  <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                    仅采集到标题
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-amber-900/90">
                  该来源目前只采集到<strong>标题与原文链接</strong>，正文尚未入库
                  {unreliable
                    ? "——该站点为动态渲染 / 反爬来源，列表接口只返回标题，正文需前往原文查看。"
                    : "，可前往原文查看完整内容。"}
                </p>
                {unreliable && (
                  <p className="mt-2 text-xs leading-6 text-amber-800/80">
                    ⚠️ 提示：此类动态站点的原文链接可能已失效或需多次跳转，打开后若为 404 属来源侧变动，非本站数据错误。
                  </p>
                )}
                {originUrl ? (
                  <a
                    href={originUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex h-9 items-center rounded-full border border-amber-400 bg-white px-4 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                  >
                    前往原文查看 ↗
                  </a>
                ) : null}
              </section>
            );
          })()
        )}

        {(() => {
          const keySignals = [
            { key: "hasFunding", label: "资金支持", active: item.hasFunding ?? false, color: "emerald", explanation: "政策包含专项资金、补贴或税收优惠" },
            { key: "hasPilot", label: "试点示范", active: item.hasPilot ?? false, color: "sky", explanation: "涉及试点项目、示范区或先行先试" },
            { key: "hasProcurement", label: "政府采购", active: item.hasProcurement ?? false, color: "violet", explanation: "涉及政府招标采购或项目申报" },
            { key: "hasStandards", label: "标准规范", active: item.hasStandards ?? false, color: "amber", explanation: "涉及技术标准制定或合规要求" },
          ];
          const activeSignals = keySignals.filter((s) => s.active);
          const riskHit = item.signalMeta?.riskHit ?? false;

          const colorMap: Record<string, { bg: string; border: string; text: string; muted: string }> = {
            emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", muted: "text-emerald-600" },
            sky: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", muted: "text-sky-600" },
            violet: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", muted: "text-violet-600" },
            amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", muted: "text-amber-600" },
            rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", muted: "text-rose-600" },
          };

          if (activeSignals.length === 0 && !riskHit) return null;

          const signalToCategory: Record<string, string[]> = {
            hasFunding: ["资金与支持"],
            hasPilot: ["试点示范"],
            hasProcurement: ["采购招标"],
            hasStandards: ["标准规范"],
            riskHit: ["监管风险"],
          };

          const getSignalKeywords = (signalKey: string): KeywordDetailItem[] => {
            const categories = signalToCategory[signalKey] || [];
            const allKeywords: KeywordDetailItem[] = [];
            for (const cat of keywordBreakdown.categoryBreakdown) {
              if (categories.some((c) => 
                typeof cat.category === "string" && typeof c === "string" &&
                (cat.category.includes(c) || c.includes(cat.category))
              )) {
                allKeywords.push(...cat.keywords);
              }
            }
            return allKeywords.slice(0, 5);
          };

          return (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">关键信号</h2>
                  <p className="mt-1 text-xs text-slate-500">一眼识别这条政策对你的价值点和风险点</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSignalWhy(!showSignalWhy)}
                  className={`text-xs transition ${showSignalWhy ? "text-sky-600" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {showSignalWhy ? "收起解释" : "为什么有这些信号？"}
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {keySignals.map((signal) => {
                  const signalKws = getSignalKeywords(signal.key);
                  return (
                    <div
                      key={signal.key}
                      className={`rounded-xl border p-3 text-center transition ${
                        signal.active
                          ? "border-[var(--brand-border)] bg-[var(--brand-tint)]/50"
                          : "border-slate-200 bg-white text-slate-400"
                      }`}
                    >
                      <div className={`text-sm font-semibold ${signal.active ? "text-slate-900" : "text-slate-400"}`}>
                        {signal.label}
                      </div>
                      <div className={`mt-1 text-[11px] leading-snug ${signal.active ? "text-slate-600" : "text-slate-400"}`}>
                        {signal.active ? signal.explanation : "未涉及"}
                      </div>
                      {signal.active && signalKws.length > 0 && (
                        <div className="mt-2 flex flex-wrap justify-center gap-1">
                          {signalKws.slice(0, 3).map((kw, idx) => (
                            <span
                              key={idx}
                              className="rounded-full border border-[var(--brand-border)] bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-600"
                              title={kw.keyword}
                            >
                              {kw.keyword}
                            </span>
                          ))}
                          {signalKws.length > 3 && (
                            <span className="rounded-full border border-[var(--brand-border)] bg-white px-1.5 py-0.5 text-[9px] text-slate-500">
                              +{signalKws.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {riskHit && (
                  <div className={`rounded-xl border p-3 text-center ${colorMap.rose.bg} ${colorMap.rose.border}`}>
                    <div className={`text-sm font-semibold ${colorMap.rose.text}`}>监管风险</div>
                    <div className={`mt-1 text-[11px] leading-snug ${colorMap.rose.muted}`}>涉及合规要求或风险条款</div>
                  </div>
                )}
              </div>

              {showSignalWhy && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="space-y-3">
                    {activeSignals.map((signal) => {
                      const signalKws = getSignalKeywords(signal.key);
                      if (signalKws.length === 0) return null;
                      return (
                        <div key={signal.key} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-900">
                              为什么识别为{"\""}
                              {signal.label}
                              {"\""}？
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {signalKws.map((kw, idx) => (
                              <span
                                key={idx}
                                className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                              >
                                {"\""}
                                {kw.keyword}
                                {"\""} <span className="text-slate-400">(权重 {kw.weight})</span>
                              </span>
                            ))}
                          </div>
                          {signalKws[0]?.context?.length > 0 && (
                            <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                              {signalKws[0].context[0]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {activeSignals.every((s) => getSignalKeywords(s.key).length === 0) && (
                      <div className="text-xs text-slate-500 text-center py-2">
                        当前关键词数据未完全加载，无法展示信号识别依据。
                        <span className="ml-1 text-sky-600 cursor-pointer" onClick={() => setShowSignalWhy(false)}>
                      了解更多 →
                    </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {summarySentences.length > 0 ? (
          <section>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              智能摘要
              <span className="text-xs font-normal text-slate-500">（基于关键词和信号词提取）</span>
            </h2>
            <ul className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800">
              {summarySentences.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-slate-400">·</span>
                  <span>
                    {hasHighlights ? <HighlightedParagraph text={s} matches={matchesByKeyword} /> : s}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <StructuredSummary data={structuredSummary} />

        <PersonalResearchCard
          sourceId={item.sourceId}
          url={item.url}
          title={item.title}
        />

        {item.categories.length > 0 ? (
          <section>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">涉及领域</h2>
                <p className="mt-1 text-xs text-slate-500">这条政策覆盖的政策领域和信号标签</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryLegend(!showCategoryLegend)}
                className="text-xs text-slate-500 hover:text-slate-700 transition"
              >
                {showCategoryLegend ? "收起图例" : "查看图例"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.categories.map((cat, index) => (
                <CategoryBadge key={cat.category ?? `category-${index}`} category={cat.category} score={cat.score} topKeywords={cat.topKeywords} />
              ))}
            </div>
            {showCategoryLegend && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {item.categories.map((cat, index) => {
                    const style = getCategoryStyle(cat.category);
                    return (
                      <div key={cat.category ?? `legend-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${style.chip.split("text-")[1]?.split(" ")[0] || "text-slate-700"}`}>
                            {style.displayLabel}
                          </span>
                        </div>
                        {style.description && (
                          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{style.description}</p>
                        )}
                        {style.value && (
                          <p className="mt-1.5 rounded-lg bg-white/60 p-2 text-[11px] text-slate-500">
                            {style.value}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        ) : null}

        <KeywordBreakdown data={keywordBreakdown} />

        <RelatedItems data={relatedPoliciesData} />

        <section>
          <button
            type="button"
            onClick={() => setShowMoreAnalysis(!showMoreAnalysis)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm transition hover:border-sky-300 hover:bg-sky-50/30"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">更多分析</span>
              <span className="text-xs text-slate-500">评分说明 · 角色视角 · 政策演进 · 全量关键词</span>
            </div>
            <span className="text-slate-400">{showMoreAnalysis ? "收起" : "展开"}</span>
          </button>

          {showMoreAnalysis && (
            <div className="mt-4 space-y-6">
              {item.keywordScore > 0 || item.signalMeta ? (
                <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <details open>
                    <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">
                      评分说明
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        （为什么这条内容被评为「{getPriorityMeta(item.importanceLevel).label}」）
                      </span>
                    </summary>
                    <div className="mt-3 space-y-2 text-xs text-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                          关键词得分 {item.keywordScore}
                        </span>
                        {item.signalMeta?.totalSignalStrength !== undefined &&
                        item.signalMeta.totalSignalStrength > 0 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                            信号强度 {item.signalMeta.totalSignalStrength}
                          </span>
                        ) : null}
                        {item.signalMeta?.totalStructureScore !== undefined &&
                        item.signalMeta.totalStructureScore > 0 ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                            结构词得分 {item.signalMeta.totalStructureScore}
                          </span>
                        ) : null}
                        {item.signalMeta?.distinctStrongTopicKeywords ? (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
                            强主题关键词 {item.signalMeta.distinctStrongTopicKeywords}
                          </span>
                        ) : null}
                        {item.signalMeta?.bodyParagraphCount !== undefined ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                            正文段落 {item.signalMeta.bodyParagraphCount}
                          </span>
                        ) : null}
                      </div>

                      {item.signalMeta?.strongTopicCategories &&
                      item.signalMeta.strongTopicCategories.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-slate-500">强主题：</span>
                          {item.signalMeta.strongTopicCategories.map((cat) => (
                            <span
                              key={cat}
                              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-700"
                              title={categoryTooltip(cat)}
                            >
                              {categoryDisplayLabel(cat)}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {item.signalMeta?.hasTitleStructure ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                            命中标题结构词（门槛 -20）
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
                            未命中标题结构词
                          </span>
                        )}
                        {item.signalMeta?.riskHit ? (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">
                            命中风险信号（门槛 -10）
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
                            未命中风险信号
                          </span>
                        )}
                        {item.signalMeta?.hasStrongTopic ? (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700">
                            命中强主题（门槛 -5）
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
                            未命中强主题
                          </span>
                        )}
                      </div>

                      {item.signalMeta?.thresholds ? (
                        <div className="rounded-lg border border-slate-200 bg-white/70 p-2">
                          <div className="text-[11px] text-slate-500">
                            当前门槛（已考虑 thresholdDiscount = {item.signalMeta.thresholdDiscount ?? 0}）
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                              核心关注 ≥ {item.signalMeta.thresholds.core}
                            </span>
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-700">
                              重点内容 ≥ {item.signalMeta.thresholds.highlight}
                            </span>
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                              中等重点 ≥ {item.signalMeta.thresholds.mid}
                            </span>
                            <span className="text-slate-400">
                              本次判定信号值 = {item.signalMeta.totalScore ?? item.keywordScore} →
                              <span className="font-semibold text-slate-700"> {item.signalMeta.level ?? item.importanceLevel}</span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                          <span>
                            ⚠ 缺少新体系的门槛信息 —— 当前「{normalizePriorityLevel(item.importanceLevel)}」标签来自旧逻辑。
                          </span>
                          <RecomputePriorityButton sourceId={item.sourceId} url={item.url} variant="inline" />
                        </div>
                      )}

                      {item.signalHitsRaw && typeof item.signalHitsRaw === "object" ? (
                        <div className="mt-2 space-y-1">
                          {Object.entries(item.signalHitsRaw)
                            .filter(([key]) => key !== "_meta")
                            .map(([key, value]) => {
                              const v = value as {
                                keywords?: string[];
                                strength?: number;
                              };
                              const keywords = Array.isArray(v.keywords) ? v.keywords : [];
                              const strength = typeof v.strength === "number" ? v.strength : null;
                              if (keywords.length === 0 && strength === null) return null;
                              return (
                                <div
                                  key={key}
                                  className="flex flex-wrap items-center gap-2"
                                >
                                  <span className="text-slate-500">
                                    {categoryDisplayLabel(key)}
                                    {strength !== null ? `（强度 ${strength}）` : ""}：
                                  </span>
                                  {keywords.map((kw) => (
                                    <span
                                      key={kw}
                                      className="rounded-full bg-white px-2 py-0.5 text-slate-700 ring-1 ring-slate-200"
                                    >
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              );
                            })}
                        </div>
                      ) : null}

                      <div className="mt-2 text-[11px] leading-5 text-slate-500">
                        定级规则（当前 v3）：
                        基础门槛 核心关注 90 / 重点内容 50 / 中等重点 20；
                        命中标题结构模板 -20 / 命中强主题 -5 / 命中风险信号 -10，
                        每一层设置最低下限避免虚高（核心关注不低于 60，重点内容不低于 40）。
                        无正文（仅靠标题）不会进入「核心关注」。
                      </div>
                    </div>
                  </details>
                </section>
              ) : null}

              <ItemForecastPanel
                sourceId={item.sourceId}
                url={item.url}
                title={item.title}
                summary={item.paragraphs.slice(0, 3).join("\n")}
                documentStatus={item.documentStatus ?? null}
                hasFunding={item.hasFunding ?? false}
                hasProcurement={item.hasProcurement ?? false}
                hasPilot={item.hasPilot ?? false}
                hasStandards={item.hasStandards ?? false}
                forecastHigh={item.forecastHigh ?? null}
                forecastMidHigh={item.forecastMidHigh ?? null}
                forecastMid={item.forecastMid ?? null}
                forecastLow={item.forecastLow ?? null}
                forecastNotes={item.forecastNotes ?? null}
                forecastUpdatedAt={item.forecastUpdatedAt ?? null}
                categories={item.categories}
              />

              <ParagraphNavigator />

              <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">角色视角 · 交集分析</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">把「命中关键词」与不同角色的关注点做交集，并给出该角色视角下的优先级理由。</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {roleAnalyses.map((ra) => {
                    const badge = getImportanceBadgeMeta(ra.priorityLevel, ra.priorityScore);
                    return (
                      <div key={ra.roleId} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-slate-900">{ra.roleName}</div>
                          {badge && (
                            <span className={"rounded-full border px-2 py-0.5 text-xs " + badge.className}>
                              {ra.priorityLevel} · 加权分 {ra.priorityScore}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{ra.roleDescription}</div>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {ra.priorityReasons.map((r, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="shrink-0 text-indigo-500">·</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {ra.matchedCategories.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-slate-500">关注分类：</span>
                              {ra.matchedCategories.slice(0, 5).map((c) => (
                                <CategoryChip key={c.category} category={c.category} score={c.score} />
                              ))}
                            </div>
                          )}
                          {ra.boostKeywords.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-slate-500">机会信号：</span>
                              {ra.boostKeywords.slice(0, 6).map((k) => (
                                <span key={k} className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{k}</span>
                              ))}
                            </div>
                          )}
                          {ra.riskKeywords.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-slate-500">风险信号：</span>
                              {ra.riskKeywords.slice(0, 6).map((k) => (
                                <span key={k} className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{k}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <ItemHistory data={policyEvolution} />

              {item.matchedKeywords.length > 0 && (
                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-xl font-semibold">命中关键词（全量）</h2>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    {item.matchedKeywords.slice(0, 60).map((kw) => (
                      <span key={`${kw.keyword}-${kw.category}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                        {kw.keyword}
                        <span className="ml-1 text-slate-400">· {categoryDisplayLabel(kw.category)}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {item.forecastSources && item.forecastSources.length > 0 ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-base font-semibold text-slate-900">
                    参考网页（支撑预估判断的 {item.forecastSources.length} 个具体信息源）
                  </h2>
                  <div className="mt-4 space-y-2">
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

              {related && related.length > 0 ? (
                <section>
                  <h2 className="text-sm font-semibold text-slate-900">相关文章</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {related.map((r, idx) => (
                      <a
                        key={idx}
                        href={`/items/${r.sourceId}?sourceId=${r.sourceId}&url=${encodeURIComponent(r.url)}`}
                        className="rounded-2xl border border-slate-200 bg-white p-3 text-sm transition hover:border-sky-300 hover:bg-sky-50/30"
                      >
                        <div className="line-clamp-2 font-medium text-slate-900">{r.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {r.departmentName} · {r.listPublishedAt}
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              <ChatPanel sourceId={item.sourceId} url={item.url} title={item.title} />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
