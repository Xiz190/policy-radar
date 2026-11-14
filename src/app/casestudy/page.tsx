import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import {
  ChartColumn, Construction, FlaskConical, Pencil, Rocket, Target,
} from "lucide-react";

const SECTIONS = [
  {
    icon: Target,
    title: "项目背景与问题定义",
    content: `情报过载不是政策域独有：补贴申报、截止日期、口径变化、AI 工具更新、创作机会，都散在几十个官方源里，人工逐站翻又慢又容易错过窗口。

Radar 是这套问题的一套方法论底座——持续监测 → 分类打分 → 解读呈现。政策雷达是它在政策情报域的实例，姊妹实例是面向音乐创作者的创作者雷达。

真正的命题不是「能不能做个信息聚合站」，而是：同一套流水线思路，能否在两个领域分别立起来，而不必每个领域从零设计一遍。答案的边界很诚实——两个实例代码各自 fork、各自垂直化，共享的是方法论，不是共享包。`,
  },
  {
    icon: Construction,
    title: "技术架构决策",
    content: `**Next.js 16 App Router + TypeScript**：Server/Client 边界分离，首屏与交互兼得。Tailwind CSS v4 驱动视觉。

**三段式流水线**：① 采集层——GitHub Actions 定时抓取各官方源（当前每 12 小时一次，与创作者雷达错开）；② 分类打分层——关键词 + 信号类别标注，规则透明、可逐条编辑；③ 解读呈现层——按优先级评分与来源标注落进收件箱 / 信号雷达。

**当前纯规则运行**：政策雷达的信号分类、优先级、研判全部由可编辑的关键词规则完成，当前不调用任何 LLM（crawl.yml 里写明「政策雷达不需要 LLM 密钥」）。LLM 接口预留在代码里，但刻意不接——对政策情报，结构化规则比黑箱生成更可控、可解释。

**PostgreSQL 而非向量库**：这里的「相关性」是结构化、可解释、可调的（monitor_sources / monitor_items），规则透明比相似度更适合政策情报。

**纯 SVG 图表 + 单强调色主题**：图表手写避免 bundle 膨胀；两实例用同一套 UI 系统、只有一个 --brand 按领域不同（政策雷达 = 冷钢蓝）。`,
  },
  {
    icon: Pencil,
    title: "设计决策与权衡",
    content: `**列表扫描 + 独立详情页**：收件箱列表用于快速扫描，点击条目进入独立详情页 /items/[id] 精读正文、信号与备注——扫描和精读分开，不互相拖累。

**本地优先（Local-first）**：个人处理数据（待跟进——含备注、标签、状态，标签库、筛选方案、偏好）都存 localStorage，零后端依赖。2026-11 把原来的稍后读、置顶、便签、动态资讯标签合并成「待跟进」一套，减少概念数量。

**渐进式信息层次**：首页 → 收件箱列表 → 详情页 → 信号雷达，用户可在任何层次停下；专注模式（Alt+F）在长列表阅读时一键收起导航。

**框架层的主动取舍**：两个实例目前是「复制壳 + 各自垂直化」，没有硬抽共享 npm 包。共享层等两个域都稳定后再收敛——过早抽象会掩盖两个域的差异，也拖慢迭代。`,
  },
  {
    icon: ChartColumn,
    title: "核心功能亮点",
    content: `**政策信号雷达（5 类）**：A·强执行 / B·强支持 / C·风险 / D·探索 / 通用启动落地，基于关键词评分 + 信号类别标注，规则可逐条编辑。

**优先级评分 + 来源透明**：每条政策按关键词命中与信号叠加给出优先级评分，并保留来源标注，判断的「依据」看得见。

**关注命中**：可关注机构、关键词、分类，命中的条目自动标重点并置顶收件箱，仪表盘显示「今日命中 / 关键词命中」概览。

**对比与研究**：对比页把两条以上的政策 / 内容并排，标出共同分类、共同关键词、差异与影响，一键导出对比报告；研究页把收藏、待跟进、备注聚到一处。

**手机版 /m + 全文检索**：移动端只保留 feed / 详情 / 收藏 / 最近，供路上快速扫；站内全文检索直接搜正文并高亮命中段落。`,
  },
  {
    icon: FlaskConical,
    title: "验证与反思",
    content: `**需求来源（非量化调研）**：第一人称的信息搜集痛点 + 与同行交流 + 对政务 / 情报流程的观察——真实但小样本的定性判断，不是编造的用户访谈。

**真实局限（主动取舍）**：① 采集依赖来源网站结构，官方改版可能失效——已做「来源健康检查」，单个源坏了会标红并发邮件；② 无 LLM 语义层，判断全部来自规则，边缘案例需人工校对；③ 无真实用户量化数据支撑优先级假设；④ 去领域化未完成——代码里仍留创作者域的分析痕迹，是明确的待清理项。

**下一步（方向与准备都已就位）**：把「领域」真正做成一份配置。现在换领域是 fork + 改 6–7 处硬编码；但准备已经做了一部分——来源清单和 __domain__ 词表已经是配置（源分三态、enabled 过滤、领域门槛三层已落地），剩下就是把信号分类、来源映射、部委表、mock/seed 也从代码里抽出来。做完后，换领域 = 换一份 config + 换一份数据库种子，代码不动；这件事本身同样可以用 AI 辅助开发完成。刻意不现在抽，是遵循「规则三次」——两个实例还没到该抽象的规模，过早抽共享层只会绑死两个域的差异，等第三个领域出现时再做。

**作品集定位**：展示的是「把一套情报方法论在两个真实域各立一个实例」的架构能力——重点在流水线设计、规则透明、UX 与工程平衡，而非算法深度。`,
  },
  {
    icon: Rocket,
    title: "技术栈总览",
    content: `- **框架**：Next.js 16 (App Router), React 19, TypeScript 5
- **样式**：Tailwind CSS v4, CSS Variables 单强调色主题
- **数据库**：PostgreSQL (pg), monitor_sources / monitor_items / monitor_runs
- **状态管理**：React Context (PrefsProvider) + hooks
- **图表**：纯 SVG（面积 / 折线 / 饼 / 热力日历）
- **信号**：关键词规则 + 信号类别（当前不调 LLM，接口预留）
- **采集**：GitHub Actions 定时抓取（12h）+ 来源健康检查
- **PWA**：manifest.json, Apple Web App meta, Service Worker
- **无障碍**：ARIA labels, 键盘导航 (j/k/r/s), 高对比度模式, 减少动画`,
  },
];

export default function CaseStudyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-8">

        {/* Breadcrumb */}
        <div className="mb-8 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-800">首页</Link>
          <span>/</span>
          <span>Case Study</span>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 mb-4">
            作品集案例 · 2026
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-tight">
            Radar 情报引擎 · 政策雷达
          </h1>
          <p className="mt-3 text-lg text-slate-600 leading-relaxed">
            Radar 是我为「情报过载」抽的一套方法论：持续监测 → 分类打分 → 解读呈现。政策雷达是它在政策情报域落地的实例（Policy Radar），姊妹实例是面向音乐创作者的创作者雷达（Creator Radar）。两实例共享这套方法论和同构的 UI 骨架，但代码各自独立、各自垂直化——换一个领域，是 fork 一份再改码，不是改几个配置就能切过去。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Next.js 16", "TypeScript", "PostgreSQL", "Tailwind CSS v4", "关键词规则信号", "PWA"].map((tag) => (
              <span key={tag} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { value: "5 类", label: "政策信号分类" },
            { value: "3 段", label: "情报流水线" },
            { value: "12h", label: "定时采集周期" },
            { value: "2 域", label: "落地实例" },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xl font-bold text-slate-900">{m.value}</div>
              <div className="mt-1 text-[11px] text-slate-500">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
                <s.icon className="h-4 w-4 text-slate-400" aria-hidden />
                <span>{s.title}</span>
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-slate-700">
                {s.content.split("\n\n").map((para, i) => (
                  <p key={i} className={para.startsWith("**") ? "font-medium" : ""}>
                    {para.split(/(\*\*[^*]+\*\*)/).map((chunk, j) =>
                      chunk.startsWith("**") && chunk.endsWith("**")
                        ? <strong key={j}>{chunk.slice(2, -2)}</strong>
                        : chunk
                    )}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-6 text-center">
          <div className="text-sm font-medium text-violet-800 mb-1">探索实际功能</div>
          <p className="text-xs text-violet-600 mb-4">本页面描述的所有功能均在当前版本中可用</p>
          <div className="flex justify-center gap-3">
            <Link
              href="/inbox"
              className="rounded-full px-5 py-2 text-sm font-medium text-white transition hover:opacity-90"
              style={{ backgroundColor: "var(--brand)" }}
            >
              进入收件箱 →
            </Link>
            <Link
              href="/signals"
              className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              信号雷达
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
