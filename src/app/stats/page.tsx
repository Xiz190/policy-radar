"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import {
  BarChart3, Inbox, Key, Landmark, Save,
} from "lucide-react";

type DashData = {
  counts: { total: number; unread: number; starred: number; urgent: number; highlight: number };
  departmentStats: { departmentName: string; total: number; todayCount: number }[];
  topKeywords: { keyword: string; category: string; count: number }[];
  periodDays: number;
};

type LocalStats = {
  notes: number;
  tags: number;
  taggedItems: number;
  readingList: number;
  pinned: number;
  savedPresets: number;
  alertRules: number;
};

function StatBlock({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

export default function StatsPage() {
  const [dash, setDash] = useState<DashData | null>(null);
  const [local, setLocal] = useState<LocalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load localStorage stats
    try {
      const notes = JSON.parse(localStorage.getItem("inbox_notes") ?? "{}");
      const tags = JSON.parse(localStorage.getItem("inbox_item_tags") ?? "{}");
      const rl = JSON.parse(localStorage.getItem("inbox_reading_list") ?? "[]");
      const pinned = JSON.parse(localStorage.getItem("inbox_pinned_items") ?? "[]");
      const presets = JSON.parse(localStorage.getItem("inbox_saved_presets") ?? "[]");
      const alerts = JSON.parse(localStorage.getItem("inbox_alert_rules") ?? "[]");
      const allTags = new Set<string>();
      for (const t of Object.values(tags) as string[][]) for (const tag of t) allTags.add(tag);
      setLocal({
        notes: Object.keys(notes).length,
        tags: allTags.size,
        taggedItems: Object.keys(tags).length,
        readingList: rl.length,
        pinned: pinned.length,
        savedPresets: presets.length,
        alertRules: alerts.length,
      });
    } catch {}

    // Fetch dashboard data
    fetch("/api/monitor/dashboard?days=30&topN=10", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setDash(d as DashData); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const readPct = dash ? Math.round(((dash.counts.total - dash.counts.unread) / Math.max(1, dash.counts.total)) * 100) : 0;
  const engagementPct = dash ? Math.round(((dash.counts.starred + dash.counts.urgent) / Math.max(1, dash.counts.total)) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">

        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-800">首页</Link>
            <span>/</span>
            <span>个人统计</span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-slate-900"><BarChart3 className="mr-1 inline h-4 w-4" aria-hidden />个人阅读统计</h1>
          <p className="mt-1 text-sm text-slate-500">基于本地数据 + 近 30 天 API 数据生成，不上传任何隐私信息</p>
        </div>

        {/* API-based stats */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5">
                <div className="h-3 w-16 rounded bg-slate-100" />
                <div className="mt-2 h-7 w-12 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : dash ? (
          <>
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700"><Inbox className="mr-1 inline h-3.5 w-3.5" aria-hidden />收件箱概览（近 {dash.periodDays} 天）</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBlock label="入库条目" value={dash.counts.total} sub="总量" />
                <StatBlock label="已读" value={dash.counts.total - dash.counts.unread} sub={`完成率 ${readPct}%`} accent="var(--brand)" />
                <StatBlock label="标星/核心" value={dash.counts.starred + dash.counts.urgent} sub={`参与率 ${engagementPct}%`} />
                <StatBlock label="未读积压" value={dash.counts.unread} sub="待处理" />
              </div>
            </section>

            {/* Reading rate bar */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">阅读完成率</span>
                <span className="text-slate-500">{readPct}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${readPct}%`, backgroundColor: readPct >= 80 ? "#10b981" : readPct >= 50 ? "#f59e0b" : "var(--brand)" }}
                />
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                {readPct >= 80 ? "阅读习惯很棒！保持下去" : readPct >= 50 ? "继续保持，超过一半了" : "还有很多精彩内容等你探索"}
              </div>
            </div>

            {/* Top departments */}
            {dash.departmentStats.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 text-sm font-semibold text-slate-700"><Landmark className="mr-1 inline h-3.5 w-3.5" aria-hidden />最活跃来源 Top 5</h2>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="space-y-3">
                    {dash.departmentStats.slice(0, 5).map((d, i) => {
                      const max = dash.departmentStats[0]?.total || 1;
                      return (
                        <div key={d.departmentName} className="flex items-center gap-3">
                          <span className="w-4 text-center text-xs text-slate-400">{i + 1}</span>
                          <span className="w-28 truncate text-xs text-slate-700">{d.departmentName}</span>
                          <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
                            <div className="h-full rounded-full" style={{ width: `${(d.total / max) * 100}%`, backgroundColor: "var(--brand)", opacity: 0.7 }} />
                          </div>
                          <span className="w-8 text-right text-xs text-slate-500">{d.total}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Top keywords */}
            {dash.topKeywords.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 text-sm font-semibold text-slate-700"><Key className="mr-1 inline h-3.5 w-3.5" aria-hidden />高频关键词</h2>
                <div className="flex flex-wrap gap-2">
                  {dash.topKeywords.slice(0, 15).map((kw) => (
                    <Link
                      key={kw.keyword}
                      href={`/inbox?q=${encodeURIComponent(kw.keyword)}`}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      style={{ fontSize: `${Math.min(14, 10 + kw.count / 5)}px` }}
                    >
                      {kw.keyword} <span className="text-slate-400">{kw.count}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}

        {/* Local stats */}
        {local && (
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-700"><Save className="mr-1 inline h-3.5 w-3.5" aria-hidden />本地使用数据</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock label="便签" value={local.notes} sub="条" />
              <StatBlock label="已打标签条目" value={local.taggedItems} sub={`${local.tags} 种标签`} />
              <StatBlock label="稍后读清单" value={local.readingList} sub="条" />
              <StatBlock label="置顶条目" value={local.pinned} sub="条" />
              <StatBlock label="已保存筛选方案" value={local.savedPresets} sub="个" />
              <StatBlock label="提醒规则" value={local.alertRules} sub="条" />
            </div>
          </section>
        )}

        {/* Motivational footer */}
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">
          <Landmark className="mx-auto mb-2 h-7 w-7 text-slate-300" aria-hidden />
          <p>持续追踪政策动态，是相关机构与研究者把握方向的关键。</p>
          <div className="mt-3 flex justify-center gap-3">
            <Link href="/inbox" className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">→ 收件箱</Link>
            <Link href="/signals" className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50">→ 信号雷达</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
