"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SIGNAL_CATEGORIES } from "@/lib/monitor/content-meta";
import {
  LoaderCircle,
} from "lucide-react";

type DigestItem = {
  sourceId: string;
  url: string;
  title: string;
  sourceName?: string;
  departmentName?: string;
  channelName?: string;
  listPublishedAt?: string;
  importanceLevel?: number;
  categories?: Array<{ category: string }>;
  summary?: string;
};

function buildHtml(items: DigestItem[], date: string): string {
  const byCategory: Record<string, DigestItem[]> = {};
  for (const item of items) {
    const cat = item.categories?.[0]?.category ?? "综合";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  const categorySections = Object.entries(byCategory)
    .map(([cat, catItems]) => `
    <tr><td style="padding:18px 32px 6px">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;border-bottom:1px solid #e2e8f0;padding-bottom:6px">${cat}</div>
    </td></tr>
    ${catItems.slice(0, 5).map((i) => `
    <tr><td style="padding:8px 32px">
      <a href="${i.url}" style="font-size:13px;font-weight:500;color:#1e293b;text-decoration:none;line-height:1.4">${i.title}</a>
      <div style="margin-top:3px;font-size:11px;color:#94a3b8">${i.departmentName ?? ""}${i.channelName ? " · " + i.channelName : ""}${i.listPublishedAt ? " · " + i.listPublishedAt.slice(0, 10) : ""}</div>
      ${i.summary ? `<div style="margin-top:4px;font-size:12px;color:#64748b;line-height:1.5">${i.summary.slice(0, 120)}…</div>` : ""}
    </td></tr>`).join("")}`)
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>政策情报日报 · ${date}</title>
<style>
  :root { color-scheme: light !important; }
  html, body { background-color: #f8fafc !important; color: #1e293b !important; }
  @media (prefers-color-scheme: dark) {
    html { background-color: #f8fafc !important; filter: none !important; }
    body { background-color: #f8fafc !important; color: #1e293b !important; }
    table { background-color: transparent; }
    a { color: #1e293b !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px">
          <div style="color:#c7d2fe;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em">政策雷达</div>
          <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:4px">今日情报日报</div>
          <div style="color:#c4b5fd;font-size:12px;margin-top:4px">${date} · 共 ${items.length} 条精选信号</div>
        </td></tr>
        <!-- Stats bar -->
        <tr><td style="background-color:#f8fafc;padding:12px 32px;border-bottom:1px solid #e2e8f0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${Object.entries(byCategory).slice(0, 4).map(([cat, list]) => `
              <td align="center" style="padding:0 8px">
                <div style="font-size:18px;font-weight:700;color:#1e293b">${list.length}</div>
                <div style="font-size:10px;color:#94a3b8;margin-top:2px">${cat.slice(2)}</div>
              </td>`).join("")}
            </tr>
          </table>
        </td></tr>
        <!-- Content -->
        <tr><td>
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff">
            ${categorySections}
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 32px;border-top:1px solid #f1f5f9;background-color:#fafafa">
          <div style="font-size:11px;color:#94a3b8;text-align:center">政策雷达 · 仅供参考 · 数据来源于公开渠道</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export default function DigestPage() {
  const [items, setItems] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"preview" | "html">("preview");
  const [copied, setCopied] = useState(false);

  const today = new Date().toLocaleDateString("zh-CN");

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams({
          view: "list",
          limit: "30",
          offset: "0",
          categories: [...SIGNAL_CATEGORIES].join(","),
          sort: "relevance",
        });
        const res = await fetch(`/api/monitor/items?${params}`, { cache: "no-store" });
        const json = await res.json() as { items?: DigestItem[] };
        setItems(json.items ?? []);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const html = buildHtml(items, today);

  function copyHtml() {
    navigator.clipboard.writeText(html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link href="/" className="hover:text-slate-800">首页</Link>
              <span>/</span>
              <span>摘要邮件预览</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">今日情报日报</h1>
            <p className="mt-1 text-sm text-slate-500">{today} · {items.length} 条信号 · HTML 邮件格式预览</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyHtml}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
            >
              {copied ? "✓ 已复制" : "复制 HTML"}
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mb-4 flex gap-1 border-b border-slate-200">
          {(["preview", "html"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition ${tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              style={tab === t ? { borderColor: "var(--brand)", color: "var(--brand)" } : undefined}
            >
              {t === "preview" ? "预览效果" : "◇ HTML 源码"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" aria-hidden /> 正在加载今日信号…
          </div>
        ) : tab === "preview" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm" style={{ background: "#f8fafc" }}>
            <iframe
              srcDoc={html}
              title="邮件预览"
              className="block w-full"
              style={{ height: "700px", border: "none", colorScheme: "light", background: "#f8fafc" }}
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <div className="relative">
            <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-900 p-5 text-[11px] leading-relaxed text-slate-300">
              {html}
            </pre>
            <button
              type="button"
              onClick={copyHtml}
              className="absolute right-3 top-3 rounded-lg bg-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-600"
            >
              {copied ? "✓" : "复制"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
