"use client";

import { useState, useRef } from "react";
import { copyToClipboard } from "@/lib/clipboard";

type ItemContentExportProps = {
  title: string;
  departmentName: string;
  channelName: string;
  listPublishedAt: string | null;
  pageTitle?: string | null;
  paragraphs: string[];
  sourceUrl: string;
};

/**
 * 内容导出与复制工具：
 *  - 「一键复制全文」：拼接标题/来源/日期/正文后写入剪贴板。
 *  - 「导出 Word」：生成 Word 可直接打开的 HTML 文档（.doc），
 *    并以 "标题 + 日期" 作为文件名，方便归档。
 */
export function ItemContentExport({
  title,
  departmentName,
  channelName,
  listPublishedAt,
  pageTitle,
  paragraphs,
  sourceUrl,
}: ItemContentExportProps) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCopyTimeRef = useRef<number>(0);
  const lastExportTimeRef = useRef<number>(0);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  function buildPlainText(): string {
    const lines: string[] = [];
    lines.push(`标题：${title}`);
    if (pageTitle && pageTitle !== title) lines.push(`页面标题：${pageTitle}`);
    lines.push(`来源：${departmentName} · ${channelName}`);
    if (listPublishedAt) lines.push(`列表日期：${listPublishedAt}`);
    if (sourceUrl) {
      lines.push(`原文链接：${sourceUrl}`);
    }
    lines.push("");
    if (!paragraphs || paragraphs.length === 0) {
      lines.push("（当前未抓取到正文，请使用「重新抓取正文」按钮后再试。）");
    } else {
      for (const p of paragraphs) lines.push(p);
    }
    return lines.join("\n");
  }

  function buildHtml(): string {
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
    if (sourceUrl) {
      headerRows.push(
        `<p style="color:#666;font-size:11pt;">原文链接：<a href="${escape(sourceUrl)}">${escape(sourceUrl)}</a></p>`,
      );
    }
    headerRows.push('<hr style="border:none;border-top:1px solid #ccc;margin:12px 0;" />');

    let bodyHtml = "";
    if (!paragraphs || paragraphs.length === 0) {
      bodyHtml = `<p>（当前未抓取到正文，请先使用「重新抓取正文」。）</p>`;
    } else {
      bodyHtml = paragraphs
        .map((p) => `<p style="line-height:1.7;text-indent:2em;">${escape(p || "")}</p>`)
        .join("\n");
    }

    // Word 2000+ 可以直接打开后缀为 .doc 的 HTML。
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
    // 只保留中英数字 / 下划线 / 连字符；去除 Windows/macOS 非法字符。
    const safe = base.replace(/[\\/:*?"<>|\t\n\r\s]+/g, "_").replace(/^_+|_+$/g, "");
    return safe.slice(0, 80) || "policy";
  }

  async function handleCopy() {
    const now = Date.now();
    if (now - lastCopyTimeRef.current < 800) return;
    lastCopyTimeRef.current = now;
    const text = buildPlainText();
    await copyToClipboard(text, {
      onSuccess: () => showToast("已复制全文"),
      onError: () => showToast("复制失败，请手动选择后复制"),
    });
  }

  function handleExport() {
    const now = Date.now();
    if (now - lastExportTimeRef.current < 1000) return;
    lastExportTimeRef.current = now;
    const html = buildHtml();
    const datePart = (listPublishedAt || "").replace(/[^\d]/g, "").slice(0, 8);
    const name = [title, datePart].filter(Boolean).join("_");
    const filename = `${sanitizeFilename(name)}.doc`;

    // UTF-8 BOM + html；部分版本 Word 对 .doc/html 的 charset 检测需 BOM。
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + html], { type: "application/msword;charset=utf-8" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 稍后释放 object URL（给浏览器留出下载启动时间）
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast("已开始导出 Word");
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        一键复制全文
      </button>
      <button
        type="button"
        onClick={handleExport}
        className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        导出 Word
      </button>

      {toast ? (
        <div
          role="status"
          className="pointer-events-none absolute -top-10 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
