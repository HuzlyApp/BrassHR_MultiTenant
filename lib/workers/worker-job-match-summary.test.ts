import { describe, expect, it } from "vitest";
import {
  pickWorkerJobMatchSummary,
  pickWorkerJobMatchSummaryPreferringRequirementCounts,
} from "./worker-job-match-summary";

describe("pickWorkerJobMatchSummary", () => {
  it("returns highest analyzed score across applications", () => {
    const summary = pickWorkerJobMatchSummary([
      {
        id: "app-a",
        worker_id: "w1",
        ai_match_status: "ANALYZED",
        ai_match_score: 72,
        ai_match_category: "GOOD_MATCH",
        ai_match_display_category: null,
        updated_at: "2026-01-10T00:00:00Z",
      },
      {
        id: "app-b",
        worker_id: "w1",
        ai_match_status: "ANALYZED",
        ai_match_score: 95,
        ai_match_category: "STRONG_MATCH",
        ai_match_display_category: null,
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    expect(summary?.applicationId).toBe("app-b");
    expect(summary?.score).toBe(95);
  });

  it("falls back to newest application when none are analyzed", () => {
    const summary = pickWorkerJobMatchSummary([
      {
        id: "app-old",
        worker_id: "w1",
        ai_match_status: null,
        ai_match_score: null,
        ai_match_category: null,
        ai_match_display_category: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "app-new",
        worker_id: "w1",
        ai_match_status: "NEEDS_REVIEW",
        ai_match_score: null,
        ai_match_category: null,
        ai_match_display_category: null,
        created_at: "2026-02-01T00:00:00Z",
      },
    ]);

    expect(summary?.applicationId).toBe("app-new");
    expect(summary?.status).toBe("NEEDS_REVIEW");
  });

  it("prefers analyzed apps that have requirement counts over higher score without counts", () => {
    const apps = [
      {
        id: "app-high-no-rows",
        worker_id: "w1",
        ai_match_status: "ANALYZED" as const,
        ai_match_score: 90,
        ai_match_category: "STRONG_MATCH",
        ai_match_display_category: null,
        updated_at: "2026-01-10T00:00:00Z",
      },
      {
        id: "app-with-rows",
        worker_id: "w1",
        ai_match_status: "ANALYZED" as const,
        ai_match_score: 70,
        ai_match_category: "GOOD_MATCH",
        ai_match_display_category: null,
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const counts = new Map([["app-with-rows", { confirmed: 5, verify: 2, notMet: 0 }]]);
    const summary = pickWorkerJobMatchSummaryPreferringRequirementCounts(apps, counts);
    expect(summary?.applicationId).toBe("app-with-rows");
    expect(summary?.score).toBe(70);
  });
});
