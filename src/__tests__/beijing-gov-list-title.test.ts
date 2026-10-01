import { describe, expect, it } from "vitest";
import { extractFromListItem } from "@/lib/monitor/beijing-gov-list";

const BASE = "https://czj.beijing.gov.cn/zwxx/tztg/";

describe("北京政府列表页 · 标题清理", () => {
  it("title 属性没闭合时，不把 target=\"_blank\"> 之后的残片吞进标题", () => {
    // 北京市财政局通知公告栏目的真实坏标记形态：title 用双引号起、单引号收
    const li = `<li><a href="./202609/t20260925_1.html" title="关于办理2026年度北京市会计专业技术初高级资格考试成绩复核工作的通知 ' target="_blank">【置顶】 关于办理2026年度北京市会计专业技术初高级资格考试成绩复核工作的通知</a><span>2026-09-25</span></li>`;
    const item = extractFromListItem(li, BASE);
    expect(item?.title).toBe("关于办理2026年度北京市会计专业技术初高级资格考试成绩复核工作的通知");
  });

  it("正常标题不受影响", () => {
    const li = `<li><a href="./202609/t20260925_2.html" title="北京市财政局关于印发某某办法的通知" target="_blank">北京市财政局关于印发某某办法的通知</a><span>2026-09-25</span></li>`;
    expect(extractFromListItem(li, BASE)?.title).toBe("北京市财政局关于印发某某办法的通知");
  });
});

describe("北京政府列表页 · 标题清理（从 <a> 正文兜底时）", () => {
  it("没有 title 属性、正文里带残片时同样截断", () => {
    const li = `<li><a href="./202609/t20260925_3.html">北京市财政局2026年乡村振兴协理员招聘面试公告 ' target="_blank"> 北京市财政局2026年乡村振兴协理员招聘面试公告</a><span>2026-09-25</span></li>`;
    expect(extractFromListItem(li, BASE)?.title).toBe("北京市财政局2026年乡村振兴协理员招聘面试公告");
  });
});
