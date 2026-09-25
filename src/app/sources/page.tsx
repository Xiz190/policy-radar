import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { buildCapabilityDigest } from "@/lib/monitor/source-capability";

export const metadata = {
  title: "数据来源与采集方法 · 已知局限",
  description: "各监测来源的采集方式、接入状态与已知局限——由来源能力字典自动汇总。",
};

export default function SourcesMethodologyPage() {
  const { groups, totals } = buildCapabilityDigest();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-800">首页</Link>
          <span>/</span>
          <span>数据来源与采集方法</span>
        </div>

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            数据来源与采集方法 · 已知局限
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            情报台的数据来自对各官方来源的持续采集。不同来源的技术形态不同，能否稳定采集、用什么方式采集，是数据工程里最真实的一环。
            本页由<strong className="font-semibold text-slate-700">来源能力字典</strong>自动汇总——改字典即改本页，不手写维护。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
              已评估 <strong className="text-slate-900">{totals.total}</strong> 个来源
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
              已跑通在库 {totals.live}
            </span>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700">
              评估待接 {totals.planned}
            </span>
          </div>
        </div>

        {/* Groups */}
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.adapter} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${g.meta.className}`}
                >
                  <g.meta.icon className="h-4 w-4" aria-hidden />
                  <span>{g.meta.label}</span>
                </span>
                <span className="text-xs text-slate-400">{g.sources.length} 个来源</span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">{g.methodology}</p>

              <ul className="mt-4 space-y-3">
                {g.sources.map((s) => (
                  <li key={s.departmentName} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{s.departmentName}</span>
                      {s.status === "planned" ? (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
                          待接
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 ring-1 ring-emerald-200">
                          已在库
                        </span>
                      )}
                    </div>
                    {s.note ? <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{s.note}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-slate-400">
          说明：本页只列出已实际评估/处理过的来源，未评估的来源不臆造采集状态。「待接」表示已判断出采集方式、尚未接入，非「已采集」。
        </p>
      </div>
    </main>
  );
}
