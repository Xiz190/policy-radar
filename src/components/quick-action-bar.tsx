"use client";

import { useState, useRef, useTransition } from "react";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { copyToClipboard, shareOrCopy } from "@/lib/clipboard";
import {
  type FollowUpStatus,
  FOLLOW_UP_STATUS_LABELS,
  FOLLOW_UP_STATUS_ICONS,
  FOLLOW_UP_STATUS_OPTIONS,
  getNote,
  getFollowUpStatus,
  setNote as setNoteStorage,
  setFollowUpStatus as setFollowUpStatusStorage,
} from "@/lib/personal-research";
import { StatusIcon } from "@/components/status-icon";
import {
  ClipboardList, FileText, NotebookPen, Tag,
} from "lucide-react";

type QuickActionBarProps = {
  sourceId: string;
  url: string;
  title: string;
  pageTitle?: string | null;
  departmentName: string;
  channelName: string;
  listPublishedAt: string | null;
  paragraphs: string[];
  initialStarred: boolean;
  initialRead: boolean;
  onCompareClick?: () => void;
  isInCompare?: boolean;
};

export function QuickActionBar({
  sourceId,
  url,
  title,
  pageTitle,
  departmentName,
  channelName,
  listPublishedAt,
  paragraphs,
  initialStarred,
  initialRead,
  onCompareClick,
  isInCompare = false,
}: QuickActionBarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isStarred, setIsStarred] = useState(initialStarred);
  const [isRead, setIsRead] = useState(initialRead);
  const [localInCompare, setLocalInCompare] = useState(isInCompare);
  const [isPending, startTransition] = useTransition();

  // 个人研究：备注和跟进状态（从 localStorage 读取）
  const [note, setNoteLocal] = useState(() => getNote(sourceId, url));
  const [followUpStatus, setFollowUpStatusLocal] = useState<FollowUpStatus>(() => getFollowUpStatus(sourceId, url));
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  function handleStarred() {
    const next = !isStarred;
    const prev = isStarred;
    setIsStarred(next);
    startTransition(async () => {
      try {
        const res = await fetchWithAuth("/api/monitor/items/batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceId,
            url,
            isStarred: next,
          }),
        });
        await res.json();
        showToast(next ? "已加入收藏" : "已取消收藏");
      } catch {
        setIsStarred(prev);
        showToast("操作失败，请稍后重试");
      }
    });
  }

  function handleRead() {
    const next = !isRead;
    const prev = isRead;
    setIsRead(next);
    startTransition(async () => {
      try {
        const res = await fetchWithAuth("/api/monitor/items/batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceId,
            url,
            isRead: next,
          }),
        });
        await res.json();
        showToast(next ? "已标记为已读" : "已标记为未读");
      } catch {
        setIsRead(prev);
        showToast("操作失败，请稍后重试");
      }
    });
  }

  function handleNoteClick() {
    setShowNoteEditor(!showNoteEditor);
    setShowExportMenu(false);
    setShowStatusMenu(false);
    if (!showNoteEditor) {
      setTimeout(() => noteTextareaRef.current?.focus(), 50);
    }
  }

  function handleNoteChange(value: string) {
    setNoteLocal(value);
  }

  function handleNoteSave() {
    setNoteStorage(sourceId, url, title, note);
    showToast(note ? "备注已保存" : "备注已清除");
    setShowNoteEditor(false);
  }

  function handleStatusClick() {
    setShowStatusMenu(!showStatusMenu);
    setShowExportMenu(false);
    setShowNoteEditor(false);
  }

  function handleStatusSelect(status: FollowUpStatus) {
    setFollowUpStatusStorage(sourceId, url, title, status);
    setFollowUpStatusLocal(status);
    setShowStatusMenu(false);
    showToast(
      status === "none" ? "已清除跟进状态" : `已设为「${FOLLOW_UP_STATUS_LABELS[status]}」`,
    );
  }

  function handleCompare() {
    const next = !localInCompare;
    setLocalInCompare(next);
    onCompareClick?.();
    showToast(next ? "已加入对比" : "已移出对比");
  }

  async function handleShare() {
    const result = await shareOrCopy({
      title: title,
      text: `${departmentName}发布：${title}`,
      url: url,
      onCopySuccess: () => showToast("链接已复制到剪贴板"),
      onCopyError: () => showToast("复制失败，请手动复制链接"),
    });
    if (result === "share") {
      // 原生分享成功，无需额外提示
    }
  }

  function buildNoteMarkdown(): string {
    const lines: string[] = [];
    lines.push(`# ${title}`);
    lines.push("");
    lines.push(`- **来源**：${departmentName} · ${channelName}`);
    lines.push(`- **日期**：${listPublishedAt}`);
    lines.push(`- **链接**：${url}`);
    lines.push("");
    lines.push("## 个人笔记");
    lines.push("");
    lines.push("> 在此记录您的思考和重点...");
    lines.push("");
    lines.push("## 核心要点");
    lines.push("");
    lines.push("- ");
    lines.push("");
    lines.push("## 行动事项");
    lines.push("");
    lines.push("- [ ] ");
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## 政策原文");
    lines.push("");
    if (paragraphs && paragraphs.length > 0) {
      for (const p of paragraphs) {
        lines.push(p);
        lines.push("");
      }
    } else {
      lines.push("（暂无正文）");
    }
    return lines.join("\n");
  }

  function buildPlainText(): string {
    const lines: string[] = [];
    lines.push(`标题：${title}`);
    if (pageTitle && pageTitle !== title) lines.push(`页面标题：${pageTitle}`);
    lines.push(`来源：${departmentName} · ${channelName}`);
    if (listPublishedAt) lines.push(`列表日期：${listPublishedAt}`);
    if (url) {
      lines.push(`原文链接：${url}`);
    }
    lines.push("");
    if (!paragraphs || paragraphs.length === 0) {
      lines.push("（当前未抓取到正文。）");
    } else {
      for (const p of paragraphs) lines.push(p);
    }
    return lines.join("\n");
  }

  function buildWordHtml(): string {
    const escape = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const headerRows: string[] = [];
    headerRows.push(`<p><strong>${escape(title)}</strong></p>`);
    if (pageTitle && pageTitle !== title) {
      headerRows.push(`<p style="color:#555;font-size:11pt;">页面标题：${escape(pageTitle)}</p>`);
    }
    headerRows.push(
      `<p style="color:#666;font-size:11pt;">来源：${escape(departmentName)} · ${escape(channelName)}${
        listPublishedAt ? `｜列表日期：${escape(listPublishedAt)}` : ""
      }</p>`,
    );
    if (url) {
      headerRows.push(
        `<p style="color:#666;font-size:11pt;">原文链接：<a href="${escape(url)}">${escape(url)}</a></p>`,
      );
    }
    headerRows.push('<hr style="border:none;border-top:1px solid #ccc;margin:12px 0;" />');

    let bodyHtml = "";
    if (!paragraphs || paragraphs.length === 0) {
      bodyHtml = `<p>（暂无正文）</p>`;
    } else {
      bodyHtml = paragraphs
        .map((p) => `<p style="line-height:1.7;text-indent:2em;">${escape(p || "")}</p>`)
        .join("\n");
    }

    return `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <title>${escape(title)}</title>
    <xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
      </w:WordDocument>
    </xml>
    <style>
      @page { size: A4; margin: 2cm; }
      body { font-family: "Microsoft YaHei", "SimSun", Arial, sans-serif; font-size: 12pt; color: #222; }
      p { margin: 6pt 0; }
      strong { font-size: 18pt; }
    </style>
  </head>
  <body>${headerRows.join("\n")}\n${bodyHtml}</body>
</html>`.trim();
  }

  function sanitizeFilename(base: string): string {
    const safe = base.replace(/[\\/:*?"<>|\t\n\r\s]+/g, "_").replace(/^_+|_+$/g, "");
    return safe.slice(0, 80) || "policy";
  }

  async function handleCopyFullText() {
    const text = buildPlainText();
    await copyToClipboard(text, {
      onSuccess: () => showToast("已复制全文"),
      onError: () => showToast("复制失败"),
    });
    setShowExportMenu(false);
  }

  function handleExportWord() {
    const html = buildWordHtml();
    const datePart = (listPublishedAt || "").replace(/[^\d]/g, "").slice(0, 8);
    const name = [title, datePart].filter(Boolean).join("_");
    const filename = `${sanitizeFilename(name)}.doc`;

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + html], { type: "application/msword;charset=utf-8" });

    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlObj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(urlObj), 5000);
    showToast("已开始导出 Word");
    setShowExportMenu(false);
  }

  function handleExportNote() {
    const md = buildNoteMarkdown();
    const datePart = listPublishedAt ? listPublishedAt.replace(/[^\d]/g, "").slice(0, 8) : "";
    const safeTitle = title.replace(/[\\/:*?"<>|\t\n\r\s]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
    const filename = `${safeTitle || "policy"}_${datePart || ""}_笔记.md`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlObj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(urlObj), 5000);
    showToast("笔记模板已导出");
    setShowExportMenu(false);
  }

  return (
    <div className="sticky top-4 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm backdrop-blur-md">
      <button
        type="button"
        onClick={handleStarred}
        disabled={isPending}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition disabled:opacity-60 ${
          isStarred
            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        <span>{isStarred ? "★" : "☆"}</span>
        <span className="hidden sm:inline">{isStarred ? "已收藏" : "收藏"}</span>
      </button>

      <button
        type="button"
        onClick={handleCompare}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition ${
          localInCompare
            ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        <span>⇄</span>
        <span className="hidden sm:inline">{localInCompare ? "对比中" : "加入对比"}</span>
      </button>

      {localInCompare && (
        <a
          href="/compare"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-sm font-medium text-white transition hover:bg-violet-700"
        >
          <span>→</span>
          <span className="hidden sm:inline">去对比</span>
        </a>
      )}

      <button
        type="button"
        onClick={handleRead}
        disabled={isPending}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition disabled:opacity-60 ${
          isRead
            ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        <span>✓</span>
        <span className="hidden sm:inline">{isRead ? "已读" : "标已读"}</span>
      </button>

      <button
        type="button"
        onClick={handleShare}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        <span>↗</span>
        <span className="hidden sm:inline">分享</span>
      </button>

      {/* 跟进状态 */}
      <div className="relative">
        <button
          type="button"
          onClick={handleStatusClick}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition ${
            followUpStatus !== "none"
              ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {followUpStatus !== "none" ? <StatusIcon status={followUpStatus} className="h-4 w-4" /> : <Tag className="h-4 w-4" aria-hidden />}
          <span className="hidden sm:inline">
            {followUpStatus !== "none" ? FOLLOW_UP_STATUS_LABELS[followUpStatus] : "跟进"}
          </span>
          <span className="text-[10px]">▾</span>
        </button>

        {showStatusMenu && (
          <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {FOLLOW_UP_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleStatusSelect(opt.value)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                  followUpStatus === opt.value ? "bg-slate-50 text-slate-900" : "text-slate-700"
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
        )}
      </div>

      {/* 备注按钮 */}
      <button
        type="button"
        onClick={handleNoteClick}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition ${
          note
            ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        <NotebookPen className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{note ? "已写备注" : "备注"}</span>
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <span>↓</span>
          <span className="hidden sm:inline">导出</span>
          <span className="text-[10px]">▾</span>
        </button>

        {showExportMenu && (
          <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={handleCopyFullText}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <ClipboardList className="h-4 w-4" aria-hidden />
              <span>复制全文</span>
            </button>
            <button
              type="button"
              onClick={handleExportWord}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" aria-hidden />
              <span>导出 Word</span>
            </button>
            <div className="mx-2 my-1 h-px bg-slate-100" />
            <button
              type="button"
              onClick={handleExportNote}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <NotebookPen className="h-4 w-4" aria-hidden />
              <span>导出笔记模板</span>
            </button>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="hidden text-xs text-slate-400 sm:inline">
          {sourceId.slice(0, 20)}
        </span>
      </div>

      {/* 备注编辑器 */}
      {showNoteEditor && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">个人备注</div>
            <div className="text-xs text-slate-400">仅保存在本地</div>
          </div>
          <textarea
            ref={noteTextareaRef}
            value={note}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="记录你的想法、重点、行动事项..."
            className="h-28 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNoteEditor(false)}
              className="inline-flex h-8 items-center rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleNoteSave}
              className="inline-flex h-8 items-center rounded-lg bg-slate-900 px-3 text-sm text-white hover:bg-slate-800"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
