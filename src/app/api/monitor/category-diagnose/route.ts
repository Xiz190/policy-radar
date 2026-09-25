import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";
import { ensureMonitorSchema, getSameTopicItems } from "@/lib/monitor/db";
import {
  isSignalCategory,
  isTopicCategory,
  filterTopicCategories,
  getFirstTopicCategory,
  SIGNAL_CATEGORIES,
  TOPIC_CATEGORIES,
  NOISE_CATEGORIES,
} from "@/lib/monitor/content-meta";

export const dynamic = "force-dynamic";

/**
 * 分类逻辑诊断接口（本地开发调试用）
 *
 * GET /api/monitor/category-diagnose
 *   - 全库分类分布统计
 *   - 信号层/主题层/其他分类的占比
 *
 * GET /api/monitor/category-diagnose?simulate=1
 *   - 模拟复杂混合分类数据，验证过滤逻辑
 *   - 返回每一步的输入/输出对比
 *
 * POST /api/monitor/category-diagnose
 *   Body: { categories: Array<{category: string, score?: number}>, sourceId?: string, url?: string }
 *   - 传入自定义分类列表，验证过滤和匹配结果
 *   - 同时测试同主题匹配查询（需指定 sourceId 和 url 排除自身）
 */

// 预设的复杂混合分类测试场景
export const SIMULATE_SCENARIOS = [
  {
    name: "场景1：信号层在前的 7 分类混合（4信号 + 3主题）",
    categories: [
      { category: "A·强执行信号", score: 30 },
      { category: "B·强支持信号", score: 28 },
      { category: "C·风险信号", score: 15 },
      { category: "D·探索信号", score: 10 },
      { category: "AI/智能体/大模型", score: 45 },
      { category: "算力/算力网/算电协同", score: 38 },
      { category: "数据要素/高质量数据集", score: 25 },
    ],
  },
  {
    name: "场景2：主题层在前的 6 分类混合（含噪音）",
    categories: [
      { category: "数据要素/高质量数据集", score: 42 },
      { category: "政务服务/平台经济/数字经济", score: 35 },
      { category: "B·强支持信号", score: 30 },
      { category: "A·强执行信号", score: 25 },
      { category: "通用启动/落地", score: 18 },
      { category: "噪音词汇", score: 8 },
    ],
  },
  {
    name: "场景3：纯信号层 + 噪音（无主题层）",
    categories: [
      { category: "A·强执行信号", score: 25 },
      { category: "B·强支持信号", score: 20 },
      { category: "通用启动/落地", score: 15 },
      { category: "噪音词汇", score: 10 },
    ],
  },
  {
    name: "场景4：单一主题层（最简场景）",
    categories: [
      { category: "产业合作/京津冀协同", score: 40 },
    ],
  },
  {
    name: "场景5：全部 6 种主题层 + 全部 5 种信号层（全混合）",
    categories: [
      { category: "A·强执行信号", score: 30 },
      { category: "B·强支持信号", score: 28 },
      { category: "C·风险信号", score: 15 },
      { category: "D·探索信号", score: 10 },
      { category: "通用启动/落地", score: 20 },
      { category: "AI/智能体/大模型", score: 45 },
      { category: "算力/算力网/算电协同", score: 38 },
      { category: "数据要素/高质量数据集", score: 25 },
      { category: "产业合作/京津冀协同", score: 22 },
      { category: "政务服务/平台经济/数字经济", score: 30 },
      { category: "法规/征求意见", score: 18 },
      { category: "噪音词汇", score: 5 },
      { category: "京津冀/北京/区域", score: 12 },
    ],
  },
  {
    name: "场景6：未知分类 + 已知分类混合",
    categories: [
      { category: "AI/智能体/大模型", score: 45 },
      { category: "未知新分类X", score: 20 },
      { category: "B·强支持信号", score: 30 },
      { category: "另一个未知分类", score: 15 },
    ],
  },
  {
    name: "场景7：空分类数组",
    categories: [],
  },
];

export type CategoryInput = Array<{ category: string; score?: number }>;

export function analyzeCategories(categories: CategoryInput) {
  const signalCats: string[] = [];
  const topicCats: string[] = [];
  const noiseCats: string[] = [];
  const unknownCats: string[] = [];

  for (const c of categories) {
    if (isSignalCategory(c.category)) {
      signalCats.push(c.category);
    } else if (NOISE_CATEGORIES.has(c.category)) {
      noiseCats.push(c.category);
    } else if (isTopicCategory(c.category)) {
      topicCats.push(c.category);
    } else {
      unknownCats.push(c.category);
    }
  }

  const filtered = filterTopicCategories(categories);
  const firstTopic = getFirstTopicCategory(categories);

  return {
    input: {
      total: categories.length,
      categories: categories.map((c) => ({
        category: c.category,
        score: c.score ?? 0,
      })),
    },
    breakdown: {
      signalCount: signalCats.length,
      signalCategories: signalCats,
      topicCount: topicCats.length,
      topicCategories: topicCats,
      noiseCount: noiseCats.length,
      noiseCategories: noiseCats,
      unknownCount: unknownCats.length,
      unknownCategories: unknownCats,
    },
    filterTopicCategories: {
      outputCount: filtered.length,
      outputCategories: filtered.map((c) => ({
        category: c.category,
        score: c.score ?? 0,
      })),
      allScoresPreserved: filtered.every(
        (c, i) => c.score === categories.find((ic) => ic.category === c.category)?.score,
      ),
    },
    getFirstTopicCategory: {
      result: firstTopic,
      expectedIfAny: topicCats.length > 0 ? topicCats[0] : null,
      matchesExpectation: firstTopic === (topicCats.length > 0 ? topicCats[0] : null),
    },
    sanityChecks: {
      signalAndTopicDisjoint: signalCats.every((s) => !topicCats.includes(s)),
      noiseNotInTopic: noiseCats.every((n) => !topicCats.includes(n)),
      noiseNotInSignal: noiseCats.every((n) => !signalCats.includes(n)),
      filteredOnlyContainsTopic: filtered.every((c) => isTopicCategory(c.category)),
      firstTopicIsFirstInInput: firstTopic
        ? categories.findIndex((c) => c.category === firstTopic) >= 0
        : true,
    },
  };
}

export async function GET(request: Request) {
  try {
    await ensureMonitorSchema();
    const url = new URL(request.url);
    const simulate = url.searchParams.get("simulate") === "1";
    const pool = getPgPool();

    // 模式1：模拟场景验证
    if (simulate) {
      const results = SIMULATE_SCENARIOS.map((scenario) => ({
        name: scenario.name,
        ...analyzeCategories(scenario.categories),
      }));

      return NextResponse.json({
        ok: true,
        mode: "simulate",
        scenarioCount: results.length,
        scenarios: results,
        summary: {
          allPassed: results.every((r) =>
            Object.values(r.sanityChecks).every((v) => v === true),
          ),
          totalChecks: results.reduce(
            (sum, r) => sum + Object.keys(r.sanityChecks).length,
            0,
          ),
          passedChecks: results.reduce(
            (sum, r) =>
              sum + Object.values(r.sanityChecks).filter((v) => v === true).length,
            0,
          ),
        },
      });
    }

    // 模式2：全库分类分布统计（默认）
    const categoryDist = await pool.query<{
      category: string;
      item_count: string;
    }>(`
      select
        c->>'category' as category,
        count(*)::text as item_count
      from monitor_items mi
      cross join jsonb_array_elements(
        case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end
      ) as c
      where jsonb_typeof(mi.matched_categories) = 'array'
      group by c->>'category'
      order by count(*) desc
    `);

    const totalItems = await pool.query<{ total: string }>(`
      select count(*)::text as total from monitor_items
    `);

    const itemsWithCategories = await pool.query<{ count: string }>(`
      select count(*)::text as count
      from monitor_items
      where jsonb_typeof(matched_categories) = 'array'
        and jsonb_array_length(matched_categories) > 0
    `);

    const rows = categoryDist.rows;

    const signalCategories: Array<{ category: string; itemCount: number }> = [];
    const topicCategories: Array<{ category: string; itemCount: number }> = [];
    const noiseCategories: Array<{ category: string; itemCount: number }> = [];
    const regionCategories: Array<{ category: string; itemCount: number }> = [];
    const unknownCategories: Array<{ category: string; itemCount: number }> = [];

    const REGION_CATEGORIES = new Set(["京津冀/北京/区域", "region_general", "region_bjj"]);

    for (const row of rows) {
      const count = Number(row.item_count) || 0;
      const cat = row.category;
      if (isSignalCategory(cat)) {
        signalCategories.push({ category: cat, itemCount: count });
      } else if (NOISE_CATEGORIES.has(cat)) {
        noiseCategories.push({ category: cat, itemCount: count });
      } else if (REGION_CATEGORIES.has(cat)) {
        regionCategories.push({ category: cat, itemCount: count });
      } else if (isTopicCategory(cat)) {
        topicCategories.push({ category: cat, itemCount: count });
      } else {
        unknownCategories.push({ category: cat, itemCount: count });
      }
    }

    const itemsWithOnlySignal = await pool.query<{ count: string }>(`
      select count(*)::text as count
      from monitor_items mi
      where jsonb_typeof(mi.matched_categories) = 'array'
        and jsonb_array_length(mi.matched_categories) > 0
        and not exists (
          select 1 from jsonb_array_elements(
            case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end
          ) as c
          where c->>'category' = any($1::text[])
        )
    `, [Array.from(TOPIC_CATEGORIES)]);

    const itemsWithMixed = await pool.query<{ count: string }>(`
      select count(*)::text as count
      from monitor_items mi
      where jsonb_typeof(mi.matched_categories) = 'array'
        and exists (
          select 1 from jsonb_array_elements(
            case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end
          ) as c
          where c->>'category' = any($1::text[])
        )
        and exists (
          select 1 from jsonb_array_elements(
            case when jsonb_typeof(mi.matched_categories) = 'array' then mi.matched_categories else '[]'::jsonb end
          ) as c
          where c->>'category' = any($2::text[])
        )
    `, [Array.from(SIGNAL_CATEGORIES), Array.from(TOPIC_CATEGORIES)]);

    return NextResponse.json({
      ok: true,
      mode: "distribution",
      totals: {
        totalItems: Number(totalItems.rows[0]?.total) || 0,
        itemsWithCategories: Number(itemsWithCategories.rows[0]?.count) || 0,
        itemsWithOnlySignalCategories: Number(itemsWithOnlySignal.rows[0]?.count) || 0,
        itemsWithMixedCategories: Number(itemsWithMixed.rows[0]?.count) || 0,
      },
      breakdown: {
        signal: {
          count: signalCategories.length,
          totalItems: signalCategories.reduce((s, c) => s + c.itemCount, 0),
          categories: signalCategories,
        },
        topic: {
          count: topicCategories.length,
          totalItems: topicCategories.reduce((s, c) => s + c.itemCount, 0),
          categories: topicCategories,
        },
        noise: {
          count: noiseCategories.length,
          totalItems: noiseCategories.reduce((s, c) => s + c.itemCount, 0),
          categories: noiseCategories,
        },
        region: {
          count: regionCategories.length,
          totalItems: regionCategories.reduce((s, c) => s + c.itemCount, 0),
          categories: regionCategories,
        },
        unknown: {
          count: unknownCategories.length,
          totalItems: unknownCategories.reduce((s, c) => s + c.itemCount, 0),
          categories: unknownCategories,
        },
      },
      reference: {
        expectedSignalCategories: Array.from(SIGNAL_CATEGORIES),
        expectedTopicCategories: Array.from(TOPIC_CATEGORIES),
        expectedNoiseCategories: Array.from(NOISE_CATEGORIES),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureMonitorSchema();
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const categories = (body.categories as CategoryInput) || [];
    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { ok: false, error: "categories must be an array" },
        { status: 400 },
      );
    }

    const analysis = analyzeCategories(categories);

    let sameTopicResult: {
      queried: boolean;
      count: number;
      items?: Array<Record<string, unknown>>;
      error?: string;
    } = { queried: false, count: 0 };

    const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
    const url = typeof body.url === "string" ? body.url : "";

    if (analysis.filterTopicCategories.outputCount > 0 && sourceId && url) {
      try {
        const topicCatNames = analysis.filterTopicCategories.outputCategories.map(
          (c) => c.category,
        );
        const items = await getSameTopicItems({
          sourceId,
          url,
          categories: topicCatNames,
          limit: 10,
        });
        sameTopicResult = {
          queried: true,
          count: items.length,
          items: items.map((it) => ({
            title: it.title,
            departmentName: it.departmentName,
            keywordScore: it.keywordScore,
            importanceLevel: it.importanceLevel,
            categories: it.categories,
          })),
        };
      } catch (err) {
        sameTopicResult = {
          queried: true,
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    } else if (analysis.filterTopicCategories.outputCount === 0) {
      sameTopicResult = {
        queried: true,
        count: 0,
        items: [],
        error: "无有效主题层分类，同主题查询应返回空",
      };
    }

    return NextResponse.json({
      ok: true,
      analysis,
      sameTopicQuery: sameTopicResult,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
