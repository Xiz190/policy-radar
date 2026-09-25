"use client";

import Link from "next/link";
import { CategoryChip } from "@/components/category-chip";
import { formatDateShort } from "@/lib/date-utils";
import type { CategoryCount } from "@/hooks/use-item-list";
import type { ContentItem } from "@/hooks/use-item-list";

type CategoryGroupViewProps = {
  categoriesWithCounts: CategoryCount[];
  items: ContentItem[];
  onSelectCategory: (category: string) => void;
};

export function CategoryGroupView({ categoriesWithCounts, items, onSelectCategory }: CategoryGroupViewProps) {
  const groupedItems = items.reduce((acc, item) => {
    for (const cat of item.categories) {
      if (!acc[cat.category]) acc[cat.category] = [];
      acc[cat.category].push(item);
    }
    if (item.categories.length === 0) {
      if (!acc["未分类"]) acc["未分类"] = [];
      acc["未分类"].push(item);
    }
    return acc;
  }, {} as Record<string, ContentItem[]>);

  const sortedCategories = [...categoriesWithCounts]
    .sort((a, b) => b.count - a.count)
    .filter((c) => groupedItems[c.category] && groupedItems[c.category].length > 0);

  if (sortedCategories.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        当前筛选下没有内容
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedCategories.map((cat) => {
        const catItems = groupedItems[cat.category] || [];
        if (catItems.length === 0) return null;

        return (
          <div key={cat.category} className="rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => onSelectCategory(cat.category)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <CategoryChip category={cat.category} className="text-sm" />
                <span className="text-xs text-slate-500">{catItems.length} 条</span>
              </div>
              <span className="text-xs text-sky-700">查看全部 →</span>
            </button>
            <div className="border-t border-slate-100">
              {catItems.slice(0, 3).map((item) => (
                <div key={`${item.sourceId}-${item.url}`} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDateShort(item.listPublishedAt)}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {item.departmentName}
                  </span>
                  <Link
                    href={`/items/${encodeURIComponent(item.sourceId)}?sourceId=${encodeURIComponent(item.sourceId)}&url=${encodeURIComponent(item.url)}`}
                    className="min-w-0 flex-1 truncate text-xs text-slate-700 hover:text-indigo-700"
                  >
                    {item.title}
                  </Link>
                  {item.isStarred ? (
                    <span className="shrink-0 text-xs text-amber-500">★</span>
                  ) : null}
                </div>
              ))}
              {catItems.length > 3 ? (
                <div className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.category)}
                    className="text-sky-700 hover:underline"
                  >
                    展开更多 ({catItems.length - 3}) →
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
