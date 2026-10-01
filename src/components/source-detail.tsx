"use client";

import Link from "next/link";
import { getImportanceBadgeMeta } from "@/lib/monitor/priority-levels";
import {
  Compass, Flame, Library, Mail, Mailbox, Star, Tag, TrendingUp, TriangleAlert,
} from "lucide-react";

export type SourceChannelStat = {
  channelName: string;
  sourceId: string | null;
  totalCount: number;
  last7DaysCount: number;
  todayCount: number;
  urgentCount: number;
  highlightCount: number;
  unreadCount: number;
  starredCount: number;
  latestPublishedAt: string | null;
  latestTitle: string | null;
  latestUrl: string | null;
};

export type SourceDailySeries = { date: string; count: number; urgent: number; highlight: number };
export type SourceCategoryCount = { category: string; label: string; count: number };
export type SourceTopItem = {
  sourceId: string | null;
  channelName: string;
  title: string;
  url: string;
  listPublishedAt: string | null;
  firstSeenAt: string | null;
  importanceLevel: string | null;
  keywordScore: number;
  isRead: boolean;
  isStarred: boolean;
  summary: string | null;
};

export type SourceDetailView = {
  departmentName: string;
  channelCount: number;
  totalCount: number;
  todayCount: number;
  last7DaysCount: number;
  urgentCount: number;
  highlightCount: number;
  unreadCount: number;
  starredCount: number;
  avgKeywordScore: number;
  firstSeenAt: string | null;
  latestPublishedAt: string | null;
  channelStats: SourceChannelStat[];
  dailySeries: SourceDailySeries[];
  categories: SourceCategoryCount[];
};

// 通用 emoji 图标包一层，确保在深色/浅色背景都正常渲染
export function SourceDetailPanel({
  detail,
  topItems,
}: {
  detail: SourceDetailView;
  topItems: SourceTopItem[];
}) {
  const inboxHref = `/inbox?departmentName=${encodeURIComponent(detail.departmentName)}`;

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <section className="px-2 py-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/departments" className="inline-flex items-center gap-1.5 text-sm text-slate-700 hover:text-slate-900">
                <span aria-hidden className="inline-block align-middle leading-none">←</span>
                <span>返回机构目录</span>
              </Link>
              <span className="text-sm text-slate-700">机构详情</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{detail.departmentName}</h1>
            <p className="text-sm leading-6 text-slate-600">
              {detail.channelCount} 个栏目 · 已入库 {detail.totalCount} 条 · 近 7 日更新 {detail.last7DaysCount} 条 · 今日更新{" "}
              {detail.todayCount} 条 · 平均关键词分 {detail.avgKeywordScore}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <StatCell label={<><Flame className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 加急</>} value={detail.urgentCount} />
            <StatCell label={<><TriangleAlert className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 重点</>} value={detail.highlightCount} />
            <StatCell label="未读" value={detail.unreadCount} />
            <StatCell label={<><Star className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 标星</>} value={detail.starredCount} />
            <StatCell label="近 7 日" value={detail.last7DaysCount} />
            <StatCell label="总内容" value={detail.totalCount} />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link
            href={inboxHref}
            className="inline-flex h-10 items-center text-sm font-medium text-slate-900 hover:text-slate-700"
          >
            <Mailbox className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 去动态资讯
          </Link>
          <Link
            href={`${inboxHref}&onlyUrgent=1`}
            className="inline-flex h-10 items-center text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <Flame className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 只看加急
          </Link>
          <Link
            href={`${inboxHref}&onlyUnread=1`}
            className="inline-flex h-10 items-center text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <Mail className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 只看未读
          </Link>
          <Link
            href={`${inboxHref}&onlyStarred=1`}
            className="inline-flex h-10 items-center text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <Star className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 只看标星
          </Link>
          <Link
            href="/departments"
            className="ml-auto inline-flex h-10 items-center text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <span aria-hidden className="inline-block align-middle leading-none">←</span>
            <span>机构目录</span>
          </Link>
        </div>
      </section>

      {/* 图表区：30 日趋势 + 分类分布 */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            <TrendingUp className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 近 30 日更新趋势
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">按 list_published_at 聚合，全部（深紫） · 加急（红） · 重点（橙）</p>
          <DailyLineChart series={detail.dailySeries} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            <Tag className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 标签分布
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">按命中标签聚合，Top {Math.min(10, detail.categories.length)}</p>
          <CategoryBarChart categories={detail.categories.slice(0, 10)} />
        </div>
      </section>

      {/* 栏目卡片 */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            <Library className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 栏目一览（{detail.channelStats.length}）
          </h2>
          <div className="text-[11px] text-slate-500">按总数降序</div>
        </div>
        {detail.channelStats.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center text-xs text-slate-500">
            该部委暂未映射到任何栏目。
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {/* 保险：按 channelName 去重，避免数据库重复条目导致 React key 冲突 */}
            {(() => {
              const seen = new Set<string>();
              const unique: typeof detail.channelStats = [];
              for (const c of detail.channelStats) {
                const k = (c.channelName || "").trim();
                if (!k) continue;
                if (seen.has(k)) {
                  // 合并到已存在的那条
                  const prev = unique[unique.length - 1];
                  prev.totalCount += c.totalCount;
                  prev.last7DaysCount += c.last7DaysCount;
                  prev.todayCount += c.todayCount;
                  prev.urgentCount += c.urgentCount;
                  prev.highlightCount += c.highlightCount;
                  prev.unreadCount += c.unreadCount;
                  prev.starredCount += c.starredCount;
                } else {
                  seen.add(k);
                  unique.push(c);
                }
              }
              return unique.map((c, idx) => (
                <ChannelCard
                  key={c.sourceId ? `${c.sourceId}-${idx}` : `${c.channelName}-${idx}`}
                  channelName={c.channelName}
                  totalCount={c.totalCount}
                  last7Days={c.last7DaysCount}
                  today={c.todayCount}
                  urgent={c.urgentCount}
                  highlight={c.highlightCount}
                  unread={c.unreadCount}
                  starred={c.starredCount}
                  latestTitle={c.latestTitle}
                  latestPublishedAt={c.latestPublishedAt}
                  departmentName={detail.departmentName}
                />
              ));
            })()}
          </div>
        )}
      </section>

      {/* Top 内容列表 */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            <Compass className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 关键内容（Top {Math.min(50, topItems.length)}）
          </h2>
          <div className="text-[11px] text-slate-500">按重要性 → 关键词分 → 发布时间 排序</div>
        </div>
        {topItems.length === 0 ? (
          <div className="mt-4 text-center text-xs text-slate-500">暂无内容。</div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {topItems.map((it, idx) => (
              <TopItemRow
                key={`${it.url || String(idx)}-${idx}`}
                item={it}
                departmentName={detail.departmentName}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCell({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <div className="text-left">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

// ====== 30 日趋势折线图（纯 SVG） ======
function DailyLineChart({ series }: { series: SourceDailySeries[] }) {
  if (series.length === 0) {
    return <EmptyHint text="暂无更新数据" />;
  }
  const width = 760;
  const height = 260;
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;
  const innerW = width - paddingLeft - paddingRight;
  const innerH = height - paddingTop - paddingBottom;

  const maxVal = Math.max(1, ...series.map((s) => Math.max(s.count, s.urgent, s.highlight)));
  const stepX = series.length > 1 ? innerW / (series.length - 1) : innerW;

  function buildPath(key: "count" | "urgent" | "highlight") {
    return series
      .map((s, i) => {
        const x = paddingLeft + i * stepX;
        const y = paddingTop + innerH - (s[key] / maxVal) * innerH;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxVal * f));

  return (
    <div className="mt-3 w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px] w-full">
        {yTicks.map((t, i) => {
          const y = paddingTop + innerH - (t / maxVal) * innerH;
          return (
            <g key={i}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={paddingLeft - 6} y={y + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: 10 }}>
                {t}
              </text>
            </g>
          );
        })}
        {series.map((s, i) => {
          if (i % 3 !== 0 && i !== series.length - 1) return null;
          const x = paddingLeft + i * stepX;
          return (
            <text key={i} x={x} y={height - 10} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
              {s.date.slice(5)}
            </text>
          );
        })}
        {/* total line (area) */}
        <path
          d={`${buildPath("count")} L ${paddingLeft + (series.length - 1) * stepX} ${paddingTop + innerH} L ${paddingLeft} ${paddingTop + innerH} Z`}
          fill="#6366f1"
          fillOpacity={0.08}
        />
        <path d={buildPath("count")} fill="none" stroke="#6366f1" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {/* urgent */}
        <path d={buildPath("urgent")} fill="none" stroke="#ef4444" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        {/* highlight */}
        <path d={buildPath("highlight")} fill="none" stroke="#f59e0b" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-[11px] text-slate-900">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 rounded-full bg-indigo-500" /> 全部
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 rounded-full bg-red-500" /> 加急
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 rounded-full bg-amber-500" /> 重点
        </span>
      </div>
    </div>
  );
}

// ====== 分类条形图 ======
function CategoryBarChart({ categories }: { categories: SourceCategoryCount[] }) {
  if (categories.length === 0) return <EmptyHint text="暂无分类数据" />;
  const max = Math.max(1, ...categories.map((c) => c.count));
  return (
    <div className="mt-3 space-y-2">
      {categories.map((c) => {
        const pct = (c.count / max) * 100;
        return (
          <div key={c.category}>
            <div className="flex items-center justify-between text-[11px] text-slate-900">
              <span className="truncate">{c.label || c.category}</span>
              <span className="shrink-0 text-slate-700">{c.count}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-800" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ====== 栏目卡片 ======
function ChannelCard({
  channelName,
  totalCount,
  last7Days,
  today,
  urgent,
  highlight,
  unread,
  starred,
  latestTitle,
  latestPublishedAt,
  departmentName,
}: {
  channelName: string;
  totalCount: number;
  last7Days: number;
  today: number;
  urgent: number;
  highlight: number;
  unread: number;
  starred: number;
  latestTitle: string | null;
  latestPublishedAt: string | null;
  departmentName: string;
}) {
  const inboxHref = `/inbox?departmentName=${encodeURIComponent(departmentName)}&channelNames=${encodeURIComponent(channelName)}`;
  const sectionHref = `/departments/${encodeURIComponent(departmentName)}/sections/${encodeURIComponent(channelName)}`;
  return (
    <div className="py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900" title={channelName}>
            {channelName}
          </h3>
          <div className="mt-1 text-[11px] text-slate-600">共 {totalCount} 条 · 近 7 日 {last7Days} · 今日 {today}</div>
        </div>
        {today > 0 ? (
          <span className="text-[11px] text-amber-700">+{today}</span>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-x-4 gap-y-1 text-center text-[11px]">
        <Mini label={<><Flame className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 加急</>} value={urgent} />
        <Mini label={<><TriangleAlert className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 重点</>} value={highlight} />
        <Mini label="未读" value={unread} />
        <Mini label={<><Star className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> 标星</>} value={starred} />
      </div>
      <div className="mt-3">
        <div className="text-[11px] text-slate-500">最新 {latestPublishedAt ? String(latestPublishedAt).slice(0, 10) : "-"}</div>
        {latestTitle ? (
          <Link
            href={inboxHref}
            className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-900 hover:text-slate-700 hover:underline underline-offset-2"
            title={latestTitle}
          >
            {latestTitle}
          </Link>
        ) : (
          <div className="mt-0.5 text-[11px] text-slate-500">—</div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        <Link href={sectionHref} className="text-[11px] text-slate-700 hover:text-slate-900">
          栏目详情 →
        </Link>
        <Link href={inboxHref} className="text-[11px] text-slate-700 hover:text-slate-900">
          打开该栏目 →
        </Link>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

// ====== Top 内容行 ======
function TopItemRow({ item, departmentName }: { item: SourceTopItem; departmentName: string }) {
  const badge = getImportanceBadgeMeta(item.importanceLevel, item.keywordScore);
  // 规范化字符串，避免 SSR/CSR 差异（trim 去除前后空白）
  const safeTitle = String(item.title ?? "").trim();
  const safeSummary = item.summary ? String(item.summary).trim() : null;
  const inboxHref = `/inbox?departmentName=${encodeURIComponent(departmentName)}&channelNames=${encodeURIComponent(item.channelName)}`;
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex w-full shrink-0 flex-wrap items-center gap-x-2 text-[11px] sm:w-40 sm:flex-nowrap">
        {badge ? (
          <span className={badge.level === "核心关注" ? "text-red-700" : "text-orange-700"}>
            {badge.level === "核心关注" ? <Flame className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> : <TriangleAlert className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden />}
            {" "}{badge.level}
          </span>
        ) : null}
        {item.isStarred ? (
          <span className="text-amber-700"><Star className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /></span>
        ) : null}
        {!item.isRead ? (
          <span className="text-sky-700">未读</span>
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        {/* 外部链接使用原生 <a>，避免 next/link 在 SSR/CSR 间的属性渲染差异 */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-slate-900 hover:text-indigo-700 hover:underline underline-offset-2"
          title={safeTitle}
        >
          {safeTitle}
        </a>
        {safeSummary ? (
          <div className="mt-1 line-clamp-2 text-[12px] text-slate-900" title={safeSummary}>
            {safeSummary}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-700">
          <span>{item.channelName}</span>
          <span>发布 {item.listPublishedAt ? String(item.listPublishedAt).slice(0, 10) : "-"}</span>
          <span>关键词分 {item.keywordScore}</span>
          <Link
            href={inboxHref}
            className="text-slate-700 hover:text-slate-900"
          >
            打开同栏目 →
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="mt-3 flex h-28 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 text-xs text-slate-400">
      {text}
    </div>
  );
}
