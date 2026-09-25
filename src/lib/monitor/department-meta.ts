/*
 * 部委元数据字典（拼音 + 别名）+ 纯函数搜索工具。
 *
 * 设计要点：
 *   - 字典与业务数据解耦。DB 返回的 DepartmentCardData 只有 departmentName 等业务字段，
 *     这里的字典按 departmentName 对齐，命中不到也不会报错（退化到纯中文包含匹配）。
 *   - 拼音按"字"切分保存，既能做全拼匹配（"caizhengbu"），也能做前缀匹配（"caizheng"），
 *     同时首字母简拼单独保存（"czb"）。
 *   - 别名字段用于"近义词"场景：例如用户输入"财政局"，提示"财政部"。
 *   - 匹配结果带 score 与 matchType，用于优先级排序 + 前端高亮/推荐文案。
 *
 * 新增部委时，只需在 DEPARTMENT_META 里增加一行即可，无需改其他文件。
 */

import type { DepartmentCardData } from "@/components/department-directory";

export type DepartmentMeta = {
  /** 正式部委名。与 DepartmentCardData.departmentName 对齐使用。 */
  departmentName: string;
  /** 按字切分的拼音全拼（小写）。例：["cai", "zheng", "bu"]。
   *  用于全拼 / 前缀模糊匹配，长度一般与汉字数一致。 */
  pinyinFull: string[];
  /** 首字母简拼（小写）。例："czb"。长度一般与汉字数一致。 */
  pinyinInitial: string;
  /** 别名 / 近义词（大小写无关）。例：["财政局", "财政厅", "财政部门"]。
   *  用户输入非正式部委名时，会命中并在卡片上显示「相关部委」。 */
  aliases: string[];
};

/**
 * 部委字典。现有部委全量列在这里。
 * 新增部委时，只需追加一行；若暂时没空填拼音/别名，字段给空数组/空串即可，
 * 搜索会自动退化为纯中文包含匹配。
 */
export const DEPARTMENT_META: DepartmentMeta[] = [
  {
    departmentName: "财政部",
    pinyinFull: ["cai", "zheng", "bu"],
    pinyinInitial: "czb",
    aliases: ["财政局", "财政厅", "财政部门", "财政"],
  },
  {
    departmentName: "文化和旅游部",
    pinyinFull: ["wen", "hua", "he", "lü", "you", "bu"],
    pinyinInitial: "whhlyb",
    aliases: ["文旅部", "文化部", "旅游部", "文旅局", "文旅"],
  },
  {
    departmentName: "北京市经济和信息化局",
    pinyinFull: ["bei", "jing", "shi", "jing", "ji", "yu", "xin", "xi", "hua", "ju"],
    pinyinInitial: "bjjxj",
    aliases: ["北京经信局", "经信局", "北京经信", "北京市经信局"],
  },
  {
    departmentName: "审计署",
    pinyinFull: ["shen", "ji", "shu"],
    pinyinInitial: "sjs",
    aliases: ["国家审计署", "审计局", "审计厅"],
  },
  {
    departmentName: "国务院",
    pinyinFull: ["guo", "wu", "yuan"],
    pinyinInitial: "gwy",
    aliases: ["中央政府", "国务院办公厅", "国办"],
  },
  {
    departmentName: "发展和改革委员会",
    pinyinFull: ["fa", "zhan", "he", "gai", "ge", "wei", "yuan", "hui"],
    pinyinInitial: "fhggewyh",
    aliases: ["发改委", "发改", "国家发改委"],
  },
  {
    departmentName: "教育部",
    pinyinFull: ["jiao", "yu", "bu"],
    pinyinInitial: "jyb",
    aliases: ["教育局", "教育厅", "教委"],
  },
  {
    departmentName: "科学技术部",
    pinyinFull: ["ke", "xue", "ji", "shu", "bu"],
    pinyinInitial: "kxjsb",
    aliases: ["科技部", "科技厅", "科技局", "科创"],
  },
  {
    departmentName: "工业和信息化部",
    pinyinFull: ["gong", "ye", "he", "xin", "xi", "hua", "bu"],
    pinyinInitial: "gyhxxhb",
    aliases: ["工信部", "工信厅", "工信局", "工业部"],
  },
  {
    departmentName: "住房和城乡建设部",
    pinyinFull: ["zhu", "fang", "he", "cheng", "xiang", "jian", "she", "bu"],
    pinyinInitial: "zfhcxjsb",
    aliases: ["住建部", "住建局", "建设部", "城乡建设"],
  },
  {
    departmentName: "国家卫生健康委员会",
    pinyinFull: ["guo", "jia", "wei", "sheng", "jian", "kang", "wei", "yuan", "hui"],
    pinyinInitial: "gjwsjkw",
    aliases: ["卫健委", "卫生部", "卫计委", "卫生局"],
  },
  {
    departmentName: "交通运输部",
    pinyinFull: ["jiao", "tong", "yun", "shu", "bu"],
    pinyinInitial: "jtysb",
    aliases: ["交通部", "交通运输", "交通部门"],
  },
  {
    departmentName: "水利部",
    pinyinFull: ["shui", "li", "bu"],
    pinyinInitial: "slb",
    aliases: ["水利局", "水利厅", "水务", "水利部门"],
  },
  {
    departmentName: "国家烟草专卖局",
    pinyinFull: ["guo", "jia", "yan", "cao", "zhuan", "mai", "ju"],
    pinyinInitial: "gjyczmj",
    aliases: ["烟草局", "烟草专卖", "烟草总公司", "国家烟草局"],
  },
  {
    departmentName: "国家林业和草原局",
    pinyinFull: ["guo", "jia", "lin", "ye", "he", "cao", "yuan", "ju"],
    pinyinInitial: "gjlyhcyj",
    aliases: ["林草局", "国家林草局", "林业局", "草原局", "林草", "国家林业和草原局"],
  },
  {
    departmentName: "生态环境部",
    pinyinFull: ["sheng", "tai", "huan", "jing", "bu"],
    pinyinInitial: "sthjb",
    aliases: ["环保部", "生态环境", "环境部", "环保部门"],
  },
  {
    departmentName: "北京市交通委员会",
    pinyinFull: ["bei", "jing", "shi", "jiao", "tong", "wei", "yuan", "hui"],
    pinyinInitial: "bjsjtwyh",
    aliases: ["北京交通委", "交通委", "北京交委", "北京市交通委"],
  },
];

/** 把字典转成以 departmentName 为 key 的 Map，便于 O(1) 查找。 */
export function buildMetaMap(
  list: DepartmentMeta[] = DEPARTMENT_META,
): Map<string, DepartmentMeta> {
  const map = new Map<string, DepartmentMeta>();
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

export type DepartmentSearchHit = {
  item: DepartmentCardData;
  meta: DepartmentMeta | null;
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
export function searchDepartments(
  departments: DepartmentCardData[],
  query: string,
  metaMap: Map<string, DepartmentMeta> = buildMetaMap(),
): DepartmentSearchHit[] {
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

  const hits: DepartmentSearchHit[] = [];

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

/** 搜索框下方的快速提示：输入"财政部 / caizhengbu / 财政局"都能命中。 */
export const SEARCH_HINT = "支持中文、拼音全拼、拼音简拼、别名搜索。例：财政部 / caizhengbu / czb / 财政局";
