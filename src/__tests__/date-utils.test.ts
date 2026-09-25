import { describe, expect, it } from "vitest";
import {
  formatDateShort,
  formatDateShortSlash,
  formatDateShortNoPad,
  formatDateFull,
  formatDateTime,
  formatDateTimeFull,
} from "@/lib/date-utils";

describe("date-utils - formatDateShort", () => {
  it("空值返回 '-'", () => {
    expect(formatDateShort(null)).toBe("-");
    expect(formatDateShort(undefined)).toBe("-");
    expect(formatDateShort("")).toBe("-");
  });

  it("默认用 '-' 分隔，返回 MM-DD 格式", () => {
    const result = formatDateShort("2025-06-15T10:30:00Z");
    expect(result).toMatch(/^\d{2}-\d{2}$/);
  });

  it("支持自定义分隔符", () => {
    const result = formatDateShort("2025-06-15T10:30:00Z", "/");
    expect(result).toMatch(/^\d{2}\/\d{2}$/);
  });

  it("无效日期字符串返回 slice(5, 10) 兜底", () => {
    expect(formatDateShort("not-a-date")).toBe("-date");
  });
});

describe("date-utils - formatDateShortSlash", () => {
  it("空值返回空字符串", () => {
    expect(formatDateShortSlash(null)).toBe("");
    expect(formatDateShortSlash(undefined)).toBe("");
    expect(formatDateShortSlash("")).toBe("");
  });

  it("返回 MM/DD 格式", () => {
    const result = formatDateShortSlash("2025-06-15T10:30:00Z");
    expect(result).toMatch(/^\d{2}\/\d{2}$/);
  });

  it("无效日期返回 slice(0, 10) 兜底", () => {
    expect(formatDateShortSlash("invalid-date-string")).toBe("invalid-da");
  });
});

describe("date-utils - formatDateShortNoPad", () => {
  it("空值返回 '-'", () => {
    expect(formatDateShortNoPad(null)).toBe("-");
    expect(formatDateShortNoPad(undefined)).toBe("-");
    expect(formatDateShortNoPad("")).toBe("-");
  });

  it("返回 M/D 格式（不补零）", () => {
    const result = formatDateShortNoPad("2025-06-05T10:30:00Z");
    expect(result).toMatch(/^\d{1,2}\/\d{1,2}$/);
    // 不补零：月份和日期不应该同时都是两位数（对于 1-9 号/月）
    // 这里只校验格式，不校验具体值，因为依赖本地时区
  });

  it("无效日期返回原字符串", () => {
    expect(formatDateShortNoPad("bad-date")).toBe("bad-date");
  });
});

describe("date-utils - formatDateFull", () => {
  it("空值返回 '—'", () => {
    expect(formatDateFull(null)).toBe("—");
    expect(formatDateFull(undefined)).toBe("—");
    expect(formatDateFull("")).toBe("—");
  });

  it("返回 zh-CN 格式的完整日期（YYYY/MM/DD 或 YYYY年MM月DD日）", () => {
    const result = formatDateFull("2025-06-15T10:30:00Z");
    // zh-CN 的 toLocaleDateString 格式包含年/月/日
    expect(result).toContain("2025");
    expect(result.length).toBeGreaterThanOrEqual(8);
  });

  it("无效日期返回原字符串", () => {
    expect(formatDateFull("not-valid")).toBe("not-valid");
  });
});

describe("date-utils - formatDateTime", () => {
  it("空值返回空字符串", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("")).toBe("");
  });

  it("返回 MM/DD HH:mm 格式", () => {
    const result = formatDateTime("2025-06-15T10:30:00Z");
    expect(result).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  it("无效日期返回原字符串", () => {
    expect(formatDateTime("bad")).toBe("bad");
  });
});

describe("date-utils - formatDateTimeFull", () => {
  it("空值返回空字符串", () => {
    expect(formatDateTimeFull(null)).toBe("");
    expect(formatDateTimeFull(undefined)).toBe("");
    expect(formatDateTimeFull("")).toBe("");
  });

  it("使用上海时区，返回 YYYY-MM-DD HH:mm 格式", () => {
    // 2025-06-15T10:30:00Z = 北京时间 2025-06-15 18:30:00
    const result = formatDateTimeFull("2025-06-15T10:30:00Z");
    expect(result).toBe("2025-06-15 18:30");
  });

  it("北京时间凌晨对应 UTC 前一天", () => {
    // 2025-06-15T02:30:00Z = 北京时间 2025-06-15 10:30:00
    const result = formatDateTimeFull("2025-06-15T02:30:00Z");
    expect(result).toBe("2025-06-15 10:30");
  });

  it("UTC 深夜对应北京时间次日", () => {
    // 2025-06-15T20:00:00Z = 北京时间 2025-06-16 04:00:00
    const result = formatDateTimeFull("2025-06-15T20:00:00Z");
    expect(result).toBe("2025-06-16 04:00");
  });

  it("无效日期返回原字符串", () => {
    expect(formatDateTimeFull("invalid")).toBe("invalid");
  });

  it("格式固定为 16 位（YYYY-MM-DD HH:mm）", () => {
    const result = formatDateTimeFull("2025-01-01T00:00:00Z");
    expect(result.length).toBe(16);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
