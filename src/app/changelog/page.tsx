import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

const ROUNDS = [
  {
    round: "R25",
    date: "2026-08-07",
    title: "键盘 Enter/O/F · 命令面板搜索历史 · 机构趋势线 · 仪表盘导出 · 条目数统计",
    items: [
      "收件箱键盘新快捷键：Enter=展开/折叠聚焦条目（修复文档已有但未实现的快捷键）、O=新 Tab 打开原文、F=关注/取关聚焦条目所属机构（再按切换）",
      "命令面板「最近搜索」：执行命令时若有搜索词，自动写入 localStorage（最多 5 条）；面板无查询时显示历史词云芯片，点击即填入搜索框；右上角「清空」按钮",
      "仪表盘机构迷你趋势线：各机构条形图右侧新增 40×14px SVG 折线 sparkline，展示近 7 日每日更新量走势（上升=琥珀，下降=灰蓝，平稳=浅灰）",
      "仪表盘「↓ 导出 JSON」：刷新按钮旁新增下载按钮，将当前 DashboardData 连同 exportedAt 时间戳和 days 参数一并序列化为 JSON 文件（命名格式 dashboard-YYYY-MM-DD.json）",
      "收件箱条目数统计徽标：排序/密度工具栏右端新增「显示 X / 共 Y 条」只读标签，筛选后动态反映当前可见条目数 vs 总条目数",
    ],
  },
  {
    round: "R24",
    date: "2026-08-07",
    title: "全部收起 · 仪表盘刷新 · 信号高亮 · 预览面板上/下条 · 首页最近浏览",
    items: [
      "收件箱「▲ 收起全部 (n)」：随机发现按钮旁，当有展开条目时显示「▲ 收起全部 (n)」按钮，一键清空所有展开状态",
      "仪表盘「⟳ 刷新 + 上次刷新时间」：标题栏新增刷新按钮（加载中旋转动画）和「上次 HH:MM」时间戳，点击触发重新请求，支持与「天数切换」独立刷新",
      "信号雷达列表视图「标题高亮」：列表视图中的条目标题现在也使用 Highlight 组件，搜索时高亮匹配词（与详情视图行为一致）",
      "预览面板「上一条/下一条」：侧边预览面板头部新增 ‹ / › 导航按钮 + 位置计数（n/total），可在当前过滤列表内翻页而无需关闭面板",
      "首页「最近浏览」版块：读取 localStorage 中最近展开的条目（最多 5 条），在 WorkspaceTabs 下方显示卡片列表，点击直接在新 Tab 打开原文",
    ],
  },
  {
    round: "R23",
    date: "2026-08-07",
    title: "批量稍后读/置顶 · 随机发现 · 命令面板最近访问 · 过期徽标 · 仪表盘周分布图",
    items: [
      "批量稍后读 + 置顶：浮动多选工具条新增「稍后读」和「置顶」两个批量操作按钮，与全部已读/收藏/需跟进并列",
      "随机发现按钮：排序/密度控制栏右侧新增「随机发现」，从当前过滤列表中的未读条目随机选一条展开并平滑滚动至它，若全部已读则从全集中随机",
      "命令面板「最近访问」区块：展开条目时自动记录到 localStorage（最多 10 条），命令面板无搜索词时在「导航」之前显示「最近访问」区块（最多 5 条），点击直接在新 Tab 打开原文",
      "过期/截止徽标：条目卡片徽标行新增状态芯片——已截止（deadlineDate 过期，玫红色）、日期（截止在 3 天内，琥珀色）、已过期（effectiveTo 过期，灰色）",
      "仪表盘「周分布」小图：热力图下方新增独立 SectionCard，用纵向柱状图展示按星期（周一→周日）汇总的入库量分布，数据来源于 departmentStats.series",
    ],
  },
  {
    round: "R22",
    date: "2026-08-07",
    title: "快捷键更新 · 今日焦点条 · 信号 CSV 导出 · OPML 导入 · 仪表盘智能摘要",
    items: [
      "键盘快捷键模态框更新：新增「G+键 全局导航」分组（G+I/S/D/H/M）及密度切换、侧边预览说明",
      "收件箱「今日焦点」条：加载后若有今日未读核心关注条目，在视图 Tab 上方显示半透明提示条，一键跳转筛选，可关闭",
      "信号雷达 CSV 导出：工具栏新增「↓ CSV」按钮，将当前过滤结果导出为带 BOM 的 UTF-8 CSV（含标题/机构/时间/信号类别/强度/链接），Excel 直接打开",
      "订阅页 OPML 导入：新增「↑ 导入 OPML」文件按钮，解析 .opml/.xml 中的 outline 元素批量导入机构订阅，与 JSON 导入并列",
      "仪表盘智能摘要段落：「关键发现」区块顶部新增叙事摘要句，将前 3 条 insight 的描述拼接成可读段落，上下文感知",
    ],
  },
  {
    round: "R21",
    date: "2026-08-07",
    title: "G键提示浮层 · 密度切换 · 信号快速日期 · 仪表盘批量折叠 · SectionCard forceCollapsed",
    items: [
      "G键导航提示浮层：按 G 后右下角浮出提示卡片列出 G+I/S/D/H/M 快捷键，1.5 秒或第二键触发后自动关闭",
      "收件箱列表密度切换：排序栏右侧新增「紧凑/标准/宽松」三挡，紧凑缩减内边距+单行标题，宽松增大内边距+显示全标题，持久化到 localStorage",
      "信号雷达快速日期过滤：工具栏新增「全部/今日/近 7 天/近 30 天」芯片组，实时筛选 filteredItems，并纳入 hasAnyFilter 逻辑",
      "仪表盘一键折叠/展开：标题栏右侧新增「↑ 全部折叠 / ↓ 全部展开」切换按钮，通过 forceCollapsed prop 同步所有 SectionCard 状态",
      "SectionCard forceCollapsed prop：新增外部强制折叠/展开支持（仅在值变化时触发），内部独立 toggle 仍正常工作",
    ],
  },
  {
    round: "R20",
    date: "2026-08-07",
    title: "OPML 导出 · G+键导航 · 智能建议条 · 侧边预览面板 · 趋势图悬浮提示",
    items: [
      "OPML 订阅导出：关注设置页新增「↓ OPML」按钮，将机构/关键词订阅导出为标准 OPML 2.0 格式（RSS 阅读器通用）",
      "G+key 全局键盘导航：按 G 后 1 秒内再按 I/S/D/H/M，快速跳转 收件箱/信号雷达/仪表盘/首页/监控",
      "收件箱智能建议条：加载后自动检测未读分布，若某分类占比 ≥35% 则显示蓝色提示条，一键快速筛选，可关闭",
      "右侧预览面板：条目操作栏新增「▷」侧览按钮，点击在屏幕右侧以抽屉形式展示摘要/正文/附件，不影响主列表状态",
      "仪表盘趋势图增强：SignalLineChart 新增合计虚线、悬浮时显示竖向标尺线与浮动 Tooltip（日期+各分类数值+合计）",
    ],
  },
  {
    round: "R19",
    date: "2026-08-06",
    title: "导航进度条 · 回到顶部 · 同来源推荐 · Markdown 导出 · 快速订阅 · 批量 Markdown",
    items: [
      "顶部导航进度条：路由切换时顶部显示主题色细条（CSS 动画，无第三方库），感知导航状态",
      "收件箱「↑ 回到顶部」浮动按钮：滚动超 400px 后出现，平滑滚回顶部，移动端在底导上方",
      "同来源更多内容：展开条目底部新增「▸ 同来源更多」，懒加载该机构的最新 4 条内容",
      "导出 Markdown：收件箱按当前筛选/标签导出 .md 文件，按机构分组，含标题+链接+日期",
      "展开条目内快速订阅：机构徽标上 hover 显示「+ 关注」按钮，一键 POST 到订阅 API",
    ],
  },
  {
    round: "R18",
    date: "2026-08-06",
    title: "离线缓存 · 个人统计 · Canvas 分享卡 · 打印优化",
    items: [
      "Service Worker 离线缓存：注册 /sw.js，预缓存所有静态页面，网络失败时从缓存返回内容，API 路由 / Next 内部请求直通网络",
      "个人统计页（/stats）：阅读完成率进度条、Top 5 来源排行、高频关键词云、本地数据量汇总（便签/标签/清单/规则）",
      "Canvas 分享卡片：展开条目后点「生成卡片」，用 Canvas API 渲染带渐变 header、标题、来源信息、分类标签和品牌落款的 PNG 卡片，直接下载",
      "打印优化：@media print 隐藏导航、按钮等，保留内容区域；信号雷达页新增「打印」按钮",
      "导航菜单新增：个人统计、提醒规则、日报预览、Case Study 四个入口",
    ],
  },
  {
    round: "R17",
    date: "2026-08-06",
    title: "周环比 · 置顶条目 · 日报预览 · Case Study · 提醒规则 · 浏览器推送",
    items: [
      "仪表盘「周环比」对比条：本周 vs 上周新增量、日均量与增减百分比，清晰感知内容节奏变化",
      "收件箱「置顶」：展开条目后可置顶，置顶条目自动排列到列表顶部，红色徽标标识，本地持久化",
      "摘要邮件预览页（/digest）：将今日信号渲染为 HTML 邮件格式（含预览 + 源码双视图），一键复制 HTML",
      "Case Study 页（/casestudy）：项目背景、技术架构、设计决策、功能亮点、局限反思全面记录，面向作品集评审",
      "自定义提醒规则（/alerts）：设置关键词 + 阈值 + 时间窗口规则，本地存储，为未来实时推送打基础",
      "浏览器推送权限：无障碍面板新增推送通知开关，调用 Notification.requestPermission()，授权后发送确认通知",
    ],
  },
  {
    round: "R16",
    date: "2026-08-06",
    title: "热力日历 · 保存筛选 · 稍后读 · 骨架屏 · 专注模式 · 复制链接",
    items: [
      "仪表盘热力日历图：GitHub 风格 15 周 × 7 天入库量热力图，颜色深浅反映当日总量",
      "收件箱保存筛选方案：为当前筛选起名并保存（最多 8 条），方案条以 chip 形式显示，一键恢复",
      "稍后读清单：展开条目后可「稍后读」，独立 /readinglist 页汇总，本地持久化，设置菜单 + 命令面板均可入口",
      "骨架屏：收件箱首次加载时显示 5 张 Skeleton 卡，替代 spinner，减少布局跳动感",
      "专注模式：Alt+F 切换，激活后 Header 收缩为细条，移动端底导航隐藏，退出按钮随时可见",
      "复制筛选链接：「复制链接」按钮将当前含筛选参数的 URL 写入剪贴板，便于分享视图",
    ],
  },
  {
    round: "R15",
    date: "2026-08-06",
    title: "全局搜索 · 无限滚动 · 阅读进度 · 可折叠组件 · 关注导出",
    items: [
      "全局搜索页（/search）：关键词跨收件箱/信号雷达双标签搜索，结果高亮 + 分页，⌘K 命令面板快速入口",
      "收件箱无限滚动：滚动到底部自动加载下一页（IntersectionObserver，rootMargin 200px）",
      "收件箱阅读进度条：已读/总数绿色进度条，显示百分比",
      "仪表盘 5 个数据卡均支持折叠，状态持久化到 localStorage（widget-collapsed-{key}）",
      "关注设置页新增「导出关注」/ 「导入关注」：JSON 文件备份，逐条 POST 恢复",
    ],
  },
  {
    round: "R14",
    date: "2026-08-06",
    title: "截止倒计时 · 展开自动已读 · 数据备份 · 今日必读 · 更新日志",
    items: [
      "信号页申报截止预警类显示发布天数徽章（绿/黄/红三级时效提醒）",
      "收件箱展开条目 1.5s 后自动标为已读（折叠则取消计时）",
      "本地数据备份/恢复页（/settings/data）：导出便签、标签、偏好为 JSON，支持再导入与清除",
      "首页「今日必读」模块：自动筛出核心关注/重点内容，红色醒目卡片置于快捷操作下方",
      "设置菜单新增「数据备份/恢复」与「更新日志」入口",
    ],
  },
  {
    round: "R13",
    date: "2026-08-06",
    title: "批量选择 · 条目分享 · 来源健康 · CSV 导出",
    items: [
      "收件箱批量选择：条目右上角复选框，选中后底部浮现操作条（全部已读 / 全部收藏 / 标「需跟进」）",
      "条目展开视图新增「复制分享」：格式化文本（标题+来源+时间+链接）写入剪贴板",
      "监测页来源健康指示：活跃度排名加彩色圆点（绿=24h活跃/黄=3天/红=超期），新增「来源健康概览」汇总卡",
      "CSV 导出跟随标签筛选（tagFilteredItems），BOM 头保证 Excel 中文兼容",
    ],
  },
  {
    round: "R12",
    date: "2026-08-06",
    title: "主题色 · 快捷键速查 · 简报生成 · 条目标签 · 通知清除",
    items: [
      "5 色主题切换（紫/靛/翠/玫/橙），CSS --brand 变量驱动，Logo 徽标与移动导航指示条跟随",
      "键盘快捷键速查弹窗（? 键召出），展示全局/收件箱/命令面板/导览快捷键",
      "首页「生成简报」：将今日情报编译为格式化文本，弹窗展示并支持一键复制",
      "收件箱条目自定义标签（需跟进/资料/已处理），本地持久化，支持顶部标签筛选条",
      "通知页新增「一键清除」按钮，调用 clearAllNotifications()",
    ],
  },
  {
    round: "R11",
    date: "2026-08-06",
    title: "命令面板增强 · 统计面板 · 自动刷新 · Changelog · 面包屑",
    items: [
      "⌘K 命令面板新增操作分区：切换深色/浅色、全部标为已读、高优先级跳转、申报截止跳转",
      "收件箱筛选结果统计面板：当前过滤后按机构分布的迷你条形图",
      "信号页自动静默刷新：可开关的轮询，发现新内容时顶部横幅提示",
      "更新日志页（本页）",
      "条目详情页面包屑增强：机构 → 栏目 → 标题完整路径",
    ],
  },
  {
    round: "R10",
    date: "2026-08-06",
    title: "首页快捷卡 · 关键词跳转 · PWA · 深色跟随系统 · 评分拆解 · 阅读时长",
    items: [
      "首页新增 4 张快捷操作卡（今日未读 / 高优先级 / 我的关注 / 申报截止）",
      "仪表盘关键词云点击跳转到收件箱搜索",
      "PWA manifest + Apple Web App 元数据，支持添加到主屏幕",
      "深色模式自动跟随系统（prefers-color-scheme 监听）",
      "信号页评分拆解 tooltip（优先级 + 关键词得分 + 类别数）",
      "收件箱展开条目显示阅读时长估算（字数 ÷ 300字/分钟）",
    ],
  },
  {
    round: "R9",
    date: "2026-08-06",
    title: "移动端导航 · 搜索历史 · 关键词高亮 · 时间范围 · 错误页 · 活跃排名",
    items: [
      "手机底部固定导航栏（工作台/收件箱/信号/监测）",
      "收件箱和信号页搜索历史（最近 8 条，localStorage，一键回填）",
      "展开条目时正文/摘要中的 matchedKeywords 高亮（amber 底色）",
      "仪表盘时间范围切换（7 / 14 / 30 天）",
      "全局错误边界页 error.tsx",
      "监测页来源活跃度排名 Top 5",
    ],
  },
  {
    round: "R8",
    date: "2026-08-06",
    title: "功能导览 · 一键分享 · 筛选持久化 · 命中率卡",
    items: [
      "App Tour 6 步功能导览（键盘可控，紫色高亮目标元素）",
      "收件箱条目一键分享（复制格式化文本卡片）",
      "筛选状态持久化（排序/地区/日期字段存 localStorage）",
      "仪表盘订阅命中率卡（今日/周/关键词命中数）",
    ],
  },
  {
    round: "R7",
    date: "2026-08-06",
    title: "周报生成器",
    items: [
      "信号页「生成周报」按钮：TL;DR 总览 + 各分类详细板块",
      "周报 Markdown 预览 + 源码双 tab 展示",
      "一键复制 / 下载 .md 文件",
    ],
  },
  {
    round: "R6",
    date: "2026-08-06",
    title: "命令面板 · 阅读进度 · 条目笔记 · CSV 导出 · 趋势图 · About 弹窗",
    items: [
      "⌘K / Ctrl+K 全局命令面板（10 条导航，↑↓ 键盘导航）",
      "收件箱阅读进度 badge（已读 N/M，点击切换只看未读）",
      "条目笔记（展开时可写笔记，图标标记有笔记的条目，localStorage）",
      "收件箱 CSV 导出（BOM 编码，按当前筛选导出）",
      "仪表盘每日总入库趋势迷你图（SVG 面积图，indigo 渐变）",
      "About 项目弹窗（技术栈 / 数据来源 / 设计决策 / 作品集说明）",
    ],
  },
  {
    round: "R5",
    date: "2026-08-06",
    title: "深色模式 · 关键词高亮 · 运行历史 · 批量启停 · 键盘导航 · 健康 badge",
    items: [
      "深色模式（html.dark CSS 全量覆盖，三档切换）",
      "收件箱/信号关键词搜索高亮（amber 底色 <mark>）",
      "监测页运行历史面板（最近 12 次，可展开每次详情）",
      "来源管理批量启用/停用（并行 PATCH）",
      "收件箱键盘导航：J/K 上下，R 标已读，S 收藏",
      "来源健康 badge（ping 结果缓存到 localStorage）",
    ],
  },
  {
    round: "R1–4",
    date: "2026-08 以前",
    title: "项目基础架构与核心功能",
    items: [
      "Next.js 15 App Router + TypeScript + Tailwind CSS v4 项目搭建",
      "PostgreSQL 数据库集成（monitor_sources / monitor_items / monitor_runs）",
      "来源管理：添加/编辑/启停/Ping 可用性检测",
      "监测任务运行器（手动触发，支持来源/机构维度）",
      "收件箱：分页、筛选（机构/分类/重要性/日期）、已读/收藏",
      "信号雷达页：信号类型分布、订阅匹配、关键词评分",
      "仪表盘：趋势图 / 重要性饼图 / 关键词云 / 洞察卡",
      "通知中心、关注订阅、关键词库管理",
      "无障碍面板（字体大小 / 高对比度 / 减少动画 / 中英文切换）",
      "i18n 双语框架（translations dict + useT hook）",
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
          <p className="mt-2 text-sm text-slate-500">
            政策雷达的功能迭代记录 · 作品集项目 · 持续构建中
          </p>
        </div>

        <div className="relative">
          {/* 时间线竖线 */}
          <div className="absolute left-[17px] top-0 h-full w-px bg-slate-200" />

          <div className="space-y-8">
            {ROUNDS.map((r) => (
              <div key={r.round} className="relative flex gap-5">
                {/* 节点 */}
                <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-violet-200 bg-white text-[11px] font-bold text-violet-600">
                  {r.round}
                </div>

                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{r.title}</h2>
                    <span className="text-[11px] text-slate-400">{r.date}</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {r.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                        <span className="mt-0.5 shrink-0 text-slate-300">·</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
          <div className="font-medium text-slate-500">持续迭代中</div>
          <p className="mt-1 text-xs">这是一个面向政策研究与行业情报的通用监测平台（当前实例聚焦 AI／数字经济政策），作为研究生申请作品集的 AI × 设计 案例</p>
        </div>
      </div>
    </main>
  );
}
