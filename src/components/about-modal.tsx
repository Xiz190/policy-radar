"use client";

import { useEffect, useRef, useState } from "react";
import {
  Accessibility, Globe, RadioTower, Search,
} from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const STACK = [
  { label: "框架", value: "Next.js 16 · React 19 · TypeScript · Tailwind CSS v4" },
  { label: "数据库", value: "PostgreSQL；公开站是定时抓取后的只读快照" },
  { label: "抓取", value: "自己写的抓取器（5 种页面类型），GitHub Actions 每 12 小时跑一次" },
  { label: "信号提取", value: "规则抽取资金 / 采购 / 试点 / 标准等结构化字段，不依赖大模型" },
  { label: "优先级", value: "关键词得分 × 命中的信号类型 × 发布日期" },
];

const SOURCES = [
  { label: "国务院与部委", desc: "工信部、网信办、发改委、科技部、文旅部、国家数据局……" },
  { label: "北京市区两级", desc: "市政府、经信局、财政局、广播电视局，以及大兴、丰台等区级部门" },
  { label: "行业主管部门", desc: "版权局、各委办局的公告、通知与政策解读" },
];

const DECISIONS = [
  { icon: Search, title: "先分信号，再看资讯", desc: "自动识别强执行、强支持、风险预警、试点探索，每条按信号类型归类，重要的排在前面" },
  { icon: Globe, title: "结构化政策字段", desc: "资金、采购、试点、标准逐一抽取，判断一条政策的力度不用读完全文" },
  { icon: RadioTower, title: "来源健康检查", desc: "某个来源抓不到内容时，那次运行会在 Actions 里标红并发邮件提醒，不会悄悄变空" },
  { icon: Accessibility, title: "辅助功能", desc: "字号、深色模式、高对比度、减少动画，体现设计包容性意识" },
];

export function AboutModal({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sourceCount, setSourceCount] = useState<number | null>(null);

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

  // 来源数会随配置变化，不写死；打开展示时才去数
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/monitor/sources")
      .then((r) => r.json())
      .then((data: Array<{ enabled?: boolean }>) => {
        if (!cancelled && Array.isArray(data)) {
          setSourceCount(data.filter((s) => s.enabled).length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

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
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-base text-white" style={{ backgroundColor: "var(--brand)" }}>政</span>
              <div>
                <div className="text-base font-semibold text-slate-900">政策雷达</div>
                <div className="text-xs text-slate-500">Xingchen Zhou · 2026</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <span aria-hidden>✕</span>
              <span className="sr-only">关闭</span>
            </button>
          </div>

          <div className="space-y-6 px-6 py-5">
            <p className="text-sm leading-7 text-slate-600">
              面向公共政策的情报平台。监测国务院、各部委和北京市区两级部门，把每条内容归到强执行、强支持、风险预警、试点探索等信号类型，帮助政策研究者与从业者在信息噪音中抓住真正重要的内容。
            </p>

            <section>
              <h3 className="mb-3 text-xs font-semibold text-slate-500">技术栈</h3>
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
              <h3 className="mb-3 text-xs font-semibold text-slate-500">
                数据来源{sourceCount ? `（${sourceCount} 个启用来源）` : ""}
              </h3>
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
              <h3 className="mb-3 text-xs font-semibold text-slate-500">设计决策</h3>
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

            <p className="border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
              这是我研究生申请作品集里的一个案例。每条内容都来自真实机构公开页面，线上数据由 GitHub Actions 定时更新；收藏、待跟进和备注只存在你自己的浏览器里。
            </p>
          </div>
        </>
      )}
    </dialog>
  );
}
