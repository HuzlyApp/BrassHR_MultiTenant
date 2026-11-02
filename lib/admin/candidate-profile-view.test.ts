import { describe, expect, it } from "vitest";
import {
  buildSmartInsight,
  countWorkTypes,
  formatCandidateLocation,
  formatProfileMatchStatusLabel,
  isActiveApplicant,
  pickBestMatch,
  resolveProfileApplicationMatchDisplay,
  pickProfessionalSummaryText,
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
    clientName: "Oklahoma Medical",
    facilityName: "Oklahoma Medical Center",
    workType: "W2",
    location: "Oklahoma City, OK",
    billRate: "$45/hr",
    agreedPayRate: "$40/hr",
    jobStatus: "open",
    appliedAt: "2026-07-20T12:00:00.000Z",
    status: "reviewing",
    statusName: "Under Review",
    statusColor: null,
    statusNote: null,
    matchScore: null,
    matchCategory: null,
    matchStatus: null,
    matchFitLabel: null,
    matchStage: null,
    matchDisplayCategory: null,
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

  it("uses the tenant hired status name instead of a generic Hired label", () => {
    expect(
      resolveOverallApplicationStatus([
        app({ id: "a1", status: "hired", statusName: "Candidate selected" }),
      ])
    ).toBe("Candidate selected");
  });

  it("marks converted workers as inactive applicants", () => {
    expect(isActiveApplicant("converted", [app({ id: "a1", status: "reviewing" })])).toBe(false);
    expect(isActiveApplicant("new", [app({ id: "a1", status: "reviewing" })])).toBe(true);
  });

  it("formats Figma match status labels from category or score", () => {
    expect(formatProfileMatchStatusLabel("STRONG_MATCH")).toBe("Strong");
    expect(formatProfileMatchStatusLabel("GOOD_MATCH")).toBe("Good");
    expect(formatProfileMatchStatusLabel(null, 95)).toBe("Strong");
    expect(formatProfileMatchStatusLabel(null, null)).toBe("—");
  });

  it("resolves Quick Match fit label when score columns are null", () => {
    const resolved = resolveProfileApplicationMatchDisplay({
      matchStatus: "ANALYZED",
      matchStage: "quick",
      matchScore: null,
      matchCategory: null,
      matchDisplayCategory: null,
      aiAnalysis: {
        quick_match: { quick_route: "LOW_MATCH" },
        candidate_match: {
          match_category: "NOT_A_MATCH",
          display_category: "Low match",
          recommended_overall_match_score: 0,
        },
      },
    });
    expect(resolved.statusLabel).toBe("Low");
    expect(resolved.score).toBeNull();
  });

  it("exposes Deep Match score for the Applications table", () => {
    const resolved = resolveProfileApplicationMatchDisplay({
      matchStatus: "ANALYZED",
      matchStage: "deep",
      matchScore: 91,
      matchCategory: "STRONG_MATCH",
      matchDisplayCategory: "Strong Match",
      aiAnalysis: {
        candidate_match: {
          match_category: "STRONG_MATCH",
          display_category: "Strong Match",
          recommended_overall_match_score: 91,
        },
      },
    });
    expect(resolved.statusLabel).toBe("Strong");
    expect(resolved.score).toBe(91);
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

  it("prefers the latest completed resume text for professional summary", () => {
    expect(
      pickProfessionalSummaryText([
        {
          uploaded_at: "2026-08-19T12:00:00.000Z",
          parse_status: "pending",
          extracted_text: "older pending text",
        },
        {
          uploaded_at: "2026-08-18T12:00:00.000Z",
          parse_status: "completed",
          extracted_text: "parsed summary",
        },
        {
          uploaded_at: "2026-08-17T12:00:00.000Z",
          parse_status: "completed",
          parsed_data: { text: "stale parsed" },
        },
      ])
    ).toBe("parsed summary");
  });
});
