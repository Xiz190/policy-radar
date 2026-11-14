"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { getNote } from "@/lib/personal-research";
import { COMPANION_RESEARCH_EVENT } from "@/lib/companion/research";

/**
 * 详情页上的「你自己写的话」。
 *
 * 详情页本身是 Server Component（数据在服务端取好，没有加载空窗），
 * 但备注存在浏览器 localStorage 里，服务端读不到——所以这块单独做成客户端组件，
 * 挂载后再填。没写过就不显示（写入口在底部工具栏的「备注」）。
 *
 * 样式与摘要块（品牌色衬线 = 系统的话）刻意不同：灰底无衬线 = 你写的，
 * 混在一起就分不清谁说的。
 */
export function CompanionNoteBlock({ sourceId, url }: { sourceId: string; url: string }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    const read = () => {
      setNote(getNote(sourceId, url));
    };
    read();
    window.addEventListener(COMPANION_RESEARCH_EVENT, read);
    return () => window.removeEventListener(COMPANION_RESEARCH_EVENT, read);
  }, [sourceId, url]);

  const trimmed = note.trim();
  if (!trimmed) return null;

  return (
    <div className="mt-[14px] flex gap-2 rounded-[11px] bg-slate-100 px-[11px] py-[9px]">
      <span className="mt-px flex-none text-slate-500" aria-hidden>
        <Pencil className="h-[13px] w-[13px]" />
      </span>
      <p className="text-[12.5px] leading-[1.46] text-slate-700">{trimmed}</p>
    </div>
  );
}
