import { mockDelay, getMockDelayMs } from "@/lib/mock";
import type { ForecastItem, ForecastStats } from "./types";

export { mockDelay, getMockDelayMs };
export type { MockArticle };

type MockArticle = {
  title: string;
  dept: string;
  channel: string;
  url: string;
  summary: string;
  paragraphs: string[];
  region: "domestic" | "global";
};

// 演示数据用可复现的伪随机（mulberry32）替代 Math.random()。
// 原因：这些 generateMock* 会在 useState 初始化里同时跑在 SSR 和客户端 hydration，
// Math.random() 两端结果不同 → React 水合报错（雷达图点位/标签不一致）。
// 每个生成函数入口 seedMock(固定值) 复位种子，保证服务端与客户端产出完全一致。
let _mockSeed = 0x9e3779b9;
function seedMock(s: number) {
  _mockSeed = s >>> 0;
}
function rng() {
  _mockSeed = (_mockSeed + 0x6d2b79f5) | 0;
  let t = Math.imul(_mockSeed ^ (_mockSeed >>> 15), 1 | _mockSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// 确定性洗牌：Fisher-Yates 每次消耗固定数量的 rng()、顺序固定，
// 跨环境（Node 服务端 / 浏览器）结果一致。
// 不能用 arr.sort(() => rng() - 0.5)：带副作用的比较器调用次数依赖 V8 排序实现，
// 服务端与客户端的 V8 版本不同会导致 rng 流错位 → 水合失配。
function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MOCK_ARTICLES: MockArticle[] = [
  {
    title: "工业和信息化部关于印发《生成式人工智能产业创新发展行动方案（2026—2028年）》的通知",
    dept: "工业和信息化部",
    channel: "政策发布",
    url: "https://www.miit.gov.cn/zwgk/zcwj/wjfb/202607/demo_miit_01.html",
    region: "domestic" as const,
    summary: "工信部印发三年行动方案，部署大模型基础能力、行业垂类应用与智能算力供给，明确到2028年建成一批标杆应用场景，并对首版次人工智能产品给予采购与保险补偿支持。",
    paragraphs: [
      "为推动生成式人工智能与实体经济深度融合，工业和信息化部制定本行动方案。",
      "方案提出三条主线：夯实大模型基础能力、培育行业垂直应用、强化智能算力与高质量数据供给。",
      "重点支持制造、医疗、教育等领域的垂类模型落地，到2028年建成不少于100个标杆应用场景。",
      "对首版次人工智能软硬件产品，探索政府采购首购、首试用及保险补偿机制。",
      "各地工信主管部门须于2026年底前出台配套实施细则，并建立揭榜挂帅项目库。",
    ],
  },
  {
    title: "国家互联网信息办公室关于《人工智能生成合成内容标识办法》公开征求意见的公告",
    dept: "国家互联网信息办公室",
    channel: "征求意见",
    url: "https://www.cac.gov.cn/2026-06/demo_cac_02.htm",
    region: "domestic" as const,
    summary: "网信办就AI生成合成内容标识办法公开征求意见，拟要求生成式AI服务对文本、图片、音视频等添加显式与隐式标识，平台须对疑似生成内容进行提示，意见反馈截止8月20日。",
    paragraphs: [
      "为规范人工智能生成合成内容，防范深度伪造与虚假信息风险，特起草本办法并公开征求意见。",
      "办法拟要求生成式人工智能服务提供者对生成内容添加显式标识与文件元数据隐式标识。",
      "内容传播平台应对疑似生成合成内容进行核验，并在展示界面作出必要提示。",
      "标识不得被恶意删除、篡改或伪造，相关技术要求将同步发布配套国家标准。",
      "公众可于2026年8月20日前通过官网或电子邮件反馈意见。",
    ],
  },
  {
    title: "国家发展改革委等部门关于深入推进“东数西算”与全国一体化算力网建设的实施意见",
    dept: "国家发展和改革委员会",
    channel: "政策发布",
    url: "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202606/demo_ndrc_03.html",
    region: "domestic" as const,
    summary: "发改委等部门部署一体化算力网建设，优化八大枢纽节点布局，提出智能算力占比、绿电使用与算力时延等约束指标，并推动算力券、算电协同等市场化机制。",
    paragraphs: [
      "为提升算力资源利用效率、支撑人工智能规模化应用，多部门联合印发本实施意见。",
      "意见提出优化八大国家枢纽节点与数据中心集群布局，引导训练算力向西部绿电富集地区集聚。",
      "明确到2027年，全国智能算力占比、数据中心绿电使用率与关键节点网络时延等约束性指标。",
      "推动算力券、算力交易平台与“算电协同”机制，降低中小企业用算成本。",
      "京津冀、长三角等区域先行开展跨省算力调度与协同试点。",
    ],
  },
  {
    title: "财政部关于印发《支持数据要素市场化配置专项资金管理办法》的通知",
    dept: "财政部",
    channel: "通知公告",
    url: "https://www.mof.gov.cn/gkml/caizhengwengao/202606/demo_mof_04.html",
    region: "domestic" as const,
    summary: "财政部设立数据要素专项资金，支持公共数据授权运营、高质量数据集建设与数据流通基础设施，单个项目最高支持2000万元，申报截止9月30日。",
    paragraphs: [
      "为培育数据要素市场、释放数据要素价值，财政部制定本专项资金管理办法。",
      "资金重点支持公共数据授权运营平台、行业高质量数据集与可信数据空间建设。",
      "单个项目支持比例不超过总投资的30%，最高不超过2000万元。",
      "申报主体须为具备数据合规与安全能力的企事业单位，并提交数据来源合法性证明。",
      "2026年度申报窗口于9月30日截止，逾期不予受理。",
    ],
  },
  {
    title: "国务院办公厅关于印发《“人工智能+”行动实施方案》的通知",
    dept: "国务院办公厅",
    channel: "政策发布",
    url: "https://www.gov.cn/zhengce/content/202607/demo_gov_05.htm",
    region: "domestic" as const,
    summary: "国办部署“人工智能+”行动，推动AI在科研、制造、消费、政务等领域深度应用，提出建设开放场景、开放数据与开放模型的“三开放”机制，并强化算力与人才保障。",
    paragraphs: [
      "为加快人工智能赋能千行百业，国务院办公厅印发“人工智能+”行动实施方案。",
      "方案覆盖人工智能+科研、+制造、+消费、+政务等重点方向，明确阶段性目标。",
      "提出开放应用场景、开放高质量数据、开放基础模型的“三开放”支撑机制。",
      "强化智能算力统筹、人才引育与安全治理等保障措施。",
      "建立跨部门推进机制，年度评估各领域标杆应用落地成效。",
    ],
  },
  {
    title: "科学技术部关于加强人工智能基础研究与科技伦理治理的若干措施",
    dept: "科学技术部",
    channel: "政策发布",
    url: "https://www.most.gov.cn/xxgk/xinxifenlei/fdzdgknr/202606/demo_most_06.html",
    region: "domestic" as const,
    summary: "科技部部署人工智能基础研究，加大对大模型理论、可解释性与具身智能的支持，同时建立科技伦理审查与风险评估机制，要求高风险AI研发开展伦理先行审查。",
    paragraphs: [
      "为夯实人工智能原始创新能力，科学技术部提出加强基础研究的若干措施。",
      "重点支持大模型基础理论、可解释性、具身智能与AI for Science等前沿方向。",
      "建立人工智能科技伦理审查与风险评估机制，高风险研发实行伦理先行审查。",
      "鼓励设立长期稳定支持的基础研究专项，允许一定比例的探索性失败。",
      "推动科研数据、算力与开源模型的共享共用。",
    ],
  },
  {
    title: "工业和信息化部关于开展智能算力标准体系建设与首批标准立项的通知",
    dept: "工业和信息化部",
    channel: "通知公告",
    url: "https://www.miit.gov.cn/zwgk/zcwj/wjfb/202605/demo_miit_07.html",
    region: "domestic" as const,
    summary: "工信部启动智能算力标准体系建设，覆盖算力度量、互联互通、绿色低碳与调度交易等方向，公开征集首批标准起草单位，鼓励产学研联合申报。",
    paragraphs: [
      "为解决算力“度量难、互通难、调度难”问题，工业和信息化部推进智能算力标准体系建设。",
      "标准体系涵盖算力度量与评测、异构算力互联、绿色低碳与算力调度交易四大方向。",
      "首批拟立项一批急需标准，公开征集起草单位与试验验证平台。",
      "鼓励芯片、云服务、运营商与科研机构组成联合体协同起草。",
      "相关标准将在国家算力枢纽节点先行开展试点验证。",
    ],
  },
  {
    title: "国家数据局、国家发展改革委关于加快构建数据基础制度体系的指导意见",
    dept: "国家发展和改革委员会",
    channel: "政策发布",
    url: "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202606/demo_ndrc_08.html",
    region: "domestic" as const,
    summary: "两部门就数据产权、流通交易、收益分配与安全治理等基础制度作出部署，探索数据资源持有权、加工使用权、经营权“三权分置”，推动公共数据有条件开放。",
    paragraphs: [
      "为落实数据基础制度“20条”，两部门联合印发本指导意见。",
      "在数据产权方面，探索建立数据资源持有权、加工使用权、经营权“三权分置”。",
      "在流通交易方面，培育数据交易场所与数据商、第三方专业服务机构。",
      "在收益分配方面，坚持“谁投入、谁贡献、谁受益”，兼顾公共利益。",
      "推动公共数据分类分级授权使用，先行在重点行业开展应用试点。",
    ],
  },
  {
    title: "北京市人民政府关于建设通用人工智能创新引领区与深化京津冀算力协同的实施方案",
    dept: "北京市人民政府",
    channel: "要闻",
    url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/demo_bj_09.html",
    region: "domestic" as const,
    summary: "北京部署通用人工智能创新引领区，支持大模型企业集聚与开源生态建设，并推动与津冀在算力调度、语料共享与场景开放上的协同，设立市级人工智能专项资金。",
    paragraphs: [
      "为打造具有全球影响力的人工智能创新策源地，北京市制定本实施方案。",
      "重点建设通用人工智能创新引领区，支持大模型研发、开源社区与算法开放平台。",
      "推动京津冀在智能算力跨区域调度、高质量语料共享与应用场景开放上的协同。",
      "设立市级人工智能专项资金，对基础大模型与关键场景应用给予支持。",
      "配套数据、算力与人才政策，探索监管沙盒支持前沿技术落地。",
    ],
  },
  {
    title: "国家发展改革委关于促进平台经济规范健康发展与数字经济提质增效的若干政策",
    dept: "国家发展和改革委员会",
    channel: "政策发布",
    url: "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202605/demo_ndrc_10.html",
    region: "domestic" as const,
    summary: "发改委出台促进平台经济与数字经济政策，支持平台企业投入人工智能与实体经济融合，规范数据与算法应用，明确对中小微企业数字化转型的支持举措。",
    paragraphs: [
      "为激发数字经济活力、稳定市场预期，国家发展改革委出台本政策。",
      "支持平台企业加大人工智能、云计算等核心技术投入，赋能实体经济。",
      "规范平台数据采集使用与算法推荐，保护用户与经营者合法权益。",
      "对中小微企业上云用数赋智给予补贴与服务券支持。",
      "建立常态化政企沟通机制，及时回应企业关切。",
    ],
  },
  {
    title: "财政部关于在政府采购中支持国产人工智能与信息技术应用创新的通知",
    dept: "财政部",
    channel: "通知公告",
    url: "https://www.mof.gov.cn/gkml/caizhengwengao/202605/demo_mof_11.html",
    region: "domestic" as const,
    summary: "财政部明确在政府采购中支持国产人工智能软硬件与信创产品，探索首购首用、创新产品预留份额与联合体投标，降低创新型中小企业参与门槛。",
    paragraphs: [
      "为发挥政府采购促进创新的政策功能，财政部印发本通知。",
      "在依法合规前提下，支持采购安全可靠的国产人工智能软硬件与信创产品。",
      "探索创新产品首购首用、预留一定采购份额及联合体投标机制。",
      "简化中小企业参与政府采购的资质要求与流程。",
      "各级财政部门须加强采购需求管理与履约验收。",
    ],
  },
  {
    title: "国家互联网信息办公室关于数据出境安全管理与重要数据识别的补充规定",
    dept: "国家互联网信息办公室",
    channel: "政策发布",
    url: "https://www.cac.gov.cn/2026-05/demo_cac_12.htm",
    region: "domestic" as const,
    summary: "网信办就数据出境安全评估与重要数据识别发布补充规定，优化自贸区负面清单机制，明确一般数据可自由流动，并细化重要数据识别标准与企业合规义务。",
    paragraphs: [
      "为统筹数据安全与数据跨境流动，国家互联网信息办公室发布本补充规定。",
      "明确一般数据可依法自由跨境流动，聚焦对重要数据与个人信息的管理。",
      "支持自由贸易试验区探索制定数据出境负面清单。",
      "细化重要数据识别标准，减轻企业不必要的合规负担。",
      "企业应建立数据分类分级与出境合规内部管理机制。",
    ],
  },
  {
    title: "欧盟《人工智能法案》高风险条款分阶段生效，通用大模型合规要求落地",
    dept: "欧盟委员会",
    channel: "要闻",
    url: "https://digital-strategy.ec.europa.eu/en/demo-ai-act-13",
    region: "global" as const,
    summary: "欧盟AI法案关于通用目的AI与高风险系统的义务分阶段生效，要求大模型提供者披露训练数据摘要、履行透明度与版权合规义务，对我国出海企业形成合规牵引。",
    paragraphs: [
      "欧盟《人工智能法案》进入分阶段实施，通用目的AI模型义务先行落地。",
      "大模型提供者需公开训练数据摘要、遵守透明度与欧盟版权合规要求。",
      "被列为高风险的应用场景须满足风险管理、数据治理与人工监督要求。",
      "违规最高可处以全球营业额一定比例的罚款。",
      "对出海欧洲的中国人工智能企业形成明确的合规牵引，值得持续跟踪。",
    ],
  },
  {
    title: "美国更新先进计算芯片与AI模型权重出口管制，强化算力管控",
    dept: "美国商务部",
    channel: "要闻",
    url: "https://www.bis.gov/demo-ai-export-14",
    region: "global" as const,
    summary: "美国商务部更新对先进AI芯片、半导体设备及部分模型权重的出口管制，收紧对特定地区的算力供给，全球算力供应链与国产替代进程受到直接影响。",
    paragraphs: [
      "美国商务部工业与安全局更新面向人工智能的出口管制规则。",
      "管制范围覆盖先进计算芯片、半导体制造设备及部分前沿模型权重。",
      "对特定国家和地区的高端算力供给进一步收紧。",
      "全球算力供应链、云服务布局与国产替代进程受到直接影响。",
      "相关动态对国内算力自主与大模型训练策略具有重要参考价值。",
    ],
  },
  {
    title: "OECD更新人工智能原则并推进全球AI治理框架协作",
    dept: "经济合作与发展组织",
    channel: "行业研究",
    url: "https://oecd.ai/en/demo-ai-principles-15",
    region: "global" as const,
    summary: "OECD更新人工智能原则，聚焦生成式AI带来的安全、透明与问责挑战，并推动各国在风险分级、评测与信息共享上的国际协作，为全球AI治理提供参照。",
    paragraphs: [
      "经济合作与发展组织更新其人工智能原则，回应生成式AI的新型风险。",
      "强调安全、透明、可问责与以人为本等核心价值。",
      "推动成员国在AI风险分级、模型评测与事故信息共享上的协作。",
      "报告分析了主要经济体AI监管路径的异同与趋势。",
      "为观察全球人工智能治理走向提供重要参照，属探索性跟踪内容。",
    ],
  },
];

const MOCK_TITLES = MOCK_ARTICLES.map((a) => a.title);
const MOCK_DEPARTMENTS = ["工业和信息化部", "国家互联网信息办公室", "国家发展和改革委员会", "财政部", "北京市人民政府"];
const MOCK_DEPARTMENTS_WITH_COUNT = MOCK_DEPARTMENTS.map((name, i) => ({
  departmentName: name,
  count: [320, 180, 145, 98, 76][i] ?? 50,
}));
const MOCK_CHANNELS = ["通知公告", "政策发布", "要闻", "征求意见"];
const MOCK_GENRES = ["通知", "公告", "意见", "办法", "方案"];
const MOCK_IMPORTANCE_LEVELS = ["核心关注", "重点内容", "普通内容"];

const MOCK_SIGNAL_CATEGORIES = [
  "A·强执行信号",
  "B·强支持信号",
  "C·风险信号",
  "D·探索信号",
  "通用启动/落地",
];

const MOCK_TOPIC_CATEGORIES = [
  "AI/智能体/大模型",
  "算力/算力网/算电协同",
  "数据要素/高质量数据集",
  "产业合作/京津冀协同",
  "政务服务/平台经济/数字经济",
  "法规/征求意见",
];

const MOCK_KEYWORDS_BY_CATEGORY: Record<string, string[]> = {
  "A·强执行信号": ["执行", "落实", "实施", "考核", "目标"],
  "B·强支持信号": ["补贴", "资金", "支持", "优惠", "扶持"],
  "C·风险信号": ["监管", "风险", "合规", "安全", "审查"],
  "D·探索信号": ["试点", "探索", "研究", "示范", "创新"],
  "通用启动/落地": ["启动", "落地", "实施", "推进", "开展"],
  "AI/智能体/大模型": ["人工智能", "大模型", "智能体", "AI", "生成式"],
  "算力/算力网/算电协同": ["算力", "数据中心", "算力网络", "算电", "云计算"],
  "数据要素/高质量数据集": ["数据", "数据要素", "数据安全", "数据共享", "数据治理"],
  "产业合作/京津冀协同": ["产业", "京津冀", "协同发展", "合作", "园区"],
  "政务服务/平台经济/数字经济": ["政务服务", "数字政府", "平台经济", "数字经济", "一网通办"],
  "法规/征求意见": ["法规", "征求意见", "规定", "办法", "条例"],
};

export { MOCK_ARTICLES };

export function generateMockItems(count: number = 15, region?: "domestic" | "global") {
  seedMock(0x1001 + count + (region === "global" ? 7 : region === "domestic" ? 3 : 0));
  const pool = region ? MOCK_ARTICLES.filter((a) => a.region === region) : MOCK_ARTICLES;
  const titles = pool.map((a) => a.title);
  const departments = MOCK_DEPARTMENTS;
  const channels = MOCK_CHANNELS;

  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(rng() * 30));

    let keywordScore: number;
    if (i < 2) {
      keywordScore = 90 + Math.floor(rng() * 11);
    } else if (i < 5) {
      keywordScore = 50 + Math.floor(rng() * 21);
    } else if (i < 10) {
      keywordScore = 15 + Math.floor(rng() * 21);
    } else {
      keywordScore = Math.floor(rng() * 11);
    }

    const hasFunding = i < 3 || rng() > 0.7;
    const hasProcurement = i === 1 || i === 4 || rng() > 0.85;
    const hasPilot = i === 0 || i === 3 || rng() > 0.8;
    const hasStandards = i === 2 || rng() > 0.85;

    const importanceLevel =
      i < 2
        ? MOCK_IMPORTANCE_LEVELS[0]
        : i < 5
        ? MOCK_IMPORTANCE_LEVELS[1]
        : MOCK_IMPORTANCE_LEVELS[2];

    const categories: Array<{ category: string; score: number; topKeywords?: string[] }> = [];

    const signalCount = i < 5 ? 2 : 1;
    const signalShuffled = shuffled(MOCK_SIGNAL_CATEGORIES);
    for (let j = 0; j < signalCount; j++) {
      const cat = signalShuffled[j];
      categories.push({
        category: cat,
        score: Math.floor(60 + rng() * 35),
        topKeywords: MOCK_KEYWORDS_BY_CATEGORY[cat]?.slice(0, 3),
      });
    }

    const topicCount = Math.min(2 + Math.floor(rng() * 2), MOCK_TOPIC_CATEGORIES.length);
    const topicShuffled = shuffled(MOCK_TOPIC_CATEGORIES);
    for (let j = 0; j < topicCount; j++) {
      const cat = topicShuffled[j];
      categories.push({
        category: cat,
        score: Math.floor(30 + rng() * 50),
        topKeywords: MOCK_KEYWORDS_BY_CATEGORY[cat]?.slice(0, 3),
      });
    }

    const article = pool[i];
    const dept = article?.dept ?? departments[i % departments.length];
    const channel = article?.channel ?? channels[i % channels.length];
    const url = article?.url ?? `https://example.com/item/${i}`;

    return {
      sourceId: `src_mock_${i}`,
      departmentName: dept,
      channelName: channel,
      displayName: `${dept}·${channel}`,
      url,
      finalUrl: url,
      title: titles[i],
      listPublishedAt: date.toISOString(),
      firstSeenAt: date.toISOString(),
      isRead: rng() > 0.3,
      isStarred: i < 3,
      keywordScore,
      importanceLevel,
      categories,
      genres: [MOCK_GENRES[Math.floor(rng() * MOCK_GENRES.length)]],
      hasFunding,
      hasProcurement,
      hasPilot,
      hasStandards,
    };
  });
}

export function generateMockSourcesTree() {
  return [
    {
      departmentName: "文化和旅游部",
      displayName: "文化和旅游部",
      totalCount: 120,
      totalUnread: 25,
      unread: 25,
      channels: [
        { sourceId: "src_mct_notice", channelName: "通知公告", count: 60, unread: 15 },
        { sourceId: "src_mct_guihua", channelName: "发展规划", count: 60, unread: 10 },
      ],
    },
    {
      departmentName: "财政部",
      displayName: "财政部",
      totalCount: 200,
      totalUnread: 45,
      unread: 45,
      channels: [
        { sourceId: "src_mof_policy", channelName: "政策发布", count: 100, unread: 25 },
        { sourceId: "src_mof_manage", channelName: "资金管理", count: 100, unread: 20 },
      ],
    },
    {
      departmentName: "国务院",
      displayName: "国务院",
      totalCount: 300,
      totalUnread: 60,
      unread: 60,
      channels: [
        { sourceId: "src_gov_yaowen", channelName: "要闻", count: 150, unread: 35 },
        { sourceId: "src_gov_gonggao", channelName: "公告", count: 150, unread: 25 },
      ],
    },
    {
      departmentName: "北京市人民政府",
      displayName: "北京市人民政府",
      totalCount: 150,
      totalUnread: 30,
      unread: 30,
      channels: [
        { sourceId: "src_bj_policy", channelName: "政策文件", count: 80, unread: 18 },
        { sourceId: "src_bj_gongkai", channelName: "政务公开", count: 70, unread: 12 },
      ],
    },
  ];
}

export function generateMockDetail(sourceId: string, url: string) {
  return {
    sourceId,
    url,
    title: "关于进一步优化文旅市场环境的通知",
    departmentName: "文化和旅游部",
    channelName: "通知公告",
    listPublishedAt: new Date().toISOString(),
    summary:
      "为深入贯彻落实党中央、国务院关于优化营商环境的决策部署，进一步激发文化和旅游市场主体活力，现就优化文旅市场环境有关事项通知如下...",
    paragraphs: [
      "一、总体要求",
      "以习近平新时代中国特色社会主义思想为指导，全面贯彻党的二十大精神，坚持以人民为中心的发展思想，深化'放管服'改革，优化营商环境，激发市场活力，扩大优质供给，推动文化和旅游高质量发展。",
      "二、主要任务",
      "（一）简化审批流程。进一步压减文化和旅游领域行政许可事项，优化审批流程，压缩审批时限，提高审批效率。",
      "（二）加强事中事后监管。建立健全以'双随机、一公开'监管为基本手段、以重点监管为补充、以信用监管为基础的新型监管机制。",
      "（三）提升政务服务水平。推进文化和旅游领域政务服务标准化、规范化、便利化，实现'一网通办'。",
      "三、保障措施",
      "各地区、各有关部门要高度重视优化文旅市场环境工作，加强组织领导，完善工作机制，确保各项任务落到实处。",
    ],
    matchedKeywords: [
      { keyword: "文旅市场", weight: 80, category: "structure" },
      { keyword: "优化环境", weight: 60, category: "opportunity" },
      { keyword: "放管服", weight: 50, category: "risk" },
    ],
    categories: [
      { category: "structure", score: 85 },
      { category: "opportunity", score: 72 },
      { category: "risk", score: 45 },
    ],
    attachments: [
      { text: "附件1：文旅市场优化环境实施方案", url: "https://example.com/attach1.pdf" },
      { text: "附件2：任务分工表", url: "https://example.com/attach2.pdf" },
    ],
    isRead: false,
    isStarred: false,
  };
}

export function generateMockDimensions() {
  return {
    sourcesTree: generateMockSourcesTree(),
    categoriesWithCounts: [
      { category: "structure", count: 300 },
      { category: "opportunity", count: 150 },
      { category: "risk", count: 80 },
      { category: "standard", count: 120 },
    ],
    genresWithCounts: [
      { genre: "通知", count: 200 },
      { genre: "公告", count: 150 },
      { genre: "意见", count: 100 },
      { genre: "办法", count: 80 },
      { genre: "方案", count: 70 },
    ],
    departments: MOCK_DEPARTMENTS,
  };
}

export function generateMockGrouped() {
  return {
    summary: [
      {
        departmentName: "文化和旅游部",
        totalCount: 120,
        unreadCount: 25,
        starredCount: 5,
        latestFirstSeenAt: new Date().toISOString(),
        channels: [
          {
            sourceId: "src_mct_notice",
            channelName: "通知公告",
            displayName: "文旅部·通知公告",
            count: 60,
            unread: 15,
            starred: 3,
            items: [],
          },
          {
            sourceId: "src_mct_guihua",
            channelName: "发展规划",
            displayName: "文旅部·发展规划",
            count: 60,
            unread: 10,
            starred: 2,
            items: [],
          },
        ],
      },
      {
        departmentName: "财政部",
        totalCount: 200,
        unreadCount: 45,
        starredCount: 12,
        latestFirstSeenAt: new Date().toISOString(),
        channels: [
          {
            sourceId: "src_mof_policy",
            channelName: "政策发布",
            displayName: "财政部·政策发布",
            count: 100,
            unread: 25,
            starred: 7,
            items: [],
          },
          {
            sourceId: "src_mof_manage",
            channelName: "资金管理",
            displayName: "财政部·资金管理",
            count: 100,
            unread: 20,
            starred: 5,
            items: [],
          },
        ],
      },
    ],
    departments: MOCK_DEPARTMENTS,
    recentKeywordHits: [],
    sourcesTree: generateMockSourcesTree(),
    categoriesWithCounts: [],
    genresWithCounts: [],
  };
}

// ================ 预估中心 Mock 数据 ================

const MOCK_FORECAST_TITLES = [
  "关于开展文化和旅游数字化试点工作的通知",
  "财政部关于下达2024年文化产业发展专项资金的通知",
  "国务院关于印发《十四五》新型城镇化规划的通知",
  "关于组织开展政府采购框架协议采购工作的通知",
  "文化和旅游部关于发布行业标准的公告",
  "关于申报2024年中央财政支持文化企业发展专项资金的通知",
  "关于开展城市一刻钟便民生活圈建设试点的意见",
  "关于加强政府采购需求管理的指导意见",
  "文化和旅游部关于修订行业标准的通知",
  "关于印发财政支持做好碳达峰碳中和工作的意见",
];

export function generateMockForecastItems(): ForecastItem[] {
  seedMock(0x2002);
  const departments = ["文化和旅游部", "财政部", "国务院"];
  const channels = ["通知公告", "政策发布", "要闻"];

  return MOCK_FORECAST_TITLES.map((title, i) => {
    let keywordScore: number;
    if (i < 2) {
      keywordScore = 92 + Math.floor(rng() * 9);
    } else if (i < 5) {
      keywordScore = 55 + Math.floor(rng() * 21);
    } else if (i < 8) {
      keywordScore = 18 + Math.floor(rng() * 22);
    } else {
      keywordScore = Math.floor(rng() * 12);
    }

    return {
      sourceId: `src_mock_${i}`,
      departmentName: departments[i % departments.length],
      channelName: channels[i % channels.length],
      displayName: `${departments[i % departments.length]}·通知公告`,
      url: `https://example.com/forecast/${i}`,
      finalUrl: `https://example.com/forecast/${i}`,
      title,
      listPublishedAt: new Date(Date.now() - i * 86400000).toISOString(),
      firstSeenAt: new Date(Date.now() - i * 86400000).toISOString(),
      importanceLevel: i < 3 ? "核心关注" : i < 6 ? "重点内容" : "普通内容",
      keywordScore,
      documentStatus: null,
      hasFunding: i < 3 || i % 4 === 0,
      hasProcurement: i === 1 || i === 4 || i % 5 === 0,
      hasPilot: i === 0 || i === 3 || i % 4 === 2,
      hasStandards: i === 2 || i % 5 === 3,
      forecastHigh: i < 3 ? "高预估" : null,
      forecastMidHigh: i >= 3 && i < 6 ? "中高预估" : null,
      forecastMid: i >= 6 && i < 9 ? "中预估" : null,
      forecastLow: i >= 9 ? "低预估" : null,
      forecastNotes: null,
      forecastSources: null,
      forecastUpdatedAt: null,
      summary: "这是一条模拟的预估信号内容",
      topCategories: [],
    };
  });
}

export function calculateForecastStats(items: ForecastItem[]): ForecastStats {
  const stats: ForecastStats = {
    forecast: 0,
    signal: 0,
    funding: 0,
    procurement: 0,
    pilot: 0,
    standards: 0,
  };
  for (const it of items) {
    const hasForecast = it.forecastHigh || it.forecastMidHigh || it.forecastMid || it.forecastLow;
    const hasSignal = it.hasFunding || it.hasProcurement || it.hasPilot || it.hasStandards;
    if (hasForecast) stats.forecast++;
    if (hasSignal && !hasForecast) stats.signal++;
    if (it.hasFunding) stats.funding++;
    if (it.hasProcurement) stats.procurement++;
    if (it.hasPilot) stats.pilot++;
    if (it.hasStandards) stats.standards++;
  }
  return stats;
}

export function generateMockForecast(limit = 500): { items: ForecastItem[]; stats: ForecastStats } {
  const items = generateMockForecastItems().slice(0, limit);
  const stats = calculateForecastStats(items);
  return { items, stats };
}

// ================ Dashboard Mock 数据 ================

const MOCK_DASHBOARD_DEPARTMENTS = [
  { name: "国务院", total: 320, today: 24 },
  { name: "财政部", total: 285, today: 18 },
  { name: "国家发展和改革委员会", total: 240, today: 15 },
  { name: "工业和信息化部", total: 210, today: 12 },
  { name: "科学技术部", total: 185, today: 10 },
  { name: "文化和旅游部", total: 160, today: 8 },
  { name: "教育部", total: 145, today: 7 },
  { name: "国家卫生健康委员会", total: 130, today: 6 },
  { name: "交通运输部", total: 115, today: 5 },
  { name: "住房和城乡建设部", total: 100, today: 4 },
  { name: "农业农村部", total: 95, today: 4 },
  { name: "北京市人民政府", total: 88, today: 3 },
];

const MOCK_TOP_KEYWORDS = [
  { keyword: "政策", category: "A·强执行信号", count: 285 },
  { keyword: "通知", category: "A·强执行信号", count: 234 },
  { keyword: "实施", category: "通用启动/落地", count: 198 },
  { keyword: "管理", category: "C·风险信号", count: 176 },
  { keyword: "发展", category: "B·强支持信号", count: 165 },
  { keyword: "改革", category: "B·强支持信号", count: 152 },
  { keyword: "规划", category: "D·探索信号", count: 143 },
  { keyword: "意见", category: "法规/征求意见", count: 128 },
  { keyword: "办法", category: "法规/征求意见", count: 117 },
  { keyword: "方案", category: "A·强执行信号", count: 105 },
  { keyword: "试点", category: "D·探索信号", count: 94 },
  { keyword: "补贴", category: "B·强支持信号", count: 87 },
  { keyword: "风险", category: "C·风险信号", count: 76 },
  { keyword: "监管", category: "C·风险信号", count: 68 },
  { keyword: "合规", category: "C·风险信号", count: 59 },
  { keyword: "人工智能", category: "AI/智能体/大模型", count: 142 },
  { keyword: "数据", category: "数据要素/高质量数据集", count: 126 },
  { keyword: "数字经济", category: "政务服务/平台经济/数字经济", count: 98 },
  { keyword: "产业", category: "产业合作/京津冀协同", count: 85 },
  { keyword: "算力", category: "算力/算力网/算电协同", count: 72 },
];

export function generateMockDashboard(days: number = 14, topKeywordsLimit: number = 20) {
  seedMock(0x3003 + days + topKeywordsLimit);
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split("T")[0];
  });

  const departmentStats = MOCK_DASHBOARD_DEPARTMENTS.map((d) => ({
    departmentName: d.name,
    total: d.total,
    todayCount: d.today,
    series: dates.map((date, idx) => ({
      date,
      count: Math.floor(d.total / days + Math.sin(idx / 2) * 5 + rng() * 8),
    })),
  }));

  const signalTrendValues = (base: number, variance: number) =>
    dates.map((_, idx) => Math.max(0, Math.floor(base + Math.sin(idx / 2) * variance + rng() * variance * 0.5)));

  return {
    periodDays: days,
    counts: { total: 2073, unread: 312, starred: 86, urgent: 72, highlight: 245 },
    departmentStats,
    importanceDistribution: [
      { level: "core", label: "核心关注", count: 72, color: "#ef4444" },
      { level: "highlight", label: "重点内容", count: 245, color: "#f97316" },
      { level: "normal", label: "普通内容", count: 1380, color: "#64748b" },
      { level: "low", label: "次要信息", count: 376, color: "#94a3b8" },
    ],
    signalTrend: {
      dates,
      series: [
        { key: "risk", label: "风险信号", color: "#ef4444", values: signalTrendValues(10, 4) },
        { key: "opportunity", label: "机会信号", color: "#22c55e", values: signalTrendValues(8, 3) },
        { key: "leading", label: "前置信号", color: "#3b82f6", values: signalTrendValues(17, 5) },
      ],
    },
    topKeywords: MOCK_TOP_KEYWORDS.slice(0, topKeywordsLimit),
  };
}

// ================ Daily Summary Mock 数据 ================

const MOCK_TOP_ITEM_TITLES = [
  "关于印发《人工智能产业创新发展行动计划（2026-2028年）》的通知",
  "国家互联网信息办公室关于加快数据要素市场化配置的指导意见",
  "财政部关于印发《财政支持科技创新若干措施》的通知",
  "工业和信息化部办公厅关于开展人工智能标准体系建设试点工作的通知",
  "国家互联网信息办公室关于数据安全管理认证工作的实施细则",
  "关于推动消费品以旧换新行动方案的通知",
  "北京市经济和信息化局关于印发《北京市人工智能赋能工业互联网高质量发展实施方案》的通知",
  "关于印发《生态保护修复领域中央预算内投资专项管理办法》的通知",
];

const MOCK_TOP_DEPARTMENTS = [
  "工业和信息化部",
  "国家互联网信息办公室",
  "财政部",
  "国家发展和改革委员会",
  "北京市人民政府",
  "科技部",
];

const MOCK_TOP_CHANNELS = [
  "政策发布",
  "政策法规",
  "通知公告",
  "新闻发布",
  "标准规范",
];

const MOCK_CATEGORIES = [
  { category: "AI/智能体/大模型", score: 40 },
  { category: "B·强支持信号", score: 35 },
  { category: "数据要素", score: 30 },
  { category: "A·强执行信号", score: 25 },
  { category: "政策·行动计划", score: 20 },
  { category: "财政支持", score: 25 },
];

export function generateMockDailySummary(sinceHours: number = 24, limit: number = 10) {
  seedMock(0x4004 + sinceHours + limit);
  const days = Math.ceil(sinceHours / 24);
  const totalDays = Math.min(30, Math.max(3, days + 6));

  const dates = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (totalDays - 1 - i));
    return d.toISOString().split("T")[0];
  });

  const dailySeries = dates.map((date) => ({
    date,
    count: Math.floor(rng() * 30) + 50,
    urgent: Math.floor(rng() * 5) + 2,
    highlight: Math.floor(rng() * 10) + 5,
  }));

  const departmentStats = MOCK_DASHBOARD_DEPARTMENTS.slice(0, 12).map((d) => ({
    departmentName: d.name,
    todayCount: d.today,
    last7DaysCount: Math.floor(d.total * 0.2),
    urgentCount: Math.floor(d.today * 0.15),
    highlightCount: Math.floor(d.today * 0.3),
    totalCount: d.total,
    channelCount: Math.floor(rng() * 4) + 2,
  }));

  const topItems = Array.from(
    { length: Math.min(limit, MOCK_TOP_ITEM_TITLES.length) },
    (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(rng() * 3));
      const hasFunding = i < 3 || i % 4 === 0;
      const hasProcurement = i === 0 || i === 2 || i === 5;
      const hasPilot = i === 0 || i === 3 || i === 6;
      const hasStandards = i === 1 || i === 4;
      const keywordScore = i < 2
        ? 92 + Math.floor(rng() * 9)
        : i < 4
        ? 55 + Math.floor(rng() * 21)
        : i < 6
        ? 20 + Math.floor(rng() * 21)
        : Math.floor(rng() * 12);
      const importanceLevel =
        i < 2 ? "核心关注" : i < 4 ? "加急推荐" : i < 7 ? "重点内容" : "普通内容";

      const itemCategories = MOCK_CATEGORIES.slice(
        0,
        Math.floor(rng() * 3) + 2
      ).map((c, idx) => ({
        category: c.category,
        score: c.score - idx * 5,
        topKeywords:
          idx === 0
            ? ["政策", "创新", "发展"].slice(0, Math.floor(rng() * 3) + 1)
            : undefined,
      }));

      return {
        sourceId: `src_mock_top_${i}`,
        departmentName:
          MOCK_TOP_DEPARTMENTS[i % MOCK_TOP_DEPARTMENTS.length],
        channelName: MOCK_TOP_CHANNELS[i % MOCK_TOP_CHANNELS.length],
        title: MOCK_TOP_ITEM_TITLES[i],
        url: `https://example.com/top-item/${i}`,
        finalUrl: `https://example.com/top-item/${i}`,
        listPublishedAt: date.toISOString(),
        firstSeenAt: date.toISOString(),
        importanceLevel,
        keywordScore,
        categories: itemCategories,
        hasFunding,
        hasProcurement,
        hasPilot,
        hasStandards,
        isStarred: i === 0,
        forecastHigh: i < 3 ? "高预估内容" : null,
      };
    }
  );

  const urgentCount = topItems.filter(
    (it) => it.importanceLevel === "核心关注" || it.importanceLevel === "加急推荐"
  ).length;
  const highlightCount = topItems.filter(
    (it) => it.importanceLevel === "重点内容"
  ).length;
  const unreadCount = Math.floor(rng() * 50) + 100;

  return {
    date: new Date().toISOString().slice(0, 10),
    sinceHours,
    urgentCount,
    highlightCount,
    unreadCount,
    dailySeries,
    departmentStats,
    topItems,
  };
}

// ================ Sources Mock 数据 ================

export function generateMockSources() {
  return [
    {
      id: "src_mct_szyw_notice",
      departmentName: "文化和旅游部",
      channelGroup: "政策法规",
      channelName: "通知公告",
      displayName: "文旅部·政策法规·通知公告",
      type: "mct_szyw",
      listUrl: "https://www.mct.gov.cn/zwgk/zcfg/",
      enabled: true,
      autoMonitor: true,
      isKey: true,
      startDate: "2024-01-01",
      maxItems: 30,
      notes: "",
    },
    {
      id: "src_mct_szyw_guihua",
      departmentName: "文化和旅游部",
      channelGroup: "发展规划",
      channelName: "发展规划",
      displayName: "文旅部·发展规划",
      type: "mct_szyw",
      listUrl: "https://www.mct.gov.cn/zwgk/fzgh/",
      enabled: true,
      autoMonitor: true,
      isKey: false,
      startDate: "2024-01-01",
      maxItems: 30,
      notes: "",
    },
    {
      id: "src_mof_zhengwuxinxi",
      departmentName: "财政部",
      channelGroup: "政务信息",
      channelName: "政策发布",
      displayName: "财政部·政务信息·政策发布",
      type: "mof_zhengwuxinxi",
      listUrl: "http://www.mof.gov.cn/zhengwuxinxi/zhengcefabu/",
      enabled: true,
      autoMonitor: true,
      isKey: true,
      startDate: "2024-01-01",
      maxItems: 30,
      notes: "",
    },
    {
      id: "src_govcn_yaowen",
      departmentName: "国务院",
      channelGroup: "重要新闻",
      channelName: "要闻",
      displayName: "国务院·要闻",
      type: "govcn_yaowen",
      listUrl: "http://www.gov.cn/yaowen/",
      enabled: true,
      autoMonitor: true,
      isKey: true,
      startDate: "2024-01-01",
      maxItems: 30,
      notes: "",
    },
    {
      id: "src_beijing_gov",
      departmentName: "北京市人民政府",
      channelGroup: "政务公开",
      channelName: "政策文件",
      displayName: "北京市·政务公开·政策文件",
      type: "beijing_gov_list",
      listUrl: "http://www.beijing.gov.cn/zhengce/",
      enabled: true,
      autoMonitor: false,
      isKey: false,
      startDate: "2024-01-01",
      maxItems: 30,
      notes: "",
    },
  ];
}
