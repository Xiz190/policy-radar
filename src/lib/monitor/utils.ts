import { DEFAULT_MONITOR_SOURCES } from "@/lib/monitor/config";

export function getMonitorSourceDisplayName(sourceId: string) {
  return DEFAULT_MONITOR_SOURCES.find((source) => source.id === sourceId)?.displayName ?? sourceId;
}

export function isDemoItem(item: { sourceId?: string; url?: string }): boolean {
  if (!item.sourceId && !item.url) return true;
  if (item.sourceId) {
    if (item.sourceId.startsWith("demo_")) return true;
    if (item.sourceId.startsWith("src_mock_")) return true;
    if (item.sourceId.startsWith("mock_")) return true;
  }
  if (!item.url) return true;
  try {
    const u = new URL(item.url);
    if (u.pathname.includes("/demo/") || u.pathname.startsWith("/demo")) return true;
    if (u.hostname === "example.com") return true;
    if (u.hostname.includes("example")) return true;
    if (u.hostname.includes("invalid")) return true;
    const simplePathPattern = /^\/[a-z0-9_-]+(-[a-z0-9_-]+)?-\d+$/;
    if (simplePathPattern.test(u.pathname)) return true;
    return false;
  } catch {
    return true;
  }
}

export function getHomepageFromDemo(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return url;
  }
}

const DEPARTMENT_ALIASES: Record<string, string> = {
  "工信部": "工业和信息化部",
  "工业和信息化部": "工业和信息化部",
  "国家工信部": "工业和信息化部",
  "网信办": "国家互联网信息办公室",
  "国家网信办": "国家互联网信息办公室",
  "中央网信办": "国家互联网信息办公室",
  "发改委": "国家发展和改革委员会",
  "国家发改委": "国家发展和改革委员会",
  "发展改革委": "国家发展和改革委员会",
  "教育部": "教育部",
  "国家教育部": "教育部",
  "科技部": "科学技术部",
  "国家科技部": "科学技术部",
  "财政部": "财政部",
  "国家财政部": "财政部",
  "人社部": "人力资源和社会保障部",
  "人力资源社会保障部": "人力资源和社会保障部",
  "自然资源部": "自然资源部",
  "生态环境部": "生态环境部",
  "住建部": "住房和城乡建设部",
  "住房城乡建设部": "住房和城乡建设部",
  "交通部": "交通运输部",
  "交通运输部": "交通运输部",
  "农业部": "农业农村部",
  "农业农村部": "农业农村部",
  "商务部": "商务部",
  "卫健委": "国家卫生健康委员会",
  "卫生健康委": "国家卫生健康委员会",
  "国家卫健委": "国家卫生健康委员会",
  "文旅部": "文化和旅游部",
  "文化和旅游部": "文化和旅游部",
  "国家文旅部": "文化和旅游部",
  "人民银行": "中国人民银行",
  "央行": "中国人民银行",
  "审计署": "审计署",
  "国资委": "国务院国有资产监督管理委员会",
  "市场监管总局": "国家市场监督管理总局",
  "国家市场监管总局": "国家市场监督管理总局",
  "市监总局": "国家市场监督管理总局",
  "税务总局": "国家税务总局",
  "国家税务总局": "国家税务总局",
  "海关总署": "海关总署",
  "广电总局": "国家广播电视总局",
  "国家广电总局": "国家广播电视总局",
  "体育总局": "国家体育总局",
  "国家体育总局": "国家体育总局",
  "统计局": "国家统计局",
  "国家统计局": "国家统计局",
  "林业和草原局": "国家林业和草原局",
  "国家林业和草原局": "国家林业和草原局",
  "林草局": "国家林业和草原局",
  "知识产权局": "国家知识产权局",
  "国家知识产权局": "国家知识产权局",
  "医保局": "国家医疗保障局",
  "国家医保局": "国家医疗保障局",
  "国管局": "国家机关事务管理局",
  "国家机关事务管理局": "国家机关事务管理局",
  "信访局": "国家信访局",
  "国家信访局": "国家信访局",
  "烟草专卖局": "国家烟草专卖局",
  "国家烟草专卖局": "国家烟草专卖局",
  "铁路局": "国家铁路局",
  "国家铁路局": "国家铁路局",
  "民航局": "中国民用航空局",
  "中国民用航空局": "中国民用航空局",
  "国家民航局": "中国民用航空局",
  "邮政局": "国家邮政局",
  "国家邮政局": "国家邮政局",
  "文物局": "国家文物局",
  "国家文物局": "国家文物局",
  "中医药管理局": "国家中医药管理局",
  "国家中医药管理局": "国家中医药管理局",
  "外汇管理局": "国家外汇管理局",
  "国家外汇管理局": "国家外汇管理局",
  "外汇局": "国家外汇管理局",
  "药品监督管理局": "国家药品监督管理局",
  "国家药品监督管理局": "国家药品监督管理局",
  "药监局": "国家药品监督管理局",
  "煤矿安全监察局": "国家矿山安全监察局",
  "国家矿山安全监察局": "国家矿山安全监察局",
  "地震局": "中国地震局",
  "中国地震局": "中国地震局",
  "气象局": "中国气象局",
  "中国气象局": "中国气象局",
  "银保监会": "国家金融监督管理总局",
  "国家金融监督管理总局": "国家金融监督管理总局",
  "证监会": "中国证券监督管理委员会",
  "中国证监会": "中国证券监督管理委员会",
  "中国证券监督管理委员会": "中国证券监督管理委员会",
  "社保基金会": "全国社会保障基金理事会",
  "全国社会保障基金理事会": "全国社会保障基金理事会",
  "能源局": "国家能源局",
  "国家能源局": "国家能源局",
  "数据局": "国家数据局",
  "国家数据局": "国家数据局",
};

const PROVINCE_GOVERNMENT_PATTERNS = [
  /^(.+?)省人民政府$/,
  /^(.+?)省政府$/,
  /^(.+?)省(人民政府)?$/,
  /^(.+?)市人民政府$/,
  /^(.+?)市政府$/,
  /^(.+?)市(人民政府)?$/,
  /^(.+?)自治区人民政府$/,
  /^(.+?)自治区政府$/,
  /^(.+?)自治区(人民政府)?$/,
  /^(.+?)区人民政府$/,
  /^(.+?)区政府$/,
  /^(.+?)县人民政府$/,
  /^(.+?)县政府$/,
  /^(.+?)镇人民政府$/,
  /^(.+?)镇政府$/,
  /^(.+?)乡人民政府$/,
  /^(.+?)乡政府$/,
  /^(.+?)街道办事处$/,
  /^(.+?)街道办$/,
];

function toHalfWidth(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xff01 && code <= 0xff5e) {
      result += String.fromCharCode(code - 0xfee0);
    } else if (code === 0x3000) {
      result += " ";
    } else {
      result += str.charAt(i);
    }
  }
  return result;
}

export function normalizeDepartmentName(rawName: string | null | undefined): string {
  if (!rawName) return "";

  let name = rawName;

  name = name.replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "");

  name = name.replace(/[\r\n\t]/g, " ");

  name = toHalfWidth(name);

  name = name.replace(/[（]/g, "(").replace(/[）]/g, ")");
  name = name.replace(/[【]/g, "[").replace(/[】]/g, "]");
  name = name.replace(/[「」『』]/g, '"');
  name = name.replace(/[—–]/g, "-");
  name = name.replace(/[…]/g, "...");

  name = name.replace(/\s+/g, " ").trim();

  name = name.replace(/^[ \-·•●◆■▲★☆♦]+|[ \-·•●◆■▲★☆♦]+$/g, "").trim();

  const match = name.match(/^(.+?)\s*[\(（](.+?)[\)）]\s*$/);
  if (match) {
    const baseName = match[1].trim();
    const inParen = match[2].trim();
    if (/^[A-Za-z]+$/.test(inParen) || inParen.length < baseName.length) {
      name = baseName;
    }
  }

  const directMatch = DEPARTMENT_ALIASES[name];
  if (directMatch) return directMatch;

  for (const pattern of PROVINCE_GOVERNMENT_PATTERNS) {
    const m = name.match(pattern);
    if (m) {
      const place = m[1].trim();
      if (pattern.source.includes("省")) {
        return `${place}省人民政府`;
      }
      if (pattern.source.includes("自治区")) {
        return `${place}自治区人民政府`;
      }
      if (pattern.source.includes("市")) {
        return `${place}市人民政府`;
      }
      if (pattern.source.includes("区")) {
        return `${place}区人民政府`;
      }
      if (pattern.source.includes("县")) {
        return `${place}县人民政府`;
      }
      if (pattern.source.includes("镇")) {
        return `${place}镇人民政府`;
      }
      if (pattern.source.includes("乡")) {
        return `${place}乡人民政府`;
      }
      if (pattern.source.includes("街道")) {
        return `${place}街道办事处`;
      }
    }
  }

  if (/^北京市委$/.test(name)) return "中共北京市委";
  if (/^(.+?)市委$/.test(name)) {
    const m = name.match(/^(.+?)市委$/);
    if (m) return `中共${m[1]}市委`;
  }
  if (/^(.+?)省委$/.test(name)) {
    const m = name.match(/^(.+?)省委$/);
    if (m) return `中共${m[1]}省委`;
  }

  const bureauMatch = name.match(/^(.+?)(?:市|区|县)?(局|委员会|办|办公室|分局|管理局)$/);
  if (bureauMatch) {
    return name;
  }

  return name;
}

export function fuzzyMatchDepartment(
  name: string,
  candidates: string[]
): string | null {
  const normalized = normalizeDepartmentName(name);
  if (candidates.includes(normalized)) return normalized;

  for (const candidate of candidates) {
    const normCandidate = normalizeDepartmentName(candidate);
    if (normCandidate === normalized) return candidate;
    if (normalized.includes(normCandidate) || normCandidate.includes(normalized)) {
      return candidate;
    }
  }

  return null;
}

export function validateDepartmentName(name: string): {
  valid: boolean;
  normalized: string;
  issues: string[];
} {
  const issues: string[] = [];
  const normalized = normalizeDepartmentName(name);

  if (!normalized) {
    issues.push("名称为空");
  }
  if (normalized.length < 2) {
    issues.push("名称过短");
  }
  if (normalized.length > 50) {
    issues.push("名称过长");
  }
  if (/[<>{}|\\^`]/.test(normalized)) {
    issues.push("包含非法字符");
  }
  if (/^\d+$/.test(normalized)) {
    issues.push("纯数字名称");
  }

  return {
    valid: issues.length === 0,
    normalized,
    issues,
  };
}

export function normalizeItemUrl(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);

    const trackingKeys = new Set([
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "spm", "clickid", "gclid", "fbclid", "from", "ref", "referer", "referrer",
    ]);

    const keys = Array.from(u.searchParams.keys());
    for (const k of keys) {
      if (trackingKeys.has(k.toLowerCase())) u.searchParams.delete(k);
      const v = u.searchParams.get(k);
      if (v === null || v === "") u.searchParams.delete(k);
    }
    u.searchParams.sort();

    let p = u.pathname.replace(/\/+/g, "/");
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    u.pathname = p;

    return u.toString();
  } catch {
    return trimmed;
  }
}

