import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";
import { ensureMonitorSchema } from "@/lib/monitor/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureMonitorSchema();
    const pool = getPgPool();

    // 1. 先清理已有的 demo 数据（可选项）
    const url = new URL(request.url);
    const clean = url.searchParams.get("clean") === "1";
    if (clean) {
      await pool.query(`
        delete from monitor_items
        where source_id in (
          'demo_miit', 'demo_ndrc', 'demo_bjgov', 'demo_tjgov', 'demo_hbgov'
        )
      `);
      await pool.query(`
        delete from monitor_sources
        where id in (
          'demo_miit', 'demo_ndrc', 'demo_bjgov', 'demo_tjgov', 'demo_hbgov'
        )
      `);
    }

    // 2. 插入 demo 部委来源（如已存在则忽略）
    const sources = [
      {
        id: "demo_miit",
        departmentName: "工业和信息化部",
        channelGroup: "产业政策",
        channelName: "政策文件",
        type: "html_list",
        listUrl: "https://www.miit.gov.cn/",
        enabled: true,
        autoMonitor: false,
        isKey: true,
        startDate: "2026-01-01",
        maxItems: 100,
      },
      {
        id: "demo_ndrc",
        departmentName: "国家发展和改革委员会",
        channelGroup: "宏观经济",
        channelName: "新闻发布",
        type: "html_list",
        listUrl: "https://www.ndrc.gov.cn/",
        enabled: true,
        autoMonitor: false,
        isKey: true,
        startDate: "2026-01-01",
        maxItems: 100,
      },
      {
        id: "demo_bjgov",
        departmentName: "北京市人民政府",
        channelGroup: "地方政策",
        channelName: "京津冀合作",
        type: "html_list",
        listUrl: "https://www.beijing.gov.cn/",
        enabled: true,
        autoMonitor: false,
        isKey: false,
        startDate: "2026-01-01",
        maxItems: 50,
      },
      {
        id: "demo_tjgov",
        departmentName: "天津市人民政府",
        channelGroup: "地方政策",
        channelName: "产业发展",
        type: "html_list",
        listUrl: "https://www.tj.gov.cn/",
        enabled: true,
        autoMonitor: false,
        isKey: false,
        startDate: "2026-01-01",
        maxItems: 50,
      },
      {
        id: "demo_hbgov",
        departmentName: "河北省人民政府",
        channelGroup: "地方政策",
        channelName: "区域协同",
        type: "html_list",
        listUrl: "https://www.hebei.gov.cn/",
        enabled: true,
        autoMonitor: false,
        isKey: false,
        startDate: "2026-01-01",
        maxItems: 50,
      },
    ];

    for (const s of sources) {
      await pool.query(
        `insert into monitor_sources
         (id, department_name, channel_group, channel_name, display_name, type,
          list_url, enabled, auto_monitor, is_key, start_date, max_items, notes,
          created_at, updated_at)
         values
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now())
         on conflict (id) do nothing`,
        [
          s.id,
          s.departmentName,
          s.channelGroup,
          s.channelName,
          `${s.departmentName}・${s.channelName}`,
          s.type,
          s.listUrl,
          s.enabled,
          s.autoMonitor,
          s.isKey,
          s.startDate,
          s.maxItems,
          "DEMO 演示数据（预估中心测试专用）",
        ],
      );
    }

    // 3. 插入演示条目的详细数据
    const now = new Date();
    const d = (days: number) => {
      const dt = new Date(now.getTime() - days * 86400000);
      return dt.toISOString().slice(0, 10);
    };
    const dt = (days: number) => {
      const dt = new Date(now.getTime() - days * 86400000);
      return dt.toISOString();
    };

    const items = [
      // ———— 人形机器人：资金 + 试点信号
      {
        sourceId: "demo_miit",
        url: "https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_f291ccd3da4c47ce95741de63cc088e6.html",
        title: "两部门关于联合开展2026年度人形机器人与具身智能实景实训专项行动的通知",
        listPublishedAt: d(12),
        firstSeenAt: dt(12),
        keywordScore: 48,
        matchedCategories: [
          { category: "B·强支持信号", score: 38 },
          { category: "AI/智能体/大模型", score: 25 },
        ],
        documentStatus: "正式发布",
        hasFunding: true,
        hasProcurement: false,
        hasPilot: true,
        hasStandards: false,
        forecastHigh:
          "根据专项行动方案，预计近30-45天内将开展第一批示范应用场景征集，涉及人形机器人在智能制造、智慧矿山、智能港口等方向的实景实训试点，预计相关资金与采购清单将同步发布。",
        forecastMidHigh:
          "预计北京、上海、深圳等具备产业基础的地区将先行启动示范项目，每个方向预计遴选5-8家骨干企业开展联合研发，后续可能扩展至全国范围的规模化应用。",
        forecastMid:
          "后续可能在2026年第四季度发布人形机器人与具身智能相关的技术标准框架，与人工智能赋能工业互联网的实施方案形成协同。",
        forecastLow:
          "人形机器人核心零部件（减速器、伺服电机等）国产化率提升计划仍在持续推进，但具体时间表尚不确定。",
        forecastNotes:
          "依据1：工信部与教育部联合发布专项行动，为实景实训提供明确的资金与试点方向；依据2：北京市已发布人工智能赋能工业互联网高质量发展实施方案，为人形机器人应用场景提供产业基础；依据3：先进制造业中试群建设工程可为硬件验证提供中试基地支撑。",
        forecastSources: [
          {
            title: "北京市经济和信息化局关于印发《北京市人工智能赋能工业互联网高质量发展实施方案（2026-2028年）》的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202605/t20260513_4649243.html",
            note: "为人形机器人与具身智能在工业互联网场景落地提供产业基础与应用方向。",
          },
          {
            title: "北京市经济和信息化局关于印发《关于加快推进先进制造业中试群建设工程的实施方案》的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202603/t20260312_4555359.html",
            note: "中试群建设工程可为人形机器人硬件样机、零部件验证与小批量试产提供公共平台支撑。",
          },
          {
            title: "国务院办公厅关于加快发展先进制造业集群的指导意见",
            url: "https://www.gov.cn/zhengce/zhengcefagui/202604/t20260418_1898631.htm",
            note: "国家级先进制造业集群培育方向将显著利好机器人与智能装备产业链的集聚与升级。",
          },
        ],
        summary:
          "工信部与教育部联合开展2026年度人形机器人与具身智能实景实训专项行动，面向制造、矿山、港口等典型场景遴选示范项目。",
        paragraphs: [
          "为深入贯彻发展新质生产力、推动人形机器人与具身智能技术落地，工业和信息化部、教育部决定联合开展2026年度人形机器人与具身智能实景实训专项行动。",
          "专项行动聚焦智能制造、智慧矿山、智能港口、智慧园区等典型场景，面向全国高校、科研院所与骨干企业遴选实景实训示范项目。",
          "申报单位应在核心算法、核心零部件或系统集成方面具有自主研发能力，并提供可展示的实景实训解决方案。",
          "第一批申报截止时间约为2026年8月上旬，遴选结果将在工业和信息化部官方渠道公示。",
        ],
        contentQuality: "full",
      },
      // ———— 中小企业宣传月：资金 + 采购信号
      {
        sourceId: "demo_miit",
        url: "http://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_fc592cb44c1d451683b0fc947b25212c.html",
        title: "两部门关于开展2026年全国中小企业法律政策宣传月活动的通知",
        listPublishedAt: d(11),
        firstSeenAt: dt(11),
        keywordScore: 30,
        matchedCategories: [
          { category: "B·强支持信号", score: 30 },
        ],
        documentStatus: "正式发布",
        hasFunding: true,
        hasProcurement: true,
        hasPilot: false,
        hasStandards: false,
        forecastHigh:
          "宣传月结束后，预计7-9月将集中发布一批面向中小企业的支持政策，包括政府采购预留份额、融资增信和数字化转型补贴，相关资金规模可能较上年有所扩大。",
        forecastMidHigh:
          "预计政府采购面向中小企业的预留比例将进一步向专精特新、战略性新兴产业倾斜，后续可能推出以旧换新等扩大内需的配套措施。",
        forecastMid:
          "部分省份可能在宣传月基础上推出地方性的中小企业发展专项资金，但具体申报时间窗口存在不确定性。",
        forecastLow:
          "面向中小企业的长期税收优惠政策调整仍处于研究阶段，短期内难以判断。",
        forecastNotes:
          "依据1：工信部与司法部联合开展宣传月，信号强；依据2：国务院办公厅近期发布以旧换新行动方案，为扩大内需与中小企业产品应用提供协同；依据3：北京已启动先进制造业中试群建设，为中小制造企业提供中试平台。",
        forecastSources: [
          {
            title: "国务院办公厅关于推动消费品以旧换新行动方案的通知",
            url: "https://www.gov.cn/zhengce/zhengcefagui/202605/t20260515_1909065.htm",
            note: "以旧换新行动将扩大中小企业消费品与装备产品的市场需求，形成直接的采购拉动。",
          },
          {
            title: "北京市经济和信息化局关于印发《关于加快推进先进制造业中试群建设工程的实施方案》的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202603/t20260312_4555359.html",
            note: "中试群建设可为专精特新中小企业提供中试验证与小批量试产能力，是典型的配套信号。",
          },
          {
            title: "国务院办公厅关于加快发展先进制造业集群的指导意见",
            url: "https://www.gov.cn/zhengce/zhengcefagui/202604/t20260418_1898631.htm",
            note: "集群化发展将显著提升中小企业在产业链中的协同配套机会与订单规模。",
          },
        ],
        summary:
          "工信部与司法部联合部署2026年全国中小企业法律政策宣传月活动，集中宣贯助企纾困、公平竞争、政府采购等相关政策。",
        paragraphs: [
          "为深入贯彻落实促进中小企业健康发展的决策部署，工业和信息化部、司法部决定在全国范围内开展2026年中小企业法律政策宣传月活动。",
          "宣传月重点围绕中小企业融资、政府采购预留份额、公平竞争审查、知识产权保护等政策进行集中解读与培训。",
          "活动于2026年6月中下旬启动，持续一个月，覆盖线上宣讲与地方组织的专场对接。",
          "各地中小企业主管部门将结合宣传月梳理本地惠企政策清单并向社会公示。",
        ],
        contentQuality: "full",
      },
      // ———— 消费名品：采购 + 资金信号
      {
        sourceId: "demo_miit",
        url: "http://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_f39a045b0f5543b69f85cf67af5b72f0.html",
        title: "两部门关于组织开展2026消费名品全国行的通知",
        listPublishedAt: d(10),
        firstSeenAt: dt(10),
        keywordScore: 35,
        matchedCategories: [
          { category: "B·强支持信号", score: 28 },
          { category: "A·强执行信号", score: 20 },
        ],
        documentStatus: "正式发布",
        hasFunding: true,
        hasProcurement: true,
        hasPilot: false,
        hasStandards: false,
        forecastHigh:
          "消费名品全国行启动后，预计7-8月会出现地方政府与平台联合发布的促消费补贴和采购清单，特别是在消费品以旧换新、绿色智能产品领域，可能带动相关装备采购与消费电子产品订单。",
        forecastMidHigh:
          "预计活动期间将在重点城市设置名品展示展销中心，并配套设置以旧换新补贴申请窗口，相关参与企业名单可能分批公示。",
        forecastMid:
          "后续若效果超预期，可能将消费名品培育与先进制造业集群建设结合，形成长期产业扶持机制，但具体节奏仍不确定。",
        forecastLow:
          "消费名品品牌评价体系与认证标准建设仍处于研究阶段，短期内正式标准出台可能性较低。",
        forecastNotes:
          "依据1：工信部联合开展消费名品全国行，与消费品以旧换新方案高度协同；依据2：国务院办公厅以旧换新行动方案为扩大内需提供直接政策依据；依据3：绿色工厂、绿色工业园区征集为名品背后的产业升级提供支撑。",
        forecastSources: [
          {
            title: "国务院办公厅关于推动消费品以旧换新行动方案的通知",
            url: "https://www.gov.cn/zhengce/zhengcefagui/202605/t20260515_1909065.htm",
            note: "以旧换新行动方案为消费名品全国行提供直接的政策协同与资金来源依据。",
          },
          {
            title: "北京市经济和信息化局关于开展2026年度市级绿色工厂和绿色工业园区征集工作的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260612_4697527.html",
            note: "绿色工厂与绿色园区的建设为消费名品背后的绿色供应链提供产业基础支撑。",
          },
          {
            title: "国务院办公厅关于加快发展先进制造业集群的指导意见",
            url: "https://www.gov.cn/zhengce/zhengcefagui/202604/t20260418_1898631.htm",
            note: "先进制造业集群建设为消费名品所在产业提供长期的产业链升级与品牌培育环境。",
          },
        ],
        summary:
          "工信部联合部署2026消费名品全国行，通过展览展销、电商对接、以旧换新等方式扩大内需，重点培育一批消费名品与品牌企业。",
        paragraphs: [
          "为贯彻扩大内需战略、推动消费升级，工业和信息化部组织开展2026消费名品全国行活动。",
          "活动聚焦食品、纺织服装、消费电子、家电家居、绿色智能产品等重点领域，组织名品企业展览展销、电商平台对接和地方专场活动。",
          "活动与消费品以旧换新行动方案协同实施，鼓励地方政府提供配套补贴。",
          "各省市将根据本地情况制定配套方案并向社会公布参与企业与产品清单。",
        ],
        contentQuality: "full",
      },
      // ———— 科研助理岗位：资金信号
      {
        sourceId: "demo_miit",
        url: "http://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_6401f8a8e4f44750830f35f8055c175b.html",
        title: "工业和信息化部等九部门关于做好科研助理岗位开发促进高校毕业生就业工作的通知",
        listPublishedAt: d(9),
        firstSeenAt: dt(9),
        keywordScore: 22,
        matchedCategories: [
          { category: "B·强支持信号", score: 22 },
        ],
        documentStatus: "正式发布",
        hasFunding: true,
        hasProcurement: false,
        hasPilot: false,
        hasStandards: false,
        forecastHigh:
          "该通知要求各高校、科研院所与骨干企业在2026年6-9月集中开发一批科研助理岗位，预计短期内将发布大量岗位招聘公告，并配套相关经费支持，资金规模取决于各单位的岗位开发数量。",
        forecastMidHigh:
          "预计专精特新中小企业、国家重点实验室与先进制造业集群内的企业将是主要的岗位开发主体，为高校毕业生提供直接的就业机会。",
        forecastMid:
          "后续可能将科研助理岗位开发纳入对高校与科研单位的考核机制，但具体执行细节仍需以各地通知为准。",
        forecastLow:
          "长期来看，科研助理岗位的常态化机制建设仍处于探索阶段。",
        forecastNotes:
          "依据1：九部门联合发文，信号强，涉及人员规模较大；依据2：先进制造业集群建设与中试群建设可为科研助理岗位提供丰富的产业应用场景；依据3：中小企业宣传月活动有助于企业了解相关政策。",
        forecastSources: [
          {
            title: "北京市经济和信息化局关于印发《关于加快推进先进制造业中试群建设工程的实施方案》的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202603/t20260312_4555359.html",
            note: "中试群建设需要大量科研助理与工程技术人员，是岗位需求的重要来源。",
          },
          {
            title: "国务院办公厅关于加快发展先进制造业集群的指导意见",
            url: "https://www.gov.cn/zhengce/zhengcefagui/202604/t20260418_1898631.htm",
            note: "先进制造业集群内企业数量与研发投入扩大，将持续创造科研助理岗位需求。",
          },
          {
            title: "两部门关于开展2026年全国中小企业法律政策宣传月活动的通知",
            url: "http://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_fc592cb44c1d451683b0fc947b25212c.html",
            note: "中小企业政策宣传月有助于企业及时了解岗位开发与经费支持政策。",
          },
        ],
        summary:
          "工信部等九部门联合部署科研助理岗位开发工作，要求在高校、科研院所、骨干企业等单位开发不少于一定数量的科研助理岗位，促进高校毕业生就业。",
        paragraphs: [
          "为贯彻落实稳就业工作部署，工业和信息化部等九部门共同印发通知，要求做好科研助理岗位开发，促进高校毕业生就业。",
          "通知要求各高校、科研院所、国家重点实验室、专精特新中小企业等单位积极开发科研助理岗位。",
          "岗位开发工作应在2026年6月至9月集中推进，各单位应向社会公开招聘信息。",
          "鼓励地方在资金、场地、项目等方面给予科研助理岗位支持。",
        ],
        contentQuality: "full",
      },
      // ———— 生态保护修复中央预算内投资：资金 + 采购信号
      {
        sourceId: "demo_ndrc",
        url: "https://www.ndrc.gov.cn/xwdt/tzgg/202606/t20260608_1405756.html",
        title: "关于印发《生态保护修复领域中央预算内投资专项管理办法》的通知",
        listPublishedAt: d(7),
        firstSeenAt: dt(7),
        keywordScore: 42,
        matchedCategories: [
          { category: "B·强支持信号", score: 35 },
          { category: "A·强执行信号", score: 25 },
        ],
        documentStatus: "正式发布",
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: false,
        forecastHigh:
          "本管理办法的发布标志着生态保护修复领域的专项资金使用规则明确。预计7-8月各省市将发布本地项目申报指南，第一批资金可能在第三季度下达，项目招标与采购将随之启动。",
        forecastMidHigh:
          "预计资金将重点投向山水林田湖草沙一体化保护修复、重点流域生态环境治理、荒漠化地区生态治理等方向，相关装备采购与工程建设企业可能受益。",
        forecastMid:
          "管理办法提及将建立项目储备与滚动实施机制，预计每年将持续更新项目清单与资金规模，但具体批次数量仍需后续观察。",
        forecastLow:
          "绿色金融工具与专项资金的长期结合仍处于研究和完善阶段。",
        forecastNotes:
          "依据1：发改委正式发布专项资金管理办法，资金路径明确；依据2：北京绿色工厂与绿色工业园区征集反映地方政府在绿色低碳领域的配套信号；依据3：先进制造业集群建设要求重点企业绿色转型，是协同信号。",
        forecastSources: [
          {
            title: "北京市经济和信息化局关于开展2026年度市级绿色工厂和绿色工业园区征集工作的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260612_4697527.html",
            note: "绿色工厂与绿色园区的建设为生态保护修复专项资金在产业端的落地提供重要承接场景。",
          },
          {
            title: "国务院办公厅关于加快发展先进制造业集群的指导意见",
            url: "https://www.gov.cn/zhengce/zhengcefagui/202604/t20260418_1898631.htm",
            note: "先进制造业集群建设中绿色低碳是重要方向，与生态保护修复专项资金在绿色产业端形成协同。",
          },
          {
            title: "关于总结推广上海浦东新区、深圳、厦门综合改革试点创新举措和经验做法的通知",
            url: "https://www.ndrc.gov.cn/xwdt/tzgg/202606/t20260605_1405708.html",
            note: "综合改革试点经验推广，可能为生态保护修复项目在市场化投融资机制方面提供借鉴。",
          },
        ],
        summary:
          "发改委印发《生态保护修复领域中央预算内投资专项管理办法》，明确专项资金的支持范围、申报流程与资金管理要求。",
        paragraphs: [
          "为加强生态保护修复领域中央预算内投资管理，发改委制定本专项管理办法。",
          "办法明确资金支持山水林田湖草沙一体化保护修复、重点流域治理、荒漠化治理、森林草原保护等方向。",
          "资金采取项目法管理，由地方发展改革部门申报，国家发展改革委审核下达。",
          "办法自发布之日起施行，各省市应结合本地情况制定项目申报指南。",
        ],
        contentQuality: "full",
      },
      // ———— 综合改革试点经验推广：试点信号
      {
        sourceId: "demo_ndrc",
        url: "https://www.ndrc.gov.cn/xwdt/tzgg/202606/t20260605_1405708.html",
        title: "关于总结推广上海浦东新区、深圳、厦门综合改革试点创新举措和经验做法的通知",
        listPublishedAt: d(10),
        firstSeenAt: dt(10),
        keywordScore: 28,
        matchedCategories: [
          { category: "A·强执行信号", score: 28 },
        ],
        documentStatus: "正式发布",
        hasFunding: false,
        hasProcurement: false,
        hasPilot: true,
        hasStandards: false,
        forecastHigh:
          "该通知标志着新一轮综合改革试点经验将向更大范围推广，预计后续将有更多区域被纳入试点名单，涉及产业发展、要素市场化、营商环境等领域的改革举措，相关地方产业政策可能密集出台。",
        forecastMidHigh:
          "北京、上海、深圳等具备产业基础的城市可能在制造业数字化转型、人工智能赋能工业互联网等方面率先借鉴推广经验。",
        forecastMid:
          "推广举措的落地节奏将取决于各地的具体实施方案，预计2026年下半年将有若干省市发布相关方案。",
        forecastLow:
          "一些涉及体制机制调整的改革举措推广周期可能较长，短期内难以形成直接的产业机会。",
        forecastNotes:
          "依据1：发改委发布推广通知，信号明确；依据2：北京已启动制造业数字化转型促进中心与先进级智能工厂申报；依据3：先进制造业集群建设与人工智能赋能工业互联网实施方案为改革推广提供产业承接场景。",
        forecastSources: [
          {
            title: "北京市经济和信息化局关于开展第二批制造业数字化转型促进中心建设工作的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260609_4693004.html",
            note: "数字化转型促进中心建设是综合改革试点经验在制造业升级方向的典型承接载体。",
          },
          {
            title: "北京市经济和信息化局关于组织开展2026年度北京市先进级智能工厂（第二批）申报工作的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260604_4686022.html",
            note: "先进级智能工厂申报体现了改革经验在高端制造与智能制造方向的落地。",
          },
          {
            title: "北京市经济和信息化局关于印发《北京市人工智能赋能工业互联网高质量发展实施方案（2026-2028年）》的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202605/t20260513_4649243.html",
            note: "人工智能赋能工业互联网是改革试点经验在数字经济方向的重要延伸。",
          },
        ],
        summary:
          "发改委发布通知，要求总结推广上海浦东新区、深圳、厦门综合改革试点的创新举措与经验做法，推动更大范围的制度型开放与产业升级。",
        paragraphs: [
          "为深入推进综合改革试点经验的推广与复制，发改委印发通知，要求各地结合实际学习借鉴。",
          "通知重点推广营商环境优化、产业发展体制机制、要素市场化配置、科技创新等方向的经验。",
          "鼓励有条件的地区结合本地产业特点开展差异化试点。",
          "后续发改委将持续跟踪评估推广成效，形成可复制可推广的政策工具箱。",
        ],
        contentQuality: "full",
      },
      // ———— 绿色工厂 / 绿色园区：资金 + 标准信号
      {
        sourceId: "demo_bjgov",
        url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260612_4697527.html",
        title: "北京市经济和信息化局关于开展2026年度市级绿色工厂和绿色工业园区征集工作的通知",
        listPublishedAt: d(3),
        firstSeenAt: dt(3),
        keywordScore: 32,
        matchedCategories: [
          { category: "B·强支持信号", score: 25 },
          { category: "A·强执行信号", score: 20 },
        ],
        documentStatus: "正式发布",
        hasFunding: true,
        hasProcurement: false,
        hasPilot: false,
        hasStandards: true,
        forecastHigh:
          "北京市开展绿色工厂和绿色园区征集后，预计8-9月将公示第一批入选名单，入选企业可能享受专项资金、政府采购优先和税收优惠等支持，预计后续将形成绿色项目申报的密集期。",
        forecastMidHigh:
          "绿色工厂和绿色园区的认证将直接带动节能环保装备、新能源、工业互联网平台等相关产品的采购需求。",
        forecastMid:
          "后续若第一批效果良好，可能将绿色工厂征集扩大到京津冀协同范围，但区域协同的具体机制仍需观察。",
        forecastLow:
          "绿色低碳领域的中长期技术标准体系建设仍在持续推进，短期内出台正式标准的节奏不确定。",
        forecastNotes:
          "依据1：北京市经信局发布正式征集通知；依据2：生态保护修复专项资金管理办法为绿色项目提供资金来源信号；依据3：先进制造业集群建设与人工智能赋能工业互联网为绿色转型提供产业基础。",
        forecastSources: [
          {
            title: "关于印发《生态保护修复领域中央预算内投资专项管理办法》的通知",
            url: "https://www.ndrc.gov.cn/xwdt/tzgg/202606/t20260608_1405756.html",
            note: "生态保护修复专项资金管理办法为绿色工厂与绿色园区项目提供可能的资金来源与政策参照。",
          },
          {
            title: "国务院办公厅关于加快发展先进制造业集群的指导意见",
            url: "https://www.gov.cn/zhengce/zhengcefagui/202604/t20260418_1898631.htm",
            note: "先进制造业集群建设中绿色低碳是重要方向，为绿色工厂认证提供产业大背景。",
          },
          {
            title: "北京市经济和信息化局关于开展第二批制造业数字化转型促进中心建设工作的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260609_4693004.html",
            note: "数字化转型促进中心为绿色工厂提供数据驱动的能耗监测与优化能力。",
          },
        ],
        summary:
          "北京市经信局组织开展2026年度市级绿色工厂和绿色工业园区征集工作，面向符合条件的工业企业和园区公开申报。",
        paragraphs: [
          "为贯彻绿色制造理念，北京市经信局组织开展2026年度市级绿色工厂和绿色工业园区征集工作。",
          "申报企业应在节能降耗、清洁生产、资源综合利用等方面具有良好基础。",
          "申报材料包括企业绿色制造体系建设情况、关键能耗数据、典型案例等。",
          "入选名单将在北京市经信局官方渠道公示，并享受相关政策支持。",
        ],
        contentQuality: "full",
      },
      // ———— 数字化转型促进中心：试点 + 资金 + 标准信号
      {
        sourceId: "demo_bjgov",
        url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260609_4693004.html",
        title: "北京市经济和信息化局关于开展第二批制造业数字化转型促进中心建设工作的通知",
        listPublishedAt: d(6),
        firstSeenAt: dt(6),
        keywordScore: 38,
        matchedCategories: [
          { category: "A·强执行信号", score: 30 },
          { category: "B·强支持信号", score: 25 },
        ],
        documentStatus: "正式发布",
        hasFunding: true,
        hasProcurement: false,
        hasPilot: true,
        hasStandards: true,
        forecastHigh:
          "第二批数字化转型促进中心的建设预计将在7-9月启动遴选，入选单位将获得建设资金与政策支持，并承担为中小企业提供数字化解决方案的公共服务职能。预计相关的工业互联网平台、软件工具、云服务等采购需求将在下半年释放。",
        forecastMidHigh:
          "预计促进中心将围绕先进级智能工厂、人工智能赋能工业互联网等方向建设重点实验室与公共服务平台，形成标准与案例输出。",
        forecastMid:
          "促进中心建设经验若成熟，可能复制推广至京津冀其他城市，但具体合作机制仍需后续观察。",
        forecastLow:
          "长期来看，数字化转型标准体系与评价指标仍在持续完善，短期内全面落地存在不确定性。",
        forecastNotes:
          "依据1：北京市已发布第一批数字化转型促进中心建设成果；依据2：人工智能赋能工业互联网实施方案为促进中心提供明确的技术路径；依据3：先进级智能工厂申报为促进中心提供直接的服务场景。",
        forecastSources: [
          {
            title: "北京市经济和信息化局关于组织开展2026年度北京市先进级智能工厂（第二批）申报工作的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260604_4686022.html",
            note: "先进级智能工厂建设是数字化转型促进中心最直接的服务场景与项目来源。",
          },
          {
            title: "北京市经济和信息化局关于印发《北京市人工智能赋能工业互联网高质量发展实施方案（2026-2028年）》的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202605/t20260513_4649243.html",
            note: "人工智能赋能工业互联网方案为促进中心提供明确的技术路线与产业融合方向。",
          },
          {
            title: "国务院办公厅关于加快发展先进制造业集群的指导意见",
            url: "https://www.gov.cn/zhengce/zhengcefagui/202604/t20260418_1898631.htm",
            note: "先进制造业集群建设为促进中心提供长期的服务对象与需求来源。",
          },
        ],
        summary:
          "北京市经信局启动第二批制造业数字化转型促进中心建设工作，鼓励高校、科研院所与企业联合建设公共服务平台。",
        paragraphs: [
          "为加快推进制造业数字化转型，北京市经信局组织开展第二批制造业数字化转型促进中心建设工作。",
          "促进中心重点提供数字化诊断、解决方案输出、标准研究、人才培训等公共服务。",
          "鼓励有条件的高校、科研院所与企业联合申报，形成产学研用一体化的服务能力。",
          "申报截止后将组织专家评审，入选名单公示后给予建设资金与政策支持。",
        ],
        contentQuality: "full",
      },
      // ———— 先进级智能工厂：资金 + 试点 + 采购信号
      {
        sourceId: "demo_bjgov",
        url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260604_4686022.html",
        title: "北京市经济和信息化局关于组织开展2026年度北京市先进级智能工厂（第二批）申报工作的通知",
        listPublishedAt: d(11),
        firstSeenAt: dt(11),
        keywordScore: 40,
        matchedCategories: [
          { category: "A·强执行信号", score: 32 },
          { category: "B·强支持信号", score: 30 },
        ],
        documentStatus: "正式发布",
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: false,
        forecastHigh:
          "第二批先进级智能工厂申报预计将在7-8月完成评审，入选企业将获得资金奖励、政府采购优先与示范项目称号，预计直接带动相关智能制造装备、工业软件、传感器与数字化产线的升级采购需求。",
        forecastMidHigh:
          "预计申报企业将集中在电子信息、高端装备、汽车与医药制造等领域，北京优势产业集群内的企业申报成功率较高。",
        forecastMid:
          "若本批申报情况良好，可能将先进级智能工厂的评价标准纳入长期机制，并扩大评选范围至京津冀协同区域，但具体安排仍需后续通知。",
        forecastLow:
          "先进级智能工厂的长期运营评估体系与动态调整机制仍在持续建设中。",
        forecastNotes:
          "依据1：北京市经信局正式印发申报通知；依据2：北京市已有人工智能赋能工业互联网与数字化转型促进中心建设方案提供支撑；依据3：先进制造业集群与中试群建设为智能工厂提供产业链与中试能力。",
        forecastSources: [
          {
            title: "北京市经济和信息化局关于印发《北京市人工智能赋能工业互联网高质量发展实施方案（2026-2028年）》的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202605/t20260513_4649243.html",
            note: "人工智能赋能工业互联网方案为先进级智能工厂提供明确的智能化方向与技术路径。",
          },
          {
            title: "北京市经济和信息化局关于开展第二批制造业数字化转型促进中心建设工作的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260609_4693004.html",
            note: "数字化转型促进中心为智能工厂提供数字化诊断与公共服务能力。",
          },
          {
            title: "北京市经济和信息化局关于印发《关于加快推进先进制造业中试群建设工程的实施方案》的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202603/t20260312_4555359.html",
            note: "中试群建设工程为智能工厂的新工艺、新装备提供中试验证与小批量试产能力。",
          },
        ],
        summary:
          "北京市经信局组织开展2026年度第二批先进级智能工厂申报工作，面向重点产业中的骨干企业开展遴选。",
        paragraphs: [
          "为加快培育智能制造示范标杆，北京市经信局组织开展2026年度北京市先进级智能工厂（第二批）申报工作。",
          "申报企业应在生产数据采集、智能排产、质量追溯、能耗优化、设备预测性维护等方面具有良好基础。",
          "申报材料包括智能工厂建设方案、关键指标数据、典型应用案例等。",
          "入选企业将获得资金支持、示范称号与政府采购优先等激励。",
        ],
        contentQuality: "full",
      },
      // ———— 人工智能赋能工业互联网：资金 + 标准 + 试点信号
      {
        sourceId: "demo_bjgov",
        url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202605/t20260513_4649243.html",
        title: "北京市经济和信息化局关于印发《北京市人工智能赋能工业互联网高质量发展实施方案（2026-2028年）》的通知",
        listPublishedAt: d(32),
        firstSeenAt: dt(32),
        keywordScore: 50,
        matchedCategories: [
          { category: "B·强支持信号", score: 40 },
          { category: "AI/智能体/大模型", score: 35 },
          { category: "A·强执行信号", score: 25 },
        ],
        documentStatus: "正式发布",
        hasFunding: true,
        hasProcurement: false,
        hasPilot: true,
        hasStandards: true,
        forecastHigh:
          "该实施方案明确到2028年的三年建设目标，预计6-9月将发布第一批重点任务清单与专项资金申报指南，覆盖人工智能大模型在工业场景的应用、工业互联网平台升级与行业大模型示范项目等，相关软硬件采购预计将在下半年释放。",
        forecastMidHigh:
          "预计方案将催生一批行业大模型示范项目，推动人形机器人、具身智能、智能工厂等方向的试点落地，与北京市先进级智能工厂和数字化转型促进中心建设形成联动。",
        forecastMid:
          "实施方案提出的三年建设周期表明，相关的技术标准、产业联盟与公共服务平台建设将持续推进，长期建设信号明显，但具体年度资金规模仍需各批申报指南发布后判断。",
        forecastLow:
          "部分涉及基础研究与核心算法突破的方向仍处于探索期，短期内大规模商业落地仍存在不确定性。",
        forecastNotes:
          "依据1：北京市经信局正式发布三年实施方案；依据2：工信部人形机器人与具身智能专项行动为方案提供产业方向；依据3：先进级智能工厂、数字化转型促进中心、中试群等建设为方案提供可落地的产业承接载体。",
        forecastSources: [
          {
            title: "两部门关于联合开展2026年度人形机器人与具身智能实景实训专项行动的通知",
            url: "https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_f291ccd3da4c47ce95741de63cc088e6.html",
            note: "人形机器人与具身智能专项行动为人赋能工业互联网方案提供最直接的典型应用场景。",
          },
          {
            title: "北京市经济和信息化局关于组织开展2026年度北京市先进级智能工厂（第二批）申报工作的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260604_4686022.html",
            note: "先进级智能工厂建设为人赋能工业互联网方案提供现成的应用载体与数据基础。",
          },
          {
            title: "北京市经济和信息化局关于开展第二批制造业数字化转型促进中心建设工作的通知",
            url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260609_4693004.html",
            note: "数字化转型促进中心为人赋能工业互联网方案提供公共服务平台与解决方案输出能力。",
          },
        ],
        summary:
          "北京市经信局印发人工智能赋能工业互联网高质量发展实施方案，提出三年建设目标，重点推动人工智能大模型、行业大模型与工业互联网深度融合。",
        paragraphs: [
          "为贯彻落实人工智能赋能新型工业化战略，北京市经信局印发《北京市人工智能赋能工业互联网高质量发展实施方案（2026-2028年）》。",
          "方案提出到2028年建成一批行业大模型示范项目，推动工业互联网平台全面升级。",
          "重点方向包括：大模型在工业研发设计、生产制造、质量检测、供应链管理等环节的应用；工业互联网平台人工智能能力增强；数据要素安全可信流通。",
          "方案鼓励骨干企业联合高校、科研院所开展关键技术攻关与试点示范，将分批发布项目申报指南与资金支持细则。",
        ],
        contentQuality: "full",
      },
      // ———— 【测试用】超级混合分类条目：4种信号层 + 3种主题层，用于验证分类过滤逻辑
      {
        sourceId: "demo_miit",
        url: "https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_test_mixed_categories.html",
        title: "【测试用】工业和信息化部关于推动人工智能与算力基础设施协同发展的指导意见（混合分类测试）",
        listPublishedAt: d(5),
        firstSeenAt: dt(5),
        keywordScore: 72,
        matchedCategories: [
          // 信号层分类（排在前面，验证过滤逻辑能正确跳过）
          { category: "A·强执行信号", score: 30 },
          { category: "B·强支持信号", score: 28 },
          { category: "C·风险信号", score: 15 },
          { category: "D·探索信号", score: 10 },
          // 主题层分类
          { category: "AI/智能体/大模型", score: 45 },
          { category: "算力/算力网/算电协同", score: 38 },
          { category: "数据要素/高质量数据集", score: 25 },
        ],
        documentStatus: "征求意见",
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        forecastHigh:
          "【测试】这是一条用于验证分类过滤逻辑的测试数据，包含4种信号层分类和3种主题层分类，用于验证同主题匹配、政策沿革标题等功能是否正确过滤信号层分类。",
        forecastMidHigh: "验证要点：政策沿革标题应显示为AI/智能体/大模型，而非A·强执行信号。",
        forecastMid: "验证要点：同主题政策应匹配AI/算力/数据要素相关条目，而非全库数据。",
        forecastLow: "验证要点：命中标签应正确显示所有7个分类。",
        forecastNotes:
          "【测试数据】本条目的 matched_categories 按「信号层在前、主题层在后」的顺序排列，用于验证前端过滤逻辑是否能正确识别并跳过信号层分类，取到第一个主题层分类作为领域名称。",
        forecastSources: [
          {
            title: "关于印发《人工智能赋能新型工业化行动计划》的通知",
            url: "https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_test_1.html",
            note: "测试数据来源1",
          },
          {
            title: "关于加快推进算力基础设施建设的指导意见",
            url: "https://www.ndrc.gov.cn/xwdt/tzgg/202606/t20260601_test_2.html",
            note: "测试数据来源2",
          },
          {
            title: "数据要素市场化配置综合改革试点方案",
            url: "https://www.gov.cn/zhengce/zhengcefagui/202605/t20260520_test_3.htm",
            note: "测试数据来源3",
          },
        ],
        summary:
          "【测试用】这是一条包含多种信号层和主题层混合分类的测试数据，用于验证分类过滤和日志输出逻辑是否正确。",
        paragraphs: [
          "为推动人工智能与算力基础设施协同发展，工业和信息化部发布本指导意见。",
          "意见提出，要加快构建人工智能大模型与算力网协同发展的技术体系，推动数据要素市场化配置。",
          "重点任务包括：加强人工智能核心技术攻关、推进算力基础设施建设、完善数据要素流通机制、强化风险防范体系。",
          "各地各部门要高度重视，认真组织落实，确保各项任务落到实处。",
        ],
        contentQuality: "full",
      },
      // ———— 【测试用】主题层在前的混合分类条目：验证过滤顺序无关
      {
        sourceId: "demo_ndrc",
        url: "https://www.ndrc.gov.cn/xwdt/tzgg/202606/art_test_topic_first.html",
        title: "【测试用】国家发展改革委关于加快数据要素市场化配置改革的指导意见（主题层在前）",
        listPublishedAt: d(4),
        firstSeenAt: dt(4),
        keywordScore: 65,
        matchedCategories: [
          // 主题层分类（排在前面，验证即使主题在前也能正确提取）
          { category: "数据要素/高质量数据集", score: 42 },
          { category: "政务服务/平台经济/数字经济", score: 35 },
          // 信号层分类
          { category: "B·强支持信号", score: 30 },
          { category: "A·强执行信号", score: 25 },
          { category: "通用启动/落地", score: 18 },
          // 噪音词汇
          { category: "噪音词汇", score: 8 },
        ],
        documentStatus: "正式发布",
        hasFunding: true,
        hasProcurement: false,
        hasPilot: true,
        hasStandards: false,
        forecastHigh:
          "【测试】主题层在前的混合分类测试数据，验证 getFirstTopicCategory 和 filterTopicCategories 能正确处理不同排序的分类列表。",
        forecastMidHigh: "验证要点：政策沿革标题应显示为数据要素/高质量数据集（第一个主题层）。",
        forecastMid: "验证要点：同主题政策应匹配数据要素+政务服务相关条目。",
        forecastLow: "验证要点：噪音词汇应被过滤，不参与主题匹配。",
        forecastNotes:
          "【测试数据】本条目的 matched_categories 按「主题层在前、信号层在后」的顺序排列，用于验证分类过滤逻辑与顺序无关，以及噪音词汇的正确过滤。",
        forecastSources: [
          {
            title: "数据要素市场化配置改革总体方案",
            url: "https://www.ndrc.gov.cn/xwdt/tzgg/202605/test_data_1.html",
            note: "测试数据来源1",
          },
        ],
        summary:
          "【测试用】主题层在前的混合分类测试条目，验证分类提取逻辑与顺序无关。",
        paragraphs: [
          "为加快数据要素市场化配置改革，国家发展改革委发布本指导意见。",
          "意见提出，要建立健全数据要素市场规则，推动数据资源开发利用。",
          "重点任务包括：完善数据产权制度、推进数据要素流通、加强数据安全保护。",
        ],
        contentQuality: "full",
      },
      // ———— 【测试用】纯信号层分类条目：验证无主题层时同主题返回空
      {
        sourceId: "demo_bjgov",
        url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/art_test_signal_only.html",
        title: "【测试用】北京市人民政府关于做好近期重点工作的通知（纯信号层分类）",
        listPublishedAt: d(3),
        firstSeenAt: dt(3),
        keywordScore: 28,
        matchedCategories: [
          // 只有信号层分类，没有主题层分类
          { category: "A·强执行信号", score: 25 },
          { category: "B·强支持信号", score: 20 },
          { category: "通用启动/落地", score: 15 },
          { category: "噪音词汇", score: 10 },
        ],
        documentStatus: "正式发布",
        hasFunding: false,
        hasProcurement: false,
        hasPilot: false,
        hasStandards: false,
        forecastHigh:
          "【测试】纯信号层分类测试数据，验证当条目没有主题层分类时，同主题相关政策应返回空数组。",
        forecastMidHigh: "验证要点：同主题政策列表应为空（0条），不应返回全库数据。",
        forecastMid: "验证要点：政策沿革标题应 fallback 到默认值'政策领域'。",
        forecastLow: "验证要点：filterTopicCategories 返回空数组。",
        forecastNotes:
          "【测试数据】本条目的 matched_categories 只包含信号层分类和噪音词汇，用于验证无有效主题分类时的边界处理逻辑，确保不会因空分类而返回全库数据。",
        forecastSources: [],
        summary:
          "【测试用】纯信号层分类测试条目，验证无主题层分类时的边界处理。",
        paragraphs: [
          "为做好近期重点工作，北京市人民政府发布本通知。",
          "通知要求各部门高度重视，认真组织落实。",
          "加强督促检查，确保各项任务落到实处。",
        ],
        contentQuality: "full",
      },
      // ———— 【测试用】单一主题层分类条目：验证最简场景
      {
        sourceId: "demo_miit",
        url: "https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_test_single_topic.html",
        title: "【测试用】工业和信息化部关于促进集成电路产业发展的若干意见（单一主题）",
        listPublishedAt: d(2),
        firstSeenAt: dt(2),
        keywordScore: 55,
        matchedCategories: [
          // 只有一个主题层分类
          { category: "产业合作/京津冀协同", score: 40 },
        ],
        documentStatus: "征求意见",
        hasFunding: true,
        hasProcurement: true,
        hasPilot: false,
        hasStandards: true,
        forecastHigh:
          "【测试】单一主题层分类测试数据，验证只有一个主题分类时的日志输出和匹配逻辑。",
        forecastMidHigh: "验证要点：政策沿革标题应正确显示为产业合作/京津冀协同。",
        forecastMid: "验证要点：同主题政策应匹配产业合作相关条目。",
        forecastLow: "",
        forecastNotes:
          "【测试数据】本条目的 matched_categories 只包含一个主题层分类，用于验证最简场景下的分类提取和匹配逻辑。",
        forecastSources: [],
        summary:
          "【测试用】单一主题层分类测试条目，验证最简场景。",
        paragraphs: [
          "为促进集成电路产业发展，工业和信息化部发布本意见。",
          "意见提出，要加大政策支持力度，推动产业创新发展。",
        ],
        contentQuality: "full",
      },
    ];

    // 4. 批量插入条目（使用 on conflict 避免重复）
    let inserted = 0;
    let updated = 0;
    for (const item of items) {
      const res = await pool.query(
        `insert into monitor_items
         (source_id, url, title, list_published_at, first_seen_at,
          keyword_score, matched_categories, matched_keywords,
          document_status, has_funding, has_procurement, has_pilot, has_standards,
          forecast_high, forecast_mid_high, forecast_mid, forecast_low, forecast_notes, forecast_sources_json,
          summary, content_json, content_quality, capture_note,
          forecast_updated_at)
         values
         ($1, $2, $3, $4, $5, $6, $7::jsonb, '[]'::jsonb, $8::text, $9::boolean, $10::boolean, $11::boolean, $12::boolean,
          $13::text, $14::text, $15::text, $16::text, $17::text, $18::jsonb,
          $19::text, $20::jsonb, $21::text, $22::text,
          case when $13::text is not null or $14::text is not null or $15::text is not null or $16::text is not null or $17::text is not null or $18::jsonb is not null then now() else null end)
         on conflict (source_id, url) do update set
           title = excluded.title,
           keyword_score = excluded.keyword_score,
           matched_categories = excluded.matched_categories,
           document_status = excluded.document_status,
           has_funding = excluded.has_funding,
           has_procurement = excluded.has_procurement,
           has_pilot = excluded.has_pilot,
           has_standards = excluded.has_standards,
           summary = excluded.summary,
           content_json = excluded.content_json,
           content_quality = excluded.content_quality,
           forecast_sources_json = excluded.forecast_sources_json
         returning (xmax = 0)::boolean as is_new`,
        [
          item.sourceId,
          item.url,
          item.title,
          item.listPublishedAt,
          item.firstSeenAt,
          item.keywordScore,
          JSON.stringify(
            item.matchedCategories.map((c) => ({
              category: c.category,
              score: c.score,
            })),
          ),
          item.documentStatus,
          item.hasFunding,
          item.hasProcurement,
          item.hasPilot,
          item.hasStandards,
          item.forecastHigh,
          item.forecastMidHigh,
          item.forecastMid,
          item.forecastLow,
          item.forecastNotes,
          JSON.stringify(item.forecastSources ?? []),
          item.summary,
          JSON.stringify({ paragraphs: item.paragraphs, url: item.url }),
          item.contentQuality,
          "[DEMO] 预估中心测试演示数据",
        ],
      );
      if (res.rows[0]?.is_new) {
        inserted++;
      } else {
        updated++;
      }
    }

    // 5. 返回统计
    const stats = await pool.query(`
      select
        count(*) filter (where has_funding = true) as funding_count,
        count(*) filter (where has_procurement = true) as procurement_count,
        count(*) filter (where has_pilot = true) as pilot_count,
        count(*) filter (where has_standards = true) as standards_count,
        count(*) filter (
          where forecast_high is not null or forecast_mid_high is not null
          or forecast_mid is not null or forecast_low is not null
        ) as with_forecast_count
      from monitor_items
      where source_id like 'demo_%'
    `);

    return NextResponse.json({
      ok: true,
      message: `已成功生成演示数据：新增 ${inserted} 条，更新 ${updated} 条`,
      inserted,
      updated,
      stats: stats.rows[0],
      demoSourceIds: sources.map((s) => s.id),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: `生成演示数据失败：${err instanceof Error ? err.message : String(err)}`,
        error: String(err),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "请使用 POST 请求调用本接口生成演示数据。",
    example: {
      basic: "POST /api/monitor/items/seed-demo",
      clean: "POST /api/monitor/items/seed-demo?clean=1",
    },
    description:
      "这个 API 会插入 5 个示例部委来源（工信部、发改委、北京/天津/河北政府），以及 10 条带有不同类型信号的演示条目（涵盖资金、采购、试点、标准、已有预估、待添加预估等多种场景），用于测试预估中心的展开和保存功能。",
  });
}
