import type { StructuredSummaryData } from "@/components/structured-summary";
import type { KeywordBreakdownData } from "@/components/keyword-breakdown";
import type { RelatedItemsData } from "@/components/related-items";
import type { PolicyEvolutionData } from "@/components/item-history";

const CORE_CONTENT_TEMPLATES = [
  "明确了行业发展的总体目标和核心任务，提出到2026年实现关键核心技术自主可控的阶段性目标",
  "建立了分级分类监管体系，根据业务类型和风险等级实施差异化监管措施",
  "加大了财政资金支持力度，设立专项基金用于关键技术研发和产业化应用",
  "推动试点示范工作，支持有条件的地区先行先试，形成可复制可推广的经验",
  "强化了数据安全和个人信息保护要求，明确了数据处理者的主体责任",
];

const IMPACT_INDUSTRIES = [
  "人工智能",
  "大数据",
  "云计算",
  "数字经济",
  "智能制造",
  "新能源",
  "生物医药",
];

const IMPACT_DEPARTMENTS = [
  "工业和信息化部",
  "国家发展改革委",
  "财政部",
  "科技部",
  "国家互联网信息办公室",
];

const IMPACT_REGIONS = [
  "北京",
  "上海",
  "粤港澳大湾区",
  "长三角地区",
  "京津冀",
];

const TIMELINE_EVENTS = [
  { event: "文件正式发布并立即生效", type: "effective" as const },
  { event: "项目申报截止日期", type: "deadline" as const },
  { event: "试点工作启动", type: "milestone" as const },
  { event: "中期评估与调整", type: "review" as const },
  { event: "年度总结报告提交", type: "deadline" as const },
];

const ACTION_ITEMS = [
  { action: "组织相关部门学习文件精神，制定落实方案", priority: "high" as const, department: "政策研究部" },
  { action: "梳理现有业务与政策的契合点，评估申报机会", priority: "high" as const, department: "政府事务部" },
  { action: "准备申报材料，对接相关部委争取支持", priority: "medium" as const, department: "公共事务部" },
  { action: "建立内部监测机制，跟踪政策后续进展", priority: "medium" as const, department: "战略规划部" },
  { action: "将政策要求纳入产品合规检查清单", priority: "low" as const, department: "法务合规部" },
];

const KEYWORD_CATEGORIES = [
  {
    category: "AI/智能体/大模型",
    keywords: [
      { keyword: "人工智能", weight: 15, importance: "核心技术方向，决定产业发展格局" },
      { keyword: "大模型", weight: 12, importance: "当前技术制高点，竞争力关键" },
      { keyword: "智能体", weight: 10, importance: "下一代应用形态，新的流量入口" },
    ],
  },
  {
    category: "B·强支持信号",
    keywords: [
      { keyword: "专项资金", weight: 8, importance: "直接的资金支持，降低研发成本" },
      { keyword: "补贴", weight: 6, importance: "财政支持信号，利好相关企业" },
    ],
  },
  {
    category: "数据要素/高质量数据集",
    keywords: [
      { keyword: "数据要素", weight: 10, importance: "新型生产要素，战略资源地位" },
      { keyword: "数据流通", weight: 7, importance: "数据价值释放的关键环节" },
    ],
  },
];

const KEYWORD_CONTEXTS = [
  "为推动人工智能产业创新发展，加快大模型技术研发与应用落地",
  "设立人工智能产业发展专项资金，支持关键核心技术攻关",
  "推进数据要素市场化配置，促进数据合规有序流通",
  "鼓励智能体技术创新，培育新产业新业态新模式",
];

const RELATED_TOPIC_TITLES = [
  "关于印发《人工智能产业创新发展行动计划》的通知",
  "国家新一代人工智能标准体系建设指南",
  "关于加快推进数据要素市场化配置的指导意见",
  "智能体技术与产业发展白皮书",
  "关于支持数字经济核心产业发展的若干措施",
];

const RELATED_DEPT_TITLES = [
  "工业和信息化部关于促进中小企业发展的指导意见",
  "工业和信息化部办公厅关于开展产业集群培育工作的通知",
  "工业和信息化部关于加强质量品牌建设的意见",
  "工业和信息化部关于推进制造业数字化转型的通知",
];

const CITED_TITLES = [
  "《中华人民共和国国民经济和社会发展第十四个五年规划》",
  "《新一代人工智能发展规划》",
  "《关于构建数据基础制度更好发挥数据要素作用的意见》",
];

const HISTORY_STAGES = [
  { stage: "early" as const, title: "关于促进人工智能发展的指导意见", keyPoint: "首次明确将人工智能列为重点发展方向" },
  { stage: "draft" as const, title: "新一代人工智能发展规划（征求意见稿）", keyPoint: "面向社会公开征求意见，规划产业发展蓝图" },
  { stage: "official" as const, title: "新一代人工智能发展规划", keyPoint: "正式发布，确立三步走战略目标" },
  { stage: "trial" as const, title: "国家人工智能创新应用先导区建设方案", keyPoint: "启动试点工作，探索落地路径" },
  { stage: "update" as const, title: "人工智能产业创新发展行动计划（2026-2028年）", keyPoint: "新阶段新目标，聚焦大模型和智能体" },
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomDate(baseDaysAgo: number, rangeDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() - baseDaysAgo - Math.floor(Math.random() * rangeDays));
  return date.toISOString().split("T")[0];
}

const TITLE_KEYWORD_HINTS: Array<{ keywords: string[]; coreBoost: number[]; industryBoost: number[] }> = [
  {
    keywords: ["人工智能", "AI", "大模型", "智能体"],
    coreBoost: [0, 1, 3],
    industryBoost: [0, 1, 3],
  },
  {
    keywords: ["数据", "数据要素", "数据安全"],
    coreBoost: [0, 4],
    industryBoost: [1, 3],
  },
  {
    keywords: ["财政", "资金", "补贴", "预算"],
    coreBoost: [2],
    industryBoost: [3, 5],
  },
  {
    keywords: ["试点", "示范", "先行"],
    coreBoost: [3],
    industryBoost: [3, 4],
  },
  {
    keywords: ["文化", "旅游"],
    coreBoost: [0, 3],
    industryBoost: [6],
  },
];

function pickWeightedRandom<T>(arr: T[], boostIndices: number[], n: number): T[] {
  const scores = arr.map((_, i) => (boostIndices.includes(i) ? 3 : 1) * (0.5 + Math.random()));
  const indexed = scores.map((s, i) => ({ s, i }));
  indexed.sort((a, b) => b.s - a.s);
  return indexed.slice(0, Math.min(n, arr.length)).map(({ i }) => arr[i]);
}

function getTitleBoost(title: string): { coreBoost: number[]; industryBoost: number[] } {
  if (!title) return { coreBoost: [], industryBoost: [] };
  const lowerTitle = title.toLowerCase();
  for (const hint of TITLE_KEYWORD_HINTS) {
    if (hint.keywords.some((kw) => lowerTitle.includes(kw.toLowerCase()))) {
      return { coreBoost: hint.coreBoost, industryBoost: hint.industryBoost };
    }
  }
  return { coreBoost: [], industryBoost: [] };
}

export function generateMockStructuredSummary(itemTitle?: string): StructuredSummaryData {
  const { coreBoost, industryBoost } = getTitleBoost(itemTitle ?? "");
  const coreCount = 3 + Math.floor(Math.random() * 2);
  const industryCount = 3 + Math.floor(Math.random() * 3);

  return {
    coreContent: pickWeightedRandom(CORE_CONTENT_TEMPLATES, coreBoost, coreCount),
    impactScope: {
      industries: pickWeightedRandom(IMPACT_INDUSTRIES, industryBoost, industryCount),
      departments: pickRandom(IMPACT_DEPARTMENTS, 2 + Math.floor(Math.random() * 2)),
      regions: pickRandom(IMPACT_REGIONS, 2 + Math.floor(Math.random() * 2)),
    },
    timeline: pickRandom(TIMELINE_EVENTS, 3 + Math.floor(Math.random() * 3))
      .map((e, i) => ({
        ...e,
        date: randomDate(i * 30, 15),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    actionItems: pickRandom(ACTION_ITEMS, 3 + Math.floor(Math.random() * 3)).map((item, i) => ({
      ...item,
      deadline: item.priority === "high" ? randomDate(10 + i * 5, 10) : undefined,
    })),
  };
}

export function generateMockKeywordBreakdown(totalScore: number = 95): KeywordBreakdownData {
  const rawCategoryBreakdown = KEYWORD_CATEGORIES.map((cat) => ({
    category: cat.category,
    rawScore: cat.keywords.reduce((sum, k) => sum + k.weight, 0),
    keywords: cat.keywords.map((kw) => ({
      ...kw,
      category: cat.category,
      context: pickRandom(KEYWORD_CONTEXTS, 1 + Math.floor(Math.random() * 2)),
    })),
  }));

  const rawTotal = rawCategoryBreakdown.reduce((sum, c) => sum + c.rawScore, 0);
  const scaleFactor = rawTotal > 0 ? totalScore / rawTotal : 1;

  const categoryBreakdown = rawCategoryBreakdown.map((cat) => {
    const scaledKeywords = cat.keywords.map((kw) => ({
      ...kw,
      weight: Math.max(1, Math.round(kw.weight * scaleFactor)),
    }));
    const categoryScore = scaledKeywords.reduce((sum, k) => sum + k.weight, 0);
    return {
      category: cat.category,
      score: categoryScore,
      keywords: scaledKeywords,
    };
  });

  const finalTotal = categoryBreakdown.reduce((sum, c) => sum + c.score, 0);

  return {
    totalScore: finalTotal,
    categoryBreakdown,
  };
}

export function generateMockRelatedItems(
  departmentName: string = "工业和信息化部"
): RelatedItemsData {
  const sameTopic = pickRandom(RELATED_TOPIC_TITLES, 4).map((title, i) => ({
    sourceId: `mock_rel_topic_${i}`,
    url: `https://example.com/related-topic/${i}`,
    title,
    departmentName: IMPACT_DEPARTMENTS[i % IMPACT_DEPARTMENTS.length],
    listPublishedAt: randomDate(10 + i * 20, 10),
    keywordScore: 60 + Math.floor(Math.random() * 35),
    importanceLevel: i < 2 ? "核心关注" : "重点内容",
    relationType: "sameTopic" as const,
    similarityScore: 65 + Math.floor(Math.random() * 30),
  }));

  const sameDept = pickRandom(RELATED_DEPT_TITLES, 3).map((title, i) => ({
    sourceId: `mock_rel_dept_${i}`,
    url: `https://example.com/related-dept/${i}`,
    title,
    departmentName,
    listPublishedAt: randomDate(20 + i * 30, 15),
    keywordScore: 30 + Math.floor(Math.random() * 40),
    importanceLevel: i === 0 ? "重点内容" : "普通内容",
    relationType: "sameDept" as const,
  }));

  const cited = pickRandom(CITED_TITLES, 2 + Math.floor(Math.random() * 2)).map((title, i) => ({
    sourceId: `mock_cited_${i}`,
    url: `https://example.com/cited/${i}`,
    title,
    departmentName: "国务院",
    listPublishedAt: randomDate(200 + i * 100, 50),
    keywordScore: 80 + Math.floor(Math.random() * 20),
    importanceLevel: "核心关注",
    relationType: "cited" as const,
  }));

  return {
    sameTopic,
    sameDept,
    cited,
  };
}

export function generateMockPolicyEvolution(domain: string = "人工智能产业发展"): PolicyEvolutionData {
  const timeline = HISTORY_STAGES.map((item, i) => ({
    sourceId: `mock_hist_${i}`,
    url: `https://example.com/history/${i}`,
    title: item.title,
    departmentName: i === 0 ? "工业和信息化部" : i === 2 ? "国务院" : "国家发展改革委",
    publishedAt: randomDate((HISTORY_STAGES.length - i) * 180, 60),
    stage: item.stage,
    keyPoint: item.keyPoint,
  }));

  return {
    domain,
    timeline,
    currentStage: "行动计划阶段 - 聚焦落地实施",
    trendSummary: "政策从顶层设计逐步走向落地实施，支持力度持续加大，监管框架不断完善，产业发展进入加速期。",
  };
}
