import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ============================================================================
// 防回归测试：通过静态扫描源代码，检测已知的 SQL / 查询反模式
//
// 四个修复点对应的反模式：
//   1) UPDATE/DELETE ... returning count(*)  —— 应使用 res.rowCount
//   2) monitor_items.created_at              —— monitor_items 表没有 created_at
//      列，应当使用 first_seen_at
//   3) batchUpdateItems 参数编号偏移
//   4) jsonb_array_length / jsonb_array_elements 未加 jsonb_typeof 保护
//      —— 当字段不是数组时会抛 "cannot get array length of a non-array"
// ============================================================================

const SRC_ROOT = path.resolve(__dirname, "..");

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过不相关目录，加快扫描
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walkFiles(full, out);
    } else if (/\.tsx?$|\.jsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

interface Match {
  file: string;
  line: number;
  text: string;
}

describe("SQL 反模式检测（防止回归）", () => {
  let sourceFiles: string[] = [];

  beforeAll(() => {
    sourceFiles = walkFiles(SRC_ROOT).filter((f) => !f.includes("/__tests__/"));
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  // —— 修复点 1：RETURNING count(*) 改为 rowCount ———————————————
  // PostgreSQL 的 RETURNING 子句不能接受聚合函数。
  // 之前代码 `returning count(*) as n` 会直接抛 SQL 错误。
  // 正确做法：去掉 RETURNING 子句，使用 pg 驱动的 res.rowCount。
  it("禁止在 SQL 中使用 `returning count(*)`（应使用 res.rowCount）", () => {
    const pattern = /returning\s+count\s*\(\s*\*\s*\)/i;
    const matches: Match[] = [];

    for (const file of sourceFiles) {
      // 只扫描包含 SQL 查询的文件（简化：所有 .ts/.tsx）
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          matches.push({ file, line: i + 1, text: lines[i].trim() });
        }
      }
    }

    if (matches.length > 0) {
      const detail = matches
        .map((m) => `  - ${path.relative(process.cwd(), m.file)}:${m.line}  →  ${m.text}`)
        .join("\n");
      throw new Error(
        `发现 ${matches.length} 处使用了 'returning count(*)' 的 SQL 反模式，\n` +
          `PostgreSQL 不允许 RETURNING 子句中使用聚合函数。\n` +
          `请移除 RETURNING 子句并改用 pg 驱动的 res.rowCount 来获取受影响行数。\n\n` +
          detail,
      );
    }
  });

  // —— 修复点 2：monitor_items.created_at 改为 first_seen_at ————————
  // monitor_items 表中的时间戳列是 first_seen_at，不存在 created_at。
  // 之前代码 `order by i.created_at desc` 会抛 "column does not exist"。
  it("禁止引用 monitor_items.created_at（应使用 first_seen_at）", () => {
    // 匹配思路：在 monitor_items 上下文（或带前缀 i./mi.）的 created_at
    // 更稳妥：搜索 monitor_items 表范围内对 created_at 的引用
    const matches: Match[] = [];
    const pattern1 = /monitor_items[^;]*\bcreated_at\b/i;
    const pattern2 = /\b(?:i|mi)\.created_at\b/i;

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (pattern1.test(line) || pattern2.test(line)) {
          // 白名单：排除注释行、以及非 monitor_items 上下文的 created_at
          //   （例如其他表的 created_at 是合法的）
          const seemsValid =
            line.trim().startsWith("//") ||
            line.trim().startsWith("*") ||
            line.trim().startsWith("/*") ||
            !/monitor_items|from\s+monitor|i\.created_at|mi\.created_at/.test(line);

          if (!seemsValid) {
            matches.push({ file, line: i + 1, text: line.trim() });
          }
        }
      }
    }

    if (matches.length > 0) {
      const detail = matches
        .map((m) => `  - ${path.relative(process.cwd(), m.file)}:${m.line}  →  ${m.text}`)
        .join("\n");
      throw new Error(
        `发现 ${matches.length} 处引用了 monitor_items.created_at，\n` +
          `但 monitor_items 表没有 created_at 列（应使用 first_seen_at）。\n\n` +
          detail,
      );
    }
  });

  // —— 修复点 3：batchUpdateItems 参数编号偏移 ————————————————————
  // batchUpdateItems 函数内部必须将 WHERE 子句中的 $N 编号向右偏移 sets.length，
  // 否则 SET 参数（$1, $2...）和 WHERE 参数会共享相同编号，导致类型错配。
  // 我们不测试具体实现细节，只校验：
  //   - 存在 offset/shifting 相关逻辑（确保未来修改不会把它删掉）
  it("batchUpdateItems 必须实现 WHERE 参数编号的偏移逻辑（防止 SET 与 WHERE 参数共用相同 $N）", () => {
    const dbDir = path.join(SRC_ROOT, "lib", "monitor", "db");
    expect(fs.existsSync(dbDir)).toBe(true);

    let content = "";
    for (const file of fs.readdirSync(dbDir)) {
      if (file.endsWith(".ts")) {
        content += fs.readFileSync(path.join(dbDir, file), "utf8");
      }
    }

    const batchFnMatch = content.match(
      /export async function batchUpdateItems[\s\S]*?^\}/m,
    );
    expect(batchFnMatch).not.toBeNull();
    const fnBody = batchFnMatch![0];

    // 必须包含偏移 / 重编号逻辑：查找对 $N 的改写或对 clauses/values 的处理
    const hasOffsetLogic =
      /offset|replace.*\\\$\(|shifted|allValues\.length|sets\.length.*clause|clauses\.map/.test(
        fnBody,
      );
    const hasParamPushAfterSets = /allValues\.push\s*\(\s*\.\.\.values\s*\)/.test(fnBody);

    if (!hasOffsetLogic) {
      throw new Error(
        `在 lib/monitor/db/ 的 batchUpdateItems 中未检测到参数编号偏移逻辑。\n` +
          `如果直接将 WHERE 子句的 $1/$2... 拼在 SET 子句之后，\n` +
          `会导致 SET 与 WHERE 的参数编号冲突，引发 SQL 类型不匹配错误。\n` +
          `请确保在拼接 allValues.push(...values) 之前将 WHERE 的 $N 重编号为 $N+sets.length。`,
      );
    }

    expect(hasParamPushAfterSets).toBe(true);
  });

  // —— 修复点 4：jsonb 数组操作必须加 jsonb_typeof 保护 ————————————————
  // 当 JSONB 字段存的不是数组（object/string/null）时，
  // 直接调用 jsonb_array_length / jsonb_array_elements 会抛
  // "cannot get array length of a non-array"，导致整个查询失败。
  // 正确做法：先判断 jsonb_typeof(col) = 'array'，或用 CASE 兜底为 '[]'::jsonb
  it("JSONB 数组操作（jsonb_array_length/elements）必须加 jsonb_typeof 保护（防止非数组脏数据导致查询崩溃）", () => {
    const dangerousPatterns = [
      /jsonb_array_length\s*\(\s*[a-z_.]+\s*\)/i,
      /jsonb_array_elements\s*\(\s*[a-z_.]+\s*\)/i,
    ];
    const protectionPattern = /jsonb_typeof/i;

    const matches: Match[] = [];

    for (const file of sourceFiles) {
      // 只看包含 SQL 查询特征的文件
      const content = fs.readFileSync(file, "utf8");
      if (!/jsonb_array_/i.test(content)) continue;

      // 按 SQL 块粗略分段：遇到 pool.query 或 ` 开头的 SQL 模板
      // 简化策略：检查每一行是否有 jsonb_array_ 且同一段上下文中没有 jsonb_typeof
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const hasDangerousOp = dangerousPatterns.some((p) => p.test(line));
        if (!hasDangerousOp) continue;

        // 向上、向下各找 15 行，看是否有 jsonb_typeof 保护
        const contextStart = Math.max(0, i - 15);
        const contextEnd = Math.min(lines.length - 1, i + 15);
        let hasProtection = false;
        for (let j = contextStart; j <= contextEnd; j++) {
          if (protectionPattern.test(lines[j])) {
            hasProtection = true;
            break;
          }
        }

        // 排除注释行
        const trimmed = line.trim();
        const isComment =
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*") ||
          trimmed.startsWith("*/");

        if (!hasProtection && !isComment) {
          matches.push({ file, line: i + 1, text: trimmed });
        }
      }
    }

    if (matches.length > 0) {
      const detail = matches
        .map((m) => `  - ${path.relative(process.cwd(), m.file)}:${m.line}  →  ${m.text}`)
        .join("\n");
      throw new Error(
        `发现 ${matches.length} 处 JSONB 数组操作未加类型保护，\n` +
          `当 matched_categories / content_json 等字段存了非数组值（object/string/null）时，\n` +
          `PostgreSQL 会抛 "cannot get array length of a non-array" 导致查询崩溃。\n` +
          `请在操作前先判断 jsonb_typeof(col) = 'array'，或用 CASE 兜底为 '[]'::jsonb。\n\n` +
          detail,
      );
    }
  });
});
