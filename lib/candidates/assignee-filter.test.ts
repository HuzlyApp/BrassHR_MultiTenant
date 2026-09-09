import { describe, expect, it } from "vitest";
import {
  buildAssigneeFilterOptions,
  candidateMatchesAssigneeFilter,
  UNASSIGNED_ASSIGNEE_FILTER,
} from "@/lib/candidates/assignee-filter";

describe("candidateMatchesAssigneeFilter", () => {
  it("passes through when no assignee filter is set", () => {
    expect(candidateMatchesAssigneeFilter("user-1", "")).toBe(true);
    expect(candidateMatchesAssigneeFilter(null, "  ")).toBe(true);
  });

  it("matches a specific assignee id", () => {
    expect(candidateMatchesAssigneeFilter("user-1", "user-1")).toBe(true);
    expect(candidateMatchesAssigneeFilter("user-2", "user-1")).toBe(false);
  });

  it("matches unassigned rows", () => {
    expect(candidateMatchesAssigneeFilter(null, UNASSIGNED_ASSIGNEE_FILTER)).toBe(true);
    expect(candidateMatchesAssigneeFilter("", UNASSIGNED_ASSIGNEE_FILTER)).toBe(true);
    expect(candidateMatchesAssigneeFilter("user-1", UNASSIGNED_ASSIGNEE_FILTER)).toBe(false);
  });
});

describe("buildAssigneeFilterOptions", () => {
  it("dedupes by id and sorts by label", () => {
    expect(
      buildAssigneeFilterOptions([
        { id: "b", name: "Zoe" },
        { id: "a", name: "Alex" },
        { id: "b", name: "Zoe Recruiter" },
        { id: "  ", name: "Skip" },
      ])
    ).toEqual([
      { value: "a", label: "Alex" },
      { value: "b", label: "Zoe Recruiter" },
    ]);
  });
});
