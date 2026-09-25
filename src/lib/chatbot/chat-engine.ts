// 本地智能问答引擎：关键词匹配 + 信号识别

export interface SearchResultItem {
  sourceId: string;
  url: string;
  title: string;
  summary?: string;
  listPublishedAt?: string;
  departmentName: string;
  channelName: string;
  keywordScore?: number;
  signals: string[];
  forecastHigh?: string;
  forecastMidHigh?: string;
  forecastMid?: string;
  forecastLow?: string;
  topCategories?: Array<{ category: string; score: number }>;
  hitParagraphs?: Array<{ idx: number; snippet: string }>;
}

export interface SearchResult {
  items: SearchResultItem[];
  matchedSignals: string[];
  totalCount: number;
}

export interface SignalAnalysisResult {
  hasFunding: boolean;
  hasProcurement: boolean;
  hasPilot: boolean;
  hasStandards: boolean;
  hasAnySignal: boolean;
  matchedKeywords: string[];
  summary: string;
}

// 信号关键词库
const SIGNAL_KEYWORDS: Record<string, string[]> = {
  funding: [
    "资金", "专项资金", "预算", "补贴", "补助", "奖励", "资助",
    "拨款", "经费", "投资", "财政", "基金", "专项", "配套资金",
    "以奖代补", "政府购买", "贴息", "奖补", "激励资金",
  ],
  procurement: [
    "采购", "招标", "公开招标", "竞争性谈判", "询价", "单一来源",
    "中标", "公告", "购买服务", "政府购买服务", "中标公告",
    "招标公告", "询价公告", "成交", "中标结果",
  ],
  pilot: [
    "试点", "示范", "创新试点", "示范区", "试验区", "先行先试",
    "试点示范", "标杆", "样板", "推广", "探索", "试行",
    "示范应用", "创新示范", "试点城市", "试点项目",
  ],
  standards: [
    "标准", "规范", "征求意见", "国家标准", "行业标准", "地方标准",
    "GB/T", "技术规范", "技术标准", "规程", "导则", "指南",
    "标准化", "指标体系", "评价标准", "体系", "编制", "制定",
  ],
};

// 行业/领域关键词（用于搜索推荐）
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  manufacturing: [
    "制造业", "先进制造", "工业", "智能制造", "工业互联网",
    "产业链", "供应链", "实体经济", "产业升级",
  ],
  tech: [
    "科技", "人工智能", "AI", "大数据", "云计算", "数字经济",
    "数字化", "数字化转型", "数字", "信息化",
  ],
  beijing_tianjin_hebei: [
    "京津冀", "雄安", "北京", "天津", "河北", "协同发展",
    "京津冀协同", "疏解", "非首都功能",
  ],
  realestate: [
    "房地产", "不动产", "住房", "限购", "房地产税", "住宅",
    "商品房", "保障性住房", "租赁", "物业",
  ],
  green: [
    "绿色", "环保", "低碳", "节能", "新能源", "双碳", "碳中和",
    "碳达峰", "生态", "环境", "可持续",
  ],
};

export class ChatEngine {
  async searchAndAnalyze(query: string): Promise<SearchResult> {
    // 1. 调用后端 API 搜索数据库
    const searchResults = await this.searchDatabase(query);

    // 2. 对搜索结果进行信号分析
    const analyzedItems = searchResults.map((item) => {
      const analysis = this.analyzeContent(item.title, item.summary || "");
      return {
        ...item,
        signals: this.mapSignals(analysis),
      } as SearchResultItem;
    });

    // 3. 按关键词匹配度排序
    const sortedItems = analyzedItems
      .map((item) => ({
        item,
        score: this.calculateMatchScore(query, item),
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item);

    return {
      items: sortedItems,
      matchedSignals: this.extractSignals(query),
      totalCount: sortedItems.length,
    };
  }

  private async searchDatabase(query: string): Promise<SearchResultItem[]> {
    try {
      const response = await fetch(`/api/chat/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await response.json()) as { ok?: boolean; items?: unknown[] };
      if (data.ok && Array.isArray(data.items)) {
        return data.items as SearchResultItem[];
      }
      return [];
    } catch (err) {
      console.warn("[chatbot] 搜索接口调用失败：",
        err instanceof Error ? err.message : String(err));
      return [];
    }
  }

  // ============ 多文档 RAG：用检索到的 items 作为上下文，调用 LLM，失败时回落规则版
  async askAnswer(question: string, items: SearchResultItem[], lang: "zh" | "en" = "zh"): Promise<{
    answer: string;
    source: "llm" | "rule";
    error?: string;
  }> {
    try {
      const response = await fetch(`/api/chat/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, items, lang }),
      });
      const data = await response.json();
      if (data.ok) {
          return { answer: data.answer, source: data.source || "rule", error: data.error };
      }
      console.warn("[chatbot] askAnswer 接口返回 ok=false，回退规则版：", data.message);
      return { answer: this.fallbackRule(question, items), source: "rule", error: data.message };
    } catch (e) {
      console.warn("[chatbot] askAnswer 接口调用异常，回退规则版：",
        e instanceof Error ? e.message : String(e));
      return { answer: this.fallbackRule(question, items), source: "rule", error: e instanceof Error ? e.message : String(e) };
    }
  }

  private fallbackRule(question: string, items: SearchResultItem[]): string {
    const top = (items || []).slice(0, 3);
    if (top.length === 0) return `未找到匹配内容；建议尝试更具体的关键词（如「资金」「试点」「标准」）。`;
    const lines: string[] = [`围绕「${question}」，在动态资讯中找到 ${top.length} 篇可能相关的内容：`];
    for (let i = 0; i < top.length; i++) {
      const it = top[i];
      lines.push("");
      lines.push(`${i + 1}.《${it.title}》`);
      const meta = [it.departmentName, it.channelName].filter(Boolean).join(" · ");
      if (meta) lines.push(`   · 来源：${meta}`);
      const paras = (it.hitParagraphs || []).slice(0, 2);
      if (paras.length > 0) for (const p of paras) lines.push(`   · ${p.snippet}`);
      else if (it.summary) lines.push(`   · ${String(it.summary).slice(0, 180)}`);
    }
    return lines.join("\n");
  }

  analyzeContent(title: string, content: string): SignalAnalysisResult {
    const fullText = `${title} ${content}`.toLowerCase();

    const matched: Record<string, boolean> = {
      funding: false,
      procurement: false,
      pilot: false,
      standards: false,
    };

    const allMatchedKeywords: string[] = [];

    for (const [signalType, keywords] of Object.entries(SIGNAL_KEYWORDS)) {
      for (const keyword of keywords) {
        if (fullText.includes(keyword.toLowerCase())) {
          matched[signalType] = true;
          if (!allMatchedKeywords.includes(keyword)) {
            allMatchedKeywords.push(keyword);
          }
        }
      }
    }

    const hasAnySignal = Object.values(matched).some(Boolean);

    // 生成简要摘要
    let summary = "";
    if (hasAnySignal) {
      const detected: string[] = [];
      if (matched.funding) detected.push("资金支持");
      if (matched.procurement) detected.push("采购机会");
      if (matched.pilot) detected.push("试点示范");
      if (matched.standards) detected.push("标准规范");
      summary = `检测到${detected.length}类政策信号：${detected.join("、")}`;
    } else {
      summary = "内容中未发现明显的政策信号关键词。";
    }

    return {
      hasFunding: matched.funding,
      hasProcurement: matched.procurement,
      hasPilot: matched.pilot,
      hasStandards: matched.standards,
      hasAnySignal,
      matchedKeywords: allMatchedKeywords,
      summary,
    };
  }

  private mapSignals(analysis: SignalAnalysisResult): string[] {
    const signals: string[] = [];
    if (analysis.hasFunding) signals.push("资金支持");
    if (analysis.hasProcurement) signals.push("采购机会");
    if (analysis.hasPilot) signals.push("试点示范");
    if (analysis.hasStandards) signals.push("标准规范");
    return signals;
  }

  private calculateMatchScore(query: string, item: SearchResultItem): number {
    const queryLower = query.toLowerCase();
    const titleLower = item.title.toLowerCase();
    const summaryLower = (item.summary || "").toLowerCase();
    let score = 0;

    // 关键词匹配
    const queryWords = queryLower.split(/[\s，,。.!?！？、；;]+/).filter(Boolean);
    for (const word of queryWords) {
      if (titleLower.includes(word)) score += 10;
      if (summaryLower.includes(word)) score += 5;
    }

    // 按时间新鲜度加分（越新越高）
    if (item.listPublishedAt) {
      try {
        const date = new Date(item.listPublishedAt);
        const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
        if (daysAgo < 30) score += 20;
        else if (daysAgo < 90) score += 10;
        else if (daysAgo < 180) score += 5;
      } catch {
        // ignore
      }
    }

    // 有预估判断的加分
    if (item.forecastHigh || item.forecastMidHigh) score += 15;

    // 信号数量加分
    score += item.signals.length * 3;

    return score;
  }

  private extractSignals(query: string): string[] {
    const lower = query.toLowerCase();
    const signals: string[] = [];

    // 检查行业关键词
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          signals.push(this.mapCategoryLabel(category));
          break;
        }
      }
    }

    // 检查信号关键词
    if (SIGNAL_KEYWORDS.funding.some((k) => lower.includes(k))) signals.push("资金支持");
    if (SIGNAL_KEYWORDS.procurement.some((k) => lower.includes(k))) signals.push("采购机会");
    if (SIGNAL_KEYWORDS.pilot.some((k) => lower.includes(k))) signals.push("试点示范");
    if (SIGNAL_KEYWORDS.standards.some((k) => lower.includes(k))) signals.push("标准规范");

    return signals;
  }

  private mapCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      manufacturing: "制造业相关",
      tech: "科技/数字经济",
      beijing_tianjin_hebei: "京津冀协同",
      realestate: "房地产/住房",
      green: "绿色/环保/双碳",
    };
    return map[category] || category;
  }
}