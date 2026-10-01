"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md space-y-6">
        <div className="text-6xl">⚠</div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">页面出错了</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            发生了意外错误，可以尝试刷新页面或返回首页。
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-[11px] text-slate-400">
              错误 ID：{error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-full bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 sm:w-auto"
          >
            重试
          </button>
          <a
            href="/"
            className="w-full rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
