import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROUP_PRE_HIRE_STAGES,
  isAssignableCatalogGroupKey,
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
});
