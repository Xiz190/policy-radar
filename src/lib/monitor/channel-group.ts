// 收件箱专用：把部委原始栏目名（channelName）归并为少量"内容大类"。
// 此文件只影响收件箱筛选逻辑；部委目录不动。

export type ChannelGroupKey =
  | "policy"
  | "notice"
  | "interpretation"
  | "news"
  | "finance"
  | "service"
  | "party"
  | "other";

export type ChannelGroup = {
  key: ChannelGroupKey;
  label: string;
  description: string;
};

// —— 大类定义（顺序即显示顺序）——
export const CHANNEL_GROUPS: ChannelGroup[] = [
  {
    key: "policy",
    label: "政策文件",
    description: "正式政策文本、意见、方案、法规、规章、部令、中央文件等",
  },
  {
    key: "notice",
    label: "通知公告",
    description: "通知 / 公告 / 通告 / 通报 / 办事通知 / 采购公告等",
  },
  {
    key: "interpretation",
    label: "政策解读",
    description: "政策解读、图解、案例解读、解读产品、实施效果等",
  },
  {
    key: "news",
    label: "动态 / 新闻",
    description: "工作动态、部门动态、要闻、时政、领导活动、会议报道、图片新闻等",
  },
  {
    key: "finance",
    label: "财政 / 数据 / 公开",
    description: "财政预决算、收支、经济运行、政府采购、人事、政府信息公开等",
  },
  {
    key: "service",
    label: "办事 / 服务",
    description: "开办企业、纳税、办理许可、政务服务便利化、人才引进、企业服务等",
  },
  {
    key: "party",
    label: "党建 / 学习 / 研究",
    description: "机关党建、学习视频、中央指示精神、政绩观学习教育、三农学习谈等",
  },
  {
    key: "other",
    label: "其他 / 未归类",
    description: "无法归入以上大类的栏目",
  },
];

export const CHANNEL_GROUP_LABELS: Record<ChannelGroupKey, string> = CHANNEL_GROUPS.reduce(
  (acc, g) => {
    acc[g.key] = g.label;
    return acc;
  },
  {} as Record<ChannelGroupKey, string>,
);

// —— 精确匹配表（优先命中）——
// 按 config.ts 中实际出现的 200+ 个唯一 channelName 手工归类。
const EXACT_MAP: Record<string, ChannelGroupKey> = {
  // —— policy：政策文件 / 法规 / 规章 ——
  政策文件: "policy",
  最新政策: "policy",
  国家政策: "policy",
  中央文件: "policy",
  国务院文件: "policy",
  市政府文件: "policy",
  市政府办公厅文件: "policy",
  地方性法规: "policy",
  行政规范性文件: "policy",
  规范性文件: "policy",
  国家行政法规库: "policy",
  其他政策文件: "policy",
  其他文件: "policy",
  部门规章: "policy",
  规章: "policy",
  法规: "policy",
  法律法规: "policy",
  法律: "policy",
  制度规定: "policy",
  制度法规: "policy",
  规划计划: "policy",
  意见: "policy",
  意见征集: "policy",
  征求意见: "policy",
  决议决定: "policy",
  决定: "policy",
  部令: "policy",
  "命令(令)": "policy",
  批复: "policy",
  函: "policy",
  报告: "policy",
  公报: "policy",
  政策集成: "policy",
  政策说明书: "policy",
  惠企助企政策: "policy",
  文件公示: "policy",

  // —— interpretation：解读 / 图解 / 案例 ——
  政策解读: "interpretation",
  "政策解读·主页": "interpretation",
  "政策解读·聚焦专题": "interpretation",
  相关解读: "interpretation",
  案例解读: "interpretation",
  解读产品: "interpretation",
  实施效果: "interpretation",
  图解: "interpretation",
  可以政策解读: "interpretation",
  审计署报告及解读: "interpretation",

  // —— notice：通知 / 公告 / 通告 ——
  通知: "notice",
  通知公告: "notice",
  通知通告: "notice",
  公告: "notice",
  通告: "notice",
  通报: "notice",
  办事通知: "notice",
  最新公开: "notice",
  采购公告: "notice",
  审计署公告及解读: "notice",
  其他新闻发布会: "notice",

  // —— news：动态 / 新闻 ——
  工作动态: "news",
  最新动态: "news",
  部门动态: "news",
  工信动态: "news",
  中央部委动态: "news",
  部属动态: "news",
  司局动态: "news",
  地方动态: "news",
  农业农村部动态: "news",
  审计署动态: "news",
  审计要闻: "news",
  财政要闻: "news",
  北京要闻: "news",
  三农要闻: "news",
  要闻: "news",
  时政要闻: "news",
  时政新闻: "news",
  时政头条: "news",
  三农头条: "news",
  头条新闻: "news",
  焦点新闻: "news",
  热点聚焦: "news",
  媒体视点: "news",
  即时报道: "news",
  地方新闻: "news",
  农网推荐: "news",
  工作信息: "news",
  工作进行时: "news",
  决策部署: "news",
  专项工作: "news",
  标准化工作: "news",
  政务联播: "news",
  政务直播: "news",
  全国联播: "news",
  全国信息联播: "news",
  新闻发布: "news",
  新闻发布会: "news",
  市政府新闻发布会: "news",
  部新闻发布会: "news",
  国新办新闻发布会: "news",
  国务院政策例行吹风会: "news",
  市委会议: "news",
  市人大会议: "news",
  市政府会议: "news",
  市政协会议: "news",
  会议活动: "news",
  图片新闻: "news",
  图文报道: "news",
  文字报道: "news",
  视频: "news",
  专题视频: "news",
  直播访谈: "news",
  访谈: "news",
  热点专题: "news",
  相关专题: "news",
  专题: "news",
  交点大图: "news",
  领导活动: "news",
  领导活动总: "news",
  部领导活动: "news",
  领导介绍: "news",
  "韩俊-活动": "news",
  "韩俊-图片": "news",
  "黄艳-活动": "news",
  "江文胜-活动": "news",
  "麦尔丹·木盖提-活动": "news",
  "潘文博-活动": "news",
  "陶怀颖-活动": "news",
  "吴qh-活动": "news",
  "张xw-活动": "news",
  "张zl-活动": "news",
  司局负责人发布: "news",
  国际交流: "news",
  对外交流: "news",
  基层: "news",
  各区热点: "news",
  各区专栏: "news",
  促进农产品生产: "news",
  第三次全国土壤普查: "news",
  电子信息制造业: "news",
  原材料工业: "news",
  装备工业: "news",
  消费品工业: "news",
  软件业: "news",
  互联网: "news",
  通信业: "news",
  农民日报: "news",
  节庆活动管理: "news",
  应急管理: "news",
  重点推荐: "news",
  社会艺术水平考级: "news",

  // —— finance：财政 / 数据 / 公开 ——
  财政数据: "finance",
  财政预决算: "finance",
  财政收支: "finance",
  部门预决算: "finance",
  市财政局预决算: "finance",
  北京市各区财政预决算: "finance",
  政府债券管理: "finance",
  政府信息公开目录: "finance",
  依法行政双公示: "finance",
  人事信息: "finance",
  办事统计: "finance",
  经济运行: "finance",
  北京工业年鉴: "finance",
  专题数据库: "finance",
  财务信息: "finance",

  // —— service：办事 / 服务 / 企业 ——
  开办企业: "service",
  办理建筑许可: "service",
  财产登记: "service",
  政府采购: "service",
  执行合同: "service",
  获得信贷: "service",
  跨境贸易: "service",
  企业人才引进: "service",
  纳税: "service",
  获得电力: "service",
  政务服务便利化: "service",
  办理破产: "service",
  企业服务: "service",
  行政事业性收费: "service",
  减税降费和营商环境建设: "service",
  出行提示: "service",
  三农信箱: "service",
  公益助农: "service",
  建议提案复文: "service",
  全国人大代表建议复文公开: "service",
  全国政协委员提案公开: "service",
  干部培训: "service",
  公务员考录: "service",
  公务员招录: "service",

  // —— party：党建 / 学习 / 研究 ——
  党建工作: "party",
  机关党建: "party",
  学习视频: "party",
  中央指示精神: "party",
  四强党支部: "party",
  政绩观学习教育: "party",
  学而时习: "party",
  三农学习谈: "party",
  三农大家谈: "party",
  三农论述资料库: "party",
  仲农平: "party",
  深壹度: "party",
  观点: "party",
  审计科研: "party",
  审计融媒体: "party",
  审计知识: "party",
  学会: "party",
  协会: "party",
  研究会: "party",
  基金会: "party",
  促进会: "party",
  其他: "other",
  "其他（社会组织）": "other",
};

// —— 关键词兜底：精确表未命中时，按关键词猜测 ——
const KEYWORD_RULES: Array<{ keywords: string[]; group: ChannelGroupKey }> = [
  {
    keywords: [
      "政策",
      "文件",
      "法规",
      "规章",
      "法律",
      "意见",
      "方案",
      "规划",
      "部令",
      "命令",
      "决议",
      "批复",
      "中央文件",
      "国务院文件",
      "市政府文件",
      "地方性法规",
      "规范性",
      "惠企助企",
      "政策说明书",
      "政策集成",
    ],
    group: "policy",
  },
  {
    keywords: ["通知", "公告", "通告", "通报", "公开", "采购公告"],
    group: "notice",
  },
  {
    keywords: ["解读", "图解", "案例解读", "实施效果"],
    group: "interpretation",
  },
  {
    keywords: [
      "动态",
      "要闻",
      "新闻",
      "时政",
      "头条",
      "专题",
      "会议",
      "报道",
      "图片",
      "视频",
      "直播",
      "访谈",
      "联播",
      "领导活动",
      "领导",
      "工作信息",
      "工作进行",
      "决策部署",
      "专项工作",
      "国际交流",
      "对外交流",
      "热点",
      "焦点",
      "重点推荐",
    ],
    group: "news",
  },
  {
    keywords: [
      "财政",
      "预决算",
      "收支",
      "债券",
      "经济运行",
      "年鉴",
      "人事",
      "公开目录",
      "双公示",
      "统计",
      "数据库",
    ],
    group: "finance",
  },
  {
    keywords: [
      "办事",
      "服务",
      "许可",
      "登记",
      "采购",
      "合同",
      "信贷",
      "贸易",
      "引进",
      "人才",
      "纳税",
      "电力",
      "破产",
      "企业",
      "收费",
      "减税",
      "营商",
      "提示",
      "信箱",
      "公益",
      "考录",
      "招录",
      "培训",
    ],
    group: "service",
  },
  {
    keywords: [
      "党建",
      "学习",
      "中央指示",
      "党支部",
      "政绩观",
      "学而时习",
      "三农学习谈",
      "三农大家谈",
      "论述资料",
      "观点",
      "科研",
      "知识",
      "学会",
      "协会",
      "研究会",
      "基金会",
      "促进会",
    ],
    group: "party",
  },
];

/** 把一个原始 channelName 归入某个大类。空值归入 "other"。 */
export function classifyChannelGroup(channelName: string | null | undefined): ChannelGroupKey {
  if (!channelName) return "other";
  const key = String(channelName).trim();
  if (!key) return "other";
  if (EXACT_MAP[key]) return EXACT_MAP[key];
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => key.includes(kw))) return rule.group;
  }
  return "other";
}

/** 给定一批栏目名+数量，按大类聚合后返回各分类的总条目数。 */
export function groupChannelCounts(
  channels: Array<{ channelName: string; count: number }>,
): Array<{ group: ChannelGroupKey; label: string; count: number }> {
  const totals = new Map<ChannelGroupKey, number>();
  for (const c of channels) {
    const g = classifyChannelGroup(c.channelName);
    totals.set(g, (totals.get(g) ?? 0) + Math.max(0, Number(c.count) || 0));
  }
  return CHANNEL_GROUPS.map((g) => ({
    group: g.key,
    label: g.label,
    count: totals.get(g.key) ?? 0,
  }));
}

/** 把一批大类 key 展开成它所包含的原始栏目名集合。用于把"选大类"还原成"选栏目"。 */
export function expandGroupsToChannelNames(
  groups: Iterable<ChannelGroupKey>,
  allChannelNames: Iterable<string>,
): Set<string> {
  const want = new Set<ChannelGroupKey>(groups);
  const result = new Set<string>();
  for (const name of allChannelNames) {
    if (want.has(classifyChannelGroup(name))) result.add(name);
  }
  return result;
}
