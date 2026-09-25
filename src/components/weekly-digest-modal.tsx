"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Newspaper,
} from "lucide-react";

type SignalItem = {
  sourceId: string;
  departmentName: string;
  channelName: string;
  title: string;
  url: string;
  listPublishedAt: string;
  firstSeenAt?: string;
  importanceLevel: string;
  keywordScore: number;
  categories: Array<{ category: string; score: number; topKeywords?: string[] }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: SignalItem[];
};

const SIGNAL_ORDER = [
  "A·强执行信号",
  "B·强支持信号",
  "C·濒危预警信号",
  "D·行业研究",
  "版权/标准",
];

const SIGNAL_CATEGORIES = new Set(SIGNAL_ORDER);

function getTopSignalCat(cats: Array<{ category: string; score: number }>): string | null {
  const sig = cats.filter((c) => SIGNAL_CATEGORIES.has(c.category));
  if (!sig.length) return null;
  return sig.sort((a, b) => b.score - a.score)[0].category;
}

function itemScore(item: SignalItem): number {
  const impScore =
    item.importanceLevel === "urgent" ? 100 :
    item.importanceLevel === "highlight" ? 60 :
    item.importanceLevel === "notable" ? 30 : 10;
  return impScore + (item.keywordScore ?? 0);
}

function fmtDate(iso: string): string {
  return iso ? iso.split("T")[0] : "";
}

function getWeekRange(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `${fmt(mon)} ~ ${fmt(sun)}`;
}

function generateMarkdown(items: SignalItem[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const weekRange = getWeekRange();

  // 分组
  const grouped = new Map<string, SignalItem[]>();
  for (const cat of SIGNAL_ORDER) grouped.set(cat, []);
  for (const item of items) {
    const cat = getTopSignalCat(item.categories);
    if (cat && grouped.has(cat)) grouped.get(cat)!.push(item);
  }
  // 每组按分数排序
  for (const [cat, list] of grouped) {
    grouped.set(cat, list.sort((a, b) => itemScore(b) - itemScore(a)));
  }

  const total = items.length;
  const lines: string[] = [];

  lines.push(`# 政策情报周报 · ${weekRange}`);
  lines.push("");

  // TL;DR
  lines.push("## TL;DR · 本周速览");
  lines.push(`本周共 **${total}** 条高价值信号`);
  lines.push("");
  let hasAnyTldr = false;
  for (const cat of SIGNAL_ORDER) {
    const list = grouped.get(cat) ?? [];
    if (!list.length) continue;
    hasAnyTldr = true;
    const top = list[0];
    lines.push(`**${cat.replace(/^[A-Z]·/, "")}**：${top.title}`);
  }
  if (!hasAnyTldr) lines.push("暂无高价值信号数据");
  lines.push("");
  lines.push("---");
  lines.push("");

  // 各版块详情
  for (const cat of SIGNAL_ORDER) {
    const list = grouped.get(cat) ?? [];
    if (!list.length) continue;
    lines.push(`## ${cat}（${list.length} 条）`);
    lines.push("");
    for (const item of list) {
      const date = fmtDate(item.listPublishedAt);
      lines.push(`- **${item.title}**`);
      lines.push(`  来源：${item.departmentName} · ${date} · [原文](${item.url})`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*由政策雷达自动生成 · ${today}*`);

  return lines.join("\n");
}

// 简单的 Markdown → JSX 预览（只处理本周报用到的子集）
function DigestPreview({ md }: { md: string }) {
  return (
    <div className="space-y-1 font-sans text-sm leading-7 text-slate-800">
      {md.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-slate-900">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="mt-4 text-base font-semibold text-slate-800 border-b border-slate-100 pb-1">{line.slice(3)}</h2>;
        if (line === "---") return <hr key={i} className="my-3 border-slate-200" />;
        if (line === "") return <div key={i} className="h-1" />;
        if (line.startsWith("- ")) {
          // inline bold
          const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
          return <li key={i} className="ml-4 list-disc text-slate-700" dangerouslySetInnerHTML={{ __html: content }} />;
        }
        // indent (sub-line of list item)
        if (line.startsWith("  来源：")) {
          const content = line.trim().replace(/\[原文\]\((.+?)\)/, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-sky-600 underline">原文 ↗</a>');
          return <div key={i} className="ml-8 text-xs text-slate-500" dangerouslySetInnerHTML={{ __html: content }} />;
        }
        // inline bold anywhere
        const content = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
        return <p key={i} className="text-slate-700" dangerouslySetInnerHTML={{ __html: content }} />;
      })}
    </div>
  );
}

export function WeeklyDigestModal({ open, onClose, items }: Props) {
  const [tab, setTab] = useState<"preview" | "markdown">("preview");
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const markdown = useMemo(() => generateMarkdown(items), [items]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) { el.showModal(); setTab("preview"); setCopied(false); }
    else { try { el.close(); } catch {} }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select textarea
      const ta = document.querySelector<HTMLTextAreaElement>("#digest-raw");
      ta?.select();
    }
  }

  function downloadMd() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-digest-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      className="m-auto max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="flex h-full max-h-[90vh] flex-col">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <div className="text-base font-semibold text-slate-900"><Newspaper className="mr-1 inline h-3.5 w-3.5" aria-hidden />信号周报生成器</div>
              <div className="text-xs text-slate-500">基于当前 {items.length} 条筛选信号 · {getWeekRange()}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >✕</button>
          </div>

          {/* Tab bar */}
          <div className="flex shrink-0 gap-1 border-b border-slate-100 px-6 py-2">
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "preview" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              预览
            </button>
            <button
              type="button"
              onClick={() => setTab("markdown")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${tab === "markdown" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Markdown 源码
            </button>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {tab === "preview" ? (
              <DigestPreview md={markdown} />
            ) : (
              <textarea
                id="digest-raw"
                readOnly
                value={markdown}
                className="h-full min-h-[400px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-700 outline-none"
              />
            )}
          </div>

          {/* Footer actions */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
            <span className="text-xs text-slate-400">
              {items.length} 条信号 · {SIGNAL_ORDER.filter((c) => (items.some((i) => getTopSignalCat(i.categories) === c))).length} 个类别
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={downloadMd}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
              >
                ↓ 下载 .md
              </button>
              <button
                type="button"
                onClick={copyToClipboard}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition ${
                  copied ? "bg-emerald-600 text-white" : "bg-slate-900 text-white hover:bg-slate-700"
                }`}
              >
                {copied ? "✓ 已复制" : "复制到剪贴板"}
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
