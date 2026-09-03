import { describe, expect, it } from "vitest";
import type { CandidateRow } from "@/app/admin_recruiter/candidates/types";
import {
  sortCandidateRows,
  toggleCandidateListSort,
} from "./candidate-list-sort";

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
    status: "New",
    createdAt: partial.createdAt ?? null,
    reference: partial.id,
    dateOfBirth: null,
    aiMatchScore: partial.aiMatchScore ?? null,
    ...partial,
  };
}

describe("sortCandidateRows", () => {
  const rows = [
    row({ id: "1", name: "Charlie", aiMatchScore: 40, createdAt: "2026-01-01T00:00:00.000Z" }),
    row({ id: "2", name: "Alice", aiMatchScore: 90, createdAt: "2026-03-01T00:00:00.000Z" }),
    row({ id: "3", name: "Bob", aiMatchScore: null, createdAt: "2026-02-01T00:00:00.000Z" }),
  ];

  it("sorts names ascending", () => {
    const sorted = sortCandidateRows(rows, { column: "name", direction: "asc" });
    expect(sorted.map((item) => item.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts match scores descending with nulls last", () => {
    const sorted = sortCandidateRows(rows, { column: "jobMatch", direction: "desc" });
    expect(sorted.map((item) => item.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts applied dates descending", () => {
    const sorted = sortCandidateRows(rows, { column: "createdDate", direction: "desc" });
    expect(sorted.map((item) => item.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts job titles and keeps empty values last", () => {
    const titled = [
      row({ id: "1", name: "Charlie", applicationJobTitle: "CNA" }),
      row({ id: "2", name: "Alice", applicationJobTitle: "RN" }),
      row({ id: "3", name: "Bob" }),
    ];
    const sorted = sortCandidateRows(titled, { column: "matchJob", direction: "asc" });
    expect(sorted.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("sorts progress status labels", () => {
    const statuses = [
      row({ id: "1", name: "Charlie", progressStatusName: "New / Not Contacted" }),
      row({ id: "2", name: "Alice", progressStatusName: "Fit for Future Roles" }),
      row({ id: "3", name: "Bob", progressStatusName: "Position Closed" }),
    ];
    const sorted = sortCandidateRows(statuses, { column: "progressStatus", direction: "asc" });
    expect(sorted.map((item) => item.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts confirmed counts descending with empty last", () => {
    const counts = [
      row({
        id: "1",
        name: "Charlie",
        aiMatchStatus: "ANALYZED",
        aiRequirementCounts: { confirmed: 1, verify: 4, notMet: 0 },
      }),
      row({
        id: "2",
        name: "Alice",
        aiMatchStatus: "ANALYZED",
        aiRequirementCounts: { confirmed: 3, verify: 2, notMet: 0 },
      }),
      row({ id: "3", name: "Bob" }),
    ];
    const sorted = sortCandidateRows(counts, { column: "conf", direction: "desc" });
    expect(sorted.map((item) => item.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts current stage labels", () => {
    const stages = [
      row({ id: "1", name: "Charlie", progressStatusKey: "hired" }),
      row({ id: "2", name: "Alice", progressStatusKey: "new" }),
      row({ id: "3", name: "Bob" }),
    ];
    const sorted = sortCandidateRows(stages, { column: "currentStage", direction: "asc" });
    expect(sorted.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("sorts evaluation analyzed first when descending", () => {
    const evaluations = [
      row({ id: "1", name: "Charlie", aiMatchStatus: "NOT_STARTED" }),
      row({ id: "2", name: "Alice", aiMatchStatus: "ANALYZED" }),
      row({ id: "3", name: "Bob" }),
    ];
    const sorted = sortCandidateRows(evaluations, { column: "evaluation", direction: "desc" });
    expect(sorted.map((item) => item.id)).toEqual(["2", "1", "3"]);
  });
});

describe("toggleCandidateListSort", () => {
  it("uses default direction when switching columns", () => {
    expect(toggleCandidateListSort({ column: null, direction: "desc" }, "name")).toEqual({
      column: "name",
      direction: "asc",
    });
    expect(toggleCandidateListSort({ column: null, direction: "desc" }, "jobMatch")).toEqual({
      column: "jobMatch",
      direction: "desc",
    });
  });

  it("toggles direction on repeated clicks", () => {
    const first = toggleCandidateListSort({ column: "name", direction: "asc" }, "name");
    expect(first).toEqual({ column: "name", direction: "desc" });
  });
});
