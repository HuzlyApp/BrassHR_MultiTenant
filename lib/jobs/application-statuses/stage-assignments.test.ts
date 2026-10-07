import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROUP_AI_MATCH_STAGES,
  DEFAULT_GROUP_PRE_HIRE_STAGES,
  isAssignableCatalogGroupKey,
  isAssignableStatusStageName,
  isPreHireStatusStageName,
} from "./stage-assignments";

describe("group → stage mapping", () => {
  it("allows one group on many Pre-Hire stages", () => {
    expect(DEFAULT_GROUP_PRE_HIRE_STAGES.interview).toEqual(["Screening", "Interview"]);
    expect(DEFAULT_GROUP_PRE_HIRE_STAGES.client).toEqual(["Submission", "Approvals"]);
    expect(DEFAULT_GROUP_PRE_HIRE_STAGES.hire).toEqual(["Offer & Agreement", "Approvals"]);
  });

  it("treats Closed as non-assignable shared group", () => {
    expect(isAssignableCatalogGroupKey("closed")).toBe(false);
    expect(isAssignableCatalogGroupKey("msp")).toBe(true);
    expect(isPreHireStatusStageName("Intake")).toBe(true);
    expect(isPreHireStatusStageName("Kickoff")).toBe(false);
  });

  it("assigns default groups to AI analysis steps 1–5", () => {
    expect(DEFAULT_GROUP_AI_MATCH_STAGES.start).toEqual(["Step 1 · Quick Match"]);
    expect(DEFAULT_GROUP_AI_MATCH_STAGES.interview).toEqual([
      "Step 2 · Verifications",
      "Step 3 · Follow-Up",
    ]);
    expect(DEFAULT_GROUP_AI_MATCH_STAGES.msp).toEqual(["Step 4 · Deep Match"]);
    expect(DEFAULT_GROUP_AI_MATCH_STAGES.client).toEqual(["Step 5 · Submission"]);
    expect(isAssignableStatusStageName("Step 5 · Submission")).toBe(true);
    expect(isPreHireStatusStageName("Step 5 · Submission")).toBe(false);
  });
});
