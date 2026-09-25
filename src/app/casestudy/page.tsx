import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import {
  ChartColumn, Construction, FlaskConical, Pencil, Rocket, Target,
} from "lucide-react";

const SECTIONS = [
  {
    icon: Target,
    title: "项目背景与问题定义",
    content: `情报过载不是某个领域的专属问题：政策补贴、申报截止、版权口径、AI 工具更新、创作与演出机会……都分散在数十个官方源里，人工逐一翻阅既慢又容易错过时效窗口。

Radar 是我为这条情报流水线抽出的领域无关底座——**持续监测 → 分类打分 → LLM 语义解读 → 分级呈现**。本案例（info-sync）是它在**政策情报**域落地的实例，称为「政策雷达 / Policy Radar」；姊妹实例是面向音乐创作者的「创作者雷达 / Creator Radar」（musicsearch）。

真正想回答的问题是：能否让"换一个领域"= 换数据源 + 换分类规则 + 换一套 prompt，而不是每个领域从零重写一个产品？`,
  },
  {
    icon: Construction,
    title: "技术架构决策",
    content: `**Next.js 16 App Router + TypeScript**：React Server Components 与 Client 边界分离，首屏速度与富交互兼得。Tailwind CSS v4 驱动视觉系统。

**三段式、领域无关的情报流水线**：① 来源适配层以 cron 定时爬取各官方源；② 分类打分层用关键词 + 信号类别标注（规则透明、可逐条调）；③ LLM 语义分析层做分级研判与理由生成。切换领域时只替换来源清单、分类规则与 prompt，管线本身不动——这就是"一套壳、两个域"能成立的地方。

**LLM 层的三级优雅降级**：分析结果统一走 PolicyAnalysisResult 形状，来源标注为 doubao / llm / rule——优先豆包 SDK，其次 OpenAI 兼容的 LLM_* HTTP（带超时兜底），两者都不可用时降级到关键词规则。这样**永远有结果**，且每条结论都带可信度来源。（当前默认以规则档运行、不发起外部请求：把密钥管理留到真正部署时接入，接口已就位。）

**PostgreSQL 而非向量库**：这里的"相关性"是结构化、可解释、可调的（monitor_sources / monitor_items / monitor_runs），规则透明比黑箱相似度更适合政策情报。

**纯 SVG 图表 + CSS Variables 主题系统**：面积/折线/饼图全部手写，避免 bundle 膨胀；5 色主题通过 --brand 变量 + html[data-accent] 选择器驱动。`,
  },
  {
    icon: Pencil,
    title: "设计决策与权衡",
    content: `**信息密度 vs 可扫描性**：收件箱采用"折叠列表 + 展开详情"模式，而非单独详情页。这减少了导航跳转，允许用户快速扫描 + 选择性精读，符合情报消费行为。

**本地优先（Local-first）**：便签、标签、稍后读、置顶、筛选方案、提醒规则全部存 localStorage，零后端依赖，保护用户隐私，离线可用。

**渐进式信息层次**：首页 → 今日必读 → 收件箱列表 → 展开条目 → 信号详情，用户可在任何层次停止；专注模式（Alt+F）在长列表阅读时一键收起导航，降低认知负担。

**框架层的主动取舍：做实叙事、不过早抽共享层**。两个实例目前是"复制壳 + 各自垂直化"，而不是硬抽一个共享 npm 包。在作品集阶段，复制 + 改让我能把每个域的差异讲清楚，也比过早抽象更快——共享层等两个域都稳定后再收敛。`,
  },
  {
    icon: ChartColumn,
    title: "核心功能亮点",
    content: `**16+ 轮迭代，每轮 TypeScript 0-error 验收**：从基础监测到分级信号、热力日历、批量操作、数据备份、全局搜索。

**政策信号雷达（5 类）**：强执行 / 强支持 / 濒危预警 / 行业研究 / 版权标准，基于关键词评分 + 信号类别自动标注，规则可逐条编辑。

**LLM 分级研判 + 来源透明**：对每条政策生成 forecastHigh / MidHigh / Mid / Low 四档研判、理由与置信度，并标注结论来源（豆包 / LLM / 规则），让用户看得见"这条判断的可信度从哪来"。

**订阅命中系统**：用户可订阅关注的机构和关键词，系统自动计算"命中率"并在首页展示，实现"个性化"而不收集任何行为数据。

**周报生成器**：将本周信号按分类编排成 Markdown 周报，一键复制或下载 .md。`,
  },
  {
    icon: FlaskConical,
    title: "验证与反思",
    content: `**需求来源（非量化调研）**：来自第一人称的信息搜集痛点、与同行的交流，以及对通用政务/情报流程的情境观察——不是编造的用户访谈，而是真实但小样本的定性判断。

**真实局限（主动取舍，不藏）**：① 采集依赖来源网站结构，官方改版可能导致失效，已排除长期死链源；② LLM 分级质量依赖 prompt，边缘案例仍需人工校对；③ 当前无真实用户量化数据支撑优先级假设；④ **去领域化尚未完成**——代码里仍留有创作者域的 role / content 分析模块，这恰是"一套壳、两个域"的痕迹，也是明确的待清理项。

**作品集定位**：本项目展示的是"抽象一套领域无关情报底座，并在两个真实域各起一个实例"的架构能力——重点在架构决策、优雅降级、以及 UX 与工程的平衡，而非算法深度。`,
  },
  {
    icon: Rocket,
    title: "技术栈总览",
    content: `- **框架**：Next.js 16 (App Router), React 19, TypeScript 5
- **样式**：Tailwind CSS v4, CSS Variables 主题系统
- **数据库**：PostgreSQL (pg), 自建 monitor_sources / monitor_items / monitor_runs 表
- **状态管理**：React Context (PrefsProvider), useState + useRef + useCallback + useMemo
- **图表**：纯 SVG（面积图、折线图、饼图、热力日历）
- **AI 集成**：LLM 语义分析层（豆包 SDK / OpenAI 兼容 LLM_* HTTP）+ 三级优雅降级（doubao / llm / rule）+ 信号分类（关键词 + 信号类别）
- **PWA**：manifest.json, Apple Web App meta, Service Worker（离线缓存规划中）
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
            Radar 是一套领域无关的情报底座：持续监测 → 分类打分 → LLM 语义解读 → 分级呈现。本案例是它在<strong className="font-semibold text-slate-700">政策情报</strong>域落地的实例（政策雷达 / Policy Radar），姊妹实例是面向音乐创作者的创作者雷达（Creator Radar）——换领域 = 换数据源 + 换分类规则 + 换 prompt，而非重写一个产品。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Next.js 16", "TypeScript", "PostgreSQL", "Tailwind CSS v4", "LLM 分析 + 规则降级", "PWA"].map((tag) => (
              <span key={tag} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { value: "16+", label: "功能迭代轮次" },
            { value: "5 类", label: "政策信号分类" },
            { value: "3 级", label: "LLM→规则降级" },
            { value: "0 error", label: "TypeScript 严格验收" },
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
