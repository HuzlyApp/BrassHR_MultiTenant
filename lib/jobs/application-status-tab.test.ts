import { describe, expect, it } from "vitest";
import { matchesApplicationStatusTab } from "@/lib/jobs/application-status-tab";

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
});
