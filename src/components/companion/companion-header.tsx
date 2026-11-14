import type { ReactNode } from "react";

export function CompanionHeader({
  title,
  subtitle,
  left,
  right,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="px-5 pb-2 pt-1.5">
      <div className="flex h-9 items-center justify-between">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-slate-900">
          {left ?? title}
        </span>
        {right}
      </div>
      {left ? (
        <h1 className="mt-[11px] font-serif text-[29px] font-medium tracking-[-0.01em] text-slate-900">
          {title}
        </h1>
      ) : null}
      {subtitle ? <div className="mt-[3px] text-[12.5px] text-slate-500">{subtitle}</div> : null}
    </header>
  );
}
