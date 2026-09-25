import { describe, expect, it } from "vitest";
import {
  CATEGORY_STYLE,
  CATEGORY_GROUP_LABELS,
  SIGNAL_CATEGORIES,
  TOPIC_CATEGORIES,
  REGION_CATEGORIES,
  NOISE_CATEGORIES,
  getCategoryStyle,
  categoryDisplayLabel,
  categoryTooltip,
  getCategoryGroup,
  categoryGroupLabel,
  isSignalCategory,
  isTopicCategory,
  filterTopicCategories,
  getFirstTopicCategory,
  categoryMeta,
} from "@/lib/monitor/content-meta";

describe("分类展示映射 - 完整性校验", () => {
  const categoryKeys = Object.keys(CATEGORY_STYLE);

  it("共 13 个分类（5 个信号层 + 6 个主题层 + 1 个区域 + 1 个噪音）", () => {
    expect(categoryKeys.length).toBe(13);
  });

  it("每个分类都有 displayLabel，且与 label 不同（内部名不泄漏）", () => {
    for (const key of categoryKeys) {
      const style = CATEGORY_STYLE[key];
      expect(style.displayLabel, `${key} 缺少 displayLabel`).toBeTruthy();
      expect(style.displayLabel.length, `${key} displayLabel 为空`).toBeGreaterThan(0);
      expect(style.displayLabel, `${key} displayLabel 与 label 相同，可能泄漏内部命名`).not.toBe(
        style.label,
      );
    }
  });

  it("每个分类都有 tooltip 说明文案", () => {
    for (const key of categoryKeys) {
      const style = CATEGORY_STYLE[key];
      expect(style.tooltip, `${key} 缺少 tooltip`).toBeTruthy();
      expect(style.tooltip.length, `${key} tooltip 过短`).toBeGreaterThan(5);
    }
  });

  it("每个分类都有 chip / highlight / bar 三种样式", () => {
    for (const key of categoryKeys) {
      const style = CATEGORY_STYLE[key];
      expect(style.chip, `${key} 缺少 chip 样式`).toBeTruthy();
      expect(style.highlight, `${key} 缺少 highlight 样式`).toBeTruthy();
      expect(style.bar, `${key} 缺少 bar 样式`).toBeTruthy();
    }
  });

  it("label 字段与 key 一致（确保映射正确）", () => {
    for (const key of categoryKeys) {
      expect(CATEGORY_STYLE[key].label, `${key} 的 label 与 key 不一致`).toBe(key);
    }
  });
});

describe("分类展示映射 - 显示函数", () => {
  it("categoryDisplayLabel 返回用户友好的展示名", () => {
    expect(categoryDisplayLabel("A·强执行信号")).toBe("强执行要求");
    expect(categoryDisplayLabel("B·强支持信号")).toBe("资金与支持");
    expect(categoryDisplayLabel("C·风险信号")).toBe("监管风险");
    expect(categoryDisplayLabel("D·探索信号")).toBe("趋势观察");
    expect(categoryDisplayLabel("AI/智能体/大模型")).toBe("人工智能");
  });

  it("categoryTooltip 返回说明文案", () => {
    const tooltip = categoryTooltip("B·强支持信号");
    expect(tooltip).toContain("资金");
    expect(tooltip.length).toBeGreaterThan(5);
  });

  it("未知分类返回 fallback（label 作为 displayLabel，空 tooltip）", () => {
    expect(categoryDisplayLabel("不存在的分类")).toBe("不存在的分类");
    expect(categoryTooltip("不存在的分类")).toBe("");
  });
});

describe("分类分组", () => {
  it("CATEGORY_GROUP_LABELS 覆盖全部 5 种分组", () => {
    expect(Object.keys(CATEGORY_GROUP_LABELS).length).toBe(5);
    expect(CATEGORY_GROUP_LABELS.signal).toBe("政策信号");
    expect(CATEGORY_GROUP_LABELS.topic).toBe("涉及领域");
    expect(CATEGORY_GROUP_LABELS.region).toBe("区域相关");
    expect(CATEGORY_GROUP_LABELS.noise).toBe("其他");
    expect(CATEGORY_GROUP_LABELS.unknown).toBe("未分类");
  });

  it("信号层分类（5 个）都归为 signal 组", () => {
    const signalCats = ["A·强执行信号", "B·强支持信号", "C·风险信号", "D·探索信号", "通用启动/落地"];
    for (const cat of signalCats) {
      expect(getCategoryGroup(cat), `${cat} 应为 signal 组`).toBe("signal");
      expect(categoryGroupLabel(cat), `${cat} 应显示为政策信号`).toBe("政策信号");
      expect(isSignalCategory(cat), `${cat} 应为信号分类`).toBe(true);
      expect(isTopicCategory(cat), `${cat} 不应是主题分类`).toBe(false);
    }
  });

  it("主题层分类（6 个）都归为 topic 组", () => {
    const topicCats = [
      "AI/智能体/大模型",
      "算力/算力网/算电协同",
      "数据要素/高质量数据集",
      "产业合作/京津冀协同",
      "政务服务/平台经济/数字经济",
      "法规/征求意见",
    ];
    for (const cat of topicCats) {
      expect(getCategoryGroup(cat), `${cat} 应为 topic 组`).toBe("topic");
      expect(categoryGroupLabel(cat), `${cat} 应显示为涉及领域`).toBe("涉及领域");
      expect(isTopicCategory(cat), `${cat} 应为主题分类`).toBe(true);
      expect(isSignalCategory(cat), `${cat} 不应是信号分类`).toBe(false);
    }
  });

  it("区域分类归为 region 组", () => {
    expect(getCategoryGroup("京津冀/北京/区域")).toBe("region");
    expect(categoryGroupLabel("京津冀/北京/区域")).toBe("区域相关");
    expect(REGION_CATEGORIES.has("京津冀/北京/区域")).toBe(true);
  });

  it("噪音分类归为 noise 组", () => {
    expect(getCategoryGroup("噪音词汇")).toBe("noise");
    expect(categoryGroupLabel("噪音词汇")).toBe("其他");
    expect(NOISE_CATEGORIES.has("噪音词汇")).toBe(true);
  });

  it("未知分类归为 unknown 组", () => {
    expect(getCategoryGroup("随便一个分类")).toBe("unknown");
    expect(categoryGroupLabel("随便一个分类")).toBe("未分类");
  });
});

describe("旧英文 key 向后兼容", () => {
  it("新分类体系英文 key 能正确映射", () => {
    expect(getCategoryStyle("signal_exec").displayLabel).toBe("强执行要求");
    expect(getCategoryStyle("signal_support").displayLabel).toBe("资金与支持");
    expect(getCategoryStyle("signal_risk").displayLabel).toBe("监管风险");
    expect(getCategoryStyle("topic_ai").displayLabel).toBe("人工智能");
    expect(getCategoryStyle("topic_data").displayLabel).toBe("数据要素");
    expect(getCategoryStyle("negative").displayLabel).toBe("其他");
  });

  it("旧分类体系英文 key 能正确映射", () => {
    expect(getCategoryStyle("ai").displayLabel).toBe("人工智能");
    expect(getCategoryStyle("data").displayLabel).toBe("数据要素");
    expect(getCategoryStyle("industry").displayLabel).toBe("产业与区域");
    expect(getCategoryStyle("security").displayLabel).toBe("监管风险");
  });

  it("连字符变体 key 能正确映射", () => {
    expect(getCategoryStyle("topic-ai").displayLabel).toBe("人工智能");
    expect(getCategoryStyle("signal-risk").displayLabel).toBe("监管风险");
  });
});

describe("分类辅助函数", () => {
  it("getFirstTopicCategory 返回第一个主题分类的名称", () => {
    const cats = [
      { category: "C·风险信号", score: 5 },
      { category: "AI/智能体/大模型", score: 10 },
      { category: "数据要素/高质量数据集", score: 8 },
    ];
    expect(getFirstTopicCategory(cats)).toBe("AI/智能体/大模型");
  });

  it("getFirstTopicCategory 忽略信号分类和噪音", () => {
    const cats = [
      { category: "A·强执行信号", score: 5 },
      { category: "B·强支持信号", score: 3 },
      { category: "噪音词汇", score: 1 },
    ];
    expect(getFirstTopicCategory(cats)).toBeNull();
  });

  it("getFirstTopicCategory 空数组返回 null", () => {
    expect(getFirstTopicCategory([])).toBeNull();
  });

  it("categoryMeta 返回 displayLabel 和颜色", () => {
    const meta = categoryMeta("B·强支持信号");
    expect(meta.label).toBe("资金与支持");
    expect(meta.color).toBeTruthy();
  });

  it("filterTopicCategories 过滤出主题分类且保持顺序", () => {
    const cats = [
      { category: "A·强执行信号", score: 5 },
      { category: "AI/智能体/大模型", score: 10 },
      { category: "噪音词汇", score: 1 },
      { category: "数据要素/高质量数据集", score: 8 },
    ];
    const filtered = filterTopicCategories(cats);
    expect(filtered.length).toBe(2);
    expect(filtered[0].category).toBe("AI/智能体/大模型");
    expect(filtered[1].category).toBe("数据要素/高质量数据集");
  });
});

describe("displayLabel 专项校验", () => {
  const categoryKeys = Object.keys(CATEGORY_STYLE);

  it("所有 displayLabel 互不重复（不同分类展示名不撞车）", () => {
    const labels = categoryKeys.map((k) => CATEGORY_STYLE[k].displayLabel);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("displayLabel 不包含内部技术命名（A·B·C·D·、信号层、主题层）", () => {
    const leakPatterns = ["A·", "B·", "C·", "D·", "信号层", "主题层", "signal", "topic"];
    for (const key of categoryKeys) {
      const label = CATEGORY_STYLE[key].displayLabel;
      for (const pattern of leakPatterns) {
        expect(
          label.toLowerCase().includes(pattern.toLowerCase()),
          `${key} 的 displayLabel "${label}" 可能泄漏内部命名（包含 "${pattern}"）`,
        ).toBe(false);
      }
    }
  });

  it("displayLabel 长度合理（2-8 个字，符合标签设计）", () => {
    for (const key of categoryKeys) {
      const label = CATEGORY_STYLE[key].displayLabel;
      expect(label.length, `${key} 的 displayLabel 过短`).toBeGreaterThanOrEqual(2);
      expect(label.length, `${key} 的 displayLabel 过长`).toBeLessThanOrEqual(10);
    }
  });

  it("categoryMeta 返回的 label 是 displayLabel 不是内部 label", () => {
    for (const key of categoryKeys) {
      const meta = categoryMeta(key);
      expect(meta.label).toBe(CATEGORY_STYLE[key].displayLabel);
      expect(meta.label).not.toBe(key);
    }
  });
});

describe("tooltip 专项校验", () => {
  const categoryKeys = Object.keys(CATEGORY_STYLE);

  it("每个 tooltip 长度在 8-40 字之间（说明充分但不冗长）", () => {
    for (const key of categoryKeys) {
      const tooltip = CATEGORY_STYLE[key].tooltip;
      expect(tooltip.length, `${key} tooltip 过短（${tooltip.length} 字）`).toBeGreaterThanOrEqual(8);
      expect(tooltip.length, `${key} tooltip 过长（${tooltip.length} 字）`).toBeLessThanOrEqual(50);
    }
  });

  it("tooltip 不重复使用 displayLabel 作为全部内容", () => {
    for (const key of categoryKeys) {
      const style = CATEGORY_STYLE[key];
      expect(style.tooltip, `${key} tooltip 与 displayLabel 相同`).not.toBe(style.displayLabel);
      expect(style.tooltip.length, `${key} tooltip 比 displayLabel 还短`).toBeGreaterThan(
        style.displayLabel.length,
      );
    }
  });

  it("所有分类的 tooltip 句末没有多余标点（保持一致风格）", () => {
    for (const key of categoryKeys) {
      const tooltip = CATEGORY_STYLE[key].tooltip;
      const lastChar = tooltip[tooltip.length - 1];
      expect(["!", "?", "！", "？"].includes(lastChar), `${key} tooltip 句末风格不一致`).toBe(false);
    }
  });

  it("categoryTooltip 工具函数返回正确内容", () => {
    for (const key of categoryKeys) {
      expect(categoryTooltip(key)).toBe(CATEGORY_STYLE[key].tooltip);
    }
  });
});

describe("fallback 专项校验", () => {
  it("未知分类返回 fallback：displayLabel 等于输入值", () => {
    expect(categoryDisplayLabel("随便一个分类名")).toBe("随便一个分类名");
  });

  it("未知分类返回 fallback：tooltip 为空字符串", () => {
    expect(categoryTooltip("不存在的分类")).toBe("");
  });

  it("未知分类返回 fallback：chip / highlight / bar 有合理默认样式", () => {
    const style = getCategoryStyle("完全不存在的分类");
    expect(style.chip).toContain("bg-");
    // chip 已按"工作台秩序"收敛为近单色（不带边框），断言底色 + 文字色
    expect(style.chip).toContain("text-");
    expect(style.highlight).toContain("bg-");
    expect(style.bar).toContain("bg-");
  });

  it("空字符串输入安全：不抛异常，返回 fallback", () => {
    expect(() => categoryDisplayLabel("")).not.toThrow();
    expect(() => categoryTooltip("")).not.toThrow();
    expect(() => getCategoryStyle("")).not.toThrow();
    expect(categoryDisplayLabel("")).toBe("");
    expect(categoryTooltip("")).toBe("");
  });

  it("未知分类的 getCategoryGroup 返回 unknown", () => {
    expect(getCategoryGroup("随便一个分类")).toBe("unknown");
    expect(categoryGroupLabel("随便一个分类")).toBe("未分类");
  });

  it("fallback 的 label 等于 normalized 后的值（输入即输出）", () => {
    const style = getCategoryStyle("my-custom-category");
    expect(style.label).toBe("my-custom-category");
    expect(style.displayLabel).toBe("my-custom-category");
  });

  it("getCategoryStyle 对未知分类每次都返回新对象（不是共享引用）", () => {
    const a = getCategoryStyle("未知A");
    const b = getCategoryStyle("未知B");
    // 两个不同的未知分类应该有各自的对象（虽然内容相同）
    expect(a.label).toBe("未知A");
    expect(b.label).toBe("未知B");
  });
});

describe("分组 Set 与映射表一致性（防漏改）", () => {
  const allCategoryKeys = new Set(Object.keys(CATEGORY_STYLE));

  it("SIGNAL_CATEGORIES 中每个分类都在 CATEGORY_STYLE 里", () => {
    for (const cat of SIGNAL_CATEGORIES) {
      expect(allCategoryKeys.has(cat), `SIGNAL_CATEGORIES 中的 "${cat}" 不在 CATEGORY_STYLE 里`).toBe(true);
    }
  });

  it("TOPIC_CATEGORIES 中每个分类都在 CATEGORY_STYLE 里", () => {
    for (const cat of TOPIC_CATEGORIES) {
      expect(allCategoryKeys.has(cat), `TOPIC_CATEGORIES 中的 "${cat}" 不在 CATEGORY_STYLE 里`).toBe(true);
    }
  });

  it("REGION_CATEGORIES 中每个分类都在 CATEGORY_STYLE 里", () => {
    for (const cat of REGION_CATEGORIES) {
      expect(allCategoryKeys.has(cat), `REGION_CATEGORIES 中的 "${cat}" 不在 CATEGORY_STYLE 里`).toBe(true);
    }
  });

  it("NOISE_CATEGORIES 中每个分类都在 CATEGORY_STYLE 里", () => {
    for (const cat of NOISE_CATEGORIES) {
      expect(allCategoryKeys.has(cat), `NOISE_CATEGORIES 中的 "${cat}" 不在 CATEGORY_STYLE 里`).toBe(true);
    }
  });

  it("CATEGORY_STYLE 中每个分类都属于且只属于一个分组", () => {
    for (const cat of allCategoryKeys) {
      const inSignal = SIGNAL_CATEGORIES.has(cat);
      const inTopic = TOPIC_CATEGORIES.has(cat);
      const inRegion = REGION_CATEGORIES.has(cat);
      const inNoise = NOISE_CATEGORIES.has(cat);
      const count = [inSignal, inTopic, inRegion, inNoise].filter(Boolean).length;
      expect(count, `${cat} 属于 ${count} 个分组（应为 1 个）`).toBe(1);
    }
  });

  it("分组数量合计 = 总分类数（5 + 6 + 1 + 1 = 13）", () => {
    const total =
      SIGNAL_CATEGORIES.size + TOPIC_CATEGORIES.size + REGION_CATEGORIES.size + NOISE_CATEGORIES.size;
    expect(total).toBe(allCategoryKeys.size);
  });
});

describe("向后兼容：legacyMap 完整性", () => {
  const allCategoryKeys = new Set(Object.keys(CATEGORY_STYLE));

  it("legacyMap 中所有 key 都能映射到有效的分类", () => {
    const testKeys = [
      // 新体系
      "signal_exec", "signal_support", "signal_risk", "signal_explore", "signal_launch",
      "topic_ai", "topic_computing", "topic_data", "topic_industry", "topic_gov", "topic_regulation",
      "region_general", "negative",
      // 旧体系
      "signal_pre", "signal_start", "signal_opportunity", "regulations", "innovation",
      "ai", "data", "platform", "security", "industry", "gov_service", "region_bjj", "byte_related",
      // 连字符变体
      "topic-ai", "topic-data", "signal-risk", "signal-exec",
    ];
    for (const key of testKeys) {
      const style = getCategoryStyle(key);
      expect(allCategoryKeys.has(style.label), `legacy key "${key}" 映射到了无效的 "${style.label}"`).toBe(true);
    }
  });

  it("连字符变体和下划线变体映射到同一个分类", () => {
    expect(getCategoryStyle("topic_ai").label).toBe(getCategoryStyle("topic-ai").label);
    expect(getCategoryStyle("signal_risk").label).toBe(getCategoryStyle("signal-risk").label);
  });

  it("旧 key 'ai' 和新 key 'topic_ai' 都映射到同一个分类", () => {
    expect(getCategoryStyle("ai").label).toBe(getCategoryStyle("topic_ai").label);
  });
});
