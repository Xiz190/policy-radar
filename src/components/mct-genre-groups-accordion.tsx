"use client";

import { useMemo, useState } from "react";
import { MONITOR_EMPTY_TEXT } from "@/lib/monitor-window";
import type { MctGenreGroup } from "@/lib/live-mct-genres";

type Props = {
  groups: MctGenreGroup[];
};

export function MctGenreGroupsAccordion({ groups }: Props) {
  const [openGroupName, setOpenGroupName] = useState<string | null>(null);

  const groupsWithUpdates = useMemo(
    () => groups.filter((group) => group.items.length > 0).length,
    [groups],
  );

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">栏目展开查看</h2>
            <p className="mt-1 text-sm text-slate-500">
              默认全部收起。点击某个栏目时再展开，便于集中查看，不会把整页拉得太长。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              有更新栏目：{groupsWithUpdates}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              无更新栏目：{groups.length - groupsWithUpdates}
            </span>
          </div>
        </div>
      </div>

      {groups.map((group) => {
        const isOpen = openGroupName === group.name;
        const hasUpdates = group.items.length > 0;

        return (
          <div key={group.name} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setOpenGroupName(isOpen ? null : group.name)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-semibold text-slate-900">{group.name}</h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      hasUpdates ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {hasUpdates ? `最新 ${group.items.length} 条` : MONITOR_EMPTY_TEXT}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {hasUpdates ? "点击可展开查看详情与正文提取。" : "当前监测窗口内没有新内容。"}
                </p>
              </div>
              <span className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700">
                {isOpen ? "收起" : "展开"}
              </span>
            </button>

            {isOpen ? (
              <div className="border-t border-slate-200 px-6 py-5">
                <div className="sticky top-4 z-10 mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpenGroupName(null)}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm"
                  >
                    收起当前栏目
                  </button>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">{group.name}</h4>
                    <p className="mt-1 text-sm text-slate-500">当前只保留 2026-05-05 之后的最新 10 条内容。</p>
                  </div>
                  <a
                    href={group.listUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    打开栏目页
                  </a>
                </div>

                <div className="mt-5 space-y-3">
                  {hasUpdates ? (
                    group.items.map((item, index) => (
                      <div key={item.url} className="rounded-2xl border border-slate-200 px-4 py-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-slate-500">
                              #{index + 1} · 列表页日期 {item.date}
                              {item.detailPublishedAt ? ` · 详情页时间 ${item.detailPublishedAt}` : ""}
                            </div>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 md:text-base"
                            >
                              {item.title}
                            </a>

                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {item.issuingDepartment ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                                  发布机构：{item.issuingDepartment}
                                </span>
                              ) : null}
                              {item.referenceNumber ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                                  文号：{item.referenceNumber}
                                </span>
                              ) : null}
                              {item.classificationText ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                                  分类：{item.classificationText}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-fit rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                          >
                            打开详情页
                          </a>
                        </div>

                        <details className="mt-4 rounded-2xl bg-slate-50 p-4">
                          <summary className="cursor-pointer text-sm font-medium text-slate-700">
                            展开查看正文提取
                          </summary>
                          {item.contentParagraphs && item.contentParagraphs.length > 0 ? (
                            <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
                              {item.contentParagraphs.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-slate-600">暂未提取到正文内容。</div>
                          )}
                        </details>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                      {MONITOR_EMPTY_TEXT}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
