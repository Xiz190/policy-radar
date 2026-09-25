"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  getAllPersonalResearch,
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_STATUS_ICONS,
  type PersonalResearchItem,
  type FollowUpStatus,
} from "@/lib/personal-research";
import { StatusIcon } from "@/components/status-icon";
import {
  NotebookPen, Sparkles,
} from "lucide-react";

const ACTIVE_STATUSES: FollowUpStatus[] = ["to_read", "reading", "to_act"];

function summarizeTitle(title: string, maxLen = 48): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen) + "…";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

export function MyFollowUps() {
  const loadedItems = useMemo(() => {
    const all = getAllPersonalResearch();
    return all
      .filter((item) => ACTIVE_STATUSES.includes(item.followUpStatus))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
  }, []);

  const [items] = useState<PersonalResearchItem[]>(loadedItems);
  const [loaded] = useState(true);

  if (!loaded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 bg-slate-200 rounded" />
          <div className="h-4 w-full bg-slate-100 rounded" />
          <div className="h-4 w-3/4 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold">
          我的待跟进
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {items.length > 0
            ? `有 ${items.length} 条政策需要你处理`
            : "暂无待跟进的政策"}
        </p>
      </div>
      <Link
        href="/research"
        className="text-sm text-slate-500 hover:text-slate-700"
      >
        查看全部 →
      </Link>
    </div>

    {items.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 py-8 text-center">
      <Sparkles className="mx-auto mb-2 h-7 w-7 text-amber-400" aria-hidden />
      <p className="text-sm text-slate-500">
        看完政策后可以标记待跟进，这里会自动汇总
      </p>
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1 mt-3 text-sm text-slate-600 hover:text-slate-800"
      >
        去动态资讯看看 →
      </Link>
    </div>
    ) : (
      <div className="space-y-2">
        {items.map((item) => (
        <Link
          key={`${item.sourceId}::${item.url}`}
          href={`/items/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
          className="group block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 text-lg">
              <StatusIcon status={item.followUpStatus} className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">
                  {FOLLOW_UP_STATUS_LABELS[item.followUpStatus]}
                </span>
                <span className="text-xs text-slate-400">
                  更新于 {formatDate(item.updatedAt)}
                </span>
              </div>
              <h3 className="mt-1 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-slate-600">
                {summarizeTitle(item.title)}
              </h3>
              {item.note && (
                <p className="mt-1.5 text-xs text-slate-500 line-clamp-1">
                  <NotebookPen className="mr-1 inline h-3 w-3" aria-hidden />{item.note}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
      </div>
    )}
    </section>
  );
}
