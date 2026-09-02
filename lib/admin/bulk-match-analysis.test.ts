import { afterEach, describe, expect, it, vi } from "vitest"
import {
  bulkAnalyzeSelectedLabel,
  bulkReanalyzeSelectedLabel,
  describeBulkMatchAnalysisOutcome,
  isMatchAnalyzedStatus,
  partitionMatchAnalysisTargets,
  postBulkMatchAnalysis,
} from "@/lib/admin/bulk-match-analysis"
import { applyCandidateBulkMatchItem } from "@/app/admin_recruiter/candidates/run-bulk-match-analyze"
import type { CandidateRow } from "@/app/admin_recruiter/candidates/types"

afterEach(() => {
  vi.unstubAllGlobals()
})

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
    })
  })

  it("dedupes application ids", () => {
    expect(
      partitionMatchAnalysisTargets([
        { applicationId: "a1", status: "ANALYZED" },
        { applicationId: "a1", status: "ANALYZED" },
      ])
    ).toEqual({ analyzeIds: [], reanalyzeIds: ["a1"] })
  })
})

describe("bulk analyze labels", () => {
  it("uses singular labels for one candidate", () => {
    expect(bulkAnalyzeSelectedLabel(1)).toBe("Analyze")
    expect(bulkReanalyzeSelectedLabel(1)).toBe("Reanalyze")
  })

  it("uses selected labels for multiple candidates", () => {
    expect(bulkAnalyzeSelectedLabel(3)).toBe("Analyze selected")
    expect(bulkReanalyzeSelectedLabel(2)).toBe("Reanalyze selected")
  })
})

describe("describeBulkMatchAnalysisOutcome", () => {
  it("reports a full success", () => {
    expect(describeBulkMatchAnalysisOutcome({ analyzed: 2, needsReview: 0, failed: 0 })).toEqual({
      ok: true,
      message: "Analyzed 2 candidates",
    })
  })

  it("reports mixed failures", () => {
    expect(describeBulkMatchAnalysisOutcome({ analyzed: 1, needsReview: 1, failed: 1 })).toEqual({
      ok: false,
      message: "1 analyzed · 1 need résumé text · 1 failed",
    })
  })
})

describe("isMatchAnalyzedStatus", () => {
  it("treats ANALYZED as already analyzed", () => {
    expect(isMatchAnalyzedStatus("ANALYZED")).toBe(true)
    expect(isMatchAnalyzedStatus("analyzed")).toBe(true)
    expect(isMatchAnalyzedStatus("FAILED")).toBe(false)
  })
})

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
    }))
    vi.stubGlobal("fetch", fetchMock)

    const chunks: unknown[] = []
    const summary = await postBulkMatchAnalysis(["a1", "a2"], (chunk) => {
      chunks.push(chunk)
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(summary).toEqual({
      analyzed: 1,
      needsReview: 1,
      failed: 0,
      results: [
        { jobApplicationId: "a1", result: { status: "ANALYZED", score: 82 } },
        { jobApplicationId: "a2", result: { status: "NEEDS_REVIEW" } },
      ],
    })
    expect(chunks).toHaveLength(1)
  })
})

describe("applyCandidateBulkMatchItem", () => {
  const row: CandidateRow = {
    id: "w1",
    name: "Pat Kim",
    firstName: "Pat",
    lastName: "Kim",
    role: "RN",
    email: "pat@example.com",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    address1: "",
    address2: "",
    status: "new",
    createdAt: null,
    reference: "W1",
    dateOfBirth: null,
    matchApplicationId: "a1",
    aiMatchStatus: "ANALYZING",
  }

  it("updates match fields for the matching application", () => {
    expect(
      applyCandidateBulkMatchItem(row, {
        jobApplicationId: "a1",
        result: {
          status: "ANALYZED",
          score: 91,
          category: "strong",
          analysis: { candidate_match: { display_category: "Strong match" } },
        },
      })
    ).toMatchObject({
      aiMatchStatus: "ANALYZED",
      aiMatchScore: 91,
      aiMatchDisplayCategory: "Strong match",
    })
  })
})
