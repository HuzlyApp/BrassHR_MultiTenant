import { describe, expect, it } from "vitest";
import type { CandidateRow } from "@/app/admin_recruiter/candidates/types";
import {
  buildCandidateStageOptions,
  candidateCurrentStageLabel,
  candidateMatchesStageFilter,
} from "./candidate-list-stage";

function row(partial: Partial<CandidateRow> & Pick<CandidateRow, "id">): CandidateRow {
  return {
    id: partial.id,
    name: partial.name ?? "",
    firstName: "",
    lastName: "",
    role: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    address1: "",
    address2: "",
    status: partial.status ?? "New",
    statusKey: partial.statusKey ?? partial.status ?? "new",
    createdAt: null,
    reference: partial.id,
    dateOfBirth: null,
    ...partial,
  };
}

describe("candidateCurrentStageLabel", () => {
  it("maps pipeline keys to stage labels", () => {
    expect(candidateCurrentStageLabel(row({ id: "1", statusKey: "interviewing" }))).toBe(
      "Interviewing"
    );
  });

  it("uses the tenant status name instead of Hired for the hired system key", () => {
    expect(
      candidateCurrentStageLabel(
        row({
          id: "1",
          progressStatusKey: "hired",
          progressStatusName: "Candidate selected",
        })
      )
    ).toBe("Candidate selected");
    expect(candidateCurrentStageLabel(row({ id: "2", statusKey: "hired" }))).toBe(
      "Selected by Client"
    );
  });
});

describe("candidateMatchesStageFilter", () => {
  it("matches by stage label", () => {
    const candidate = row({ id: "1", statusKey: "hired" });
    expect(candidateMatchesStageFilter(candidate, "Selected by Client")).toBe(true);
    expect(candidateMatchesStageFilter(candidate, "Hired")).toBe(false);
    expect(candidateMatchesStageFilter(candidate, "Reviewing")).toBe(false);
  });
});

describe("buildCandidateStageOptions", () => {
  it("returns unique sorted stage labels", () => {
    const options = buildCandidateStageOptions([
      row({ id: "1", statusKey: "hired" }),
      row({ id: "2", statusKey: "new" }),
      row({ id: "3", statusKey: "new" }),
    ]);
    expect(options).toEqual(["Reviewing", "Selected by Client"]);
  });
});
