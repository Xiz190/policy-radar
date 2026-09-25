"use client";

import { useState } from "react";
import { LocalDataNotice } from "@/components/local-data-notice";
import {
  resetLocalDataNoticeDismissed,
} from "@/lib/local-data-notice";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

export default function LocalDataNoticeDemoPage() {
  const [bannerKey, setBannerKey] = useState(0);
  const [footerKey, setFooterKey] = useState(0);
  const [cardKey, setCardKey] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  };

  const resetAll = () => {
    resetLocalDataNoticeDismissed();
    setBannerKey((k) => k + 1);
    setFooterKey((k) => k + 1);
    setCardKey((k) => k + 1);
    addLog("已重置关闭状态");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              LocalDataNotice 组件演示
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              三种模式的效果预览与交互测试
            </p>
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            重置关闭状态
          </button>
        </div>

        <div className="space-y-6">
          <Section title="模式一：banner（顶部通栏）— 设置页用">
            <LocalDataNotice
              key={`banner-${bannerKey}`}
              variant="banner"
              showPrimaryAction
              showSecondaryAction
              showGuideEntry
              autoDismissState={true}
              onDismiss={() => addLog("banner: 关闭")}
              onPrimaryAction={() => addLog("banner: 我知道了")}
              onSecondaryAction={() => addLog("banner: 了解更多")}
              onShowGuide={() => {
                addLog("banner: 查看数据说明");
                setBannerKey((k) => k + 1);
              }}
            />
          </Section>

          <Section title="模式二：footer（页脚弱提示）— 通知中心用">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-3 text-xs text-slate-500">（模拟通知中心底部）</div>
              <LocalDataNotice
                key={`footer-${footerKey}`}
                variant="footer"
                showSecondaryAction
                autoDismissState={true}
                onDismiss={() => addLog("footer: 关闭")}
                onSecondaryAction={() => addLog("footer: 了解更多")}
              />
            </div>
          </Section>

          <Section title="模式三：card（引导卡片）— 首次进入用">
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <LocalDataNotice
                  key={`card-${cardKey}`}
                  variant="card"
                  showPrimaryAction
                  showSecondaryAction
                  autoDismissState={true}
                  onDismiss={() => addLog("card: 关闭")}
                  onPrimaryAction={() => addLog("card: 我知道了")}
                  onSecondaryAction={() => addLog("card: 了解更多")}
                />
              </div>
            </div>
          </Section>

          <Section title="交互日志">
            <div className="max-h-48 overflow-y-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-300">
              {log.length === 0 ? (
                <div className="text-slate-500">暂无日志，点击上方组件试试</div>
              ) : (
                log.map((line, idx) => <div key={idx}>{line}</div>)
              )}
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
