import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeBulkMatchAnalysisOutcome,
  isMatchAnalyzedStatus,
  partitionMatchAnalysisTargets,
  postBulkMatchAnalysis,
} from "@/lib/admin/bulk-match-analysis";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("partitionMatchAnalysisTargets", () => {
  it("splits unanalyzed and analyzed application ids", () => {
    expect(
      partitionMatchAnalysisTargets([
        { applicationId: "a1", status: "NOT_ANALYZED" },
        { applicationId: "a2", status: "ANALYZED" },
        { applicationId: "a3", status: "FAILED" },
        { applicationId: null, status: "ANALYZED" },
      ])
    ).toEqual({
      analyzeIds: ["a1", "a3"],
      reanalyzeIds: ["a2"],
    });
  });

  it("dedupes application ids", () => {
    expect(
      partitionMatchAnalysisTargets([
        { applicationId: "a1", status: "ANALYZED" },
        { applicationId: "a1", status: "ANALYZED" },
      ])
    ).toEqual({ analyzeIds: [], reanalyzeIds: ["a1"] });
  });
});

describe("describeBulkMatchAnalysisOutcome", () => {
  it("reports a full success", () => {
    expect(describeBulkMatchAnalysisOutcome({ analyzed: 2, needsReview: 0, failed: 0 })).toEqual({
      ok: true,
      message: "Analyzed 2 candidates",
    });
  });

  it("reports mixed failures", () => {
    expect(describeBulkMatchAnalysisOutcome({ analyzed: 1, needsReview: 1, failed: 1 })).toEqual({
      ok: false,
      message: "1 analyzed · 1 need résumé text · 1 failed",
    });
  });
});

describe("isMatchAnalyzedStatus", () => {
  it("treats ANALYZED as already analyzed", () => {
    expect(isMatchAnalyzedStatus("ANALYZED")).toBe(true);
    expect(isMatchAnalyzedStatus("analyzed")).toBe(true);
    expect(isMatchAnalyzedStatus("FAILED")).toBe(false);
  });
});

describe("postBulkMatchAnalysis", () => {
  it("posts application ids and reports analyzed counts", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          { jobApplicationId: "a1", result: { status: "ANALYZED", score: 82 } },
          { jobApplicationId: "a2", result: { status: "NEEDS_REVIEW" } },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const chunks: unknown[] = [];
    const summary = await postBulkMatchAnalysis(["a1", "a2"], (chunk) => {
      chunks.push(chunk);
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ jobApplicationIds: ["a1", "a2"], analysisMode: "analyze" }),
    });
    expect(summary).toEqual({
      analyzed: 1,
      needsReview: 1,
      failed: 0,
      results: [
        { jobApplicationId: "a1", result: { status: "ANALYZED", score: 82 } },
        { jobApplicationId: "a2", result: { status: "NEEDS_REVIEW" } },
      ],
    });
    expect(chunks).toHaveLength(1);
  });
});
