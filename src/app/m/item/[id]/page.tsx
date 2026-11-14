import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { getItemDetailBySourceAndUrl } from "@/lib/monitor/db";
import { t } from "@/lib/i18n";
import { primaryCategory } from "@/lib/companion/feed";
import { readingMinutes, shortDate, sourceAbbr } from "@/lib/companion/format";
import { keywordStrings, segmentByKeywords } from "@/lib/companion/highlight";
import { DetailToolbar } from "@/components/companion/detail-toolbar";
import { CompanionNoteBlock } from "@/components/companion/detail-note-block";

/**
 * 详情页做成 **Server Component**（与其他伴侣版页面不同）：
 * 数据在服务端直接取好，没有"先 Loading 再填"的空窗，也不需要客户端 fetch。
 * 只有底部工具栏与本地备注块需要交互/读 localStorage，拆成客户端子组件。
 *
 * 政策雷达固定中文，这里用 `t(key, "zh")` 直接取。
 *
 * ⚠️ Next 16：params 与 searchParams 都是 Promise，必须 await。
 * 另外 Next 会**自动解码**这两者，所以不要再 decodeURIComponent——那会把值里
 * 残留的 % 二次解码弄坏。桌面端的 /items/[itemId] 也是不手动解码的。
 */
export default async function CompanionItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ url?: string }>;
}) {
  const { id } = await params;
  const { url } = await searchParams;
  const sourceId = id;
  const targetUrl = url ?? "";

  if (!sourceId || !targetUrl) notFound();

  const item = await getItemDetailBySourceAndUrl(sourceId, targetUrl);
  if (!item) notFound();

  const tr = (key: Parameters<typeof t>[0], vars?: Record<string, string | number>) =>
    t(key, "zh", vars);

  const sourceName = item.displayName || item.departmentName;
  const category = primaryCategory(item);
  const keywords = keywordStrings(item.matchedKeywords);
  const minutes = readingMinutes(item.paragraphs);
  const summary = (item.summary ?? "").trim();

  return (
    <main>
      <header className="px-5 pb-2 pt-1.5">
        <div className="flex h-9 items-center justify-between">
          <Link
            href="/m/feed"
            className="flex items-center gap-[5px] text-[14px] font-semibold text-slate-700"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {tr("companion.feed.title")}
          </Link>
        </div>
      </header>

      <article className="px-5 pb-28 pt-1.5">
        {category ? (
          <div className="mt-2 text-[11px] font-semibold tracking-[0.02em] text-slate-500">
            {category}
          </div>
        ) : null}

        <h1 className="mt-2 font-serif text-[23px] font-medium leading-[1.24] tracking-[-0.01em] text-slate-900">
          {item.title}
        </h1>

        <div className="mt-[14px] flex items-center gap-[9px] text-[12px] text-slate-500">
          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[8px] bg-slate-200 text-[10px] font-bold tracking-[0.02em] text-slate-600">
            {sourceAbbr(sourceName)}
          </span>
          <span className="font-semibold text-slate-700">{sourceName}</span>
          <span className="h-[3px] w-[3px] flex-none rounded-full bg-slate-200" aria-hidden />
          <time className="font-mono">{shortDate(item.listPublishedAt)}</time>
          <span className="h-[3px] w-[3px] flex-none rounded-full bg-slate-200" aria-hidden />
          <span>{tr("companion.detail.minRead", { n: minutes })}</span>
        </div>

        {/* 「智能摘要」：衬线 + 品牌色，是系统生成的话。
            与正文关键词命中高亮（固定浅黄）刻意分开——两者混在一起
            就分不清哪些是系统说的、哪些是命中的词。 */}
        {summary ? (
          <div className="mt-5 flex gap-[10px] rounded-[14px] bg-[color-mix(in_srgb,var(--brand)_6%,transparent)] px-[15px] py-[14px]">
            <span className="mt-0.5 flex-none text-[var(--brand)]" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2c.5 4.7 2.6 6.8 7.3 7.3-4.7.5-6.8 2.6-7.3 7.3-.5-4.7-2.6-6.8-7.3-7.3C9.4 8.8 11.5 6.7 12 2Z" />
              </svg>
            </span>
            <div>
              <div className="mb-1 text-[10px] font-bold tracking-[0.03em] text-[var(--brand-ink)]">
                智能摘要
              </div>
              <p className="font-serif text-[14.5px] leading-[1.5] text-[var(--brand-ink)]">{summary}</p>
            </div>
          </div>
        ) : null}

        {/* 「你自己写的话」：灰底无衬线，与上面那块（品牌色衬线）刻意不同。
            存在 localStorage，服务端读不到，所以是客户端组件，挂载后填。 */}
        <CompanionNoteBlock sourceId={item.sourceId} url={item.url} />

        {item.paragraphs.length === 0 ? (
          <p className="mt-5 text-[13.5px] leading-[1.6] text-slate-500">
            {tr("companion.detail.noBody")}
          </p>
        ) : (
          <div className="mt-5">
            {item.paragraphs.map((p, i) => (
              <p key={i} className="mb-[14px] text-[14.5px] leading-[1.66] text-slate-700">
                {segmentByKeywords(p, keywords).map((seg, j) =>
                  seg.hit ? (
                    // .kw 的样式定义在 globals.css 的 [data-companion] 作用域里
                    <mark key={j} className="kw">
                      {seg.text}
                    </mark>
                  ) : (
                    <span key={j}>{seg.text}</span>
                  ),
                )}
              </p>
            ))}
          </div>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 inline-flex items-center gap-[6px] text-[13px] font-semibold text-[var(--brand-ink)]"
        >
          {tr("companion.detail.openOn", { src: sourceName })}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </article>

      <DetailToolbar
        sourceId={item.sourceId}
        url={item.url}
        title={item.title}
        sourceAbbrText={sourceAbbr(sourceName)}
        initialStarred={item.isStarred}
        initialRead={item.isRead}
      />
    </main>
  );
}
