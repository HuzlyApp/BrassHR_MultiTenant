import { describe, expect, it } from "vitest";
import {
  mapAssignedStepsToDynamicProgress,
  stateFromWorkflowDisplayStatus,
} from "@/lib/onboarding/map-dynamic-admin-progress";

describe("stateFromWorkflowDisplayStatus", () => {
  it("treats board-complete statuses as complete", () => {
    expect(stateFromWorkflowDisplayStatus("completed")).toBe("complete");
    expect(stateFromWorkflowDisplayStatus("approved")).toBe("complete");
    expect(stateFromWorkflowDisplayStatus("submitted")).toBe("complete");
    expect(stateFromWorkflowDisplayStatus("skipped")).toBe("complete");
    expect(stateFromWorkflowDisplayStatus("not_applicable")).toBe("complete");
  });

  it("treats active work as in_progress", () => {
    expect(stateFromWorkflowDisplayStatus("in_progress")).toBe("in_progress");
    expect(stateFromWorkflowDisplayStatus("under_review")).toBe("in_progress");
    expect(stateFromWorkflowDisplayStatus("needs_revision")).toBe("in_progress");
  });

  it("treats not started / blocked as pending", () => {
    expect(stateFromWorkflowDisplayStatus("not_started")).toBe("pending");
    expect(stateFromWorkflowDisplayStatus("rejected")).toBe("pending");
    expect(stateFromWorkflowDisplayStatus("blocked")).toBe("pending");
  });
});

describe("mapAssignedStepsToDynamicProgress", () => {
  it("mirrors hire-stage step counting for percent and totals", () => {
    const result = mapAssignedStepsToDynamicProgress([
      {
        id: "1",
        stepKey: "resume",
        title: "Resume",
        phase: "pre_hire",
        displayStatus: "completed",
      },
      {
        id: "2",
        stepKey: "interview",
        title: "Interview",
        phase: "pre_hire",
        displayStatus: "in_progress",
      },
      {
        id: "3",
        stepKey: "offer",
        title: "Offer",
        phase: "pre_hire",
        displayStatus: "not_started",
      },
      {
        id: "4",
        stepKey: "docs",
        title: "Docs",
        phase: "pre_hire",
        displayStatus: "submitted",
      },
    ]);

    expect(result.totalSteps).toBe(4);
    expect(result.completedSteps).toBe(2);
    expect(result.completionPercent).toBe(50);
    expect(result.steps.map((s) => s.state)).toEqual([
      "complete",
      "in_progress",
      "pending",
      "complete",
    ]);
  });

  it("returns zeros for an empty assignment", () => {
    expect(mapAssignedStepsToDynamicProgress([])).toEqual({
      steps: [],
      configVersion: 0,
      completedSteps: 0,
      totalSteps: 0,
      completionPercent: 0,
    });
  });
});
