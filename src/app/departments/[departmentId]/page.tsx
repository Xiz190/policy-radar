"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";

export default function SourceGroupDetailPage() {
  const router = useRouter();
  const params = useParams<{ departmentId: string }>();
  const departmentName = decodeURIComponent(params.departmentId || "");

  useEffect(() => {
    if (departmentName) {
      const targetUrl = `/inbox?view=all&departmentName=${encodeURIComponent(departmentName)}`;
      router.replace(targetUrl);
    } else {
      router.replace("/inbox?view=byDepartment");
    }
  }, [router, departmentName]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center">
        <div className="text-sm text-slate-500">正在跳转…</div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {departmentName || "来源详情"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          已并入「动态资讯」，即将跳转到对应机构的动态列表…
        </p>
      </div>
    </main>
  );
}
