import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

// 里程碑式的真实迭代记录（2026-09-30 重写）。
// 旧版是从创作者雷达拷来的 8 月 6–7 日 25 轮功能清单，停在 8 月 7 日，且列着不少后来删掉的功能；
// 这里只记真正改变产品的节点，每条都能在提交历史里找到对应。政策雷达固定中文，不做英文。

type Milestone = { when: string; title: string; points: string[] };

const MILESTONES: Milestone[] = [
  {
    when: "2026 年 6–8 月",
    title: "搭起一套公开信息监测框架",
    points: [
      "抓取 → 去重 → 评分 → 收件箱 的骨架；后来创作者雷达就是从这里分出去的",
      "8 月初的原型期两天里加了几十个小功能，其中不少后来被删掉——这一阶段学到的是「少而准」",
    ],
  },
  {
    when: "9 月 2–4 日",
    title: "编辑台设计系统与数据洞察",
    points: [
      "与创作者雷达共用同一套版式：衬线标题、暖纸底、近单色，政策台用自己的强调色",
      "接入真实数据，数据洞察看板按真实数据重做",
    ],
  },
  {
    when: "9 月 8 日",
    title: "国家网信办、国家新闻出版署专用抓取器",
    points: [
      "这两个站的栏目结构特殊，单独写抓取规则，并用真实页面做测试",
    ],
  },
  {
    when: "9 月 17–18 日",
    title: "做减法与同步修复",
    points: [
      "全站 emoji 换成统一的矢量图标",
      "把创作者雷达先修好、本台还缺的几处问题同步过来；健康概览不再把停用的储备来源算成异常",
      "手机端间距与重叠修复",
    ],
  },
  {
    when: "9 月 25 日",
    title: "能稳定构建",
    points: [
      "修掉生产构建预渲染失败、搜索页首屏空白、运行记录把作废任务显示成「运行中」等问题",
    ],
  },
  {
    when: "9 月 30 日",
    title: "上线准备与「会说谎的数字」",
    points: [
      "界面固定为中文；公开演示模式（访客只读、作者口令登录）；GitHub Actions 每 12 小时定时抓取",
      "修掉误导人的数字：首页「今天有 200 条」其实是查询上限、「本周新增 0」是日期键错位",
      "删掉详情页里对真实政策展示的模拟摘要和编出来的相似度——真实政策旁边不该放假内容",
      "站内检索此前完全不可用，现已修复；转载去重；动态资讯同步创作者雷达的整改版",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-8">
        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-800">首页</Link>
            <span>/</span>
            <span>更新日志</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">更新日志</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">只记真正改变了产品的节点；零碎修复见提交历史。</p>
        </div>

        <ol className="relative border-l border-slate-200">
          {MILESTONES.map((m) => (
            <li key={m.title} className="relative pb-9 pl-6 last:pb-0">
              <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--brand)] bg-white" aria-hidden />
              <div className="text-xs font-medium text-slate-500">{m.when}</div>
              <h2 className="mt-1 text-base font-semibold text-slate-900">{m.title}</h2>
              <ul className="mt-2 space-y-1.5">
                {m.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                    <span className="mt-0.5 shrink-0 text-slate-300">·</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
