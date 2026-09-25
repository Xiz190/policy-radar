"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Bot, ClipboardList, Download, FileText, FolderOpen, Lightbulb, MessageCircle, MessageSquare, Paperclip, Rocket, Ruler, ShoppingCart, Target, Trash2,
} from "lucide-react";
import { ChatEngine, SearchResult, SignalAnalysisResult } from "@/lib/chatbot/chat-engine";
import { parseFile, ParsedResult } from "@/lib/chatbot/file-parser";
import { usePrefs } from "@/contexts/prefs-context";

interface TextMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text";
  data?: undefined;
  timestamp: number;
}

interface ResultsMessage {
  id: string;
  role: "assistant";
  content: string;
  type: "results";
  data: SearchResult;
  timestamp: number;
}

interface ParsedMessage {
  id: string;
  role: "assistant";
  content: string;
  type: "parsed";
  data: ParsedResult;
  timestamp: number;
}

interface AnalysisMessage {
  id: string;
  role: "assistant";
  content: string;
  type: "analysis";
  data: SignalAnalysisResult;
  timestamp: number;
}

type Message = TextMessage | ResultsMessage | ParsedMessage | AnalysisMessage;

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

type SizeMode = "small" | "medium" | "large";

const SIZE_PRESETS: Record<SizeMode, { width: number; height: number; label: string }> = {
  small: { width: 360, height: 520, label: "小" },
  medium: { width: 460, height: 680, label: "中" },
  large: { width: 820, height: 760, label: "大" },
};

const STORAGE_KEY = "policy-chatbot-state-v1";
const DEFAULT_CONV_ID = "conv-default-static";
const WELCOME_MSG_ID = "msg-welcome-static";
const STATIC_TIMESTAMP = 0;

const SUGGESTED_QUESTIONS = [
  "最近有什么资金政策？",
  "搜索先进制造业相关政策",
  "有哪些试点示范项目？",
  "分析京津冀协同发展政策",
  "标准规范有哪些新动态？",
];

// ============ 状态持久化 ============
interface PersistedState {
  conversations: Conversation[];
  activeConversationId: string;
  sizeMode: SizeMode;
  position: { left: number; top: number } | null;
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.conversations && parsed.conversations.length > 0) {
        return {
          conversations: parsed.conversations,
          activeConversationId: parsed.activeConversationId || parsed.conversations[0].id,
          sizeMode: parsed.sizeMode || "medium",
          position: parsed.position || null,
        };
      }
    }
  } catch {
    // ignore
  }

  const newConv: Conversation = {
    id: DEFAULT_CONV_ID,
    title: "新对话",
    messages: [welcomeMessage()],
    createdAt: STATIC_TIMESTAMP,
    updatedAt: STATIC_TIMESTAMP,
  };
  return {
    conversations: [newConv],
    activeConversationId: newConv.id,
    sizeMode: "medium",
    position: null,
  };
}

function welcomeMessage(): Message {
  return {
    id: WELCOME_MSG_ID,
    role: "assistant",
    content:
      "你好！我是你的政策分析助手 \n\n我可以帮你：\n• 搜索站内政策文章\n• 解析上传的 PDF/Word/图片文件\n• 分析政策信号（资金/采购/试点/标准）\n• 提供结构化的分析结果\n\n请输入你的问题，或者上传文件开始分析！",
    type: "text",
    timestamp: STATIC_TIMESTAMP,
  };
}

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function createConversation(index: number): Conversation {
  return {
    id: `conv-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: `对话 ${index}`,
    messages: [welcomeMessage()],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function formatTitleFromFirstMessage(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > 20 ? clean.slice(0, 20) + "…" : clean || "新对话";
}

export function ChatbotWidget() {
  const { language } = usePrefs();
  const [isOpen, setIsOpen] = useState(false);
  const loadedState = useMemo(() => loadState(), []);
  const [conversations, setConversations] = useState<Conversation[]>(loadedState.conversations);
  const [activeConversationId, setActiveConversationId] = useState<string>(loadedState.activeConversationId);
  const [sizeMode, setSizeMode] = useState<SizeMode>(loadedState.sizeMode);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(loadedState.position);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const dragStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEngine = useRef(new ChatEngine());

  const defaultConv: Conversation = {
    id: DEFAULT_CONV_ID,
    title: "新对话",
    messages: [welcomeMessage()],
    createdAt: STATIC_TIMESTAMP,
    updatedAt: STATIC_TIMESTAMP,
  };
  const activeConv = conversations.find((c) => c.id === activeConversationId) || conversations[0] || defaultConv;
  const messages = activeConv?.messages || [];

  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isOpen]);

  // 每次状态变更时保存到 localStorage
  useEffect(() => {
    saveState({
      conversations,
      activeConversationId,
      sizeMode,
      position,
    });
  }, [conversations, activeConversationId, sizeMode, position]);

  // ============ 对话管理操作 ============
  function updateActiveConversation(updater: (conv: Conversation) => Conversation) {
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversationId ? { ...updater(c), updatedAt: Date.now() } : c))
    );
  }

  function handleNewConversation() {
    const newConv = createConversation(conversations.length + 1);
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setShowSidebar(false);
  }

  function handleSwitchConversation(id: string) {
    setActiveConversationId(id);
    setShowSidebar(false);
  }

  function handleDeleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (conversations.length <= 1) {
      // 只剩一个时，新建一个替换它
      const newConv = createConversation(1);
      setConversations([newConv]);
      setActiveConversationId(newConv.id);
      return;
    }
    const newList = conversations.filter((c) => c.id !== id);
    setConversations(newList);
    if (id === activeConversationId) {
      setActiveConversationId(newList[0].id);
    }
  }

  function handleClearAll() {
    if (!confirm("确定要清空所有对话历史吗？此操作不可撤销。")) return;
    const newConv = createConversation(1);
    setConversations([newConv]);
    setActiveConversationId(newConv.id);
    setShowSidebar(false);
  }

  // ============ 发送消息/搜索 ============
  function addMessage(msg: Omit<Message, "id" | "timestamp">) {
    const newMsg = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    } as Message;
    updateActiveConversation((conv) => {
      const newMessages = [...conv.messages, newMsg];
      // 如果这是第一条用户消息，用它做对话标题
      let newTitle = conv.title;
      if (msg.role === "user" && conv.messages.length <= 1) {
        newTitle = formatTitleFromFirstMessage(msg.content);
      }
      return { ...conv, messages: newMessages, title: newTitle };
    });
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    addMessage({ role: "user", content: text, type: "text" });
    setIsLoading(true);

    try {
      // 第 1 步：多文档检索（TF 打分 + 段落级命中）
      const result = await chatEngine.current.searchAndAnalyze(text);

      if (result.items.length === 0) {
        addMessage({
          role: "assistant",
          content: ` 我在数据库中搜索了「${text}」，但暂时没有找到完全匹配的政策文章。\n\n建议：\n• 试试更简单的关键词，如「资金」「试点」「标准」\n• 查看下方快捷提问按钮\n• 或者上传 PDF/Word 文件让我分析`,
          type: "text",
        });
      } else {
        // 先展示"找到 N 条"的文档卡片（用户可以立即看到原文线索）
        addMessage({
          role: "assistant",
          content: ` 已找到 ${result.items.length} 条与「${text}」相关的政策内容，以下是最相关的文档：`,
          type: "results",
          data: result,
        });

        // 第 2 步：把这些 items 作为上下文，调用 RAG 生成自然语言回答
        const answer = await chatEngine.current.askAnswer(text, result.items, language);

        const tag =
          answer.source === "llm"
            ? " 由大模型基于检索结果生成"
            : " 规则引擎（未配置 LLM 或调用失败）";
        const hint = answer.error ? `\n 备注：${answer.error}` : "";

        addMessage({
          role: "assistant",
          content: `${tag}\n\n${answer.answer}${hint}`,
          type: "text",
        });
      }
    } catch (error) {
      addMessage({
        role: "assistant",
        content: ` 抱歉，搜索出错了：${(error as Error).message}\n\n请稍后再试。`,
        type: "text",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ============ 文件上传（含 .doc 提前检测） ============
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 提前检测旧格式文件
      if (file.name.toLowerCase().endsWith(".doc")) {
        const proceed = window.confirm(
          ` 文件 "${file.name}" 是旧式 Word 格式 (.doc)。\n\n` +
          `当前仅支持现代 Word 格式 (.docx)。\n\n` +
          `建议转换方法：\n` +
          `  1) 在 Word/WPS 中「另存为」→ 选择 .docx\n` +
          `  2) 或使用 Google Docs 在线转换\n\n` +
          `是否仍然上传该文件以查看完整提示？`
        );
        if (!proceed) continue;
      }

      addMessage({
        role: "user",
        content: ` 上传文件：${file.name} (${formatFileSize(file.size)})`,
        type: "text",
      });
      setIsLoading(true);

      try {
        const result = await parseFile(file);
        addMessage({
          role: "assistant",
          content: generateFileResult(file, result),
          type: "parsed",
          data: result,
        });

        if (result.text && result.text.length > 50) {
          const analysis = chatEngine.current.analyzeContent(file.name, result.text);
          if (analysis.hasAnySignal) {
            addMessage({
              role: "assistant",
              content: generateAnalysisResponse(file.name, analysis),
              type: "analysis",
              data: analysis,
            });
          }
        }
      } catch (error) {
        addMessage({
          role: "assistant",
          content: ` 文件解析失败：${(error as Error).message}`,
          type: "text",
        });
      } finally {
        setIsLoading(false);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSuggestion(question: string) {
    setInput(question);
  }

  // ============ 拖动/大小切换 ============
  function handleDragStart(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).closest(".chatbot-container")?.getBoundingClientRect();
    if (rect) {
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        left: rect.left,
        top: rect.top,
      };
      setIsDragging(true);
    }
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragStart.current) return;
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;
      setPosition({
        left: Math.max(0, dragStart.current.left + deltaX),
        top: Math.max(0, dragStart.current.top + deltaY),
      });
    }

    function handleMouseUp() {
      dragStart.current = null;
      setIsDragging(false);
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  function cycleSize() {
    const modes: SizeMode[] = ["small", "medium", "large"];
    const currentIdx = modes.indexOf(sizeMode);
    setSizeMode(modes[(currentIdx + 1) % modes.length]);
  }

  function handleResetPosition() {
    setPosition(null);
  }

  const { width, height } = SIZE_PRESETS[sizeMode];
  const currentSizeLabel = SIZE_PRESETS[sizeMode].label;

  // 动态样式：根据是否被拖动过位置决定定位方式
  const chatContainerStyle: React.CSSProperties = position
    ? { position: "fixed", left: `${position.left}px`, top: `${position.top}px`, width: `${width}px`, height: `${height}px` }
    : { width: `${width}px`, height: `${height}px` };

  return (
    <>
      {/* 浮动按钮（右下角） */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/25 transition hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-0.5 sm:bottom-6 ${
          isOpen ? "opacity-0 pointer-events-none" : ""
        }`}
      >
        <MessageCircle className="h-4 w-4" />
        <span>政策助手</span>
      </button>

      {/* 底部占位：防止页面内容被浮动按钮遮挡 */}
      <div className="h-20" aria-hidden="true" />

      {/* 聊天窗口 - 支持拖动移动 */}
      {isOpen ? (
        <div
          className={`chatbot-container ${position ? "" : "fixed bottom-6 right-6"} z-50 flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ${isDragging ? "cursor-grabbing" : ""}`}
          style={chatContainerStyle}
        >
          {/* 头部（可拖动移动 + 对话管理） */}
          <div
            onMouseDown={handleDragStart}
            className="flex cursor-grab items-center justify-between bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2.5 text-white active:cursor-grabbing"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg">
                <Bot className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{activeConv?.title || "政策分析助手"}</div>
                <div className="text-xs text-amber-50">{conversations.length} 条对话 · 拖动头部移动</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* 对话列表切换按钮 */}
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                title="查看/管理对话历史"
                className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition ${showSidebar ? "bg-white text-amber-600" : "bg-white/20 hover:bg-white/30"}`}
              >
                <FolderOpen className="mr-1 inline h-3.5 w-3.5" aria-hidden />{conversations.length}
              </button>
              {/* 新建对话 */}
              <button
                onClick={handleNewConversation}
                title="新建对话"
                className="rounded-full bg-white/20 px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/30"
              >
                ＋
              </button>
              {/* 重置位置 */}
              {position ? (
                <button
                  onClick={handleResetPosition}
                  title="回到右下角"
                  className="rounded-full bg-white/20 px-2 py-1.5 text-xs font-medium transition hover:bg-white/30"
                >
                  ↺
                </button>
              ) : null}
              {/* 大小切换 */}
              <button
                onClick={cycleSize}
                title={`当前：${currentSizeLabel} - 点击切换尺寸`}
                className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/30"
              >
                <span>尺寸</span>
                <span className="font-bold">{currentSizeLabel}</span>
                <span>⇄</span>
              </button>
              {/* 关闭 */}
              <button
                onClick={() => setIsOpen(false)}
                title="关闭（历史会保留）"
                className="rounded-full p-1.5 transition hover:bg-white/20"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 对话历史侧边栏（可展开/收起） */}
          {showSidebar ? (
            <div className="border-b border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><FolderOpen className="h-3.5 w-3.5" aria-hidden />对话历史</div>
                <div className="flex gap-1">
                  <button
                    onClick={handleNewConversation}
                    className="rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-white transition hover:bg-amber-600"
                  >
                    ＋ 新建
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="rounded-full border border-rose-300 px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />清空全部
                  </button>
                </div>
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {conversations.map((conv) => {
                  const firstUserMsg = conv.messages.find((m) => m.role === "user");
                  const preview = firstUserMsg ? firstUserMsg.content.slice(0, 30).replace(/\n/g, " ") : conv.title;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSwitchConversation(conv.id)}
                      className={`group flex cursor-pointer items-start gap-2 rounded-xl p-2 text-left transition ${
                        conv.id === activeConversationId
                          ? "bg-amber-100 ring-1 ring-amber-300"
                          : "bg-white hover:bg-amber-50 ring-1 ring-slate-100"
                      }`}
                    >
                      <div className="shrink-0 text-base">
                        {conv.id === activeConversationId
                          ? <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                          : <FileText className="h-3.5 w-3.5" aria-hidden />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-800">
                          {conv.title}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {preview || "空对话"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {(() => {
                            const parts = new Intl.DateTimeFormat("en-CA", {
                              timeZone: "Asia/Shanghai",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            }).formatToParts(new Date(conv.updatedAt));
                            const m = parts.find((p) => p.type === "month")?.value ?? "00";
                            const d = parts.find((p) => p.type === "day")?.value ?? "00";
                            const h = parts.find((p) => p.type === "hour")?.value ?? "00";
                            const min = parts.find((p) => p.type === "minute")?.value ?? "00";
                            return `${m}/${d} ${h}:${min}`;
                          })()}{" "}
                          · {conv.messages.length} 条
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs text-slate-400 opacity-0 transition hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100"
                        title="删除此对话"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`mb-4 ${msg.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <div className="whitespace-pre-wrap text-left">{msg.content}</div>
                </div>

                {/* 搜索结果展示 */}
                {msg.type === "results" && msg.data?.items?.length > 0 ? (
                  <div className="mt-3 space-y-2 text-left">
                    {msg.data.items.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="font-medium text-slate-800">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.departmentName} · {item.channelName}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.signals?.map((s, i) => (
                            <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                              {s}
                            </span>
                          ))}
                        </div>
                        {item.url?.startsWith("http") ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-xs text-sky-600 hover:underline"
                          >
                            打开原文 →
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* 文件解析结果 */}
                {msg.type === "parsed" && msg.data ? (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 text-left text-xs leading-5 text-slate-700">
                    <div className="flex items-center gap-1.5 font-medium text-emerald-800"><ClipboardList className="h-4 w-4" aria-hidden />文件信息</div>
                    <div className="mt-2 space-y-1">
                      <div>文件类型：{msg.data.fileType}</div>
                      <div>提取文字：{msg.data.text?.length || 0} 字</div>
                    </div>
                    {msg.data.text?.length > 0 ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                          查看提取的文字内容
                        </summary>
                        <div className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-white p-2 text-xs leading-5 text-slate-600">
                          {msg.data.text.slice(0, 1000)}
                          {msg.data.text.length > 1000 ? "……" : ""}
                        </div>
                      </details>
                    ) : null}
                    {msg.data.text?.length > 0 ? (
                      <button
                        onClick={() => {
                          const blob = new Blob([msg.data.text], { type: "text/plain;charset=utf-8" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${msg.data.fileName || "extracted-text"}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="mt-2 w-full rounded-full bg-emerald-600 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
                      >
                        <Download className="mr-1 inline h-3.5 w-3.5" aria-hidden />导出文字内容
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {/* 信号分析结果 */}
                {msg.type === "analysis" && msg.data ? (
                  <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-3 text-left text-xs leading-5 text-slate-700">
                    <div className="flex items-center gap-1.5 font-medium text-violet-800"><Target className="h-4 w-4" aria-hidden />信号分析结果</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className={`rounded-xl p-2 text-center ${msg.data.hasFunding ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                        <Lightbulb className="mr-1 inline h-3.5 w-3.5" aria-hidden />资金信号 {msg.data.hasFunding ? "✓" : "—"}
                      </div>
                      <div className={`rounded-xl p-2 text-center ${msg.data.hasProcurement ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                        <ShoppingCart className="mr-1 inline h-3.5 w-3.5" aria-hidden />采购机会 {msg.data.hasProcurement ? "✓" : "—"}
                      </div>
                      <div className={`rounded-xl p-2 text-center ${msg.data.hasPilot ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                        <Rocket className="mr-1 inline h-3.5 w-3.5" aria-hidden />试点示范 {msg.data.hasPilot ? "✓" : "—"}
                      </div>
                      <div className={`rounded-xl p-2 text-center ${msg.data.hasStandards ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}>
                        <Ruler className="mr-1 inline h-3.5 w-3.5" aria-hidden />标准规范 {msg.data.hasStandards ? "✓" : "—"}
                      </div>
                    </div>
                    {msg.data.matchedKeywords?.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.data.matchedKeywords.map((k, i) => (
                          <span key={i} className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
                            {k}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}

            {isLoading ? (
              <div className="mb-4">
                <div className="inline-block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  <span className="inline-block animate-pulse">正在分析...</span>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          {/* 快捷提问 - 只在对话开始阶段显示 */}
          {messages.length <= 2 ? (
            <div className="border-t border-slate-200 bg-white px-4 py-2">
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestion(q)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* 输入区域 */}
          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                title="上传文件（PDF/Word/图片）"
              >
                <Paperclip className="h-4 w-4" aria-hidden />
              </button>
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="输入你的问题，或上传文件..."
                  rows={1}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  style={{ minHeight: "42px", maxHeight: "120px" }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                发送
              </button>
            </div>
            <div className="mt-2 text-center text-xs text-slate-400">
              <Lightbulb className="mr-1 inline h-3.5 w-3.5" aria-hidden />对话历史自动保存 · 支持 PDF/Word/图片 · Enter 发送
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ============= 工具函数 =============

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function generateFileResult(file: File, result: ParsedResult): string {
  const lines: string[] = [];
  lines.push(` 文件解析完成！`);
  lines.push("");
  lines.push(` 文件名：${file.name}`);
  lines.push(` 文件类型：${result.fileType}`);
  if (result.pageCount) lines.push(` 页数：${result.pageCount}`);
  if (result.imageCount) lines.push(`图片数：${result.imageCount}`);
  if (result.text) lines.push(` 提取文字：${result.text.length} 字`);
  lines.push("");
  if (result.text && result.text.length > 0) {
    lines.push(" 提示：已自动识别政策信号，点击下方结果可查看分析。");
    lines.push(" 可以点击「导出文字内容」按钮保存为 txt 文件。");
  } else {
    lines.push(" 未能从该文件中提取文字内容。");
  }
  return lines.join("\n");
}

function generateAnalysisResponse(fileName: string, analysis: SignalAnalysisResult): string {
  const lines: string[] = [];
  lines.push(` 信号分析完成：${fileName}`);
  lines.push("");
  if (analysis.summary) lines.push(` ${analysis.summary}`);
  lines.push("");
  if (analysis.hasAnySignal) {
    lines.push("检测到以下政策信号：");
    if (analysis.hasFunding) lines.push("• 资金支持：检测到资金、补贴、专项资金等关键词");
    if (analysis.hasProcurement) lines.push("• 采购机会：检测到采购、招标、购买等关键词");
    if (analysis.hasPilot) lines.push("• 试点示范：检测到试点、示范、创新等关键词");
    if (analysis.hasStandards) lines.push("• 标准规范：检测到标准、规范、征求意见等关键词");
    lines.push("");
    lines.push("匹配的关键词：" + (analysis.matchedKeywords?.slice(0, 10).join("、") || "—"));
  } else {
    lines.push(" 未检测到明显的政策信号。");
    lines.push("该文件可能是普通文档，或内容不包含政策相关关键词。");
  }
  return lines.join("\n");
}
