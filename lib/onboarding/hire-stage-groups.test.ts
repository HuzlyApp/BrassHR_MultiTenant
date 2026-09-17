import { describe, expect, it } from "vitest";
import type { CandidateWorkflowStepView } from "@/lib/onboarding/candidate-workflow-phase-view";
import {
  groupStepsIntoHireStages,
  hireStageProgressMeta,
  isInterviewScheduleStep,
  shouldShowInterviewScheduleAction,
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
  it("groups Figma W2 pre-hire steps into Intake → Interview → Compliance", () => {
    const groups = groupStepsIntoHireStages(
      [
        step({
          id: "1",
          title: "Collect Extra Files",
          stepKey: "collect-extra-files",
          displayStatus: "completed",
          completedAt: "2026-07-20T00:00:00Z",
        }),
        step({
          id: "2",
          title: "Collect References",
          stepKey: "references-collection",
          displayStatus: "completed",
          completedAt: "2026-07-20T00:00:00Z",
        }),
        step({
          id: "3",
          title: "Extra form",
          stepKey: "custom-form",
          displayStatus: "completed",
          completedAt: "2026-07-20T00:00:00Z",
        }),
        step({
          id: "4",
          title: "Interview/Qualification",
          stepKey: "interview-qualification",
          displayStatus: "in_progress",
        }),
        step({
          id: "5",
          title: "Internal Select",
          stepKey: "internal-select",
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

    expect(groups.map((g) => g.name)).toEqual(["Intake", "Interview", "Compliance"]);
    expect(groups[0]?.status).toBe("completed");
    expect(groups[1]?.status).toBe("current");
    expect(groups[2]?.status).toBe("locked");
    expect(isInterviewScheduleStep(groups[1]!.steps[0]!)).toBe(true);
    expect(isInterviewScheduleStep(groups[1]!.steps[1]!)).toBe(true);
    expect(shouldShowInterviewScheduleAction(groups[1]!, groups[1]!.steps[0]!)).toBe(true);
    expect(shouldShowInterviewScheduleAction(groups[2]!, groups[2]!.steps[0]!)).toBe(false);

    const meta = hireStageProgressMeta(groups);
    expect(meta.percent).toBeGreaterThan(0);
    expect(meta.inProgress).toBe(1);
  });

  it("puts SSN in Compliance and Submission/Interview stages in Figma order", () => {
    const groups = groupStepsIntoHireStages(
      [
        step({ id: "i1", title: "Resume & Basic Profile", stepKey: "resume-basic-profile" }),
        step({ id: "s1", title: "Skill Assessment", stepKey: "skill-qualification-assessment" }),
        step({ id: "iv1", title: "Interview / Qualification", stepKey: "interview-qualification" }),
        step({ id: "sub1", title: "Sent to Client / MSP", stepKey: "release-to-client" }),
        step({ id: "c1", title: "SSN / Identity Verification", stepKey: "ssn-identity-verification" }),
        step({ id: "o1", title: "Offer Acceptance", stepKey: "offer-acceptance" }),
        step({ id: "a1", title: "HR Final Approval", stepKey: "hr-final-approval" }),
      ],
      "pre_hire"
    );

    expect(groups.map((g) => g.name)).toEqual([
      "Intake",
      "Screening",
      "Interview",
      "Submission",
      "Compliance",
      "Offer & Agreement",
      "Approvals",
    ]);
    expect(groups.find((g) => g.name === "Compliance")?.steps.map((s) => s.title)).toEqual([
      "SSN / Identity Verification",
    ]);
  });

  it("groups post-hire steps into Figma Payroll / Access / Training / Welcome buckets", () => {
    const groups = groupStepsIntoHireStages(
      [
        step({
          id: "p1",
          title: "Direct Deposit Setup",
          stepKey: "direct-deposit-setup",
          phase: "post_hire",
          displayStatus: "completed",
        }),
        step({
          id: "p2",
          title: "Badge / Equipment Issuance",
          stepKey: "badge-equipment-issuance",
          phase: "post_hire",
          displayStatus: "in_progress",
        }),
        step({
          id: "p3",
          title: "Safety Training",
          stepKey: "safety-training",
          phase: "post_hire",
          displayStatus: "not_started",
        }),
        step({
          id: "p4",
          title: "Final Onboarding Call",
          stepKey: "final-onboarding-call",
          phase: "post_hire",
          displayStatus: "not_started",
        }),
      ],
      "post_hire"
    );

    expect(groups.map((g) => g.name)).toEqual([
      "Payroll & Tax",
      "Access & Systems",
      "Training & Policy",
      "Welcome & Complete",
    ]);
  });
});
