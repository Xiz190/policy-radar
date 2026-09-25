"use client";

import { useState } from "react";

type ExpandableTextProps = {
  text: string;
  maxLength?: number;
  className?: string;
};

export function ExpandableText({ text, maxLength = 120, className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const needTruncate = text.length > maxLength && !expanded;
  const display = needTruncate ? text.slice(0, maxLength) + "..." : text;

  return (
    <span className={className}>
      {display}
      {text.length > maxLength ? (
        <>
          {" "}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline"
      >
        {expanded ? "收起" : "展开"}
      </button>
        </>
      ) : null}
    </span>
  );
}

type ExpandableListProps = {
  items: Array<{ text: string; url: string }>;
  itemType?: string;
  maxLength?: number;
};

/**
 * 附件/外链列表：每一行显示：[展开/全部显示
 */
export function ExpandableList({ items, itemType = "相关文章/链接", maxLength = 120 }: ExpandableListProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);
  const hasMore = items.length > 5;

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-semibold text-slate-900">
        {itemType}（{items.length}）
      </h3>
      <ul className="mt-2 space-y-2 text-xs">
        {visible.map((l, i) => (
          <li
            key={i}
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <ExpandableText
              text={l.text || l.url}
              maxLength={maxLength}
              className="min-w-0 break-all text-slate-700"
            />
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sky-700 underline"
            >
              打开
            </a>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-sky-700 underline-offset-2 hover:underline"
        >
          {expanded ? "收起" : `展开剩余 ${items.length - 5} 条`}
        </button>
      ) : null}
    </div>
  );
}
