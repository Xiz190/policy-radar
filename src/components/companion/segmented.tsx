"use client";

/**
 * mockup 的 .seg：灰底胶囊里放几个选项，选中项浮白。
 *
 * 尺寸用任意值而非 Tailwind 刻度，是为了跟 mockup 精确对齐——
 * globals.css 会用 !important 改写 rounded-*，所以圆角必须写任意值。
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex rounded-[11px] bg-[#eef2f6] p-[3px] ${className}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`rounded-[8px] px-[14px] py-[6px] text-[13px] font-semibold transition-colors ${
              on
                ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
