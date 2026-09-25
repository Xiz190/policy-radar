"use client";

import { useEffect, useRef } from "react";
import {
  Accessibility, Globe, RadioTower, Search,
} from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const STACK = [
  { label: "框架", value: "Next.js 15 App Router · TypeScript · Tailwind CSS v4" },
  { label: "数据库", value: "PostgreSQL（via Neon Serverless）" },
  { label: "AI 接口", value: "DeepSeek API（流式对话 · RAG · grounding guard）" },
  { label: "监测引擎", value: "自研抓取器（5 种页面类型 · RSS · HTML 列表）" },
  { label: "优先级算法", value: "关键词评分 × 信号类型 × 发布时效 三维加权" },
];

const SOURCES = [
  { label: "工业和信息化部", desc: "人工智能 · 算力 · 制造业数字化政策" },
  { label: "国家互联网信息办公室", desc: "生成式AI · 数据安全 · 数据出境" },
  { label: "国家发展和改革委员会", desc: "数字经济 · 算力网络 · 数据要素" },
  { label: "科学技术部", desc: "AI基础研究 · 科技伦理" },
  { label: "国家数据局", desc: "数据基础制度 · 数据要素市场化" },
];

const DECISIONS = [
  { icon: Search, title: "信号优先于资讯", desc: "区分[有机会/有风险]的高价值信号与普通动态，让创作者专注于真正重要的信息" },
  { icon: Globe, title: "中英双语界面", desc: "面向国际评委的 portfolio，i18n 从架构层支持，而不是后期补丁" },
  { icon: Accessibility, title: "辅助功能", desc: "字体大小 / 深色模式 / 高对比度 / 减少动画，体现设计包容性意识" },
  { icon: RadioTower, title: "可扩展信源架构", desc: "5 种信源类型可配置，批量 ping 检测可用性，运行历史可回溯" },
];

export function AboutModal({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      className="m-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm open:flex open:flex-col"
    >
      {open && (
        <>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-700 text-base text-white">创</span>
              <div>
                <div className="text-base font-semibold text-slate-900">政策雷达</div>
                <div className="text-xs text-slate-500">Policy Radar · Portfolio Project 2026</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6 px-6 py-5">
            <p className="text-sm leading-7 text-slate-600">
              面向公共政策的情报平台。监测各部委与地方政府主管部门，提取高价值政策信号（强执行 · 强支持 · 濒危预警 · 行业研究），帮助政策研究者与从业者在信息噪音中抓住真正重要的内容。
            </p>

            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">技术栈</h3>
              <div className="space-y-2">
                {STACK.map((item) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-2.5">
                    <span className="shrink-0 text-xs font-medium text-slate-500 w-20">{item.label}</span>
                    <span className="text-xs text-slate-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">数据来源（5 个机构）</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {SOURCES.map((s) => (
                  <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold text-slate-800">{s.label}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{s.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">设计决策</h3>
              <div className="space-y-2">
                {DECISIONS.map((d) => (
                  <div key={d.title} className="flex items-start gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                    <d.icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{d.title}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{d.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="rounded-2xl bg-violet-50 px-5 py-4 text-xs text-violet-700">
              <span className="font-semibold">Portfolio 说明：</span> 本项目为研究生申请作品集案例，演示数据来自真实机构公开信息，监测引擎在本地运行。技术栈选型考虑了扩展性与部署成本，AI 对话层可切换至任意兼容 OpenAI 协议的模型。
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}
