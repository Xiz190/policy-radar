import { describe, expect, it } from "vitest";
import { assessSourceHealth, type HealthRun } from "@/lib/monitor/source-health";

const NOW = new Date("2026-11-04T00:00:00Z");

// 从最新往前，每 6 小时一轮；每轮给出 [状态, 扫描数]
function runsOf(history: Array<["success" | "error", number]>, errorMessage = "fetch failed"): HealthRun[] {
  return history.map(([status, scannedCount], i) => ({
    startedAt: new Date(NOW.getTime() - (i + 1) * 6 * 3_600_000).toISOString(),
    results: [
      {
        sourceId: "src_a",
        displayName: "来源A",
        status,
        scannedCount,
        errorMessage: status === "error" ? errorMessage : undefined,
      },
    ],
  }));
}

const ok = (n = 10): ["success", number] => ["success", n];
const zero: ["success", number] = ["success", 0];
const err: ["error", number] = ["error", 0];

describe("assessSourceHealth", () => {
  it("一切正常时没有问题", () => {
    expect(assessSourceHealth(runsOf([ok(), ok(), ok(), ok()]), NOW)).toEqual([]);
  });

  it("偶发出错不告警，连续 3 轮出错告警", () => {
    expect(assessSourceHealth(runsOf([err, ok(), err, err, ok()]), NOW)).toEqual([]);
    const [issue] = assessSourceHealth(runsOf([err, err, err, ok()], "HTTP 403"), NOW);
    expect(issue).toMatchObject({ level: "alert", sourceId: "src_a" });
    expect(issue.reason).toContain("连续 3 轮出错");
    expect(issue.reason).toContain("HTTP 403");
  });

  it("以前正常、之后连续扫描 0 超过 72 小时 → 告警（Suno 改版的情形）", () => {
    const history = [...Array(18).fill(zero), ok(), ok()];
    const [issue] = assessSourceHealth(runsOf(history), NOW);
    expect(issue.level).toBe("alert");
    expect(issue.reason).toContain("连续 18 轮扫描到 0 条");
  });

  it("扫描 0 还不到 72 小时不告警", () => {
    // 4 轮 × 6 小时 = 最早一轮在 24 小时前
    expect(assessSourceHealth(runsOf([zero, zero, zero, zero, ok()]), NOW)).toEqual([]);
  });

  it("出错轮次夹在扫描 0 中间，不打断连续段", () => {
    const history = [zero, err, ...Array(12).fill(zero), err, ok()];
    const [issue] = assessSourceHealth(runsOf(history), NOW);
    expect(issue.level).toBe("alert");
    expect(issue.reason).toContain("连续 13 轮");
  });

  it("记录里从没扫到过 → 只是警告，不告警", () => {
    const [issue] = assessSourceHealth(runsOf([...Array(20).fill(zero), err]), NOW);
    expect(issue.level).toBe("warning");
  });

  it("只检查最新一轮里仍在抓的来源", () => {
    const runs = runsOf([ok(), ...Array(20).fill(err)]);
    runs[0].results = [{ sourceId: "src_b", displayName: "来源B", status: "success", scannedCount: 5 }];
    expect(assessSourceHealth(runs, NOW)).toEqual([]);
  });

  it("没有任何运行记录时不报错", () => {
    expect(assessSourceHealth([], NOW)).toEqual([]);
  });
});
