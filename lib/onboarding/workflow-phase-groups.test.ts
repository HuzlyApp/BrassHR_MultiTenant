import { describe, expect, it } from "vitest";
import {
  countsForPhase,
  formatPhaseProgressShort,
  groupStepsByLifecyclePhase,
  resolveEmploymentJourneyStage,
} from "@/lib/onboarding/workflow-phase-groups";

describe("workflow phase groups", () => {
  it("keeps independent Pre-Hire and Post-Hire counts", () => {
    const pre = countsForPhase(8, 5, "pre_hire");
    const post = countsForPhase(12, 0, "post_hire");
    expect(pre.label).toBe("5 / 8 Pre-Hire completed");
    expect(post.label).toBe("0 / 12 Post-Hire completed");
    expect(formatPhaseProgressShort(5, 20, "pre_hire")).not.toContain("/ 20 Post");
  });

  it("groups steps by explicit phase, not title", () => {
    const grouped = groupStepsByLifecyclePhase(
      [
        { title: "I-9", phase: "post_hire" as const },
        { title: "Resume", phase: "pre_hire" as const },
      ],
      (step) => step.phase
    );
    expect(grouped.preHire.map((step) => step.title)).toEqual(["Resume"]);
    expect(grouped.postHire.map((step) => step.title)).toEqual(["I-9"]);
  });

  it("resolves employment journey from hired status, not last Pre-Hire step", () => {
    expect(
      resolveEmploymentJourneyStage({
        isHired: false,
        workflowPhase: "pre_hire",
        hasPreHireWorkflow: true,
        hasPostHireWorkflow: true,
        postHireUnlocked: false,
        onboarded: false,
      })
    ).toBe("pre_hire");
    expect(
      resolveEmploymentJourneyStage({
        isHired: true,
        workflowPhase: "post_hire",
        hasPreHireWorkflow: true,
        hasPostHireWorkflow: true,
        postHireUnlocked: true,
        onboarded: false,
      })
    ).toBe("post_hire");
  });
});
