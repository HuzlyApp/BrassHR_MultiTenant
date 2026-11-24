import { describe, expect, it } from "vitest";
import type { CandidateRow } from "./types";

/**
 * Mirrors candidates/page.tsx helpers for BUG-189 — keep in sync if those change.
 */
function resolveCandidateApplicationId(row: CandidateRow): string {
  return (row.progressStatusApplicationId ?? row.matchApplicationId ?? "").trim();
}

function resolveInterviewJobBinding(row: CandidateRow): {
  applicationId?: string;
  jobTitle?: string;
} {
  const applicationId = resolveCandidateApplicationId(row);
  if (!applicationId) return {};
  const fromAssignee = row.jobAssignees?.find(
    (entry) => entry.applicationId === applicationId
  )?.jobTitle?.trim();
  return {
    applicationId,
    jobTitle: fromAssignee || row.applicationJobTitle?.trim() || undefined,
  };
}

function baseRow(overrides: Partial<CandidateRow>): CandidateRow {
  return {
    id: "worker-1",
    name: "Test",
    firstName: "Test",
    lastName: "User",
    role: "RN",
    email: "t@example.com",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    address1: "",
    address2: "",
    status: "New",
    createdAt: null,
    reference: "ABC",
    dateOfBirth: null,
    ...overrides,
  };
}

describe("Schedule Interview job binding (BUG-189)", () => {
  it("prefers progress/status application over AI match application", () => {
    const row = baseRow({
      progressStatusApplicationId: "app-progress",
      matchApplicationId: "app-match",
      applicationJobTitle: "Progress Job Title",
      jobAssignees: [
        {
          applicationId: "app-progress",
          jobTitle: "Progress Job Title",
          assignedRecruiterUserId: null,
          assignedRecruiterName: null,
        },
      ],
    });
    expect(resolveCandidateApplicationId(row)).toBe("app-progress");
    expect(resolveInterviewJobBinding(row)).toEqual({
      applicationId: "app-progress",
      jobTitle: "Progress Job Title",
    });
  });

  it("falls back to match application when progress id is missing", () => {
    const row = baseRow({
      matchApplicationId: "app-match",
      applicationJobTitle: "Match Job",
    });
    expect(resolveInterviewJobBinding(row)).toEqual({
      applicationId: "app-match",
      jobTitle: "Match Job",
    });
  });
});
