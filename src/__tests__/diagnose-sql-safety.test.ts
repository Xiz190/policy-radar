import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");

function findJsonbArrayOps(sql: string): Array<{ op: string; context: string }> {
  const results: Array<{ op: string; context: string }> = [];
  const re = /jsonb_array_(length|elements)\s*\(\s*([a-z_][a-z0-9_.]*)\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    results.push({ op: m[0], context: m[0] });
  }
  return results;
}

describe("诊断页 SQL 安全性测试（脏数据防护）", () => {
  const diagnosePageFile = path.join(SRC_ROOT, "app", "monitor", "diagnose", "page.tsx");
  const diagnoseApiFile = path.join(SRC_ROOT, "app", "api", "monitor", "diagnose", "route.ts");
  const categoryDiagnoseApiFile = path.join(
    SRC_ROOT,
    "app",
    "api",
    "monitor",
    "category-diagnose",
    "route.ts",
  );

  it("diagnose/page.tsx 中所有 jsonb_array_length/elements 操作都有 jsonb_typeof 保护", () => {
    expect(fs.existsSync(diagnosePageFile)).toBe(true);
    const content = fs.readFileSync(diagnosePageFile, "utf8");

    const ops = findJsonbArrayOps(content);
    expect(ops.length).toBeGreaterThan(0);

    const unprotected = ops.filter((op) => {
      const idx = content.indexOf(op.op);
      const start = Math.max(0, idx - 500);
      const end = Math.min(content.length, idx + 500);
      const context = content.slice(start, end);
      return !/jsonb_typeof/i.test(context);
    });

    expect(unprotected.length).toBe(0);
  });

  it("api/monitor/diagnose/route.ts 中所有 jsonb_array_length/elements 操作都有 jsonb_typeof 保护", () => {
    expect(fs.existsSync(diagnoseApiFile)).toBe(true);
    const content = fs.readFileSync(diagnoseApiFile, "utf8");

    const ops = findJsonbArrayOps(content);
    if (ops.length === 0) return;

    const unprotected = ops.filter((op) => {
      const idx = content.indexOf(op.op);
      const start = Math.max(0, idx - 500);
      const end = Math.min(content.length, idx + 500);
      const context = content.slice(start, end);
      return !/jsonb_typeof/i.test(context);
    });

    expect(unprotected.length).toBe(0);
  });

  it("api/monitor/category-diagnose/route.ts 中所有 jsonb_array_length/elements 操作都有 jsonb_typeof 保护", () => {
    expect(fs.existsSync(categoryDiagnoseApiFile)).toBe(true);
    const content = fs.readFileSync(categoryDiagnoseApiFile, "utf8");

    const ops = findJsonbArrayOps(content);
    expect(ops.length).toBeGreaterThan(0);

    const unprotected = ops.filter((op) => {
      const idx = content.indexOf(op.op);
      const start = Math.max(0, idx - 500);
      const end = Math.min(content.length, idx + 500);
      const context = content.slice(start, end);
      return !/jsonb_typeof/i.test(context);
    });

    expect(unprotected.length).toBe(0);
  });

  it("diagnose/page.tsx 使用了 safeQuery 包装，单条查询失败不会导致整体崩溃", () => {
    expect(fs.existsSync(diagnosePageFile)).toBe(true);
    const content = fs.readFileSync(diagnosePageFile, "utf8");

    expect(content).toContain("async function safeQuery");
    expect(content).toContain("try {");
    expect(content).toContain("catch (err)");
    expect(content).toContain("return { rows: [] }");
  });

  it("api/monitor/diagnose/route.ts 有整体 try/catch，异常时返回结构化 JSON 而非空响应", () => {
    expect(fs.existsSync(diagnoseApiFile)).toBe(true);
    const content = fs.readFileSync(diagnoseApiFile, "utf8");

    expect(content).toContain("ok: false");
    expect(content).toContain("error: errMsg");
    expect(content).toContain("status: 500");
    expect(content).toContain("content-type\": \"application/json");
  });

  it("monitor-runner.tsx 中 runDiagnose 使用了 safeFetchJson 做容错解析", () => {
    const runnerFile = path.join(SRC_ROOT, "components", "monitor-runner.tsx");
    expect(fs.existsSync(runnerFile)).toBe(true);
    const content = fs.readFileSync(runnerFile, "utf8");

    expect(content).toContain("async function safeFetchJson");
    expect(content).toContain("接口不存在（404）");
    expect(content).toContain("返回 HTML 而非 JSON");
    expect(content).toContain("接口返回空响应");
    expect(content).toContain("JSON 解析失败");
    expect(content).toContain("safeFetchJson(\"/api/monitor/diagnose\"");
  });

  it("diagnose/page.tsx 中所有收纳区块使用 details 标签，默认收起（无 open 属性）", () => {
    expect(fs.existsSync(diagnosePageFile)).toBe(true);
    const content = fs.readFileSync(diagnosePageFile, "utf8");

    const detailsMatches = content.match(/<details\s/g) || [];
    expect(detailsMatches.length).toBeGreaterThanOrEqual(6);

    const openMatches = content.match(/<details\s[^>]*\bopen\b/g) || [];
    expect(openMatches.length).toBe(0);
  });

  it("monitor-runner.tsx 中 expandedDepartments 和 expandedResults 默认是空 Set（全部收起）", () => {
    const runnerFile = path.join(SRC_ROOT, "components", "monitor-runner.tsx");
    expect(fs.existsSync(runnerFile)).toBe(true);
    const content = fs.readFileSync(runnerFile, "utf8");

    const deptMatch = content.match(
      /const \[expandedDepartments[^;\n]*useState<Set<string>>\(\s*\(\)\s*=>\s*new Set\(\s*\)\s*\)/,
    );
    expect(deptMatch).not.toBeNull();

    const resultMatch = content.match(
      /const \[expandedResults[^;\n]*useState<Set<string>>\(\s*\(\)\s*=>\s*new Set\(\s*\)\s*\)/,
    );
    expect(resultMatch).not.toBeNull();
  });

  it("diagnose/page.tsx 包含脏数据统计区块（dirty data stats）", () => {
    expect(fs.existsSync(diagnosePageFile)).toBe(true);
    const content = fs.readFileSync(diagnosePageFile, "utf8");

    expect(content).toContain("脏数据统计");
    expect(content).toContain("JSONB 字段类型异常统计");
    expect(content).toContain("dirtyDataStats");
    expect(content).toContain("dirtyTotal");
  });
});
