import { describe, expect, it } from "vitest";
import {
  candidateMatchesJobTitleFilter,
  getCandidateJobTitleOptions,
  resolveCandidateMatchJobTitle,
} from "./candidate-match-job-title";

describe("resolveCandidateMatchJobTitle", () => {
  it("prefers latest application job title", () => {
    expect(
      resolveCandidateMatchJobTitle({
        applicationJobTitle: "Mainframe Developer / Engineer - COBOL | CICS",
        applicationJobTitlesText: "Other Title",
      })
    ).toBe("Mainframe Developer / Engineer - COBOL | CICS");
  });

  it("falls back to first title from joined list", () => {
    expect(
      resolveCandidateMatchJobTitle({
        applicationJobTitle: null,
        applicationJobTitlesText: "Role A | Role B",
      })
    ).toBe("Role A");
  });
});

describe("getCandidateJobTitleOptions", () => {
  it("returns all distinct titles", () => {
    expect(
      getCandidateJobTitleOptions({
        applicationJobTitle: "Role A",
        applicationJobTitlesText: "Role A | Role B",
      })
    ).toEqual(["Role A", "Role B"]);
  });
});

describe("candidateMatchesJobTitleFilter", () => {
  it("matches when any applied title equals the filter", () => {
    expect(
      candidateMatchesJobTitleFilter(
        {
          applicationJobTitle: "Role A",
          applicationJobTitlesText: "Role A | Role B",
        },
        "Role B"
      )
    ).toBe(true);
  });
});
