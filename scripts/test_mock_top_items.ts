import { getMockTopItems, getMockDailySummaryData } from "./mock_top_items";

console.log("\n=== 模拟数据加载测试 ===\n");

const items = getMockTopItems();
console.log(`总记录数: ${items.length} 条\n`);

items.forEach((item, idx) => {
  const signals = [];
  if (item.hasFunding) signals.push("💰资金");
  if (item.hasProcurement) signals.push("📋采购");
  if (item.hasPilot) signals.push("🧪试点");
  if (item.hasStandards) signals.push("📐标准");
  
  const catLabels = item.categories.slice(0, 3).map(c => c.category.split("·").pop() || c.category);
  
  console.log(`${idx + 1}. [${item.importanceLevel}] ${item.departmentName}`);
  console.log(`   标题: ${item.title.slice(0, 40)}${item.title.length > 40 ? "..." : ""}`);
  console.log(`   得分: ${item.keywordScore} | 信号: ${signals.length > 0 ? signals.join(" ") : "无"}`);
  console.log(`   分类: ${catLabels.join(", ") || "无"}`);
  console.log(`   收藏: ${item.isStarred ? "⭐是" : "否"} | 栏目: ${item.channelName} | 日期: ${item.listPublishedAt.split("T")[0]}`);
  console.log();
});

const summary = getMockDailySummaryData();
console.log("=== 汇总数据 ===");
console.log(`日期: ${summary.date}`);
console.log(`核心关注数: ${summary.urgentCount}`);
console.log(`近7天趋势: ${summary.dailySeries.map(d => `${d.date}:${d.count}`).join(" → ")}`);
console.log(`部委统计数: ${summary.departmentStats.length} 个`);
console.log(`Top Items数: ${summary.topItems.length} 条\n`);

console.log("✅ 数据加载成功！");
