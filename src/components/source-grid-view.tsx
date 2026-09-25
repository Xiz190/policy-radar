"use client";

import type { SourceTreeNode } from "@/hooks/use-item-list";

type SourceGridViewProps = {
  sourcesTree: SourceTreeNode[];
  onSelectDepartment: (deptName: string) => void;
};

export function SourceGridView({ sourcesTree, onSelectDepartment }: SourceGridViewProps) {
  if (sourcesTree.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        暂无部委数据
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sourcesTree.map((dept) => (
        <button
          key={dept.departmentName}
          type="button"
          onClick={() => onSelectDepartment(dept.departmentName)}
          className="group flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm"
        >
          <div className="flex w-full items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">
              {dept.displayName || dept.departmentName}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {dept.totalCount} 条
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{dept.channels.length} 个栏目</span>
            {dept.unread > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                {dept.unread} 未读
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {dept.channels.slice(0, 4).map((ch) => (
              <span
                key={ch.sourceId}
                className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
              >
                {ch.channelName}
              </span>
            ))}
            {dept.channels.length > 4 ? (
              <span className="text-[11px] text-slate-400">+{dept.channels.length - 4}</span>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-sky-700 opacity-0 transition group-hover:opacity-100">
            查看政策 →
          </div>
        </button>
      ))}
    </div>
  );
}
