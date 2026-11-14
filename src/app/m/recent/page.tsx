"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/lib/i18n";
import { sourceAbbr, viewedLabel } from "@/lib/companion/format";
import { CompanionHeader } from "@/components/companion/companion-header";

// localStorage 的 inbox_recent_items 由桌面端 inbox 页写入（见 src/app/inbox/page.tsx），
// 形状：{ title, url, sourceId, departmentName, listPublishedAt, viewedAt }。
// 伴侣版的最近浏览只读本地这一份，不做跨设备同步。
type RecentEntry = {
  title: string;
  url: string;
  sourceId?: string;
  departmentName?: string;
  listPublishedAt?: string;
  viewedAt?: string;
};

export default function CompanionRecentPage() {
  const t = useT("zh");
  const [items, setItems] = useState<RecentEntry[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("inbox_recent_items") ?? "[]") as RecentEntry[];
      // 写入口（桌面 inbox）已按 newest-first 插入，这里原样呈现即为"最新在前"。
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后才能读浏览器数据（本地存储/窗口/当前时间），服务端读不到；放进渲染会造成水合不一致
      setItems(Array.isArray(stored) ? stored : []);
    } catch {
      setItems([]);
    }
  }, []);

  return (
    <main>
      <CompanionHeader
        title={t("companion.today.recentlyViewed")}
        left={
          <Link
            href="/m"
            className="flex items-center gap-[5px] text-[14px] font-semibold text-slate-700"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {t("companion.tab.today")}
          </Link>
        }
      />

      <div className="px-5 pb-24 pt-1.5">
        {items.length === 0 ? (
          <p className="pt-6 text-[13.5px] text-slate-500">{t("companion.empty")}</p>
        ) : (
          items.map((item, i) => {
            // 存下来的形状带 sourceId，可链进 /m/item/[id]；缺 sourceId 时退回原文链接。
            const href = item.sourceId
              ? `/m/item/${encodeURIComponent(item.sourceId)}?url=${encodeURIComponent(item.url)}`
              : item.url;
            const external = !item.sourceId;
            return (
              <Link
                key={`${item.url}::${i}`}
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
                className="flex items-start gap-[11px] border-b border-slate-200 px-0.5 py-[13px]"
              >
                <span className="mt-[1px] flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[8px] bg-slate-200 text-[10px] font-bold tracking-[0.02em] text-slate-600">
                  {sourceAbbr(item.departmentName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-[1.34] text-slate-900">
                    {item.title}
                  </span>
                  <span className="mt-[4px] flex items-center gap-[6px] text-[11.5px] text-slate-500">
                    <span className="font-semibold text-slate-700">{item.departmentName}</span>
                    <span className="h-[3px] w-[3px] flex-none rounded-full bg-slate-200" aria-hidden />
                    <span>{viewedLabel(item.viewedAt)}看过</span>
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
