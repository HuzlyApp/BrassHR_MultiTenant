import { describe, expect, it } from "vitest";
import {
  buildSmartInsight,
  countWorkTypes,
  formatCandidateLocation,
  isActiveApplicant,
  pickBestMatch,
  resolveOverallApplicationStatus,
  summarizeApplicationStatuses,
  summarizeWorkTypes,
  type CandidateProfileApplication,
} from "./candidate-profile-view";

function app(
  overrides: Partial<CandidateProfileApplication> & Pick<CandidateProfileApplication, "id">
): CandidateProfileApplication {
  return {
    jobRequisitionId: "job-1",
    jobTitle: "Registered Nurse",
    companyName: "Oklahoma Medical Center",
    workType: "W2",
    appliedAt: "2026-07-20T12:00:00.000Z",
    status: "reviewing",
    statusName: "Under Review",
    statusColor: null,
    statusNote: null,
    matchScore: null,
    matchCategory: null,
    matchStatus: null,
    ...overrides,
  };
}

describe("candidate profile view", () => {
  it("formats a full street location", () => {
    expect(
      formatCandidateLocation({
        address1: "512 West Street",
        city: "San Francisco",
        state: "CA",
        zip: "94107",
      })
    ).toBe("512 West Street San Francisco, CA 94107");
  });

  it("counts W-2 and 1099 applications separately", () => {
    const counts = countWorkTypes([
      { workType: "W2" },
      { workType: "W2" },
      { workType: "1099" },
      { workType: "Contract" },
    ]);
    expect(counts).toEqual({ total: 4, w2: 2, contractor1099: 1, contract: 1 });
  });

  it("summarizes work types and statuses for charts", () => {
    const applications = [
      app({ id: "a1", workType: "W2", status: "reviewing", statusName: "Under Review" }),
      app({ id: "a2", workType: "1099", status: "interviewing", statusName: "HR Interview" }),
      app({ id: "a3", workType: "W2", status: "reviewing", statusName: "Under Review" }),
    ];
    const workTypes = summarizeWorkTypes(applications);
    expect(workTypes.map((slice) => slice.key)).toEqual(["W2", "1099"]);
    expect(workTypes.find((slice) => slice.key === "W2")?.color).toBe("#1D4ED8");
    expect(workTypes.find((slice) => slice.key === "1099")?.color).toBe("#7E22CE");
    expect(summarizeApplicationStatuses(applications).find((slice) => slice.key === "reviewing")?.count).toBe(2);
  });

  it("uses In Progress when the candidate has open applications", () => {
    expect(
      resolveOverallApplicationStatus([
        app({ id: "a1", status: "reviewing", statusName: "Under Review" }),
        app({ id: "a2", status: "hired", statusName: "Hired" }),
      ])
    ).toBe("In Progress");
  });

  it("marks converted workers as inactive applicants", () => {
    expect(isActiveApplicant("converted", [app({ id: "a1", status: "reviewing" })])).toBe(false);
    expect(isActiveApplicant("new", [app({ id: "a1", status: "reviewing" })])).toBe(true);
  });

  it("picks the strongest AI match and writes a dual-work-type insight", () => {
    const match = pickBestMatch([
      app({ id: "a1", matchScore: 72, matchCategory: "GOOD_MATCH" }),
      app({ id: "a2", matchScore: 97, matchCategory: "STRONG_MATCH", jobRequisitionId: "job-2" }),
    ]);
    expect(match).toEqual({
      applicationId: "a2",
      jobRequisitionId: "job-2",
      score: 97,
      category: "STRONG_MATCH",
      label: "Strong Match",
    });
    expect(
      buildSmartInsight({
        firstName: "Benjamin",
        workTypes: { total: 5, w2: 3, contractor1099: 2, contract: 0 },
        match,
      })
    ).toContain("both employee and contractor");
  });
});
