import { describe, it, expect } from "vitest";
import { Flame } from "lucide-react";
import {
  calculatePriorityScore,
  normalizeKeywordScore,
  calculateSignalBonus,
  calculateDepartmentBonus,
  calculateQualityBonus,
  scoreToLevel,
  formatPriorityScore,
  isHighPriority,
  isCorePriority,
  type PriorityScoreInput,
} from "@/lib/monitor/priority-score";

// ============================================================================
// 统一优先级分数计算单元测试
// 覆盖：关键词归一化、信号加成、部委权重、质量加成、等级判定、边界情况
// ============================================================================

describe("优先级分数 - normalizeKeywordScore（关键词得分归一化）", () => {
  it("0 分关键词得分返回 0", () => {
    expect(normalizeKeywordScore(0)).toBe(0);
  });

  it("50 分关键词得分归一化到 32.5 分（满分 65 的一半）", () => {
    expect(normalizeKeywordScore(50)).toBe(32.5);
  });

  it("100 分关键词得分归一化到 65 分（满分）", () => {
    expect(normalizeKeywordScore(100)).toBe(65);
  });

  it("超过 100 分的关键词得分归一化后不超过 65 分", () => {
    expect(normalizeKeywordScore(200)).toBe(65);
    expect(normalizeKeywordScore(500)).toBe(65);
  });

  it("负数关键词得分返回 0", () => {
    expect(normalizeKeywordScore(-10)).toBe(0);
    expect(normalizeKeywordScore(-100)).toBe(0);
  });

  it("非数字输入返回 0", () => {
    expect(normalizeKeywordScore(NaN as unknown as number)).toBe(0);
    expect(normalizeKeywordScore(null as unknown as number)).toBe(0);
    expect(normalizeKeywordScore(undefined as unknown as number)).toBe(0);
  });
});

describe("优先级分数 - calculateSignalBonus（信号加成计算）", () => {
  it("无信号时加成 0", () => {
    const result = calculateSignalBonus({ keywordScore: 0 });
    expect(result.total).toBe(0);
    expect(result.funding).toBe(0);
    expect(result.procurement).toBe(0);
    expect(result.pilot).toBe(0);
    expect(result.standards).toBe(0);
  });

  it("单种信号加成正确", () => {
    expect(calculateSignalBonus({ keywordScore: 0, hasFunding: true }).funding).toBe(10);
    expect(calculateSignalBonus({ keywordScore: 0, hasProcurement: true }).procurement).toBe(12);
    expect(calculateSignalBonus({ keywordScore: 0, hasPilot: true }).pilot).toBe(7);
    expect(calculateSignalBonus({ keywordScore: 0, hasStandards: true }).standards).toBe(6);
  });

  it("四种信号全部命中时总加成有上限（封顶 20）", () => {
    const result = calculateSignalBonus({
      keywordScore: 0,
      hasFunding: true,
      hasProcurement: true,
      hasPilot: true,
      hasStandards: true,
    });
    expect(result.funding).toBe(10);
    expect(result.procurement).toBe(12);
    expect(result.pilot).toBe(7);
    expect(result.standards).toBe(6);
    expect(result.total).toBeLessThanOrEqual(20);
  });

  it("资金+采购组合加成（22 分，封顶到 20）", () => {
    const result = calculateSignalBonus({
      keywordScore: 0,
      hasFunding: true,
      hasProcurement: true,
    });
    expect(result.total).toBe(20);
  });
});

describe("优先级分数 - calculateDepartmentBonus（部委权重计算）", () => {
  it("空部委名返回 0", () => {
    expect(calculateDepartmentBonus("")).toBe(0);
    expect(calculateDepartmentBonus(undefined)).toBe(0);
  });

  it("国务院返回最高权重", () => {
    expect(calculateDepartmentBonus("国务院")).toBe(10);
    expect(calculateDepartmentBonus("国务院办公厅")).toBe(10);
  });

  it("核心部委返回最高权重", () => {
    expect(calculateDepartmentBonus("工业和信息化部")).toBe(10);
    expect(calculateDepartmentBonus("财政部")).toBe(10);
    expect(calculateDepartmentBonus("国家发展改革委")).toBe(10);
    expect(calculateDepartmentBonus("国家互联网信息办公室")).toBe(10);
    expect(calculateDepartmentBonus("科学技术部")).toBe(10);
  });

  it("京津冀地方政府返回权重", () => {
    expect(calculateDepartmentBonus("北京市人民政府")).toBe(10);
    expect(calculateDepartmentBonus("天津市人民政府")).toBe(10);
    expect(calculateDepartmentBonus("河北省人民政府")).toBe(10);
  });

  it("普通部委返回 0", () => {
    expect(calculateDepartmentBonus("某省某某局")).toBe(0);
    expect(calculateDepartmentBonus("未知部委")).toBe(0);
  });

  it("模糊匹配：包含部委名称也能命中", () => {
    expect(calculateDepartmentBonus("工业和信息化部办公厅")).toBe(10);
    expect(calculateDepartmentBonus("财政部国库司")).toBe(10);
  });
});

describe("优先级分数 - calculateQualityBonus（内容质量加成）", () => {
  it("无质量信号返回 0", () => {
    expect(calculateQualityBonus({ keywordScore: 0 })).toBe(0);
  });

  it("有预估判断加 3 分", () => {
    expect(calculateQualityBonus({ keywordScore: 0, hasForecast: true })).toBe(3);
  });

  it("有正文加 2 分", () => {
    expect(calculateQualityBonus({ keywordScore: 0, hasMeaningfulBody: true })).toBe(2);
  });

  it("预估+正文共加 5 分（封顶）", () => {
    expect(calculateQualityBonus({
      keywordScore: 0,
      hasForecast: true,
      hasMeaningfulBody: true,
    })).toBe(5);
  });
});

describe("优先级分数 - scoreToLevel（等级判定）", () => {
  it("75 分及以上为核心", () => {
    expect(scoreToLevel(100)).toBe("核心");
    expect(scoreToLevel(75)).toBe("核心");
    expect(scoreToLevel(90)).toBe("核心");
  });

  it("50-74 分为重点", () => {
    expect(scoreToLevel(50)).toBe("重点");
    expect(scoreToLevel(74)).toBe("重点");
    expect(scoreToLevel(65)).toBe("重点");
  });

  it("25-49 分为关注", () => {
    expect(scoreToLevel(25)).toBe("关注");
    expect(scoreToLevel(49)).toBe("关注");
    expect(scoreToLevel(35)).toBe("关注");
  });

  it("0-24 分为普通", () => {
    expect(scoreToLevel(0)).toBe("普通");
    expect(scoreToLevel(24)).toBe("普通");
    expect(scoreToLevel(15)).toBe("普通");
  });
});

describe("优先级分数 - calculatePriorityScore（综合计算）", () => {
  it("最低分：关键词 0 分 + 无信号 + 普通部委", () => {
    const result = calculatePriorityScore({
      keywordScore: 0,
      departmentName: "某普通单位",
    });
    expect(result.score).toBe(0);
    expect(result.level).toBe("普通");
    expect(result.levelLabel).toBe("普通监测");
  });

  it("中等关键词得分：50 分关键词 = 32.5 基础分", () => {
    const result = calculatePriorityScore({
      keywordScore: 50,
      departmentName: "某普通单位",
    });
    expect(result.score).toBeGreaterThanOrEqual(25);
    expect(result.score).toBeLessThan(40);
    expect(result.breakdown.keywordBase).toBe(32.5);
    expect(result.level).toBe("关注");
  });

  it("较高关键词得分：80 分关键词 = 52 基础分", () => {
    const result = calculatePriorityScore({
      keywordScore: 80,
      departmentName: "某普通单位",
    });
    expect(result.breakdown.keywordBase).toBe(52);
    expect(result.level).toBe("重点");
  });

  it("关键词满分 + 重点部委 = 75 分（核心级边界）", () => {
    const result = calculatePriorityScore({
      keywordScore: 100,
      departmentName: "工业和信息化部",
    });
    expect(result.score).toBe(75);
    expect(result.level).toBe("核心");
  });

  it("关键词满分 + 所有信号 + 重点部委 = 核心级", () => {
    const result = calculatePriorityScore({
      keywordScore: 100,
      hasFunding: true,
      hasProcurement: true,
      hasPilot: true,
      hasStandards: true,
      departmentName: "工业和信息化部",
    });
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.level).toBe("核心");
    expect(result.levelIcon).toBe(Flame);
  });

  it("工信部 + 资金 + 采购 + 较高关键词 = 核心级（典型核心关注场景）", () => {
    const result = calculatePriorityScore({
      keywordScore: 90,
      hasFunding: true,
      hasProcurement: true,
      departmentName: "工业和信息化部",
    });
    expect(result.level).toBe("核心");
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it("财政部 + 资金 + 中等关键词 = 重点级", () => {
    const result = calculatePriorityScore({
      keywordScore: 60,
      hasFunding: true,
      departmentName: "财政部",
    });
    expect(result.level).toBe("重点");
  });

  it("网信办 + 试点 + 标准 + 较高关键词 = 重点级", () => {
    const result = calculatePriorityScore({
      keywordScore: 70,
      hasPilot: true,
      hasStandards: true,
      departmentName: "国家互联网信息办公室",
    });
    expect(result.level).toBe("重点");
  });

  it("低分关键词 + 所有信号 + 重点部委 = 关注级（信号不能替代内容质量）", () => {
    const result = calculatePriorityScore({
      keywordScore: 20,
      hasFunding: true,
      hasProcurement: true,
      hasPilot: true,
      hasStandards: true,
      departmentName: "工业和信息化部",
    });
    expect(result.level).toBe("关注");
    expect(result.score).toBeGreaterThanOrEqual(25);
    expect(result.score).toBeLessThan(50);
  });

  it("有预估判断和正文时增加质量加成", () => {
    const without = calculatePriorityScore({
      keywordScore: 80,
      departmentName: "工业和信息化部",
    });
    const withQuality = calculatePriorityScore({
      keywordScore: 80,
      departmentName: "工业和信息化部",
      hasForecast: true,
      hasMeaningfulBody: true,
    });
    expect(withQuality.score).toBe(without.score + 5);
  });

  it("分数构成明细正确", () => {
    const result = calculatePriorityScore({
      keywordScore: 50,
      hasFunding: true,
      hasPilot: true,
      departmentName: "财政部",
      hasForecast: true,
    });
    expect(result.breakdown.keywordBase).toBe(32.5);
    expect(result.breakdown.signalBonus.funding).toBe(10);
    expect(result.breakdown.signalBonus.pilot).toBe(7);
    expect(result.breakdown.signalBonus.total).toBe(17);
    expect(result.breakdown.departmentBonus).toBe(10);
    expect(result.breakdown.qualityBonus).toBe(3);
    expect(result.breakdown.total).toBe(result.score);
  });

  it("总分不超过 100", () => {
    const result = calculatePriorityScore({
      keywordScore: 500,
      hasFunding: true,
      hasProcurement: true,
      hasPilot: true,
      hasStandards: true,
      departmentName: "国务院",
      hasForecast: true,
      hasMeaningfulBody: true,
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("优先级分数 - 工具函数", () => {
  it("formatPriorityScore 正确格式化", () => {
    expect(formatPriorityScore(85.6)).toBe("86");
    expect(formatPriorityScore(60)).toBe("60");
    expect(formatPriorityScore(0)).toBe("0");
  });

  it("isHighPriority 判断正确", () => {
    expect(isHighPriority(50)).toBe(true);
    expect(isHighPriority(90)).toBe(true);
    expect(isHighPriority(49)).toBe(false);
    expect(isHighPriority(0)).toBe(false);
  });

  it("isCorePriority 判断正确", () => {
    expect(isCorePriority(75)).toBe(true);
    expect(isCorePriority(95)).toBe(true);
    expect(isCorePriority(74)).toBe(false);
    expect(isCorePriority(60)).toBe(false);
  });
});

describe("优先级分数 - 典型场景验证", () => {
  const scenarios: Array<{ name: string; input: PriorityScoreInput; expectedLevel: string; minScore: number; maxScore: number }> = [
    {
      name: "工信部 AI 政策 + 资金 + 试点 + 高关键词 = 核心",
      input: {
        keywordScore: 95,
        hasFunding: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "工业和信息化部",
        hasForecast: true,
      },
      expectedLevel: "核心",
      minScore: 75,
      maxScore: 100,
    },
    {
      name: "财政部 财政支持政策 + 资金 + 采购 = 核心",
      input: {
        keywordScore: 88,
        hasFunding: true,
        hasProcurement: true,
        departmentName: "财政部",
      },
      expectedLevel: "核心",
      minScore: 75,
      maxScore: 100,
    },
    {
      name: "网信办 数据要素政策 + 试点 + 标准 = 重点",
      input: {
        keywordScore: 75,
        hasPilot: true,
        hasStandards: true,
        departmentName: "国家互联网信息办公室",
      },
      expectedLevel: "重点",
      minScore: 50,
      maxScore: 74,
    },
    {
      name: "地方政府 普通通知 + 中等关键词 = 关注",
      input: {
        keywordScore: 40,
        departmentName: "浙江省人民政府",
      },
      expectedLevel: "关注",
      minScore: 25,
      maxScore: 49,
    },
    {
      name: "普通部委 + 低关键词 = 普通",
      input: {
        keywordScore: 15,
        departmentName: "某省某某局",
      },
      expectedLevel: "普通",
      minScore: 0,
      maxScore: 24,
    },
  ];

  scenarios.forEach((scenario) => {
    it(scenario.name, () => {
      const result = calculatePriorityScore(scenario.input);
      expect(result.level).toBe(scenario.expectedLevel);
      expect(result.score).toBeGreaterThanOrEqual(scenario.minScore);
      expect(result.score).toBeLessThanOrEqual(scenario.maxScore);
      expect(result.breakdown.total).toBe(result.score);
    });
  });
});

// ============================================================================
// 边界测试：关键词权重变化对等级的影响
// 验证：关键词得分突然增加时，普通政策是否会意外变成核心关注
// ============================================================================

describe("边界测试 - 关键词权重变化对等级的影响", () => {
  describe("场景1：纯关键词增长（无信号 + 普通部委）", () => {
    const testPoints = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200];

    const results = testPoints.map((kw) => ({
      keywordScore: kw,
      result: calculatePriorityScore({
        keywordScore: kw,
        departmentName: "某普通单位",
      }),
    }));

    it("关键词 0 分 → 普通级", () => {
      const r = results.find((r) => r.keywordScore === 0)!;
      expect(r.result.level).toBe("普通");
      expect(r.result.score).toBe(0);
    });

    it("关键词 25 分左右 → 关注级（边界）", () => {
      const r = results.find((r) => r.keywordScore === 40)!;
      expect(r.result.level).toBe("关注");
    });

    it("关键词 80 分 → 重点级（不会跳到核心）", () => {
      const r = results.find((r) => r.keywordScore === 80)!;
      expect(r.result.level).toBe("重点");
      expect(r.result.score).toBe(52);
    });

    it("关键词 100 分（满分）→ 仍为重点级（不会到核心）", () => {
      const r = results.find((r) => r.keywordScore === 100)!;
      expect(r.result.level).toBe("重点");
      expect(r.result.score).toBe(65);
      expect(r.result.score).toBeLessThan(75);
    });

    it("结论：无信号 + 普通部委，纯关键词增长永远达不到核心级", () => {
      const maxResult = results[results.length - 1].result;
      expect(maxResult.level).not.toBe("核心");
      expect(maxResult.score).toBeLessThan(75);
    });
  });

  describe("场景2：关键词增长 + 所有信号命中 + 普通部委（危险场景）", () => {
    const testPoints = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    const results = testPoints.map((kw) => ({
      keywordScore: kw,
      result: calculatePriorityScore({
        keywordScore: kw,
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "某普通单位",
      }),
    }));

    it("关键词 0 分 + 所有信号 → 普通级（20分，不到关注级门槛25）", () => {
      const r = results.find((r) => r.keywordScore === 0)!;
      expect(r.result.level).toBe("普通");
      expect(r.result.score).toBe(20);
    });

    it("关键词 50 分 + 所有信号 → 重点级", () => {
      const r = results.find((r) => r.keywordScore === 50)!;
      expect(r.result.level).toBe("重点");
      expect(r.result.score).toBe(52.5);
    });

    it("关键词 85 分 + 所有信号 → 达到核心级（边界点）", () => {
      const r = calculatePriorityScore({
        keywordScore: 85,
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "某普通单位",
      });
      expect(r.score).toBeGreaterThanOrEqual(75);
      expect(r.level).toBe("核心");
    });

    it("关键词 84 分 + 所有信号 → 仍为重点级（核心级门槛）", () => {
      const r = calculatePriorityScore({
        keywordScore: 84,
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "某普通单位",
      });
      expect(r.score).toBeLessThan(75);
      expect(r.level).toBe("重点");
    });

    it("结论：普通部委 + 全信号，关键词需 ≥ 85 分才会到核心级", () => {
      const boundary = calculatePriorityScore({
        keywordScore: 85,
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "某普通单位",
      });
      expect(boundary.level).toBe("核心");
    });
  });

  describe("场景3：关键词增长 + 重点部委 + 无信号", () => {
    const testPoints = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    const results = testPoints.map((kw) => ({
      keywordScore: kw,
      result: calculatePriorityScore({
        keywordScore: kw,
        departmentName: "工业和信息化部",
      }),
    }));

    it("关键词 0 分 + 重点部委 → 普通级（10分，不到关注级门槛25）", () => {
      const r = results.find((r) => r.keywordScore === 0)!;
      expect(r.result.level).toBe("普通");
      expect(r.result.score).toBe(10);
    });

    it("关键词 50 分 + 重点部委 → 关注级（42.5分，不到重点级门槛50）", () => {
      const r = results.find((r) => r.keywordScore === 50)!;
      expect(r.result.level).toBe("关注");
      expect(r.result.score).toBe(42.5);
    });

    it("关键词 100 分 + 重点部委 → 刚好达到核心级（75分）", () => {
      const r = results.find((r) => r.keywordScore === 100)!;
      expect(r.result.score).toBe(75);
      expect(r.result.level).toBe("核心");
    });

    it("关键词 99 分 + 重点部委 → 仍为重点级", () => {
      const r = calculatePriorityScore({
        keywordScore: 99,
        departmentName: "工业和信息化部",
      });
      expect(r.score).toBeLessThan(75);
      expect(r.level).toBe("重点");
    });

    it("结论：重点部委 + 无信号，关键词需 ≥ 100 分才会到核心级", () => {
      const boundary = calculatePriorityScore({
        keywordScore: 100,
        departmentName: "工业和信息化部",
      });
      expect(boundary.level).toBe("核心");
    });
  });

  describe("场景4：关键词增长 + 重点部委 + 所有信号 + 质量加成（最高风险）", () => {
    const testPoints = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    const results = testPoints.map((kw) => ({
      keywordScore: kw,
      result: calculatePriorityScore({
        keywordScore: kw,
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "工业和信息化部",
        hasForecast: true,
        hasMeaningfulBody: true,
      }),
    }));

    it("关键词 0 分 + 全部加成 → 关注级（35分，不到重点级门槛50）", () => {
      const r = results.find((r) => r.keywordScore === 0)!;
      expect(r.result.level).toBe("关注");
      expect(r.result.score).toBe(35);
    });

    it("关键词 30 分 + 全部加成 → 仍为重点级", () => {
      const r = results.find((r) => r.keywordScore === 30)!;
      expect(r.result.level).toBe("重点");
      expect(r.result.score).toBeLessThan(75);
    });

    it("关键词 62 分 + 全部加成 → 达到核心级（边界点）", () => {
      const r = calculatePriorityScore({
        keywordScore: 62,
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "工业和信息化部",
        hasForecast: true,
        hasMeaningfulBody: true,
      });
      expect(r.score).toBeGreaterThanOrEqual(75);
      expect(r.level).toBe("核心");
    });

    it("关键词 61 分 + 全部加成 → 仍为重点级", () => {
      const r = calculatePriorityScore({
        keywordScore: 61,
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "工业和信息化部",
        hasForecast: true,
        hasMeaningfulBody: true,
      });
      expect(r.score).toBeLessThan(75);
      expect(r.level).toBe("重点");
    });

    it("结论：所有加成拉满时，关键词 ≥ 62 分就会到核心级", () => {
      const boundary = calculatePriorityScore({
        keywordScore: 62,
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "工业和信息化部",
        hasForecast: true,
        hasMeaningfulBody: true,
      });
      expect(boundary.level).toBe("核心");
    });
  });

  describe("场景5：从普通级到核心级的完整跃迁路径", () => {
    type TestCase = {
      name: string;
      input: PriorityScoreInput;
      expectedLevel: string;
    };

    const cases: TestCase[] = [
      {
        name: "基线：低关键词 + 普通部委 + 无信号 = 普通",
        input: { keywordScore: 10, departmentName: "某普通单位" },
        expectedLevel: "普通",
      },
      {
        name: "关键词涨到 40 → 关注（26分，刚过25门槛）",
        input: { keywordScore: 40, departmentName: "某普通单位" },
        expectedLevel: "关注",
      },
      {
        name: "关键词涨到 80 + 有资金信号 → 重点（62分，过50门槛）",
        input: { keywordScore: 80, hasFunding: true, departmentName: "某普通单位" },
        expectedLevel: "重点",
      },
      {
        name: "关键词涨到 80 + 所有信号 → 还是重点（不到核心）",
        input: {
          keywordScore: 80,
          hasFunding: true,
          hasProcurement: true,
          hasPilot: true,
          hasStandards: true,
          departmentName: "某普通单位",
        },
        expectedLevel: "重点",
      },
      {
        name: "关键词涨到 90 + 所有信号 + 重点部委 → 核心",
        input: {
          keywordScore: 90,
          hasFunding: true,
          hasProcurement: true,
          hasPilot: true,
          hasStandards: true,
          departmentName: "工业和信息化部",
        },
        expectedLevel: "核心",
      },
    ];

    cases.forEach((c) => {
      it(c.name, () => {
        const result = calculatePriorityScore(c.input);
        expect(result.level).toBe(c.expectedLevel);
      });
    });
  });

  describe("场景6：核心级门槛汇总表（不同组合下关键词需要多少分）", () => {
    function findCoreThreshold(
      baseInput: Omit<PriorityScoreInput, "keywordScore">
    ): number {
      for (let kw = 0; kw <= 200; kw++) {
        const result = calculatePriorityScore({
          keywordScore: kw,
          ...baseInput,
        });
        if (result.level === "核心") return kw;
      }
      return -1;
    }

    it("普通部委 + 无信号 + 无质量 → 永远达不到核心（100分也只有65分）", () => {
      const threshold = findCoreThreshold({
        departmentName: "某普通单位",
      });
      expect(threshold).toBe(-1);
    });

    it("普通部委 + 全信号 + 无质量 → 关键词需 85 分", () => {
      const threshold = findCoreThreshold({
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "某普通单位",
      });
      expect(threshold).toBe(85);
    });

    it("重点部委 + 无信号 + 无质量 → 关键词需 100 分", () => {
      const threshold = findCoreThreshold({
        departmentName: "工业和信息化部",
      });
      expect(threshold).toBe(100);
    });

    it("重点部委 + 全信号 + 无质量 → 关键词需 70 分", () => {
      const threshold = findCoreThreshold({
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "工业和信息化部",
      });
      expect(threshold).toBe(70);
    });

    it("重点部委 + 全信号 + 全质量 → 关键词需 62 分", () => {
      const threshold = findCoreThreshold({
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "工业和信息化部",
        hasForecast: true,
        hasMeaningfulBody: true,
      });
      expect(threshold).toBe(62);
    });
  });

  describe("场景7：mock 数据梯度验证（确保不会意外跳级）", () => {
    it("模拟数据中普通级政策（关键词 0-20 分）即使有部委权重也不会跳到核心", () => {
      for (let kw = 0; kw <= 20; kw++) {
        const result = calculatePriorityScore({
          keywordScore: kw,
          hasFunding: true,
          hasProcurement: true,
          departmentName: "工业和信息化部",
          hasForecast: true,
          hasMeaningfulBody: true,
        });
        expect(result.level).not.toBe("核心");
      }
    });

    it("模拟数据中关注级政策（关键词 25-50 分）拉满加成也不会到核心", () => {
      for (let kw = 25; kw <= 50; kw++) {
        const result = calculatePriorityScore({
          keywordScore: kw,
          hasFunding: true,
          hasProcurement: true,
          hasPilot: true,
          hasStandards: true,
          departmentName: "工业和信息化部",
          hasForecast: true,
          hasMeaningfulBody: true,
        });
        if (kw < 62) {
          expect(result.level).not.toBe("核心");
        }
      }
    });

    it("关键词 62 分是拉满加成时的核心级临界点", () => {
      const at61 = calculatePriorityScore({
        keywordScore: 61,
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "工业和信息化部",
        hasForecast: true,
        hasMeaningfulBody: true,
      });
      const at62 = calculatePriorityScore({
        keywordScore: 62,
        hasFunding: true,
        hasProcurement: true,
        hasPilot: true,
        hasStandards: true,
        departmentName: "工业和信息化部",
        hasForecast: true,
        hasMeaningfulBody: true,
      });

      expect(at61.level).toBe("重点");
      expect(at62.level).toBe("核心");
    });
  });
});
