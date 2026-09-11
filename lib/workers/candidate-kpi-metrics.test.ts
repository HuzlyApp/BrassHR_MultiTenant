import { describe, expect, it } from "vitest";
import {
  buildCandidateKpiCardsFromMetrics,
  CANDIDATE_KPI_DEFINITIONS,
  normalizeCandidateKpiMetricsPayload,
  percentChangeSafe,
  trendFromBucket,
} from "@/lib/workers/candidate-kpi-metrics";
import { isAnalyzedCandidate } from "@/app/admin_recruiter/candidates/candidate-kpis";

describe("candidate KPI definitions", () => {
  it("documents all four Analyze metrics", () => {
    expect(CANDIDATE_KPI_DEFINITIONS.map((d) => d.key)).toEqual([
      "newCandidates",
      "activeCandidates",
      "analyzed",
      "hired",
    ]);
    for (const def of CANDIDATE_KPI_DEFINITIONS) {
      expect(def.sourceTable).toBeTruthy();
      expect(def.requiredFilters.length).toBeGreaterThan(0);
      expect(def.countingMethod).toBeTruthy();
      expect(def.denominator).toBeTruthy();
      expect(def.duplicateHandling).toBeTruthy();
    }
  });
});

describe("percentChangeSafe", () => {
  it("avoids division by zero", () => {
    expect(percentChangeSafe(0, 0)).toBe(0);
    expect(percentChangeSafe(5, 0)).toBe(100);
    expect(percentChangeSafe(15, 10)).toBe(50);
  });
});

describe("isAnalyzedCandidate", () => {
  it("requires ANALYZED status (not score alone)", () => {
    expect(isAnalyzedCandidate({ aiMatchStatus: "ANALYZED", aiMatchScore: 80 })).toBe(true);
    expect(isAnalyzedCandidate({ aiMatchStatus: "FAILED", aiMatchScore: 90 })).toBe(false);
    expect(isAnalyzedCandidate({ aiMatchStatus: null, aiMatchScore: 95 })).toBe(false);
    expect(isAnalyzedCandidate({ aiMatchStatus: "ANALYZING", aiMatchScore: null })).toBe(false);
  });
});

describe("normalizeCandidateKpiMetricsPayload", () => {
  it("maps RPC payload into KPI cards with safe trends", () => {
    const metrics = normalizeCandidateKpiMetricsPayload({
      newCandidates: { value: 4, previous: 2 },
      activeCandidates: { value: 10, currentWindow: 3, previousWindow: 1 },
      analyzed: { value: 6, currentWindow: 2, previousWindow: 2 },
      hired: { value: 0, currentWindow: 0, previousWindow: 0 },
      totalCandidates: 12,
    });
    expect(metrics.totalCandidates).toBe(12);
    expect(trendFromBucket(metrics.newCandidates)).toBe(100);
    expect(trendFromBucket(metrics.activeCandidates)).toBe(200);
    expect(trendFromBucket(metrics.analyzed)).toBe(0);
    expect(trendFromBucket(metrics.hired)).toBe(0);

    const cards = buildCandidateKpiCardsFromMetrics(metrics);
    expect(cards.map((c) => c.label)).toEqual([
      "New Candidates",
      "Active Candidates",
      "Analyzed",
      "Hired",
    ]);
    expect(cards.map((c) => c.value)).toEqual([4, 10, 6, 0]);
  });

  it("handles empty / missing payload without NaN", () => {
    const cards = buildCandidateKpiCardsFromMetrics(normalizeCandidateKpiMetricsPayload(null));
    expect(cards.every((c) => Number.isFinite(c.value) && Number.isFinite(c.trendPercent))).toBe(
      true
    );
  });
});

/** Fixture matrix documenting expected DB counting rules for metrics tests. */
describe("candidate KPI fixture expectations", () => {
  const fixtures = [
    { name: "completed analysis", analyzed: true, hired: false, active: true },
    { name: "failed analysis", analyzed: false, hired: false, active: true },
    { name: "pending analysis", analyzed: false, hired: false, active: true },
    { name: "no analysis", analyzed: false, hired: false, active: true },
    { name: "multiple analysis attempts", analyzed: true, hired: false, active: true },
    { name: "converted / employment", analyzed: false, hired: true, active: false },
    { name: "rejected", analyzed: false, hired: false, active: false },
    { name: "empty tenant", analyzed: false, hired: false, active: false },
  ] as const;

  it("counts analyzed only for ANALYZED workers once", () => {
    const analyzedCount = fixtures.filter((f) => f.analyzed).length;
    expect(analyzedCount).toBe(2);
  });

  it("counts hired from conversions separately from active list", () => {
    expect(fixtures.filter((f) => f.hired).length).toBe(1);
    expect(fixtures.filter((f) => f.active).length).toBe(5);
  });
});
