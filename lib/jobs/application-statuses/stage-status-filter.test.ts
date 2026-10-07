import { describe, expect, it } from "vitest";
import { aiMatchStatusStageName, isAssignableStatusStageName } from "./stage-assignments";
import { filterStatusesForAssignedGroups } from "./stage-status-filter";

describe("AI analysis status stages", () => {
  it("maps progression steps onto settings stage names", () => {
    expect(aiMatchStatusStageName("quick")).toBe("Step 1 · Quick Match");
    expect(aiMatchStatusStageName("submission")).toBe("Step 5 · Submission");
    expect(aiMatchStatusStageName("unknown")).toBeNull();
  });

  it("keeps AI step 5 distinct from the Pre-Hire Submission stage", () => {
    expect(isAssignableStatusStageName("Submission")).toBe(true);
    expect(isAssignableStatusStageName("Step 5 · Submission")).toBe(true);
    expect(isAssignableStatusStageName("Kickoff")).toBe(false);
  });
});

describe("filterStatusesForAssignedGroups", () => {
  const statuses = [
    { id: "start", name: "New / Applied", groupId: "g-start", groupSystemKey: "start" },
    { id: "interview", name: "Qualified", groupId: "g-interview", groupSystemKey: "interview" },
    { id: "closed", name: "Not a Fit", groupId: "g-closed", groupSystemKey: "closed" },
    { id: "current", name: "Selected", groupId: "g-hire", groupSystemKey: "hire" },
  ];

  it("keeps assigned groups, Closed, and the current status", () => {
    const visible = filterStatusesForAssignedGroups(statuses, ["g-start"], "current").map(
      (status) => status.id
    );
    expect(visible).toEqual(["start", "closed", "current"]);
  });
});
