import { describe, expect, it } from "vitest";
import { resolveCandidateMatchJobTitle } from "./candidate-match-job-title";

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
