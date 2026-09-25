"use client";

import { useEffect, useRef, useState } from "react";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ChatPanel");

type RoleInfo = { id: string; name: string; description: string };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ index: number; snippet: string }>;
};

const ROLES: RoleInfo[] = [
  { id: "", name: "通用视角", description: "不做角色过滤，仅基于文档内容回答" },
  { id: "policy_exec_tracker", name: "政策执行追踪者", description: "关注落实要求、责任分工与执行时间节点" },
  { id: "funding_researcher", name: "扶持资金研究者", description: "关注专项资金 / 补贴奖补 / 试点示范 / 项目申报" },
  { id: "compliance_researcher", name: "合规版权研究者", description: "关注版权 / 标准 / 管理办法与合规红线" },
  { id: "industry_trend_researcher", name: "行业趋势研究者", description: "关注规划、数据与文化产业的长期方向" },
];

// —— 轻量 markdown 渲染：仅支持 **粗体**、列表（- xxx）、> 引用、空行分段
// 避免引入 react-markdown 这类外部依赖，保持项目零依赖、构建快
function renderMarkdown(text: string): string[] {
  const lines = text.split("\n");
  const out: string[] = [];
  let inBlock = false; // 是否正在 list block 中（用于 <ul> 的开闭合）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      if (inBlock) { out.push("</ul>"); inBlock = false; }
      out.push("<br/>");
      continue;
    }
    if (/^[-*] /.test(trimmed)) {
      if (!inBlock) {
        out.push("<ul style='margin:0.25rem 0 0 1rem; padding:0; list-style:disc;'>");
        inBlock = true;
      }
      out.push("<li style='margin:0.15rem 0;'>" + inline(trimmed.replace(/^[-*] /, "")) + "</li>");
      continue;
    }
    if (trimmed.startsWith("> ")) {
      if (inBlock) { out.push("</ul>"); inBlock = false; }
      out.push(
        "<blockquote style='margin:0.4rem 0 0.2rem; padding:0.4rem 0.8rem; border-left:3px solid #cbd5e1; background:#f8fafc; color:#475569; font-size:0.82rem; line-height:1.6; border-radius:0.25rem;'>"
        + inline(trimmed.slice(2)) + "</blockquote>",
      );
      continue;
    }
    if (inBlock) { out.push("</ul>"); inBlock = false; }
    out.push("<div style='margin:0.15rem 0;'>" + inline(trimmed) + "</div>");
  }
  if (inBlock) out.push("</ul>");
  return out;
}

// 行内：**粗体**、`code`、普通文本；HTML 字符转义
function inline(s: string): string {
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code style='background:#f1f5f9; padding:1px 5px; border-radius:4px; font-size:0.82em; color:#334155;'>$1</code>");
}

function MarkdownContent({ text }: { text: string }) {
  const html = renderMarkdown(text).join("");
  return (
    <div
      style={{ fontSize: "0.875rem", color: "rgb(30 41 59)", lineHeight: 1.65 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const CHAT_SEND_TIMEOUT_MS = 30000;

export default function ChatPanel({ sourceId, url, title }: { sourceId: string; url: string; title: string }) {
  const [roleId, setRoleId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSendTimeRef = useRef<number>(0);
  const sendAbortControllerRef = useRef<AbortController | null>(null);
  const sendRequestIdRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    logger.debug(`初始化加载 sourceId=${sourceId}`);
    async function load() {
      setInitLoading(true);
      try {
        const sp = new URLSearchParams();
        sp.set("sourceId", sourceId);
        sp.set("url", url);
        const res = await fetch(`/api/monitor/chat?${sp.toString()}`, { signal: controller.signal });
        if (controller.signal.aborted) {
          return;
        }
        if (!res.ok) throw new Error("请求失败");
        const json = await res.json();
        if (controller.signal.aborted) {
          return;
        }
        if (json && json.message) {
          setMessages([json.message as ChatMessage]);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        if (controller.signal.aborted) return;
        logger.error(`初始化请求失败`, { error: (err as Error).message });
        setMessages([{
          id: "err-init",
          role: "assistant",
          content: "加载失败，请稍后再试。",
        }]);
      } finally {
        if (!controller.signal.aborted) setInitLoading(false);
      }
    }
    void load();
    return () => {
      /* debug removed */
      controller.abort();
    };
  }, [sourceId, url]);

  useEffect(() => {
    const controller = new AbortController();
    /* debug removed */
    async function load() {
      try {
        const res = await fetch(`/api/monitor/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId, url, question: "", roleId: roleId || undefined }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          /* debug removed */
          return;
        }
        if (!res.ok) throw new Error("请求失败");
        const json = await res.json();
        if (controller.signal.aborted) {
          /* debug removed */
          return;
        }
        if (json && json.message) {
          /* debug removed */
          setMessages([json.message as ChatMessage]);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          /* debug removed */
          return;
        }
        if (controller.signal.aborted) return;
        /* error removed */
      }
    }
    if (roleId) {
      void load();
    }
    return () => {
      /* debug removed */
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    const now = Date.now();
    if (now - lastSendTimeRef.current < 1000) return;
    lastSendTimeRef.current = now;

    sendRequestIdRef.current += 1;
    const myRequestId = sendRequestIdRef.current;
    /* debug removed */

    if (sendAbortControllerRef.current) {
      /* debug removed */
      sendAbortControllerRef.current.abort();
    }
    const myController = new AbortController();
    sendAbortControllerRef.current = myController;

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const contextSummary = lastAssistant
      ? `上一轮摘要：${lastAssistant.content.slice(0, 300)}${lastAssistant.citations && lastAssistant.citations.length > 0 ? ";引用段落关键词：" + lastAssistant.citations.map((c) => c.snippet.slice(0, 40)).join(" / ") : ""}`
      : undefined;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: q,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const timeoutTimer = setTimeout(() => {
      /* debug removed */
      myController.abort();
    }, CHAT_SEND_TIMEOUT_MS);

    try {
      const res = await fetch(`/api/monitor/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceId,
          url,
          question: q,
          roleId: roleId || undefined,
          contextSummary,
        }),
        signal: myController.signal,
      });
      if (myController.signal.aborted) {
        /* debug removed */
        return;
      }
      if (!res.ok) throw new Error(`请求失败 ${res.status}`);
      const json = await res.json();
      if (myController.signal.aborted) {
        /* debug removed */
        return;
      }
      if (myRequestId !== sendRequestIdRef.current) {
        /* debug removed */
        return;
      }
      if (json && json.message) {
        /* debug removed */
        setMessages((prev) => [...prev, json.message as ChatMessage]);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        /* debug removed */
        return;
      }
      if (myRequestId !== sendRequestIdRef.current) {
        /* debug removed */
        return;
      }
      /* error removed */
      setMessages((prev) => [...prev, {
        id: `e_${Date.now()}`,
        role: "assistant",
        content: "回答失败，请稍后重试。",
      }]);
    } finally {
      clearTimeout(timeoutTimer);
      if (myRequestId === sendRequestIdRef.current) {
        setLoading(false);
        if (sendAbortControllerRef.current === myController) {
          sendAbortControllerRef.current = null;
        }
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (loading || !input.trim()) {
        // loading 中或空内容：阻止默认提交但不发送
        e.preventDefault();
        return;
      }
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex h-[640px] flex-col rounded-3xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">文档问答</h3>
          <span className="text-xs text-slate-500">基于关键词命中与正文段落（规则实现）</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">视角：</span>
          {ROLES.map((r) => {
            const active = roleId === "" ? r.id === "" : roleId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoleId(r.id)}
                title={r.description}
                className={
                  "rounded-full border px-3 py-1 text-xs transition " +
                  (active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50")
                }
              >
                {r.name}
              </button>
            );
          })}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-4"
      >
        {initLoading ? (
          <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">正在准备中…</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm " +
                  (m.role === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-800 ring-1 ring-slate-200")
                }
              >
                <MarkdownContent text={m.content} />
                {m.citations && m.citations.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <div className="font-medium text-slate-700">引用段落（点击跳转正文）：</div>
                    {m.citations.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("chat:jump-paragraph", {
                                detail: { index: c.index },
                              }),
                            );
                          }
                        }}
                        className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-2 text-left text-[11px] text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50"
                      >
                        <span className="mr-2 text-indigo-500">#{c.index}</span>
                        {c.snippet}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
        {loading ? (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
              正在检索并组织答案…
            </div>
          </div>
        ) : null}
      </div>

      <footer className="flex gap-2 border-t border-slate-100 px-4 py-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`关于《${title.length > 40 ? title.slice(0, 40) + "…" : title}》你想问什么？（Enter 发送，Shift+Enter 换行）`}
          rows={2}
          className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none ring-0 focus:border-slate-500"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading || !input.trim()}
          className="shrink-0 self-end rounded-2xl bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-not-allowed"
        >
          发送
        </button>
      </footer>
    </div>
  );
}
