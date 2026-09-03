import { describe, expect, it } from "vitest";
import {
  applicationListSortFromToolbar,
  applicationToolbarScoreSort,
  sortApplicationRows,
  toggleApplicationListSort,
  type ApplicationListSortRow,
} from "./application-list-sort";

function row(
  partial: Partial<ApplicationListSortRow> & Pick<ApplicationListSortRow, "id">
): ApplicationListSortRow {
  return {
    id: partial.id,
    status: partial.status ?? "new",
    created_at: partial.created_at ?? "2026-01-01T00:00:00.000Z",
    submitted_at: partial.submitted_at ?? partial.created_at ?? "2026-01-01T00:00:00.000Z",
    workflow_id: partial.workflow_id ?? "wf",
    applicant_profiles: partial.applicant_profiles ?? {
      first_name: partial.id,
      last_name: "Test",
      email: `${partial.id}@example.com`,
    },
    ...partial,
  };
}

describe("sortApplicationRows", () => {
  const rows = [
    row({
      id: "1",
      applicant_profiles: { first_name: "Charlie", last_name: "A", email: "c@x.com" },
      ai_match_score: 40,
      submitted_at: "2026-01-01T00:00:00.000Z",
      statusName: "New / Not Contacted",
    }),
    row({
      id: "2",
      applicant_profiles: { first_name: "Alice", last_name: "B", email: "a@x.com" },
      ai_match_score: 90,
      submitted_at: "2026-03-01T00:00:00.000Z",
      statusName: "Fit for Future Roles",
    }),
    row({
      id: "3",
      applicant_profiles: { first_name: "Bob", last_name: "C", email: "b@x.com" },
      ai_match_score: null,
      submitted_at: "2026-02-01T00:00:00.000Z",
      statusName: "Position Closed",
    }),
  ];

  it("sorts candidate names ascending", () => {
    const sorted = sortApplicationRows(rows, { column: "candidates", direction: "asc" });
    expect(sorted.map((item) => item.id)).toEqual(["2", "3", "1"]);
  });

  it("sorts match scores descending with nulls last", () => {
    const sorted = sortApplicationRows(rows, { column: "matches", direction: "desc" });
    expect(sorted.map((item) => item.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts progress status labels", () => {
    const sorted = sortApplicationRows(rows, { column: "status", direction: "asc" });
    expect(sorted.map((item) => item.id)).toEqual(["2", "1", "3"]);
  });
});

describe("toggleApplicationListSort", () => {
  it("defaults match score to descending", () => {
    expect(toggleApplicationListSort({ column: null, direction: "desc" }, "matches")).toEqual({
      column: "matches",
      direction: "desc",
    });
  });
});

describe("toolbar mapping", () => {
  it("maps score toolbar to matches column", () => {
    expect(applicationListSortFromToolbar("matchScoreAsc")).toEqual({
      column: "matches",
      direction: "asc",
    });
    expect(applicationToolbarScoreSort({ column: "matches", direction: "desc" })).toBe("high-low");
    expect(applicationToolbarScoreSort({ column: "candidates", direction: "asc" })).toBe("");
  });
});
