"use client";

import { useState } from "react";
import { ItemCard } from "@/components/item-card";
import { ForecastItemCard } from "@/components/forecast-item-card";
import { SignalDrawer } from "@/components/signal-drawer";
import { isDemoItem, getHomepageFromDemo } from "@/lib/monitor/utils";
import type { ContentItem } from "@/hooks/use-item-list";
import type { ForecastItem } from "@/lib/monitor/types";

const mockDemoMiitItem: ContentItem = {
  sourceId: "demo_miit",
  departmentName: "工业和信息化部",
  channelName: "产品更新",
  displayName: "关于推动人形机器人产业发展的指导意见",
  url: "https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_f291ccd3da4c47ce95741de63cc088e6.html",
  title: "工业和信息化部关于推动人形机器人产业高质量发展的指导意见",
  listPublishedAt: "2026-06-15",
  firstSeenAt: "2026-06-15T10:00:00Z",
  isRead: false,
  isStarred: false,
  keywordScore: 95,
  importanceLevel: "核心关注",
  categories: [
    { category: "智能制造", score: 0.9 },
    { category: "人工智能", score: 0.85 },
  ],
  genres: ["规范性文件"],
};

const mockRealMiitItem: ContentItem = {
  sourceId: "mct_szyw",
  departmentName: "文化和旅游部",
  channelName: "时政要闻",
  displayName: "关于促进文化产业发展的通知",
  url: "https://www.mct.gov.cn/whzx/szyw/202606/t20260615_123456.html",
  title: "文化和旅游部关于促进文化产业高质量发展的通知",
  listPublishedAt: "2026-06-14",
  firstSeenAt: "2026-06-14T08:00:00Z",
  isRead: false,
  isStarred: false,
  keywordScore: 80,
  importanceLevel: "重点内容",
  categories: [
    { category: "文化产业", score: 0.9 },
  ],
  genres: ["通知"],
};

const mockDemoUrlItem: ContentItem = {
  sourceId: "custom_source",
  departmentName: "测试部门",
  channelName: "测试栏目",
  displayName: "URL 路径包含 /demo/ 的测试条目",
  url: "https://example.com/demo/test-page.html",
  title: "URL 路径包含 /demo/ 的测试条目",
  listPublishedAt: "2026-06-13",
  firstSeenAt: "2026-06-13T12:00:00Z",
  isRead: false,
  isStarred: false,
  keywordScore: 60,
  importanceLevel: "普通内容",
  categories: [],
  genres: [],
};

const mockDemoForecastItem: ForecastItem = {
  sourceId: "demo_ndrc",
  url: "https://www.ndrc.gov.cn/xwdt/tzgg/202606/t20260610_1234567.html",
  title: "国家发展改革委关于组织开展2026年新兴产业专项的通知",
  summary: "为深入贯彻落实党中央、国务院决策部署，加快推动新兴产业高质量发展，现就有关事项通知如下。",
  listPublishedAt: "2026-06-10",
  firstSeenAt: "2026-06-10T09:00:00Z",
  departmentName: "国家发展和改革委员会",
  channelName: "更新公告",
  displayName: "2026年新兴产业专项",
  importanceLevel: "核心关注",
  keywordScore: 90,
  documentStatus: "full",
  hasFunding: true,
  hasProcurement: false,
  hasPilot: true,
  hasStandards: false,
  forecastHigh: "5000万",
  forecastMidHigh: "3000万",
  forecastMid: "1500万",
  forecastLow: "500万",
  forecastNotes: "基于历年专项规模估算",
  forecastSources: null,
  forecastUpdatedAt: null,
  topCategories: [
    { category: "资金扶持", score: 0.95 },
    { category: "新兴产业", score: 0.9 },
  ],
};

const mockRealForecastItem: ForecastItem = {
  sourceId: "mct_genre_504",
  url: "https://zwgk.mct.gov.cn/zfxxgkml/503/504/index_3081.html",
  title: "文化和旅游部关于印发文化产业发展专项资金管理办法的通知",
  summary: "为规范文化产业发展专项资金管理，提高资金使用效益，制定本办法。",
  listPublishedAt: "2026-06-08",
  firstSeenAt: "2026-06-08T14:00:00Z",
  departmentName: "文化和旅游部",
  channelName: "决议决定",
  displayName: "文化产业专项资金管理办法",
  importanceLevel: "重点内容",
  keywordScore: 75,
  documentStatus: "full",
  hasFunding: true,
  hasProcurement: false,
  hasPilot: false,
  hasStandards: false,
  forecastHigh: null,
  forecastMidHigh: null,
  forecastMid: null,
  forecastLow: null,
  forecastNotes: null,
  forecastSources: null,
  forecastUpdatedAt: null,
  topCategories: [
    { category: "资金扶持", score: 0.8 },
  ],
};

type TestCase = {
  label: string;
  description: string;
  sourceId: string;
  url: string;
  expected: "来源主页" | "打开原网址";
};

const testCases: TestCase[] = [
  {
    label: "demo_miit（工信部 demo 数据）",
    description: "sourceId 以 demo_ 开头，应该显示「来源主页」",
    sourceId: "demo_miit",
    url: "https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_test.html",
    expected: "来源主页",
  },
  {
    label: "demo_ndrc（发改委 demo 数据）",
    description: "sourceId 以 demo_ 开头，应该显示「来源主页」",
    sourceId: "demo_ndrc",
    url: "https://www.ndrc.gov.cn/xwdt/tzgg/202606/t20260610_test.html",
    expected: "来源主页",
  },
  {
    label: "demo_bjgov（北京政府 demo 数据）",
    description: "sourceId 以 demo_ 开头，应该显示「来源主页」",
    sourceId: "demo_bjgov",
    url: "https://www.beijing.gov.cn/zhengce/zhengcefagui/202606/t20260609_test.html",
    expected: "来源主页",
  },
  {
    label: "真实数据源 mct_szyw",
    description: "sourceId 不以 demo_ 开头，URL 也不含 /demo/，应该显示「打开原网址」",
    sourceId: "mct_szyw",
    url: "https://www.mct.gov.cn/whzx/szyw/202606/t20260615_123456.html",
    expected: "打开原网址",
  },
  {
    label: "URL 路径包含 /demo/",
    description: "URL 路径包含 /demo/，即使 sourceId 不以 demo_ 开头，也应该显示「来源主页」",
    sourceId: "custom_source",
    url: "https://example.com/demo/test-page.html",
    expected: "来源主页",
  },
  {
    label: "URL 以 /demo 开头",
    description: "URL 路径以 /demo 开头，应该显示「来源主页」",
    sourceId: "custom_source",
    url: "https://example.com/demo.html",
    expected: "来源主页",
  },
  {
    label: "空 URL",
    description: "URL 为空，应该按 demo 处理",
    sourceId: "unknown",
    url: "",
    expected: "来源主页",
  },
  {
    label: "无效 URL",
    description: "URL 格式无效，应该按 demo 处理",
    sourceId: "unknown",
    url: "not-a-valid-url",
    expected: "来源主页",
  },
  {
    label: "src_mock_ 前缀",
    description: "sourceId 以 src_mock_ 开头（旧版 mock 数据），应该按 demo 处理",
    sourceId: "src_mock_0",
    url: "https://example.com/item/0",
    expected: "来源主页",
  },
  {
    label: "mock_ 前缀",
    description: "sourceId 以 mock_ 开头，应该按 demo 处理",
    sourceId: "mock_rel_0",
    url: "https://example.com/related/0",
    expected: "来源主页",
  },
  {
    label: "example.com 域名",
    description: "URL 域名为 example.com，应该按 demo 处理",
    sourceId: "custom_source",
    url: "https://example.com/some/path",
    expected: "来源主页",
  },
  {
    label: "合成路径 /ai-policy-1",
    description: "URL 路径是合成的简单路径（如 /ai-policy-1），应该按 demo 处理",
    sourceId: "src_miit_ai",
    url: "https://www.miit.gov.cn/ai-policy-1",
    expected: "来源主页",
  },
  {
    label: "合成路径 /finance-policy-1",
    description: "URL 路径是合成的简单路径，应该按 demo 处理",
    sourceId: "src_mof_fund",
    url: "https://www.mof.gov.cn/finance-policy-1",
    expected: "来源主页",
  },
];

export default function DemoUrlTestPage() {
  const [drawerItem, setDrawerItem] = useState<ContentItem | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Demo URL 按钮行为测试</h1>
        <p className="mt-2 text-sm text-slate-600">
          验证 <code className="rounded bg-slate-200 px-1.5 py-0.5">isDemoItem()</code> 函数在各种场景下的判断结果，以及「打开原网址」按钮的显示行为。
        </p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">一、单元测试矩阵</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">测试场景</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">sourceId</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">URL</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">预期</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">实际</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">跳转目标</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {testCases.map((tc, i) => {
                  const isDemo = isDemoItem({ sourceId: tc.sourceId, url: tc.url });
                  const actual = isDemo ? "来源主页" : "打开原网址";
                  const pass = actual === tc.expected;
                  const homepage = isDemo ? getHomepageFromDemo(tc.url) : tc.url;
                  return (
                    <tr key={i} className={pass ? "" : "bg-rose-50"}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{tc.label}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{tc.description}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{tc.sourceId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 max-w-[200px] truncate" title={tc.url}>
                        {tc.url || "(空)"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          tc.expected === "来源主页" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"
                        }`}>
                          {tc.expected}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          pass
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}>
                          {pass ? "✓ " : "✗ "}{actual}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 max-w-[180px] truncate" title={homepage}>
                        {homepage || "(空)"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            通过: {testCases.filter(tc => {
              const isDemo = isDemoItem({ sourceId: tc.sourceId, url: tc.url });
              return (isDemo ? "来源主页" : "打开原网址") === tc.expected;
            }).length} / {testCases.length}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">二、ItemCard 组件对比</h2>
          <p className="mt-1 text-sm text-slate-600">展开卡片后查看底部「打开原网址」按钮的显示差异</p>
          
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium text-amber-700">Demo 数据（demo_miit）— 应该显示「来源主页 →」</div>
              <ItemCard item={mockDemoMiitItem} isExpanded={true} />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-sky-700">真实数据（mct_szyw）— 应该显示「打开原网址 →」</div>
              <ItemCard item={mockRealMiitItem} isExpanded={true} />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-amber-700">URL 含 /demo/ — 应该显示「来源主页 →」</div>
              <ItemCard item={mockDemoUrlItem} isExpanded={true} />
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">三、ForecastItemCard 组件对比</h2>
          
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium text-amber-700">Demo 数据（demo_ndrc）— 应该显示「来源主页 →」</div>
              <ForecastItemCard item={mockDemoForecastItem} />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-sky-700">真实数据（mct_genre_504）— 应该显示「打开原网址 →」</div>
              <ForecastItemCard item={mockRealForecastItem} />
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">四、SignalDrawer 组件对比</h2>
          <p className="mt-1 text-sm text-slate-600">点击按钮打开抽屉，查看底部按钮的显示差异</p>
          
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setDrawerItem(mockDemoMiitItem)}
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              打开 Demo 数据抽屉
            </button>
            <button
              onClick={() => setDrawerItem(mockRealMiitItem)}
              className="rounded-full bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
            >
              打开真实数据抽屉
            </button>
          </div>
        </section>

        <SignalDrawer
          isOpen={!!drawerItem}
          onClose={() => setDrawerItem(null)}
          item={drawerItem}
        />

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">五、isDemoItem 函数逻辑</h2>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <pre className="overflow-x-auto text-xs text-slate-700">
{`function isDemoItem(item: { sourceId?: string; url?: string }): boolean {
  // 1. 优先判断 sourceId 是否以 demo_ 开头
  if (item.sourceId?.startsWith("demo_")) return true;
  
  // 2. URL 为空，按 demo 处理
  if (!item.url) return true;
  
  // 3. 尝试解析 URL，检查路径是否包含 /demo/
  try {
    const u = new URL(item.url);
    if (u.pathname.includes("/demo/") || u.pathname.startsWith("/demo")) return true;
    return false;
  } catch {
    // 4. URL 解析失败，按 demo 处理（安全兜底）
    return true;
  }
}`}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
