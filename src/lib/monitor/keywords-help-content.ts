import type { HelpContentItem } from "@/components/help-popover";
import {
  ClipboardList, RefreshCw, Swords, Target, TriangleAlert,
} from "lucide-react";

export const KEYWORDS_HELP_CONTENT: HelpContentItem[] = [
  {
    type: "paragraph",
    title: "关键词 ≠ 爬虫",
    icon: RefreshCw,
    text: "关键词<strong>不会触发爬虫</strong>。爬虫独立运行，从各平台网站抓取内容列表和正文。关键词是在内容入库后，对已有内容进行匹配、打分和分类。",
  },
  {
    type: "steps",
    title: "完整流程",
    icon: ClipboardList,
    steps: ["爬虫抓列表", "入库", "抓正文", "关键词扫描", "计算得分"],
    highlightIndex: 3,
  },
  {
    type: "list",
    title: "关键词的实际用途",
    icon: Target,
    items: [
      { label: "排序", desc: "收件箱按关键词得分降序排列，得分高的排前面" },
      { label: "分级", desc: "自动判断「核心关注 / 重点内容 / 普通内容」" },
      { label: "分类", desc: "归入 强执行 / 强支持 / 濒危预警 / 行业研究 等大类" },
      { label: "信号识别", desc: "自动识别执行落实、资金扶持、申报截止、监管变化等信号" },
      { label: "角色分析", desc: "按政策研究者视角计算每条内容的关注优先级" },
    ],
  },
  {
    type: "list",
    title: "全局关键词 vs 来源关键词",
    icon: Swords,
    items: [
      { label: "全局关键词", desc: "对所有来源的内容都生效" },
      { label: "来源关键词", desc: "只对对应来源平台的内容生效" },
      { label: "匹配时会合并", desc: "全局 + 该来源的关键词一起扫描", strong: true },
    ],
  },
  {
    type: "list",
    title: "注意事项",
    icon: TriangleAlert,
    items: [
      { label: "新抓进来的内容会自动用最新关键词库扫描" },
      { label: "已经在库里的旧内容不会自动重算，需要手动触发重扫", strong: true },
      { label: "权重范围 1-10，权重越高命中时得分越多；C·申报截止预警建议设 7-8" },
    ],
  },
];
