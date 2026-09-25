"use client";

import { useState } from "react";
import {
  Link, Paperclip, Tag,
} from "lucide-react";

export type RelatedContentItem = {
  sourceId: string;
  url: string;
  title: string;
  departmentName: string;
  listPublishedAt: string;
  keywordScore: number;
  importanceLevel: string;
  relationType: "sameTopic" | "sameDept" | "cited";
  similarityScore?: number;
};

export type RelatedItemsData = {
  sameTopic: RelatedContentItem[];
  sameDept: RelatedContentItem[];
  cited: RelatedContentItem[];
};

type RelatedItemsProps = {
  data: RelatedItemsData;
};

const TAB_CONFIG = [
  { key: "sameTopic", label: "同领域", icon: Tag, description: "标签高度重合" },
  { key: "sameDept", label: "同来源", icon: Tag, description: "同一来源平台的内容" },
  { key: "cited", label: "被引用", icon: Link, description: "本文中引用的文件" },
] as const;

function getImportanceBadge(level: string) {
  if (level.includes("核心")) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (level.includes("重点") || level.includes("加急")) {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }
  if (level.includes("关注")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-50 text-slate-600 border-slate-200";
}

export function RelatedItems({ data }: RelatedItemsProps) {
  const [activeTab, setActiveTab] = useState<"sameTopic" | "sameDept" | "cited">("sameTopic");

  const items = data[activeTab];

  const totalCount =
    data.sameTopic.length + data.sameDept.length + data.cited.length;

  if (totalCount === 0) return null;

  function handleCompareAll() {
    try {
      const key = "compare_items";
      const raw = window.localStorage.getItem(key);
      let existingItems: Array<{ sourceId: string; url: string; title: string }> = [];
      if (raw) {
        try {
          existingItems = JSON.parse(raw);
        } catch {
          existingItems = [];
        }
      }
      const toAdd = items.slice(0, 5).filter(
        (it) => !existingItems.some((e) => e.sourceId === it.sourceId && e.url === it.url)
      );
      const merged = [...existingItems, ...toAdd.map((it) => ({ sourceId: it.sourceId, url: it.url, title: it.title }))].slice(0, 10);
      window.localStorage.setItem(key, JSON.stringify(merged));
    } catch {
      // localStorage 不可用时忽略
    }
  }

  const displayCount = Math.min(items.length, 5);
  const hasCompareButton = items.length >= 2;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" aria-hidden />
          <h2 className="text-base font-semibold text-slate-900">相关内容</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
            共 {totalCount} 条
          </span>
        </div>
        {hasCompareButton && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCompareAll}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-violet-600 px-3 text-xs font-medium text-white transition hover:bg-violet-700"
            >
              <span>⇄</span>
              <span>对比前 {displayCount} 条</span>
            </button>
            <a
              href="/compare"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <span>→</span>
              <span>去对比</span>
            </a>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-1 border-b border-slate-200">
        {TAB_CONFIG.map((tab) => {
          const count = data[tab.key as keyof typeof data].length;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`relative px-3 py-2 text-xs font-medium transition ${
                isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
              } ${count === 0 ? "opacity-40" : ""}`}
              disabled={count === 0}
            >
              <span className="inline-flex items-center gap-1"><tab.icon className="h-3.5 w-3.5" aria-hidden />{tab.label}</span>
              <span className="ml-1 text-[10px]">({count})</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.slice(0, 8).map((item, idx) => (
              <a
                key={idx}
                href={`/items/${item.sourceId}?sourceId=${item.sourceId}&url=${encodeURIComponent(item.url)}`}
                className="block rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium text-slate-900">
                      {item.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{item.departmentName}</span>
                      <span>·</span>
                      <span>{item.listPublishedAt}</span>
                      {item.similarityScore !== undefined && (
                        <>
                          <span>·</span>
                          <span className="text-sky-600">
                            相似度 {item.similarityScore}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getImportanceBadge(item.importanceLevel)}`}
                    >
                      {item.importanceLevel}
                    </span>
                    <span className="text-[10px] text-violet-600">
                      {item.keywordScore} 分
                    </span>
                  </div>
                </div>
              </a>
            ))}
            {items.length > 8 && (
              <div className="text-center text-xs text-slate-400">
                还有 {items.length - 8} 条相关内容
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-400">
            暂无相关内容
          </div>
        )}
      </div>
    </section>
  );
}
