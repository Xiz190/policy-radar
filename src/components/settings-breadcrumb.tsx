import Link from "next/link";

type SettingsBreadcrumbProps = {
  current: string;
  className?: string;
};

export function SettingsBreadcrumb({ current, className = "" }: SettingsBreadcrumbProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm text-slate-500 ${className}`}>
      <Link href="/monitor" className="hover:text-slate-900">
        系统设置
      </Link>
      <span>/</span>
      <span className="text-slate-900">{current}</span>
    </div>
  );
}
