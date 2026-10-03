import { describe, it, expect } from "vitest";
import { passesSourceTopicGate } from "@/lib/monitor/topic-gate";

// 综合大部委（工信部 / 国务院栏目 JSON）的主题门槛：只收 AI / 数据要素 / 数字内容与文化政策

describe("passesSourceTopicGate", () => {
  it("工信部 / 国务院：主题相关的放行", () => {
    for (const t of [
      "工业和信息化部关于印发《“人工智能+软件”专项行动实施方案》的通知",
      "工业和信息化部等五部门关于组织开展2026年度国家绿色算力设施推荐工作的通知",
      "首批高标准数字园区建设对象名单公示",
      "国家新闻出版署有关负责同志就《出版业发展“十五五”规划》答记者问",
      "文化和旅游部印发《艺术发展“十五五”规划》",
      "经济日报：开启人形机器人作业模式",
    ]) {
      expect(passesSourceTopicGate("miit_list", t), t).toBe(true);
    }
  });

  it("工信部 / 国务院：与主题无关的挡掉", () => {
    for (const t of [
      "李乐成主持召开中小企业圆桌会 强调健全主动发现机制 做好对企服务",
      "《轻工纺织产业发展“十五五”规划》解读",
      "关于公开征求《工业雷管延期时间测定方法》等11项强制性国家标准（征求意见稿）意见的公示",
      "8月经济数据出炉，如何看待国民经济运行态势？", // 「数据」单字不算
      "商务部消费促进司负责人解读《促进智能家居消费行动方案》", // 「智能」单字不算
    ]) {
      expect(passesSourceTopicGate("govcn_json", t), t).toBe(false);
    }
  });

  it("部门名里的字不算命中：「工业和信息化部举行升国旗仪式」挡掉", () => {
    expect(passesSourceTopicGate("miit_list", "工业和信息化部举行升国旗仪式 庆祝中华人民共和国成立77周年")).toBe(false);
  });

  it("「AI」按整词匹配；其他抓取类型的来源一律放行", () => {
    expect(passesSourceTopicGate("miit_list", "关于AI赋能新型工业化的意见")).toBe(true);
    expect(passesSourceTopicGate("miit_list", "MAIL 系统维护通知")).toBe(false);
    expect(passesSourceTopicGate("beijing_gov_list", "北京市某区召开中小企业座谈会")).toBe(true);
    expect(passesSourceTopicGate(undefined, "任意标题")).toBe(true);
  });
});
