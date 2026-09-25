import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import {
  ensureMonitorSchema,
  getAllKeywordsGrouped,
  getAllDepartments,
  getGlobalKeywords,
} from "@/lib/monitor/db";
import { isDbAvailable } from "@/lib/db";
import { KeywordsClient } from "./keywords-client";

export const dynamic = "force-dynamic";

export default async function KeywordsPage() {
  try { await ensureMonitorSchema(); } catch {}

  if (!isDbAvailable()) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <SiteHeader />
        <div className="mx-auto max-w-4xl px-6 py-12">
          <SettingsBreadcrumb current="按标签" />
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
            <div className="text-base font-semibold text-slate-900">演示模式</div>
            <p className="mt-2">标签管理功能需要连接数据库。当前为本地演示模式，标签数据不可用。</p>
          </div>
        </div>
      </main>
    );
  }

  const [rawGroups, departments, globalKeywords] = await Promise.all([
    getAllKeywordsGrouped(),
    getAllDepartments(),
    getGlobalKeywords(),
  ]);

  const initialGroups = Array.from(rawGroups.entries()).map(([department, keywords]) => ({
    department,
    keywords: keywords.map((k) => ({
      ...k,
      department_name: department,
      created_at: (k as { created_at?: string }).created_at || new Date().toISOString(),
    })),
  }));

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 pt-6">
        <SettingsBreadcrumb current="关键词库" />
      </div>
      <KeywordsClient
        initialGroups={initialGroups}
        departments={departments}
        globalKeywords={globalKeywords.map((k) => ({
          ...k,
          department_name: "__global__",
          created_at: k.createdAt,
        }))}
      />
    </>
  );
}
