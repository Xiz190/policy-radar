"use client";

import { useEffect } from "react";

type Props = { open: boolean; onClose: () => void };

const SHORTCUTS = [
  { group: "全局", rows: [
    { key: "⌘K / Ctrl+K", label: "打开命令面板" },
    { key: "?", label: "快捷键速查（本弹窗）" },
    { key: "Alt+F", label: "切换专注模式（隐藏导航）" },
    { key: "ESC", label: "关闭当前弹窗" },
  ]},
  { group: "G+键 全局导航", rows: [
    { key: "G → I", label: "跳转收件箱" },
    { key: "G → S", label: "跳转信号雷达" },
    { key: "G → D", label: "跳转仪表盘" },
    { key: "G → H", label: "跳转首页" },
    { key: "G → M", label: "跳转监控" },
  ]},
  { group: "收件箱", rows: [
    { key: "J", label: "聚焦下一条目" },
    { key: "K", label: "聚焦上一条目" },
    { key: "Enter", label: "展开 / 折叠聚焦条目" },
    { key: "R", label: "标记当前条目已读/未读" },
    { key: "S", label: "收藏 / 取消收藏" },
    { key: "O", label: "在新 Tab 打开原文" },
    { key: "F", label: "关注 / 取关聚焦条目所属机构" },
    { key: "▷ 按钮", label: "右侧侧边预览面板" },
    { key: "密度切换", label: "紧凑 / 标准 / 宽松三档列表间距" },
    { key: "随机发现", label: "随机展开一条未读内容" },
    { key: "▲ 收起全部", label: "收起当前所有已展开条目" },
    { key: "批量选择", label: "多选后可批量稍后读、置顶、收藏、标记" },
  ]},
  { group: "命令面板", rows: [
    { key: "↑ / ↓", label: "上下选择" },
    { key: "Enter", label: "执行所选命令" },
    { key: "ESC", label: "关闭面板" },
  ]},
  { group: "功能导览", rows: [
    { key: "→ / Enter", label: "下一步" },
    { key: "←", label: "上一步" },
    { key: "ESC", label: "退出导览" },
  ]},
];

export function KeyboardShortcutsModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "?") { e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">键盘快捷键</h2>
              <p className="text-xs text-slate-400">按 ? 或 ESC 关闭</p>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-6">
            <div className="space-y-6">
              {SHORTCUTS.map((section) => (
                <div key={section.group}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.group}</div>
                  <div className="overflow-hidden rounded-xl border border-slate-100">
                    {section.rows.map((row, i) => (
                      <div key={row.key} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? "border-t border-slate-50" : ""}`}>
                        <span className="text-slate-700">{row.label}</span>
                        <kbd className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600">{row.key}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-400">
            按 <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[11px]">?</kbd> 随时召出此列表
          </div>
        </div>
      </div>
    </>
  );
}
