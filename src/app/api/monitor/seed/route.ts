import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";
import { createMonitorSource } from "@/lib/monitor/db/sources";

const DEMO_SOURCES = [
  {
    departmentName: "工业和信息化部",
    channelName: "政策文件",
    displayName: "工信部·政策文件",
    type: "html_list",
    listUrl: "https://www.miit.gov.cn/zwgk/zcwj/index.html",
    enabled: false,
    autoMonitor: false,
    isKey: true,
    notes: "人工智能、算力、制造业数字化等产业政策权威来源。启用前请确认 URL 可访问。",
    language: "zh" as const,
    region: "domestic" as const,
    contentCategory: "policy" as const,
  },
  {
    departmentName: "国家互联网信息办公室",
    channelName: "网信政务",
    displayName: "网信办·网信政务",
    type: "cac_list",
    listUrl: "http://www.cac.gov.cn/wxzw/A0937index_1.htm",
    enabled: false,
    autoMonitor: false,
    isKey: true,
    notes: "网信政务栏目（政策法规/规章/规范性文件/解读等，生成式AI/数据治理主源）。文章为日期化 c_ 链接，用专属抓取器 cac_list；原 gzcy 地址实为 404，已换此真实栏目。启用前请确认 URL 可访问。",
    language: "zh" as const,
    region: "domestic" as const,
    contentCategory: "policy" as const,
  },
  {
    departmentName: "国家版权局",
    channelName: "通知公告",
    displayName: "版权局·通知公告",
    type: "ncac_list",
    listUrl: "https://www.ncac.gov.cn/xxfb/tzgg/",
    enabled: false,
    autoMonitor: false,
    isKey: true,
    notes: "版权监管/预警动态主源（如版权工作“十五五”规划等通知）。该栏目无 JS 跳转壳、列表可直接抓，用专属抓取器 ncac_list。启用前请确认 URL 可访问。",
    language: "zh" as const,
    region: "domestic" as const,
    contentCategory: "policy" as const,
  },
  {
    departmentName: "国家发展和改革委员会",
    channelName: "政策发布",
    displayName: "发改委·政策发布",
    type: "html_list",
    listUrl: "https://www.ndrc.gov.cn/xxgk/zcfb/",
    enabled: false,
    autoMonitor: false,
    isKey: true,
    notes: "数字经济、算力网络、数据要素等宏观政策。启用前请确认 URL 可访问。",
    language: "zh" as const,
    region: "domestic" as const,
    contentCategory: "policy" as const,
  },
  {
    departmentName: "科学技术部",
    channelName: "政策法规",
    displayName: "科技部·政策法规",
    type: "html_list",
    listUrl: "https://www.most.gov.cn/xxgk/xinxifenlei/fdzdgknr/fgzc/",
    enabled: false,
    autoMonitor: false,
    isKey: false,
    notes: "人工智能基础研究、科技伦理等科技政策。启用前请确认 URL 可访问。",
    language: "zh" as const,
    region: "domestic" as const,
    contentCategory: "policy" as const,
  },
  {
    departmentName: "国家数据局",
    channelName: "政策文件",
    displayName: "国家数据局·政策文件",
    type: "html_list",
    listUrl: "https://www.nda.gov.cn/sjj/zcfg/index.html",
    enabled: false,
    autoMonitor: false,
    isKey: true,
    notes: "数据基础制度、数据要素市场化配置等政策。启用前请确认 URL 可访问。",
    language: "zh" as const,
    region: "domestic" as const,
    contentCategory: "policy" as const,
  },
  {
    departmentName: "财政部",
    channelName: "政策发布",
    displayName: "财政部·政策发布",
    type: "html_list",
    listUrl: "https://www.mof.gov.cn/gkml/",
    enabled: false,
    autoMonitor: false,
    isKey: false,
    notes: "数据要素专项资金、政府采购支持国产AI等财政政策。启用前请确认 URL 可访问。",
    language: "zh" as const,
    region: "domestic" as const,
    contentCategory: "policy" as const,
  },
  {
    departmentName: "文化和旅游部",
    channelName: "时政要闻",
    displayName: "文旅部·时政要闻",
    type: "mct_szyw",
    listUrl: "https://www.mct.gov.cn/whzx/szyw/",
    enabled: true,
    autoMonitor: true,
    isKey: true,
    notes: "示范内置爬虫的已跑通来源（站点结构配置驱动抓取）。",
    language: "zh" as const,
    region: "domestic" as const,
    contentCategory: "policy" as const,
  },
  {
    departmentName: "文化和旅游部",
    channelName: "政务公开",
    displayName: "文旅部·政务公开（政策法规）",
    type: "mct_zwgk_genre",
    listUrl: "https://zwgk.mct.gov.cn/zfxxgkml/447/483/484/index_3081.html",
    enabled: true,
    autoMonitor: true,
    isKey: true,
    notes: "示范专用爬虫的已跑通来源（政务公开栏目，站点结构配置驱动抓取）。",
    language: "zh" as const,
    region: "domestic" as const,
    contentCategory: "policy" as const,
  },
] as const;

export async function POST() {
  try {
    const pool = getPgPool();
    const results: { name: string; status: "created" | "exists" }[] = [];

    for (const src of DEMO_SOURCES) {
      const existing = await pool.query(
        `select id from monitor_sources where list_url = $1 limit 1`,
        [src.listUrl],
      );
      if (existing.rows.length > 0) {
        results.push({ name: src.displayName, status: "exists" });
        continue;
      }
      await createMonitorSource({
        ...src,
        startDate: "2024-01-01",
        maxItems: 20,
      });
      results.push({ name: src.displayName, status: "created" });
    }

    const created = results.filter((r) => r.status === "created").length;
    const skipped = results.filter((r) => r.status === "exists").length;

    return NextResponse.json({
      ok: true,
      message: `已写入 ${created} 个示例来源，跳过已存在 ${skipped} 个`,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
