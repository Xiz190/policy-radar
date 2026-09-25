import { describe, it, expect } from "vitest";
import {
  analyzeFieldDifferences,
  computeTextDiff,
  analyzeCategoryOverlap,
  analyzeKeywordOverlap,
  analyzeImpactComparison,
  analyzeTimelineComparison,
  analyzeEvolutionTrend,
  generateMarkdownReport,
  runFullComparison,
  getImpactDimensionLabel,
  COMPARE_IMPACT_DIMENSIONS,
  type CompareItemBasic,
} from "@/lib/monitor/compare-analysis";

// ============================================================================
// 测试数据
// ============================================================================

function createMockItem(overrides: Partial<CompareItemBasic> = {}): CompareItemBasic {
  return {
    sourceId: "test-1",
    url: "https://example.com/test",
    title: "关于推进数字经济发展的指导意见",
    departmentName: "工业和信息化部",
    channelName: "政策法规",
    listPublishedAt: "2026-01-15T00:00:00Z",
    firstSeenAt: "2026-01-15T08:00:00Z",
    importanceLevel: "核心关注",
    keywordScore: 85,
    summary: "为推动数字经济高质量发展，加快数字技术创新应用，培育新产业新业态新模式。",
    paragraphs: [
      "一、总体要求",
      "坚持创新驱动发展，加快数字经济与实体经济深度融合。",
      "二、重点任务",
      "设立专项资金支持关键核心技术研发，开展试点示范工作。",
    ],
    categories: [
      { category: "AI·人工智能", score: 95 },
      { category: "B·强支持信号", score: 80 },
      { category: "数据要素", score: 70 },
    ],
    matchedKeywords: [
      { keyword: "人工智能", category: "AI" },
      { keyword: "专项资金", category: "B" },
      { keyword: "数字经济", category: "主题" },
    ],
    effectiveFrom: "2026-02-01",
    effectiveTo: "2028-12-31",
    deadlineDate: "2026-03-31",
    hasFunding: true,
    hasPilot: true,
    hasProcurement: false,
    documentStatus: "正式发文",
    ...overrides,
  };
}

const itemA = createMockItem({
  sourceId: "item-a",
  title: "政策A：关于推进数字经济发展的指导意见",
  departmentName: "工业和信息化部",
  listPublishedAt: "2026-01-15T00:00:00Z",
  importanceLevel: "核心关注",
  keywordScore: 85,
  summary: "为推动数字经济高质量发展，加快数字技术创新应用，设立专项资金支持关键核心技术研发，开展试点示范工作，鼓励政府采购。",
  paragraphs: [
    "一、总体要求",
    "坚持创新驱动发展，加快数字经济与实体经济深度融合，全面推进各行业数字化转型。",
    "二、重点任务",
    "设立专项资金支持关键核心技术研发，安排财政补贴和经费补助，鼓励金融机构提供贷款支持。",
    "开展试点示范工作，建设示范区和示范工程，探索先行先试经验。",
    "加大政府采购力度，优先采购自主创新产品，通过公开招标方式推进项目落地。",
    "制定行业标准和技术规范，建立标准化体系，推动产业规范化发展。",
    "三、保障措施",
    "建立统筹协调机制，加强跨区域协同，形成多部门联动工作格局。",
  ],
  categories: [
    { category: "AI·人工智能", score: 95 },
    { category: "B·强支持信号", score: 80 },
    { category: "数据要素", score: 70 },
  ],
  matchedKeywords: [
    { keyword: "人工智能", category: "AI" },
    { keyword: "专项资金", category: "B" },
    { keyword: "数字经济", category: "主题" },
  ],
  hasFunding: true,
  hasPilot: true,
  hasProcurement: true,
  effectiveFrom: "2026-02-01",
  effectiveTo: "2028-12-31",
});

const itemB = createMockItem({
  sourceId: "item-b",
  title: "政策B：人工智能产业创新发展实施方案",
  departmentName: "科技部",
  listPublishedAt: "2026-03-20T00:00:00Z",
  importanceLevel: "重点内容",
  keywordScore: 92,
  summary: "促进人工智能产业创新发展，推动大模型技术研发，开展试点示范，鼓励政府采购。",
  categories: [
    { category: "AI·人工智能", score: 98 },
    { category: "B·强支持信号", score: 75 },
    { category: "算力", score: 85 },
  ],
  matchedKeywords: [
    { keyword: "人工智能", category: "AI" },
    { keyword: "大模型", category: "AI" },
    { keyword: "政府采购", category: "采购" },
  ],
  hasFunding: true,
  hasPilot: true,
  hasProcurement: true,
  effectiveFrom: "2026-04-01",
  effectiveTo: "2027-12-31",
  deadlineDate: "2026-05-15",
});

const itemC = createMockItem({
  sourceId: "item-c",
  title: "政策C：关于加强数据安全管理的通知",
  departmentName: "国家互联网信息办公室",
  listPublishedAt: "2026-05-10T00:00:00Z",
  importanceLevel: "普通",
  keywordScore: 60,
  summary: "建立数据安全标准规范体系，加强监管，防范数据安全风险。",
  paragraphs: [
    "一、总体要求",
    "坚持安全与发展并重，建立健全数据安全治理体系。",
    "二、重点任务",
    "加强数据安全监管，完善标准规范，防范化解数据安全风险。",
  ],
  categories: [
    { category: "数据要素", score: 80 },
    { category: "D·监管信号", score: 90 },
  ],
  matchedKeywords: [
    { keyword: "数据安全", category: "数据" },
    { keyword: "监管", category: "监管" },
    { keyword: "标准", category: "标准" },
  ],
  hasFunding: false,
  hasPilot: false,
  hasProcurement: false,
  effectiveFrom: "2026-06-01",
  effectiveTo: null,
  deadlineDate: null,
});

// ============================================================================
// 1. 字段差异分析测试
// ============================================================================

describe("compare-analysis - analyzeFieldDifferences（字段差异分析）", () => {
  it("2 条政策时正确识别差异字段", () => {
    const result = analyzeFieldDifferences([itemA, itemB]);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    
    const deptField = result.find((f) => f.key === "departmentName");
    expect(deptField).toBeDefined();
    expect(deptField?.type).toBe("different");
    
    const fundingField = result.find((f) => f.key === "hasFunding");
    expect(fundingField).toBeDefined();
    expect(fundingField?.type).toBe("same");
  });

  it("相同字段标记为 same", () => {
    const sameItem = createMockItem({ ...itemA, sourceId: "same" });
    const result = analyzeFieldDifferences([itemA, sameItem]);
    const diffCount = result.filter((f) => f.type === "different").length;
    expect(diffCount).toBe(0);
  });

  it("差异字段标记为 different", () => {
    const result = analyzeFieldDifferences([itemA, itemB]);
    const diffFields = result.filter((f) => f.type === "different");
    expect(diffFields.length).toBeGreaterThan(0);
    expect(diffFields.some((f) => f.key === "departmentName")).toBe(true);
    expect(diffFields.some((f) => f.key === "importanceLevel")).toBe(true);
  });

  it("返回正确的 displayValues", () => {
    const result = analyzeFieldDifferences([itemA, itemB]);
    const deptField = result.find((f) => f.key === "departmentName");
    expect(deptField?.displayValues).toContain("工业和信息化部");
    expect(deptField?.displayValues).toContain("科技部");
  });

  it("3 条政策时正确分析差异", () => {
    const result = analyzeFieldDifferences([itemA, itemB, itemC]);
    expect(result.length).toBeGreaterThan(0);
    
    const fundingField = result.find((f) => f.key === "hasFunding");
    expect(fundingField?.type).toBe("different");
    
    const pilotField = result.find((f) => f.key === "hasPilot");
    expect(pilotField?.type).toBe("different");
  });

  it("布尔字段正确显示是/否", () => {
    const result = analyzeFieldDifferences([itemA, itemC]);
    const fundingField = result.find((f) => f.key === "hasFunding");
    expect(fundingField?.displayValues[0]).toBe("是");
    expect(fundingField?.displayValues[1]).toBe("否");
  });

  it("日期字段正确格式化", () => {
    const result = analyzeFieldDifferences([itemA, itemB]);
    const pubField = result.find((f) => f.key === "listPublishedAt");
    expect(pubField?.displayValues[0]).toContain("2026");
  });

  it("所有字段都有 label", () => {
    const result = analyzeFieldDifferences([itemA, itemB]);
    result.forEach((field) => {
      expect(field.label).toBeDefined();
      expect(field.label.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// 2. 文本差异检测测试
// ============================================================================

describe("compare-analysis - computeTextDiff（文本差异检测）", () => {
  it("完全相同的文本返回 same 段", () => {
    const text = "这是一段测试文本。";
    const result = computeTextDiff(text, text);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.type === "same")).toBe(true);
  });

  it("完全不同的文本返回 added 和 removed 段", () => {
    const result = computeTextDiff("你好世界", "再见世界");
    expect(result.some((s) => s.type === "removed")).toBe(true);
    expect(result.some((s) => s.type === "added")).toBe(true);
  });

  it("空字符串 A 时全部为 added", () => {
    const result = computeTextDiff("", "新增的内容");
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("added");
  });

  it("空字符串 B 时全部为 removed", () => {
    const result = computeTextDiff("删除的内容", "");
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("removed");
  });

  it("两个空字符串返回空数组", () => {
    const result = computeTextDiff("", "");
    expect(result).toEqual([]);
  });

  it("正确识别部分相同的文本", () => {
    const result = computeTextDiff("数字经济高质量发展", "数字经济创新发展");
    expect(result.some((s) => s.type === "same")).toBe(true);
    expect(result.some((s) => s.type === "removed")).toBe(true);
    expect(result.some((s) => s.type === "added")).toBe(true);
  });

  it("支持中文标点符号分词", () => {
    const result = computeTextDiff("你好，世界！", "你好，大家！");
    expect(result.length).toBeGreaterThan(0);
  });

  it("返回的段落可以拼接回完整文本", () => {
    const textA = "为推动数字经济发展，设立专项资金。";
    const textB = "促进人工智能产业，开展试点示范。";
    const diff = computeTextDiff(textA, textB);
    
    const reconstructedA = diff
      .filter((s) => s.type !== "added")
      .map((s) => s.text)
      .join("");
    
    const reconstructedB = diff
      .filter((s) => s.type !== "removed")
      .map((s) => s.text)
      .join("");
    
    expect(reconstructedA).toBe(textA);
    expect(reconstructedB).toBe(textB);
  });

  it("长文本也能正常处理（不崩溃）", () => {
    const longText = "这是一段很长的测试文本。".repeat(100);
    const longText2 = "这是另一段很长的测试文本。".repeat(100);
    expect(() => computeTextDiff(longText, longText2)).not.toThrow();
    const result = computeTextDiff(longText, longText2);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 3. 分类重叠分析测试
// ============================================================================

describe("compare-analysis - analyzeCategoryOverlap（分类重叠分析）", () => {
  it("正确识别共同分类", () => {
    const result = analyzeCategoryOverlap([itemA, itemB]);
    expect(result.common).toContain("AI·人工智能");
    expect(result.common).toContain("B·强支持信号");
  });

  it("正确识别独有分类", () => {
    const result = analyzeCategoryOverlap([itemA, itemB]);
    expect(result.uniquePerPolicy[0]).toContain("数据要素");
    expect(result.uniquePerPolicy[1]).toContain("算力");
  });

  it("3 条政策时正确分析共同分类", () => {
    const result = analyzeCategoryOverlap([itemA, itemB, itemC]);
    expect(result.common.length).toBe(0);
  });

  it("返回 allCategories 包含所有分类", () => {
    const result = analyzeCategoryOverlap([itemA, itemB]);
    const allExpected = ["AI·人工智能", "B·强支持信号", "数据要素", "算力"];
    allExpected.forEach((cat) => {
      expect(result.allCategories).toContain(cat);
    });
  });

  it("空分类时正常处理", () => {
    const emptyItem = createMockItem({ categories: [] });
    const result = analyzeCategoryOverlap([emptyItem, emptyItem]);
    expect(result.common).toEqual([]);
    expect(result.allCategories).toEqual([]);
  });
});

// ============================================================================
// 4. 关键词重叠分析测试
// ============================================================================

describe("compare-analysis - analyzeKeywordOverlap（关键词重叠分析）", () => {
  it("正确识别共同关键词", () => {
    const result = analyzeKeywordOverlap([itemA, itemB]);
    expect(result.common).toContain("人工智能");
  });

  it("正确识别独有关键词", () => {
    const result = analyzeKeywordOverlap([itemA, itemB]);
    expect(result.uniquePerPolicy[0]).toContain("专项资金");
    expect(result.uniquePerPolicy[0]).toContain("数字经济");
    expect(result.uniquePerPolicy[1]).toContain("大模型");
    expect(result.uniquePerPolicy[1]).toContain("政府采购");
  });

  it("3 条政策时正确分析共同关键词", () => {
    const result = analyzeKeywordOverlap([itemA, itemB, itemC]);
    expect(result.common.length).toBe(0);
  });

  it("返回 allKeywords 包含所有关键词", () => {
    const result = analyzeKeywordOverlap([itemA, itemB]);
    const allExpected = ["人工智能", "专项资金", "数字经济", "大模型", "政府采购"];
    allExpected.forEach((kw) => {
      expect(result.allKeywords).toContain(kw);
    });
  });

  it("空关键词时正常处理", () => {
    const emptyItem = createMockItem({ matchedKeywords: [] });
    const result = analyzeKeywordOverlap([emptyItem, emptyItem]);
    expect(result.common).toEqual([]);
    expect(result.allKeywords).toEqual([]);
  });
});

// ============================================================================
// 5. 影响对比分析测试
// ============================================================================

describe("compare-analysis - analyzeImpactComparison（影响对比分析）", () => {
  it("为每条政策生成影响分析", () => {
    const result = analyzeImpactComparison([itemA, itemB]);
    expect(result).toHaveLength(2);
    expect(result[0].policyIndex).toBe(0);
    expect(result[1].policyIndex).toBe(1);
  });

  it("包含所有 7 个维度", () => {
    const result = analyzeImpactComparison([itemA]);
    const dimensions = Object.keys(result[0].dimensions);
    expect(dimensions).toHaveLength(7);
    COMPARE_IMPACT_DIMENSIONS.forEach((dim) => {
      expect(result[0].dimensions[dim]).toBeDefined();
    });
  });

  it("每个维度有正确的结构", () => {
    const result = analyzeImpactComparison([itemA]);
    const funding = result[0].dimensions.funding;
    expect(funding.level).toBeDefined();
    expect(funding.description).toBeDefined();
    expect(Array.isArray(funding.evidence)).toBe(true);
  });

  it("level 是有效值", () => {
    const validLevels = ["high", "medium", "low", "none"];
    const result = analyzeImpactComparison([itemA, itemB, itemC]);
    result.forEach((item) => {
      COMPARE_IMPACT_DIMENSIONS.forEach((dim) => {
        expect(validLevels).toContain(item.dimensions[dim].level);
      });
    });
  });

  it("有资金关键词的政策 funding 维度不为 none", () => {
    const result = analyzeImpactComparison([itemA]);
    expect(result[0].dimensions.funding.level).not.toBe("none");
  });

  it("无资金关键词的政策 funding 维度为 none", () => {
    const result = analyzeImpactComparison([itemC]);
    expect(result[0].dimensions.funding.level).toBe("none");
  });

  it("有试点关键词的政策 pilot 维度不为 none", () => {
    const result = analyzeImpactComparison([itemA]);
    expect(result[0].dimensions.pilot.level).not.toBe("none");
  });

  it("overallLevel 是有效值", () => {
    const validLevels = ["high", "medium", "low"];
    const result = analyzeImpactComparison([itemA, itemB, itemC]);
    result.forEach((item) => {
      expect(validLevels).toContain(item.overallLevel);
    });
  });

  it("overallScore 与维度数量相关", () => {
    const result = analyzeImpactComparison([itemA]);
    expect(result[0].overallScore).toBeGreaterThan(0);
    expect(result[0].overallScore).toBeLessThanOrEqual(21);
  });

  it("强政策 overallLevel 高于弱政策", () => {
    const result = analyzeImpactComparison([itemA, itemC]);
    const scoreA = result[0].overallScore;
    const scoreC = result[1].overallScore;
    expect(scoreA).toBeGreaterThan(scoreC);
  });

  it("getImpactDimensionLabel 返回正确的中文标签", () => {
    expect(getImpactDimensionLabel("funding")).toBe("资金支持");
    expect(getImpactDimensionLabel("pilot")).toBe("试点示范");
    expect(getImpactDimensionLabel("procurement")).toBe("采购招标");
    expect(getImpactDimensionLabel("standard")).toBe("标准规范");
    expect(getImpactDimensionLabel("risk")).toBe("监管风险");
    expect(getImpactDimensionLabel("timeline")).toBe("时间紧迫度");
    expect(getImpactDimensionLabel("scope")).toBe("覆盖范围");
  });

  it("COMPARE_IMPACT_DIMENSIONS 包含 7 个维度", () => {
    expect(COMPARE_IMPACT_DIMENSIONS).toHaveLength(7);
  });
});

// ============================================================================
// 6. 时间线对比分析测试
// ============================================================================

describe("compare-analysis - analyzeTimelineComparison（时间线对比分析）", () => {
  it("生成时间线事件", () => {
    const result = analyzeTimelineComparison([itemA, itemB]);
    expect(result.events.length).toBeGreaterThan(0);
  });

  it("包含发布事件", () => {
    const result = analyzeTimelineComparison([itemA]);
    const pubEvents = result.events.filter((e) => e.type === "publication");
    expect(pubEvents.length).toBeGreaterThan(0);
  });

  it("包含生效事件", () => {
    const result = analyzeTimelineComparison([itemA]);
    const effEvents = result.events.filter((e) => e.type === "effective");
    expect(effEvents.length).toBeGreaterThan(0);
  });

  it("包含失效事件", () => {
    const result = analyzeTimelineComparison([itemA]);
    const deadlineEvents = result.events.filter((e) => e.type === "deadline");
    expect(deadlineEvents.length).toBeGreaterThan(0);
  });

  it("事件按日期排序", () => {
    const result = analyzeTimelineComparison([itemA, itemB, itemC]);
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i].date >= result.events[i - 1].date).toBe(true);
    }
  });

  it("每个事件关联到正确的政策", () => {
    const result = analyzeTimelineComparison([itemA, itemB]);
    result.events.forEach((event) => {
      expect(event.policyIndex).toBeGreaterThanOrEqual(0);
      expect(event.policyIndex).toBeLessThan(2);
    });
  });

  it("timeSpan 计算正确", () => {
    const result = analyzeTimelineComparison([itemA, itemB]);
    if (result.timeSpan.totalDays > 0) {
      expect(result.timeSpan.earliest).toBeDefined();
      expect(result.timeSpan.latest).toBeDefined();
      expect(result.timeSpan.totalDays).toBeGreaterThan(0);
    }
  });

  it("policyTimeframes 包含每条政策的时间范围", () => {
    const result = analyzeTimelineComparison([itemA, itemB]);
    expect(result.policyTimeframes).toHaveLength(2);
    expect(result.policyTimeframes[0].policyIndex).toBe(0);
    expect(result.policyTimeframes[1].policyIndex).toBe(1);
  });

  it("没有截止日期的政策 endDate 为 null", () => {
    const result = analyzeTimelineComparison([itemC]);
    expect(result.policyTimeframes[0].endDate).toBeNull();
  });

  it("事件类型是有效值", () => {
    const validTypes = ["deadline", "effective", "milestone", "review", "publication"];
    const result = analyzeTimelineComparison([itemA, itemB]);
    result.events.forEach((event) => {
      expect(validTypes).toContain(event.type);
    });
  });
});

// ============================================================================
// 7. Markdown 报告生成测试
// ============================================================================

describe("compare-analysis - generateMarkdownReport（Markdown 报告生成）", () => {
  it("生成非空的 Markdown 报告", () => {
    const fieldDiffs = analyzeFieldDifferences([itemA, itemB]);
    const impact = analyzeImpactComparison([itemA, itemB]);
    const timeline = analyzeTimelineComparison([itemA, itemB]);
    const catOverlap = analyzeCategoryOverlap([itemA, itemB]);
    const kwOverlap = analyzeKeywordOverlap([itemA, itemB]);

    const report = generateMarkdownReport([itemA, itemB], fieldDiffs, impact, timeline, catOverlap, kwOverlap);
    expect(report).toBeDefined();
    expect(report.length).toBeGreaterThan(0);
  });

  it("包含标题", () => {
    const fieldDiffs = analyzeFieldDifferences([itemA, itemB]);
    const impact = analyzeImpactComparison([itemA, itemB]);
    const timeline = analyzeTimelineComparison([itemA, itemB]);
    const catOverlap = analyzeCategoryOverlap([itemA, itemB]);
    const kwOverlap = analyzeKeywordOverlap([itemA, itemB]);

    const report = generateMarkdownReport([itemA, itemB], fieldDiffs, impact, timeline, catOverlap, kwOverlap);
    expect(report).toContain("# 政策对比分析报告");
  });

  it("包含政策概览表格", () => {
    const fieldDiffs = analyzeFieldDifferences([itemA, itemB]);
    const impact = analyzeImpactComparison([itemA, itemB]);
    const timeline = analyzeTimelineComparison([itemA, itemB]);
    const catOverlap = analyzeCategoryOverlap([itemA, itemB]);
    const kwOverlap = analyzeKeywordOverlap([itemA, itemB]);

    const report = generateMarkdownReport([itemA, itemB], fieldDiffs, impact, timeline, catOverlap, kwOverlap);
    expect(report).toContain("对比政策概览");
    expect(report).toContain(itemA.title);
    expect(report).toContain(itemB.title);
  });

  it("包含差异字段对比", () => {
    const fieldDiffs = analyzeFieldDifferences([itemA, itemB]);
    const impact = analyzeImpactComparison([itemA, itemB]);
    const timeline = analyzeTimelineComparison([itemA, itemB]);
    const catOverlap = analyzeCategoryOverlap([itemA, itemB]);
    const kwOverlap = analyzeKeywordOverlap([itemA, itemB]);

    const report = generateMarkdownReport([itemA, itemB], fieldDiffs, impact, timeline, catOverlap, kwOverlap);
    expect(report).toContain("差异字段");
  });

  it("包含影响维度对比", () => {
    const fieldDiffs = analyzeFieldDifferences([itemA, itemB]);
    const impact = analyzeImpactComparison([itemA, itemB]);
    const timeline = analyzeTimelineComparison([itemA, itemB]);
    const catOverlap = analyzeCategoryOverlap([itemA, itemB]);
    const kwOverlap = analyzeKeywordOverlap([itemA, itemB]);

    const report = generateMarkdownReport([itemA, itemB], fieldDiffs, impact, timeline, catOverlap, kwOverlap);
    expect(report).toContain("影响维度对比");
    expect(report).toContain("资金支持");
    expect(report).toContain("试点示范");
  });

  it("包含时间线对比", () => {
    const fieldDiffs = analyzeFieldDifferences([itemA, itemB]);
    const impact = analyzeImpactComparison([itemA, itemB]);
    const timeline = analyzeTimelineComparison([itemA, itemB]);
    const catOverlap = analyzeCategoryOverlap([itemA, itemB]);
    const kwOverlap = analyzeKeywordOverlap([itemA, itemB]);

    const report = generateMarkdownReport([itemA, itemB], fieldDiffs, impact, timeline, catOverlap, kwOverlap);
    expect(report).toContain("时间线对比");
  });

  it("包含分类与关键词对比", () => {
    const fieldDiffs = analyzeFieldDifferences([itemA, itemB]);
    const impact = analyzeImpactComparison([itemA, itemB]);
    const timeline = analyzeTimelineComparison([itemA, itemB]);
    const catOverlap = analyzeCategoryOverlap([itemA, itemB]);
    const kwOverlap = analyzeKeywordOverlap([itemA, itemB]);

    const report = generateMarkdownReport([itemA, itemB], fieldDiffs, impact, timeline, catOverlap, kwOverlap);
    expect(report).toContain("分类对比");
    expect(report).toContain("关键词对比");
  });

  it("3 条政策也能生成报告", () => {
    const fieldDiffs = analyzeFieldDifferences([itemA, itemB, itemC]);
    const impact = analyzeImpactComparison([itemA, itemB, itemC]);
    const timeline = analyzeTimelineComparison([itemA, itemB, itemC]);
    const catOverlap = analyzeCategoryOverlap([itemA, itemB, itemC]);
    const kwOverlap = analyzeKeywordOverlap([itemA, itemB, itemC]);

    const report = generateMarkdownReport([itemA, itemB, itemC], fieldDiffs, impact, timeline, catOverlap, kwOverlap);
    expect(report).toContain("3 条");
    expect(report).toContain(itemC.title);
  });

  it("包含生成时间", () => {
    const fieldDiffs = analyzeFieldDifferences([itemA, itemB]);
    const impact = analyzeImpactComparison([itemA, itemB]);
    const timeline = analyzeTimelineComparison([itemA, itemB]);
    const catOverlap = analyzeCategoryOverlap([itemA, itemB]);
    const kwOverlap = analyzeKeywordOverlap([itemA, itemB]);

    const report = generateMarkdownReport([itemA, itemB], fieldDiffs, impact, timeline, catOverlap, kwOverlap);
    expect(report).toContain("生成时间");
  });
});

// ============================================================================
// 8. 完整对比入口测试
// ============================================================================

describe("compare-analysis - runFullComparison（完整对比分析入口）", () => {
  it("返回所有分析结果", () => {
    const result = runFullComparison([itemA, itemB]);
    expect(result.fieldDiffs).toBeDefined();
    expect(result.impactComparison).toBeDefined();
    expect(result.timeline).toBeDefined();
    expect(result.categoryOverlap).toBeDefined();
    expect(result.keywordOverlap).toBeDefined();
    expect(result.markdownReport).toBeDefined();
    expect(result.summaryStats).toBeDefined();
  });

  it("summaryStats 包含正确的统计数据", () => {
    const result = runFullComparison([itemA, itemB]);
    expect(result.summaryStats.totalFields).toBeGreaterThan(0);
    expect(result.summaryStats.diffFields).toBeGreaterThan(0);
    expect(result.summaryStats.sameFields).toBeGreaterThan(0);
    expect(result.summaryStats.totalFields).toBe(
      result.summaryStats.diffFields + result.summaryStats.sameFields
    );
  });

  it("summaryStats 包含事件和分类统计", () => {
    const result = runFullComparison([itemA, itemB]);
    expect(result.summaryStats.totalEvents).toBeGreaterThan(0);
    expect(result.summaryStats.commonCategories).toBeDefined();
    expect(result.summaryStats.commonKeywords).toBeDefined();
  });

  it("2 条政策时正常工作", () => {
    const result = runFullComparison([itemA, itemB]);
    expect(result.fieldDiffs.length).toBeGreaterThan(0);
    expect(result.impactComparison).toHaveLength(2);
  });

  it("3 条政策时正常工作", () => {
    const result = runFullComparison([itemA, itemB, itemC]);
    expect(result.fieldDiffs.length).toBeGreaterThan(0);
    expect(result.impactComparison).toHaveLength(3);
    expect(result.timeline.policyTimeframes).toHaveLength(3);
  });

  it("markdownReport 非空", () => {
    const result = runFullComparison([itemA, itemB]);
    expect(result.markdownReport.length).toBeGreaterThan(0);
  });

  it("categoryOverlap 包含 common 和 uniquePerPolicy", () => {
    const result = runFullComparison([itemA, itemB]);
    expect(Array.isArray(result.categoryOverlap.common)).toBe(true);
    expect(Array.isArray(result.categoryOverlap.uniquePerPolicy)).toBe(true);
  });

  it("keywordOverlap 包含 common 和 uniquePerPolicy", () => {
    const result = runFullComparison([itemA, itemB]);
    expect(Array.isArray(result.keywordOverlap.common)).toBe(true);
    expect(Array.isArray(result.keywordOverlap.uniquePerPolicy)).toBe(true);
  });
});

// ============================================================================
// 9. 边界条件测试
// ============================================================================

describe("compare-analysis - 边界条件测试", () => {
  it("空内容政策不崩溃", () => {
    const emptyItem = createMockItem({
      summary: "",
      paragraphs: [],
      categories: [],
      matchedKeywords: [],
    });
    expect(() => analyzeFieldDifferences([emptyItem, emptyItem])).not.toThrow();
    expect(() => analyzeImpactComparison([emptyItem])).not.toThrow();
    expect(() => analyzeTimelineComparison([emptyItem])).not.toThrow();
    expect(() => runFullComparison([emptyItem, emptyItem])).not.toThrow();
  });

  it("完全相同的政策差异字段为 0", () => {
    const sameItem = createMockItem({ ...itemA, sourceId: "same" });
    const result = runFullComparison([itemA, sameItem]);
    expect(result.summaryStats.diffFields).toBe(0);
  });

  it("完全不同的政策相同字段较少", () => {
    const result = runFullComparison([itemA, itemC]);
    expect(result.summaryStats.sameFields).toBeLessThan(result.summaryStats.totalFields);
  });

  it("computeTextDiff 处理特殊字符", () => {
    const result = computeTextDiff("测试@#$%^&*()", "测试[]{}|<>");
    expect(result.length).toBeGreaterThan(0);
  });

  it("analyzeImpactComparison 处理非常短的文本", () => {
    const shortItem = createMockItem({
      summary: "短文本",
      paragraphs: [],
    });
    expect(() => analyzeImpactComparison([shortItem])).not.toThrow();
    const result = analyzeImpactComparison([shortItem]);
    expect(result[0].overallScore).toBeDefined();
  });
});

// ============================================================================
// 10. 演变趋势分析测试
// ============================================================================

describe("compare-analysis - analyzeEvolutionTrend（演变趋势分析）", () => {
  it("2 条政策时返回正确数量的阶段", () => {
    const result = analyzeEvolutionTrend([itemA, itemB]);
    expect(result.stages).toHaveLength(2);
  });

  it("3 条政策时返回正确数量的阶段", () => {
    const result = analyzeEvolutionTrend([itemA, itemB, itemC]);
    expect(result.stages).toHaveLength(3);
  });

  it("阶段按发布时间排序", () => {
    const result = analyzeEvolutionTrend([itemB, itemA, itemC]);
    const dates = result.stages.map((s) => s.publishedAt);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] >= dates[i - 1]).toBe(true);
    }
  });

  it("第一个阶段 relationToPrev 是 initial", () => {
    const result = analyzeEvolutionTrend([itemA, itemB]);
    expect(result.stages[0].relationToPrev).toBe("initial");
  });

  it("非第一个阶段 relationToPrev 不是 initial", () => {
    const result = analyzeEvolutionTrend([itemA, itemB]);
    expect(result.stages[1].relationToPrev).not.toBe("initial");
  });

  it("每个阶段都有关键变化列表", () => {
    const result = analyzeEvolutionTrend([itemA, itemB]);
    result.stages.forEach((stage) => {
      expect(Array.isArray(stage.keyChanges)).toBe(true);
      expect(stage.keyChanges.length).toBeGreaterThan(0);
    });
  });

  it("每个阶段都有高亮指标", () => {
    const result = analyzeEvolutionTrend([itemA, itemB]);
    result.stages.forEach((stage) => {
      expect(stage.highlightMetrics).toBeDefined();
      expect(typeof stage.highlightMetrics.overall).toBe("number");
      expect(typeof stage.highlightMetrics.funding).toBe("number");
    });
  });

  it("包含趋势指标数据", () => {
    const result = analyzeEvolutionTrend([itemA, itemB]);
    expect(result.trendMetrics).toBeDefined();
    expect(result.trendMetrics.length).toBeGreaterThan(0);
  });

  it("趋势指标包含资金支持维度", () => {
    const result = analyzeEvolutionTrend([itemA, itemB]);
    const fundingMetric = result.trendMetrics.find((m) => m.name === "funding");
    expect(fundingMetric).toBeDefined();
    expect(fundingMetric?.label).toBeDefined();
    expect(fundingMetric?.dataPoints).toHaveLength(2);
  });

  it("包含总体趋势描述", () => {
    const result = analyzeEvolutionTrend([itemA, itemB]);
    expect(result.overallTrend).toBeDefined();
    expect(result.overallTrend.length).toBeGreaterThan(0);
  });

  it("包含主要里程碑列表", () => {
    const result = analyzeEvolutionTrend([itemA, itemB]);
    expect(Array.isArray(result.majorMilestones)).toBe(true);
    expect(result.majorMilestones.length).toBeGreaterThan(0);
  });

  it("单条政策也能正常工作", () => {
    const result = analyzeEvolutionTrend([itemA]);
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0].relationToPrev).toBe("initial");
  });

  it("runFullComparison 返回 evolutionTrend", () => {
    const result = runFullComparison([itemA, itemB]);
    expect(result.evolutionTrend).toBeDefined();
    expect(result.evolutionTrend.stages).toHaveLength(2);
  });

  it("summaryStats 包含 evolutionStages", () => {
    const result = runFullComparison([itemA, itemB]);
    expect(result.summaryStats.evolutionStages).toBe(2);
  });
});
