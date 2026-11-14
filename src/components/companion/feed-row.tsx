import Link from "next/link";
import { Sparkles, Star } from "lucide-react";
import type { ContentItem } from "@/hooks/use-item-list";
import { primaryCategory } from "@/lib/companion/feed";
import { shortAgo } from "@/lib/companion/format";

/**
 * Feed 的一条。结构照 mockup：
 *   行首小标签（信号层分类）+ 重点星标（仅重点/核心）+ 未读圆点（仅未读时）
 *   标题
 *   来源 · 时间 + 收藏星标（已收藏时实心）
 *
 * `now` 由调用方传入而不是在这里取 Date.now()：让整屏在同一时刻基准上渲染，
 * 也避免每条各算一次带来的不一致。
 */
export function FeedRow({ item, now }: { item: ContentItem; now: Date }) {
  const cat = primaryCategory(item);
  // ✦ 只标重点/核心：政策雷达里"重点内容/核心关注"是少数，全标就等于没标
  const spark = item.importanceLevel === "核心关注" || item.importanceLevel === "重点内容";
  const read = item.isRead;

  return (
    <Link
      href={`/m/item/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`}
      className="block border-b border-slate-100 py-[19px]"
    >
      <div className="mb-2 flex items-center gap-2">
        {cat ? (
          <span className="text-[11px] font-semibold tracking-[0.01em] text-slate-500">{cat}</span>
        ) : null}
        {spark ? <Sparkles className="h-3 w-3 flex-none text-[var(--brand)]" aria-label="重点" /> : null}
        {!read ? (
          <span
            className="ml-auto h-[7px] w-[7px] flex-none rounded-full bg-[var(--brand)]"
            aria-label="未读"
          />
        ) : null}
      </div>

      <h2
        className={`text-[15.5px] leading-[1.4] tracking-[-0.006em] ${
          read ? "font-medium text-slate-700" : "font-semibold text-slate-900"
        }`}
      >
        {item.title}
      </h2>

      <div className="mt-[13px] flex items-center gap-[7px] text-[12px] text-slate-500">
        <span className="font-semibold text-slate-700">{item.departmentName}</span>
        <span className="h-[3px] w-[3px] flex-none rounded-full bg-slate-200" aria-hidden />
        <time className="font-mono text-[11px]">{shortAgo(item.listPublishedAt, now)}</time>
        <Star
          className={`ml-auto h-[15px] w-[15px] ${
            item.isStarred ? "text-[var(--brand)]" : "text-slate-400"
          }`}
          fill={item.isStarred ? "currentColor" : "none"}
          aria-hidden
        />
      </div>
    </Link>
  );
}
