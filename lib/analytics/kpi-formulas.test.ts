import { describe, expect, it } from "vitest";
import {
  engagementRatio,
  formatMetricDisplay,
  jobCoverage,
  mergeEngagedSeconds,
  offerAcceptanceRate,
  periodOverPeriodChange,
  safeRatio,
  targetAttainment,
  taskCompletionRate,
  weightedKpiScore,
} from "@/lib/analytics/kpi-formulas";

describe("kpi-formulas", () => {
  it("returns N/A for zero denominators", () => {
    const ratio = safeRatio(5, 0);
    expect(ratio.value).toBeNull();
    expect(ratio.availability).toBe("zero_denominator");
    expect(formatMetricDisplay(ratio.value, ratio.availability)).toBe("N/A");
  });

  it("does not treat missing data as zero", () => {
    const ratio = taskCompletionRate(null, null);
    expect(ratio.value).toBeNull();
    expect(ratio.availability).toBe("missing");
  });

  it("computes engagement ratio", () => {
    const ratio = engagementRatio(30, 60);
    expect(ratio.value).toBe(50);
    expect(ratio.availability).toBe("available");
  });

  it("computes job coverage from distinct jobs", () => {
    const coverage = jobCoverage(3, 6);
    expect(coverage.value).toBe(50);
  });

  it("computes offer acceptance with cohort denominator", () => {
    expect(offerAcceptanceRate(8, 10).value).toBe(80);
  });

  it("returns N/A period change when previous is zero", () => {
    const change = periodOverPeriodChange(5, 0);
    expect(change.changePct).toBeNull();
    expect(change.direction).toBe("na");
  });

  it("handles higher-is-better target attainment", () => {
    expect(targetAttainment(80, 100).attainmentPct).toBe(80);
  });

  it("handles lower-is-better zero safely", () => {
    expect(targetAttainment(0, 0, "lower_is_better").attainmentPct).toBe(100);
    expect(targetAttainment(0, 5, "lower_is_better").attainmentPct).toBeNull();
  });

  it("merges overlapping engaged intervals without double-counting", () => {
    const seconds = mergeEngagedSeconds([
      { startedAt: 0, endedAt: 10_000 },
      { startedAt: 5_000, endedAt: 15_000 },
      { startedAt: 20_000, endedAt: 25_000 },
    ]);
    expect(seconds).toBe(20);
  });

  it("computes weighted score with proportional redistribution", () => {
    const result = weightedKpiScore(
      [
        { key: "a", weight: 0.5, attainmentPct: 100, available: true },
        { key: "b", weight: 0.5, attainmentPct: null, available: false },
      ],
      "proportional",
    );
    expect(result.score).toBe(100);
    expect(result.redistributed).toBe(true);
  });

  it("excludes score when policy requires all components", () => {
    const result = weightedKpiScore(
      [
        { key: "a", weight: 0.5, attainmentPct: 100, available: true },
        { key: "b", weight: 0.5, attainmentPct: null, available: false },
      ],
      "exclude_score",
    );
    expect(result.score).toBeNull();
  });
});
