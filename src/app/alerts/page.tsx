"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

type AlertRule = {
  id: string;
  keyword: string;
  threshold: number;
  window: "day" | "week";
  enabled: boolean;
  createdAt: string;
};

const STORAGE_KEY = "inbox_alert_rules";

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [keyword, setKeyword] = useState("");
  const [threshold, setThreshold] = useState(3);
  const [window, setWindow] = useState<"day" | "week">("day");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRules(JSON.parse(raw));
    } catch {}
  }, []);

  function persist(next: AlertRule[]) {
    setRules(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  function addRule() {
    const kw = keyword.trim();
    if (!kw) { setMsg({ type: "error", text: "请输入关键词" }); setTimeout(() => setMsg(null), 2000); return; }
    if (rules.some((r) => r.keyword === kw && r.window === window)) {
      setMsg({ type: "error", text: "该关键词规则已存在" }); setTimeout(() => setMsg(null), 2000); return;
    }
    const rule: AlertRule = { id: newId(), keyword: kw, threshold, window, enabled: true, createdAt: new Date().toISOString() };
    persist([rule, ...rules]);
    setKeyword("");
    setMsg({ type: "success", text: "规则已保存" });
    setTimeout(() => setMsg(null), 2000);
  }

  function toggleRule(id: string) {
    persist(rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  function deleteRule(id: string) {
    persist(rules.filter((r) => r.id !== id));
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">

        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/settings/data" className="hover:text-slate-800">设置</Link>
            <span>/</span>
            <span>提醒规则</span>
          </div>
          <h1 className="mt-1 text-xl font-bold text-slate-900">自定义提醒规则</h1>
          <p className="mt-1 text-sm text-slate-500">
            设置关键词出现频率阈值，当条件满足时生成本地提醒。规则仅在本地运行。
          </p>
        </div>

        {/* Add Rule Form */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">添加新规则</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">关键词</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRule()}
                placeholder="例：AI 工具、申报、奖项"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">触发阈值（条数 ≥）</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">统计窗口</label>
                <div className="flex gap-2">
                  {(["day", "week"] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWindow(w)}
                      className={`flex-1 rounded-xl border py-2 text-sm transition ${window === w ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {w === "day" ? "每日" : "每周"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {msg && (
              <div className={`rounded-xl px-3 py-2 text-sm ${msg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                {msg.text}
              </div>
            )}
            <button
              type="button"
              onClick={addRule}
              className="w-full rounded-xl py-2.5 text-sm font-medium text-white transition"
              style={{ backgroundColor: "var(--brand)" }}
            >
              + 添加规则
            </button>
          </div>
        </div>

        {/* Rules List */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">已配置规则 ({rules.length})</h2>
          {rules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
              暂无规则 · 添加后当关键词命中频率超过阈值时会提示
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center gap-4 rounded-2xl border bg-white p-4 transition ${rule.enabled ? "border-slate-200" : "border-slate-100 opacity-60"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">「{rule.keyword}」</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        {rule.window === "day" ? "每日" : "每周"} ≥ {rule.threshold} 条
                      </span>
                      {rule.enabled ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-600">启用</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400">已停用</span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      创建于 {new Date(rule.createdAt).toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleRule(rule.id)}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                    >
                      {rule.enabled ? "停用" : "启用"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRule(rule.id)}
                      className="rounded-full border border-rose-100 px-2.5 py-1 text-[11px] text-rose-400 hover:bg-rose-50"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500">
          <p className="font-medium text-slate-600 mb-1">说明</p>
          <p>规则保存在浏览器本地（localStorage），不会上传到服务器。未来版本将对接实时数据流，实现真正的推送提醒。当前版本可手动到「全局搜索」核实关键词频率。</p>
        </div>
      </div>
    </main>
  );
}
