/*
 * 平台元数据字典（别名）+ 纯函数搜索工具。
 *
 * 设计要点：
 *   - 字典与业务数据解耦。DB 返回的 SourceCardData 只有 departmentName 等业务字段，
 *     这里的字典按 departmentName 对齐，命中不到也不会报错（退化到纯文本包含匹配）。
 *   - aliases 字段用于"近义词"场景：例如用户输入"文旅部"，命中"文化和旅游部"。
 *   - 匹配结果带 score 与 matchType，用于优先级排序 + 前端高亮/推荐文案。
 *
 * 新增平台时，只需在 SOURCE_META 里增加一行即可，无需改其他文件。
 */

import type { SourceCardData } from "@/components/source-directory";

export type SourceMeta = {
  /** 平台/来源名称。与 SourceCardData.departmentName 对齐使用。 */
  departmentName: string;
  /** 拼音（英文平台留空数组即可，直接走英文包含匹配）。 */
  pinyinFull: string[];
  /** 拼音简拼（英文平台留空串）。 */
  pinyinInitial: string;
  /** 别名 / 近义词（大小写无关）。用户输入变体名称时命中。 */
  aliases: string[];
};

/**
 * 平台字典。新增平台时，只需追加一行；
 * 若暂时没有别名，aliases 给空数组即可，搜索自动退化为纯文本包含匹配。
 */
export const SOURCE_META: SourceMeta[] = [
  // —— 中央文化主管部门 ——
  { departmentName: "文化和旅游部", pinyinFull: ["wen", "hua", "he", "lv", "you", "bu"], pinyinInitial: "whhlyb", aliases: ["文旅部", "文化部", "MCT", "mct.gov.cn"] },
  { departmentName: "国家文物局", pinyinFull: ["guo", "jia", "wen", "wu", "ju"], pinyinInitial: "gjwwj", aliases: ["文物局", "NCHA", "ncha.gov.cn"] },
  { departmentName: "国家版权局", pinyinFull: ["guo", "jia", "ban", "quan", "ju"], pinyinInitial: "gjbqj", aliases: ["版权局", "NCAC", "ncac.gov.cn"] },
  { departmentName: "国家新闻出版署", pinyinFull: ["xin", "wen", "chu", "ban", "shu"], pinyinInitial: "xwcbs", aliases: ["新闻出版署", "出版署", "NPPA"] },
  { departmentName: "教育部", pinyinFull: ["jiao", "yu", "bu"], pinyinInitial: "jyb", aliases: ["MOE", "moe.gov.cn", "教委"] },

  // —— 数据 / 研究机构 ——
  { departmentName: "国家数据局", pinyinFull: ["guo", "jia", "shu", "ju", "ju"], pinyinInitial: "gjsjj", aliases: ["数据局", "国数局", "nda", "nda.gov.cn"] },
  { departmentName: "中国信息通信研究院", pinyinFull: ["xin", "tong", "yuan"], pinyinInitial: "xty", aliases: ["信通院", "CAICT", "中国信通院"] },

  // —— 地方文旅（示例）——
  { departmentName: "北京市文化和旅游局", pinyinFull: ["bei", "jing"], pinyinInitial: "bj", aliases: ["北京文旅局", "京文旅"] },
  { departmentName: "上海市文化和旅游局", pinyinFull: ["shang", "hai"], pinyinInitial: "sh", aliases: ["上海文旅局", "沪文旅"] },
  { departmentName: "广东省文化和旅游厅", pinyinFull: ["guang", "dong"], pinyinInitial: "gd", aliases: ["广东文旅厅", "粤文旅"] },
];

/** 把字典转成以 departmentName 为 key 的 Map，便于 O(1) 查找。 */
export function buildMetaMap(
  list: SourceMeta[] = SOURCE_META,
): Map<string, SourceMeta> {
  const map = new Map<string, SourceMeta>();
  for (const m of list) map.set(m.departmentName, m);
  return map;
}

/** 命中结果类型，按 score 降序展示。 */
export type MatchType =
  | "exact"       // 完全等同部委名（score=100）
  | "aliasExact"  // 完全等同别名（score=90）
  | "contains"    // 部委名包含 query（score=80）
  | "pinyinFull"  // 拼音全拼前缀或包含（score=60）
  | "pinyinInitial" // 拼音简拼前缀或包含（score=50）
  | "channelMatch" // 命中该部委下某个栏目名（score=30）
  | "aliasFuzzy"; // 别名包含（score=20，走"相关推荐"）

export type SourceSearchHit = {
  item: SourceCardData;
  meta: SourceMeta | null;
  score: number;
  matchType: MatchType;
  /** 命中的原文字段（用于前端高亮文案）。没有中文命中时传空串。 */
  matchedText: string;
  /** true = 用户输入的不是正式部委名，是通过别名/近义词关系推荐的。 */
  isRecommended: boolean;
};

/** 归一化输入：去空格、全角转半角、转小写。 */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。、]/g, "");
}

const SCORE_TABLE: Record<MatchType, number> = {
  exact: 100,
  aliasExact: 90,
  contains: 80,
  pinyinFull: 60,
  pinyinInitial: 50,
  channelMatch: 30,
  aliasFuzzy: 20,
};

/**
 * 核心搜索函数。纯函数，便于测试和复用。
 *
 * 匹配优先级见 SCORE_TABLE。
 * - 命中中文 / 别名 → 是"直接结果"（isRecommended=false）
 * - 命中"别名完全相等" → 视为"相关推荐"（isRecommended=true），
 *   用于你搜索"财政局"提示"财政部"这种场景。
 */
export function searchSources(
  departments: SourceCardData[],
  query: string,
  metaMap: Map<string, SourceMeta> = buildMetaMap(),
): SourceSearchHit[] {
  const q = normalize(query);
  if (!q) {
    // 空查询：返回所有部门，但标记为"无匹配"，便于上层排序时放默认顺序
    return departments.map((item) => ({
      item,
      meta: metaMap.get(item.departmentName) ?? null,
      score: 0,
      matchType: "contains",
      matchedText: "",
      isRecommended: false,
    }));
  }

  const hits: SourceSearchHit[] = [];

  for (const item of departments) {
    const meta = metaMap.get(item.departmentName) ?? null;
    const deptName = item.departmentName;
    const deptNameLower = deptName.toLowerCase();

    let matchType: MatchType | null = null;
    let matchedText = "";
    let isRecommended = false;

    // 1) 完全等同部委名
    if (deptNameLower === q) {
      matchType = "exact";
      matchedText = deptName;
    }

    // 2) 完全等同某个别名 → 视为"相关推荐"
    if (!matchType && meta) {
      const aliasExact = meta.aliases.find((a) => a.toLowerCase() === q);
      if (aliasExact) {
        matchType = "aliasExact";
        matchedText = aliasExact;
        isRecommended = true;
      }
    }

    // 3) 部委名包含
    if (!matchType && deptNameLower.includes(q)) {
      matchType = "contains";
      matchedText = deptName;
    }

    // 4) 拼音全拼（"caizhengbu" → 财政部；"caizheng" → 财政部）
    if (!matchType && meta?.pinyinFull?.length) {
      const full = meta.pinyinFull.join("");
      if (full.includes(q) || full.startsWith(q)) {
        matchType = "pinyinFull";
        matchedText = deptName;
      }
    }

    // 5) 拼音简拼（"czb" → 财政部；"cz" → 财政部）
    if (!matchType && meta?.pinyinInitial) {
      if (meta.pinyinInitial.includes(q) || meta.pinyinInitial.startsWith(q)) {
        matchType = "pinyinInitial";
        matchedText = deptName;
      }
    }

    // 6) 栏目名包含（部委下的某个栏目命中）
    if (!matchType && item.channelNames?.length) {
      const hitChannel = item.channelNames.find((c) => c.toLowerCase().includes(q));
      if (hitChannel) {
        matchType = "channelMatch";
        matchedText = hitChannel;
      }
    }

    // 7) 别名包含（最弱一档，作为相关推荐）
    if (!matchType && meta?.aliases?.length) {
      const aliasHit = meta.aliases.find((a) => a.toLowerCase().includes(q));
      if (aliasHit) {
        matchType = "aliasFuzzy";
        matchedText = aliasHit;
        isRecommended = true;
      }
    }

    if (matchType) {
      hits.push({
        item,
        meta,
        score: SCORE_TABLE[matchType],
        matchType,
        matchedText,
        isRecommended,
      });
    }
  }

  // 得分降序；同分时按 item.totalCount 降序，倾向展示更活跃的部委
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.item.totalCount ?? 0) - (a.item.totalCount ?? 0);
  });

  return hits;
}

/** 搜索框下方的快速提示。 */
export const SEARCH_HINT = "支持部门名称、别名、拼音搜索。例：工信部 / 网信办 / fgw / 数据局";
