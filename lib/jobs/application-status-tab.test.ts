import { describe, expect, it } from "vitest";
import { matchesApplicationStatusTab, isVisibleOnJobCandidatesAllTab } from "@/lib/jobs/application-status-tab";

const options = [
  { id: "s-new", name: "New / Not Contacted", systemKey: "new" },
  { id: "s-attempted", name: "Attempted Contact", systemKey: null },
  { id: "s-reviewing", name: "Reviewing", systemKey: "reviewing" },
  { id: "s-hired", name: "Onboarded", systemKey: "hired" },
];

describe("matchesApplicationStatusTab", () => {
  it("does not put a custom-status row into the system-key tab just because status is still new", () => {
    const attempted = {
      status: "new",
      status_id: "s-attempted",
    };
    expect(matchesApplicationStatusTab(attempted, "s-new", options)).toBe(false);
    expect(matchesApplicationStatusTab(attempted, "s-attempted", options)).toBe(true);
    expect(matchesApplicationStatusTab(attempted, "new", options)).toBe(false);
  });

  it("matches the selected status_id for the dashboard card", () => {
    const row = { status: "new", status_id: "s-new" };
    expect(matchesApplicationStatusTab(row, "s-new", options)).toBe(true);
    expect(matchesApplicationStatusTab(row, "s-reviewing", options)).toBe(false);
  });

  it("falls back to the legacy status column only when status_id is missing", () => {
    const row = { status: "hired", status_id: null };
    expect(matchesApplicationStatusTab(row, "s-hired", options)).toBe(true);
    expect(matchesApplicationStatusTab(row, "hired", options)).toBe(true);
    expect(matchesApplicationStatusTab(row, "s-new", options)).toBe(false);
  });

  it("keeps archived applications on the All tab", () => {
    const archived = {
      status: "archived",
      status_id: "s-archived",
      application_statuses: { id: "s-archived", system_key: "archived" as const },
    };
    const optionsWithArchived = [
      ...options,
      { id: "s-archived", name: "Position Closed", systemKey: "archived" },
    ];
    expect(matchesApplicationStatusTab(archived, "all", optionsWithArchived)).toBe(true);
    expect(matchesApplicationStatusTab(archived, "s-archived", optionsWithArchived)).toBe(true);
    expect(matchesApplicationStatusTab(archived, "s-new", optionsWithArchived)).toBe(false);
  });
});

describe("isVisibleOnJobCandidatesAllTab", () => {
  it("includes archived, rejected, and withdrawn on All", () => {
    expect(isVisibleOnJobCandidatesAllTab({ status: "new" })).toBe(true);
    expect(isVisibleOnJobCandidatesAllTab({ status: "rejected" })).toBe(true);
    expect(isVisibleOnJobCandidatesAllTab({ status: "withdrawn" })).toBe(true);
    expect(
      isVisibleOnJobCandidatesAllTab({
        status: "new",
        application_statuses: { system_key: "archived" },
      })
    ).toBe(true);
    expect(isVisibleOnJobCandidatesAllTab({})).toBe(true);
    expect(isVisibleOnJobCandidatesAllTab({ status: null })).toBe(true);
  });
});
