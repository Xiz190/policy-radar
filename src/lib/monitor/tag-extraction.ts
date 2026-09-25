export interface ExtractedTag {
  tag: string;
  weight: number;
  category: string;
  source: string;
}

const PREDEFINED_KEYWORDS: Record<string, { category: string; weight: number }> = {
  "数字经济": { category: "领域", weight: 0.9 },
  "人工智能": { category: "技术", weight: 0.85 },
  "大数据": { category: "技术", weight: 0.8 },
  "云计算": { category: "技术", weight: 0.8 },
  "区块链": { category: "技术", weight: 0.75 },
  "物联网": { category: "技术", weight: 0.75 },
  "工业互联网": { category: "领域", weight: 0.85 },
  "5G": { category: "技术", weight: 0.8 },
  "数据安全": { category: "安全", weight: 0.85 },
  "网络安全": { category: "安全", weight: 0.85 },
  "隐私保护": { category: "安全", weight: 0.8 },
  "碳中和": { category: "环保", weight: 0.9 },
  "碳达峰": { category: "环保", weight: 0.85 },
  "绿色发展": { category: "环保", weight: 0.8 },
  "新能源": { category: "环保", weight: 0.85 },
  "新能源汽车": { category: "环保", weight: 0.8 },
  "补贴": { category: "政策", weight: 0.85 },
  "资金": { category: "政策", weight: 0.8 },
  "支持": { category: "政策", weight: 0.7 },
  "试点": { category: "政策", weight: 0.85 },
  "示范": { category: "政策", weight: 0.8 },
  "标准": { category: "政策", weight: 0.85 },
  "规范": { category: "政策", weight: 0.8 },
  "监管": { category: "政策", weight: 0.8 },
  "审批": { category: "政策", weight: 0.75 },
  "税收": { category: "政策", weight: 0.85 },
  "优惠": { category: "政策", weight: 0.8 },
  "融资": { category: "金融", weight: 0.8 },
  "信贷": { category: "金融", weight: 0.75 },
  "债券": { category: "金融", weight: 0.7 },
  "基金": { category: "金融", weight: 0.75 },
};

export function extractTags(title: string, paragraphs: string[]): ExtractedTag[] {
  const content = [title, ...paragraphs].join("\n");
  const foundTags: ExtractedTag[] = [];

  for (const [keyword, info] of Object.entries(PREDEFINED_KEYWORDS)) {
    const regex = new RegExp(keyword, "gi");
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      let weight = info.weight;
      if (matches.length >= 3) {
        weight = Math.min(1, weight + 0.1);
      }
      if (title.includes(keyword)) {
        weight = Math.min(1, weight + 0.15);
      }
      foundTags.push({
        tag: keyword,
        weight: Math.round(weight * 100) / 100,
        category: info.category,
        source: "规则匹配",
      });
    }
  }

  return foundTags.sort((a, b) => b.weight - a.weight).slice(0, 15);
}

export async function updateItemExtractedTags(
  pool: ReturnType<typeof import("@/lib/db").getPgPool>,
  sourceId: string,
  url: string,
  tags: ExtractedTag[],
) {
  await pool.query(
    `update monitor_items
     set extracted_tags_json = $3::jsonb
     where source_id = $1 and url = $2`,
    [sourceId, url, JSON.stringify(tags)],
  );
}