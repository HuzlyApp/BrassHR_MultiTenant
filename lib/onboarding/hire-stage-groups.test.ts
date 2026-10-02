import { describe, expect, it } from "vitest";
import type { CandidateWorkflowStepView } from "@/lib/onboarding/candidate-workflow-phase-view";
import {
  groupStepsIntoHireStages,
  hireStageProgressMeta,
  isInterviewScheduleStep,
} from "@/lib/onboarding/hire-stage-groups";

function step(
  partial: Partial<CandidateWorkflowStepView> & Pick<CandidateWorkflowStepView, "id" | "title">
): CandidateWorkflowStepView {
  return {
    snapshotStepId: partial.snapshotStepId ?? partial.id,
    tenantStepId: null,
    stepKey: partial.stepKey ?? partial.title.toLowerCase().replace(/\s+/g, "-"),
    stepType: partial.stepType ?? "form",
    onboardingType: partial.onboardingType ?? "custom",
    phase: "pre_hire",
    required: true,
    status: "not_started",
    displayStatus: partial.displayStatus ?? "not_started",
    inspectable: true,
    unmatched: false,
    assignedAt: null,
    completedAt: partial.completedAt ?? null,
    ...partial,
  };
}

describe("groupStepsIntoHireStages", () => {
  it("groups Figma-like pre-hire steps and marks current/locked stages", () => {
    const groups = groupStepsIntoHireStages(
      [
        step({
          id: "1",
          title: "Collect Extra Files",
          stepKey: "extra-files",
          displayStatus: "completed",
          completedAt: "2026-07-20T00:00:00Z",
        }),
        step({
          id: "2",
          title: "Collect References",
          stepKey: "legacy-references",
          displayStatus: "completed",
          completedAt: "2026-07-20T00:00:00Z",
        }),
        step({
          id: "3",
          title: "Extra form",
          stepKey: "extra-form",
          displayStatus: "in_progress",
        }),
        step({
          id: "4",
          title: "Interview",
          stepKey: "interview",
          displayStatus: "in_progress",
        }),
        step({
          id: "5",
          title: "We want to hire",
          stepKey: "we-want-to-hire",
          displayStatus: "not_started",
        }),
        step({
          id: "6",
          title: "Background Check",
          stepKey: "background-check",
          displayStatus: "not_started",
        }),
      ],
      "pre_hire"
    );

    expect(groups.map((g) => g.name)).toEqual(["Screening", "Interview", "Compliance"]);
    expect(groups[0]?.status).toBe("current");
    expect(groups[1]?.status).toBe("locked");
    expect(groups[2]?.status).toBe("locked");
    expect(isInterviewScheduleStep(groups[1]!.steps[0]!)).toBe(true);

    const meta = hireStageProgressMeta(groups);
    expect(meta.percent).toBeGreaterThan(0);
    expect(meta.inProgress).toBe(2);
  });

  it("uses the library stage instead of keyword guesses", () => {
    const groups = groupStepsIntoHireStages(
      [
        step({
          id: "1",
          title: "Collect Extra Files",
          stepKey: "collect-extra-files",
          stepType: "collect-extra-files",
          displayStatus: "completed",
        }),
        step({
          id: "2",
          title: "Drug Test / Screening",
          stepKey: "drug-test-screening",
          stepType: "drug-test-screening",
          displayStatus: "not_started",
        }),
        step({
          id: "3",
          title: "Pay and Start Date",
          stepKey: "pay-rate-hire-date",
          stepType: "pay-rate-hire-date",
          displayStatus: "not_started",
        }),
        step({
          id: "4",
          title: "I-9 section 1",
          stepKey: "i9-right-to-work-verification",
          stepType: "i9-right-to-work-verification",
          displayStatus: "not_started",
        }),
      ],
      "pre_hire"
    );
    expect(groups.map((group) => group.name)).toEqual([
      "Intake",
      "Compliance",
      "Offer & Agreement",
    ]);
    expect(groups[0]?.status).toBe("completed");
    expect(groups[1]?.status).toBe("current");
    expect(groups[2]?.status).toBe("locked");
  });

  it("lets an explicit stageName override the library map", () => {
    const groups = groupStepsIntoHireStages(
      [
        step({
          id: "1",
          title: "Collect Extra Files",
          stepType: "collect-extra-files",
          settings: { stageName: "Screening" },
        }),
      ],
      "pre_hire"
    );
    expect(groups[0]?.name).toBe("Screening");
  });
});
