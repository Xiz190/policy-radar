import { describe, it, expect } from "vitest";
import {
  isSignalCategory,
  isTopicCategory,
  filterTopicCategories,
  getFirstTopicCategory,
  SIGNAL_CATEGORIES,
  TOPIC_CATEGORIES,
  NOISE_CATEGORIES,
} from "@/lib/monitor/content-meta";

// ============================================================================
// 分类工具函数单元测试
// 覆盖：isSignalCategory、isTopicCategory、filterTopicCategories、getFirstTopicCategory
// 场景：信号层、主题层、噪音、空数组、混合顺序、纯信号层、单一主题、未知分类
// ============================================================================

describe("分类工具 - isSignalCategory（判断是否为信号层分类）", () => {
  it("A·强执行信号 是信号层", () => {
    expect(isSignalCategory("A·强执行信号")).toBe(true);
  });

  it("B·强支持信号 是信号层", () => {
    expect(isSignalCategory("B·强支持信号")).toBe(true);
  });

  it("C·风险信号 是信号层", () => {
    expect(isSignalCategory("C·风险信号")).toBe(true);
  });

  it("D·探索信号 是信号层", () => {
    expect(isSignalCategory("D·探索信号")).toBe(true);
  });

  it("通用启动/落地 是信号层", () => {
    expect(isSignalCategory("通用启动/落地")).toBe(true);
  });

  it("AI/智能体/大模型 不是信号层", () => {
    expect(isSignalCategory("AI/智能体/大模型")).toBe(false);
  });

  it("算力/算力网/算电协同 不是信号层", () => {
    expect(isSignalCategory("算力/算力网/算电协同")).toBe(false);
  });

  it("噪音词汇 不是信号层", () => {
    expect(isSignalCategory("噪音词汇")).toBe(false);
  });

  it("未知分类 不是信号层", () => {
    expect(isSignalCategory("未知分类")).toBe(false);
    expect(isSignalCategory("")).toBe(false);
  });

  it("SIGNAL_CATEGORIES 集合包含全部 5 种信号层分类", () => {
    expect(SIGNAL_CATEGORIES.size).toBe(5);
    expect(SIGNAL_CATEGORIES.has("A·强执行信号")).toBe(true);
    expect(SIGNAL_CATEGORIES.has("B·强支持信号")).toBe(true);
    expect(SIGNAL_CATEGORIES.has("C·风险信号")).toBe(true);
    expect(SIGNAL_CATEGORIES.has("D·探索信号")).toBe(true);
    expect(SIGNAL_CATEGORIES.has("通用启动/落地")).toBe(true);
  });
});

describe("分类工具 - isTopicCategory（判断是否为主题层分类）", () => {
  it("AI/智能体/大模型 是主题层", () => {
    expect(isTopicCategory("AI/智能体/大模型")).toBe(true);
  });

  it("算力/算力网/算电协同 是主题层", () => {
    expect(isTopicCategory("算力/算力网/算电协同")).toBe(true);
  });

  it("数据要素/高质量数据集 是主题层", () => {
    expect(isTopicCategory("数据要素/高质量数据集")).toBe(true);
  });

  it("产业合作/京津冀协同 是主题层", () => {
    expect(isTopicCategory("产业合作/京津冀协同")).toBe(true);
  });

  it("政务服务/平台经济/数字经济 是主题层", () => {
    expect(isTopicCategory("政务服务/平台经济/数字经济")).toBe(true);
  });

  it("法规/征求意见 是主题层", () => {
    expect(isTopicCategory("法规/征求意见")).toBe(true);
  });

  it("A·强执行信号 不是主题层", () => {
    expect(isTopicCategory("A·强执行信号")).toBe(false);
  });

  it("B·强支持信号 不是主题层", () => {
    expect(isTopicCategory("B·强支持信号")).toBe(false);
  });

  it("噪音词汇 不是主题层", () => {
    expect(isTopicCategory("噪音词汇")).toBe(false);
  });

  it("京津冀/北京/区域 不是主题层（区域类不计入主题层用于匹配）", () => {
    expect(isTopicCategory("京津冀/北京/区域")).toBe(false);
  });

  it("未知分类 不是主题层", () => {
    expect(isTopicCategory("未知分类")).toBe(false);
    expect(isTopicCategory("")).toBe(false);
  });

  it("TOPIC_CATEGORIES 集合包含全部 6 种主题层分类", () => {
    expect(TOPIC_CATEGORIES.size).toBe(6);
    expect(TOPIC_CATEGORIES.has("AI/智能体/大模型")).toBe(true);
    expect(TOPIC_CATEGORIES.has("算力/算力网/算电协同")).toBe(true);
    expect(TOPIC_CATEGORIES.has("数据要素/高质量数据集")).toBe(true);
    expect(TOPIC_CATEGORIES.has("产业合作/京津冀协同")).toBe(true);
    expect(TOPIC_CATEGORIES.has("政务服务/平台经济/数字经济")).toBe(true);
    expect(TOPIC_CATEGORIES.has("法规/征求意见")).toBe(true);
  });

  it("NOISE_CATEGORIES 集合包含噪音词汇", () => {
    expect(NOISE_CATEGORIES.size).toBe(1);
    expect(NOISE_CATEGORIES.has("噪音词汇")).toBe(true);
  });
});

describe("分类工具 - filterTopicCategories（过滤主题层分类）", () => {
  it("全信号层输入返回空数组", () => {
    const input = [
      { category: "A·强执行信号", score: 30 },
      { category: "B·强支持信号", score: 28 },
      { category: "C·风险信号", score: 15 },
    ];
    const result = filterTopicCategories(input);
    expect(result).toEqual([]);
  });

  it("全主题层输入返回全部", () => {
    const input = [
      { category: "AI/智能体/大模型", score: 45 },
      { category: "算力/算力网/算电协同", score: 38 },
      { category: "数据要素/高质量数据集", score: 25 },
    ];
    const result = filterTopicCategories(input);
    expect(result.length).toBe(3);
    expect(result.map((c) => c.category)).toEqual([
      "AI/智能体/大模型",
      "算力/算力网/算电协同",
      "数据要素/高质量数据集",
    ]);
  });

  it("混合分类（信号在前）正确过滤出主题层", () => {
    const input = [
      { category: "A·强执行信号", score: 30 },
      { category: "B·强支持信号", score: 28 },
      { category: "C·风险信号", score: 15 },
      { category: "D·探索信号", score: 10 },
      { category: "AI/智能体/大模型", score: 45 },
      { category: "算力/算力网/算电协同", score: 38 },
      { category: "数据要素/高质量数据集", score: 25 },
    ];
    const result = filterTopicCategories(input);
    expect(result.length).toBe(3);
    expect(result.map((c) => c.category)).toEqual([
      "AI/智能体/大模型",
      "算力/算力网/算电协同",
      "数据要素/高质量数据集",
    ]);
  });

  it("混合分类（主题在前）正确过滤出主题层（顺序无关）", () => {
    const input = [
      { category: "数据要素/高质量数据集", score: 42 },
      { category: "政务服务/平台经济/数字经济", score: 35 },
      { category: "B·强支持信号", score: 30 },
      { category: "A·强执行信号", score: 25 },
      { category: "通用启动/落地", score: 18 },
    ];
    const result = filterTopicCategories(input);
    expect(result.length).toBe(2);
    expect(result.map((c) => c.category)).toEqual([
      "数据要素/高质量数据集",
      "政务服务/平台经济/数字经济",
    ]);
  });

  it("包含噪音词汇的混合分类正确过滤（噪音不计入主题层）", () => {
    const input = [
      { category: "AI/智能体/大模型", score: 45 },
      { category: "B·强支持信号", score: 30 },
      { category: "噪音词汇", score: 10 },
      { category: "算力/算力网/算电协同", score: 38 },
    ];
    const result = filterTopicCategories(input);
    expect(result.length).toBe(2);
    expect(result.map((c) => c.category)).toEqual([
      "AI/智能体/大模型",
      "算力/算力网/算电协同",
    ]);
  });

  it("空数组输入返回空数组", () => {
    const result = filterTopicCategories([]);
    expect(result).toEqual([]);
  });

  it("单一主题层分类返回包含该分类的数组", () => {
    const input = [{ category: "产业合作/京津冀协同", score: 40 }];
    const result = filterTopicCategories(input);
    expect(result.length).toBe(1);
    expect(result[0].category).toBe("产业合作/京津冀协同");
  });

  it("保留原始的 score 字段值", () => {
    const input = [
      { category: "AI/智能体/大模型", score: 45 },
      { category: "算力/算力网/算电协同", score: 38 },
    ];
    const result = filterTopicCategories(input);
    expect(result[0].score).toBe(45);
    expect(result[1].score).toBe(38);
  });

  it("未知分类不计入主题层", () => {
    const input = [
      { category: "AI/智能体/大模型", score: 45 },
      { category: "未知分类X", score: 20 },
    ];
    const result = filterTopicCategories(input);
    expect(result.length).toBe(1);
    expect(result[0].category).toBe("AI/智能体/大模型");
  });
});

describe("分类工具 - getFirstTopicCategory（获取第一个主题层分类）", () => {
  it("信号层在前的混合分类返回第一个主题层（跳过信号层）", () => {
    const input = [
      { category: "A·强执行信号", score: 30 },
      { category: "B·强支持信号", score: 28 },
      { category: "AI/智能体/大模型", score: 45 },
      { category: "算力/算力网/算电协同", score: 38 },
    ];
    const result = getFirstTopicCategory(input);
    expect(result).toBe("AI/智能体/大模型");
  });

  it("主题层在前的混合分类返回第一个主题层", () => {
    const input = [
      { category: "数据要素/高质量数据集", score: 42 },
      { category: "政务服务/平台经济/数字经济", score: 35 },
      { category: "B·强支持信号", score: 30 },
    ];
    const result = getFirstTopicCategory(input);
    expect(result).toBe("数据要素/高质量数据集");
  });

  it("全信号层分类返回 null（无主题层时 fallback）", () => {
    const input = [
      { category: "A·强执行信号", score: 25 },
      { category: "B·强支持信号", score: 20 },
      { category: "通用启动/落地", score: 15 },
      { category: "噪音词汇", score: 10 },
    ];
    const result = getFirstTopicCategory(input);
    expect(result).toBeNull();
  });

  it("空数组返回 null", () => {
    const result = getFirstTopicCategory([]);
    expect(result).toBeNull();
  });

  it("单一主题层分类返回该分类", () => {
    const input = [{ category: "法规/征求意见", score: 30 }];
    const result = getFirstTopicCategory(input);
    expect(result).toBe("法规/征求意见");
  });

  it("噪音词汇在前时跳过噪音取第一个主题层", () => {
    const input = [
      { category: "噪音词汇", score: 10 },
      { category: "产业合作/京津冀协同", score: 40 },
      { category: "B·强支持信号", score: 25 },
    ];
    const result = getFirstTopicCategory(input);
    expect(result).toBe("产业合作/京津冀协同");
  });

  it("全部是未知分类返回 null", () => {
    const input = [
      { category: "未知分类1", score: 10 },
      { category: "未知分类2", score: 20 },
    ];
    const result = getFirstTopicCategory(input);
    expect(result).toBeNull();
  });

  it("完整 7 分类混合（4信号+3主题，信号在前）返回正确第一个主题", () => {
    const input = [
      { category: "A·强执行信号", score: 30 },
      { category: "B·强支持信号", score: 28 },
      { category: "C·风险信号", score: 15 },
      { category: "D·探索信号", score: 10 },
      { category: "AI/智能体/大模型", score: 45 },
      { category: "算力/算力网/算电协同", score: 38 },
      { category: "数据要素/高质量数据集", score: 25 },
    ];
    const result = getFirstTopicCategory(input);
    expect(result).toBe("AI/智能体/大模型");
  });
});

describe("分类工具 - 分层互斥性验证", () => {
  it("信号层分类不是主题层，主题层分类不是信号层", () => {
    const allSignal = Array.from(SIGNAL_CATEGORIES);
    const allTopic = Array.from(TOPIC_CATEGORIES);

    for (const sig of allSignal) {
      expect(isSignalCategory(sig)).toBe(true);
      expect(isTopicCategory(sig)).toBe(false);
    }

    for (const top of allTopic) {
      expect(isTopicCategory(top)).toBe(true);
      expect(isSignalCategory(top)).toBe(false);
    }
  });

  it("噪音词汇既不属于信号层也不属于主题层", () => {
    expect(isSignalCategory("噪音词汇")).toBe(false);
    expect(isTopicCategory("噪音词汇")).toBe(false);
  });

  it("SIGNAL_CATEGORIES 与 TOPIC_CATEGORIES 无交集", () => {
    const intersection = Array.from(SIGNAL_CATEGORIES).filter((c) =>
      TOPIC_CATEGORIES.has(c),
    );
    expect(intersection).toEqual([]);
  });
});
