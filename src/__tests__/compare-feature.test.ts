import { describe, it, expect } from "vitest";
import {
  parseItemsParam,
  generateRuleBasedComparison,
  MAX_COMPARE_ITEMS,
} from "@/app/api/monitor/compare/route";
import {
  formatDate,
  getImportanceBadge,
  getImpactBadge,
  getImpactLabel,
} from "@/app/compare/page";

// ============================================================================
// 政策对比功能单元测试
// 覆盖三个 Tab 的核心逻辑：参数解析、规则对比生成、工具函数
// ============================================================================

describe("对比功能 - parseItemsParam（URL 参数解析）", () => {
  it("正常解析 2 条政策", () => {
    const input = "source1::https://example.com/1|source2::https://example.com/2";
    const result = parseItemsParam(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ sourceId: "source1", url: "https://example.com/1" });
    expect(result[1]).toEqual({ sourceId: "source2", url: "https://example.com/2" });
  });

  it("正常解析 3 条政策", () => {
    const input = "s1::http://a.com|s2::http://b.com|s3::http://c.com";
    const result = parseItemsParam(input);
    expect(result).toHaveLength(3);
  });

  it("空字符串返回空数组", () => {
    expect(parseItemsParam("")).toEqual([]);
  });

  it("跳过无效格式（没有 :: 的条目）", () => {
    const input = "source1::https://a.com|invalid|source2::https://b.com";
    const result = parseItemsParam(input);
    expect(result).toHaveLength(2);
    expect(result[0].sourceId).toBe("source1");
    expect(result[1].sourceId).toBe("source2");
  });

  it("跳过 sourceId 为空的条目", () => {
    const input = "::https://a.com|source1::https://b.com";
    const result = parseItemsParam(input);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("source1");
  });

  it("跳过 url 为空的条目", () => {
    const input = "source1::|source2::https://b.com";
    const result = parseItemsParam(input);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("source2");
  });

  it(`超过 ${MAX_COMPARE_ITEMS} 条时截断到 ${MAX_COMPARE_ITEMS} 条`, () => {
    const items = Array.from({ length: 10 }, (_, i) => `s${i}::https://example.com/${i}`);
    const input = items.join("|");
    const result = parseItemsParam(input);
    expect(result).toHaveLength(MAX_COMPARE_ITEMS);
  });

  it("正确解析包含特殊字符的 URL", () => {
    const input = "source1::https://example.com/path?a=1&b=2#hash";
    const result = parseItemsParam(input);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com/path?a=1&b=2#hash");
  });

  it("处理开头和结尾的分隔符", () => {
    const input = "|s1::http://a.com|s2::http://b.com|";
    const result = parseItemsParam(input);
    expect(result).toHaveLength(2);
  });

  it("正确解析包含 :: 的 URL（只分割第一个 ::）", () => {
    const input = "source1::https://example.com/foo::bar";
    const result = parseItemsParam(input);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe("source1");
    expect(result[0].url).toBe("https://example.com/foo::bar");
  });
});

describe("对比功能 - generateRuleBasedComparison（规则版 AI 对比）", () => {
  const baseItems = [
    {
      title: "政策一：关于推进数字经济发展的指导意见",
      content: "为推动数字经济发展，安排专项资金支持试点示范工作。",
      summary: "加快数字经济建设",
      department: "工业和信息化部",
      publishedAt: "2026-01-15",
    },
    {
      title: "政策二：人工智能产业创新发展实施方案",
      content: "推动人工智能技术创新，开展试点示范，鼓励政府采购。",
      summary: "促进AI产业发展",
      department: "科技部",
      publishedAt: "2026-03-20",
    },
  ];

  it("2 条政策时生成完整的对比结果", () => {
    const result = generateRuleBasedComparison(baseItems);
    expect(result).toBeDefined();
    expect(typeof result.overallSummary).toBe("string");
    expect(result.overallSummary.length).toBeGreaterThan(0);
    expect(Array.isArray(result.similarities)).toBe(true);
    expect(Array.isArray(result.differences)).toBe(true);
    expect(typeof result.relationships).toBe("string");
    expect(Array.isArray(result.impactComparison)).toBe(true);
    expect(typeof result.keyFindings).toBe("string");
  });

  it("共同点：包含基础政策数量描述", () => {
    const result = generateRuleBasedComparison(baseItems);
    const sims = result.similarities as string[];
    expect(sims.some((s) => s.includes("2 份政策文件"))).toBe(true);
  });

  it("共同点：所有政策都有资金关键词时包含资金相关", () => {
    const items = [
      { title: "A", content: "专项资金补贴", department: "工信部", publishedAt: "2026-01-01" },
      { title: "B", content: "经费预算安排", department: "财政部", publishedAt: "2026-02-01" },
    ];
    const result = generateRuleBasedComparison(items);
    const sims = result.similarities as string[];
    expect(sims.some((s) => s.includes("资金支持"))).toBe(true);
  });

  it("共同点：所有政策都有试点关键词时包含试点相关", () => {
    const items = [
      { title: "A", content: "试点示范工程", department: "工信部", publishedAt: "2026-01-01" },
      { title: "B", content: "开展示范区试验", department: "财政部", publishedAt: "2026-02-01" },
    ];
    const result = generateRuleBasedComparison(items);
    const sims = result.similarities as string[];
    expect(sims.some((s) => s.includes("试点"))).toBe(true);
  });

  it("差异点：发布单位不同时包含单位差异", () => {
    const result = generateRuleBasedComparison(baseItems);
    const diffs = result.differences as string[];
    expect(diffs.some((d) => d.includes("发布单位不同"))).toBe(true);
    expect(diffs.some((d) => d.includes("工业和信息化部"))).toBe(true);
    expect(diffs.some((d) => d.includes("科技部"))).toBe(true);
  });

  it("差异点：部分政策有资金时包含资金差异", () => {
    const items = [
      { title: "A", content: "专项资金补贴", department: "工信部", publishedAt: "2026-01-01" },
      { title: "B", content: "加强宣传推广", department: "宣传部", publishedAt: "2026-02-01" },
    ];
    const result = generateRuleBasedComparison(items);
    const diffs = result.differences as string[];
    expect(diffs.some((d) => d.includes("资金支持力度不同"))).toBe(true);
    expect(diffs.some((d) => d.includes("1 份政策"))).toBe(true);
  });

  it("差异点：发布时间不同时包含时间跨度差异", () => {
    const result = generateRuleBasedComparison(baseItems);
    const diffs = result.differences as string[];
    expect(diffs.some((d) => d.includes("发布时间跨度较大"))).toBe(true);
    expect(diffs.some((d) => d.includes("2026-01-15"))).toBe(true);
    expect(diffs.some((d) => d.includes("2026-03-20"))).toBe(true);
  });

  it("差异点：部分政策有试点时包含推进方式差异", () => {
    const items = [
      { title: "A", content: "试点示范", department: "工信部", publishedAt: "2026-01-01" },
      { title: "B", content: "全面推行", department: "财政部", publishedAt: "2026-02-01" },
    ];
    const result = generateRuleBasedComparison(items);
    const diffs = result.differences as string[];
    expect(diffs.some((d) => d.includes("推进方式有差异"))).toBe(true);
  });

  it("影响评估：每条政策都有影响等级", () => {
    const result = generateRuleBasedComparison(baseItems);
    const impacts = result.impactComparison as Array<{
      policyIndex: number;
      impactLevel: string;
      impactAreas: string[];
    }>;
    expect(impacts).toHaveLength(2);
    expect(["high", "medium", "low"]).toContain(impacts[0].impactLevel);
    expect(["high", "medium", "low"]).toContain(impacts[1].impactLevel);
    expect(impacts[0].policyIndex).toBe(0);
    expect(impacts[1].policyIndex).toBe(1);
  });

  it("影响评估：资金+试点+采购政策影响等级更高", () => {
    const items = [
      {
        title: "弱政策",
        content: "加强宣传",
        department: "A",
        publishedAt: "2026-01-01",
      },
      {
        title: "强政策",
        content: "专项资金 试点示范 政府采购 标准规范",
        department: "B",
        publishedAt: "2026-01-01",
      },
    ];
    const result = generateRuleBasedComparison(items);
    const impacts = result.impactComparison as Array<{
      impactLevel: string;
      impactAreas: string[];
    }>;
    // 弱政策应该是 low 或 medium
    expect(["low", "medium"]).toContain(impacts[0].impactLevel);
    // 强政策应该是 high
    expect(impacts[1].impactLevel).toBe("high");
    // 强政策的影响领域应该更多
    expect(impacts[1].impactAreas.length).toBeGreaterThan(impacts[0].impactAreas.length);
  });

  it("影响评估：包含正确的影响领域标签", () => {
    const items = [
      {
        title: "A",
        content: "资金 试点 标准 采购",
        department: "工信部",
        publishedAt: "2026-01-01",
      },
    ];
    const result = generateRuleBasedComparison(items);
    const impacts = result.impactComparison as Array<{ impactAreas: string[] }>;
    const areas = impacts[0].impactAreas;
    expect(areas).toContain("资金支持");
    expect(areas).toContain("试点示范");
    expect(areas).toContain("标准规范");
    expect(areas).toContain("采购招标");
  });

  it("同部门同时段政策共同点有 2 条以上（含自动补全）", () => {
    const items = [
      { title: "A", content: "无关键词", department: "A", publishedAt: "2026-01-01" },
      { title: "B", content: "无关键词", department: "A", publishedAt: "2026-01-01" },
    ];
    const result = generateRuleBasedComparison(items);
    const sims = result.similarities as string[];
    // 基础 1 条 + 自动补全 1 条 = 至少 2 条
    expect(sims.length).toBeGreaterThanOrEqual(2);
  });

  it("同部门同时段政策差异点有 1 条以上（含自动补全）", () => {
    const items = [
      { title: "A", content: "完全相同", department: "A", publishedAt: "2026-01-01" },
      { title: "B", content: "完全相同", department: "A", publishedAt: "2026-01-01" },
    ];
    const result = generateRuleBasedComparison(items);
    const diffs = result.differences as string[];
    // 自动补全 1 条（政策侧重点各有不同）
    expect(diffs.length).toBeGreaterThanOrEqual(1);
    expect(diffs.some((d) => d.includes("侧重点"))).toBe(true);
  });

  it("关系分析：2 条及以上政策时有内容", () => {
    const result = generateRuleBasedComparison(baseItems);
    expect((result.relationships as string).length).toBeGreaterThan(0);
  });

  it("关键发现：包含规则分析声明", () => {
    const result = generateRuleBasedComparison(baseItems);
    expect((result.keyFindings as string).includes("关键词规则")).toBe(true);
  });

  it("空内容政策也能正常处理（不崩溃）", () => {
    const items = [
      { title: "", content: "", department: "", publishedAt: "" },
      { title: "", content: "", department: "", publishedAt: "" },
    ];
    expect(() => generateRuleBasedComparison(items)).not.toThrow();
    const result = generateRuleBasedComparison(items);
    expect(result.overallSummary).toBeDefined();
  });

  it("3 条政策时正确生成", () => {
    const items = [
      ...baseItems,
      {
        title: "政策三：关于加强数据安全管理的通知",
        content: "建立数据安全标准规范体系。",
        summary: "保障数据安全",
        department: "国家互联网信息办公室",
        publishedAt: "2026-05-10",
      },
    ];
    const result = generateRuleBasedComparison(items);
    const sims = result.similarities as string[];
    expect(sims.some((s) => s.includes("3 份政策文件"))).toBe(true);
    const impacts = result.impactComparison as Array<{ policyIndex: number }>;
    expect(impacts).toHaveLength(3);
  });

  it("共同点和差异点最多不超过 8 条", () => {
    const items = [
      {
        title: "A",
        content: "资金 试点 标准 采购 年内 一季度",
        department: "A",
        publishedAt: "2026-01-01",
      },
      {
        title: "B",
        content: "资金 试点 标准 采购 年内 一季度",
        department: "B",
        publishedAt: "2026-06-01",
      },
    ];
    const result = generateRuleBasedComparison(items);
    expect((result.similarities as string[]).length).toBeLessThanOrEqual(8);
    expect((result.differences as string[]).length).toBeLessThanOrEqual(8);
  });
});

describe("对比功能 - formatDate（日期格式化）", () => {
  it("null 返回 —", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("空字符串返回 —", () => {
    expect(formatDate("")).toBe("—");
  });

  it("有效日期格式化为 YYYY/MM/DD", () => {
    const result = formatDate("2026-01-15");
    expect(result).toMatch(/\d{4}\/\d{2}\/\d{2}/);
  });

  it("无效日期返回原字符串", () => {
    const invalid = "不是日期";
    expect(formatDate(invalid)).toBe(invalid);
  });

  it("ISO 格式日期正确解析", () => {
    const result = formatDate("2026-06-25T12:00:00Z");
    expect(result).toMatch(/\d{4}\/\d{2}\/\d{2}/);
  });
});

describe("对比功能 - getImportanceBadge（重要等级徽章样式）", () => {
  it("核心关注返回正确样式", () => {
    const result = getImportanceBadge("核心关注");
    expect(result).toContain("rose");
  });

  it("加急推荐返回正确样式", () => {
    const result = getImportanceBadge("加急推荐");
    expect(result).toContain("orange");
  });

  it("重点内容返回正确样式", () => {
    const result = getImportanceBadge("重点内容");
    expect(result).toContain("amber");
  });

  it("中等重点返回正确样式", () => {
    const result = getImportanceBadge("中等重点");
    expect(result).toContain("sky");
  });

  it("普通返回正确样式", () => {
    const result = getImportanceBadge("普通");
    expect(result).toContain("slate");
  });

  it("未知等级降级为普通样式", () => {
    const result = getImportanceBadge("未知等级");
    expect(result).toBe(getImportanceBadge("普通"));
  });
});

describe("对比功能 - getImpactBadge（影响等级徽章样式）", () => {
  it("high 返回 rose 样式", () => {
    expect(getImpactBadge("high")).toContain("rose");
  });

  it("medium 返回 amber 样式", () => {
    expect(getImpactBadge("medium")).toContain("amber");
  });

  it("low 返回 slate 样式", () => {
    expect(getImpactBadge("low")).toContain("slate");
  });

  it("未知等级降级为 slate 样式", () => {
    expect(getImpactBadge("unknown")).toContain("slate");
  });
});

describe("对比功能 - getImpactLabel（影响等级标签）", () => {
  it("high 返回 高影响", () => {
    expect(getImpactLabel("high")).toBe("高影响");
  });

  it("medium 返回 中影响", () => {
    expect(getImpactLabel("medium")).toBe("中影响");
  });

  it("low 返回 低影响", () => {
    expect(getImpactLabel("low")).toBe("低影响");
  });

  it("未知等级返回 未知", () => {
    expect(getImpactLabel("unknown")).toBe("未知");
  });
});
