import { describe, expect, it } from "vitest";
import { createDefaultOnboardingStepDrafts } from "@/lib/onboarding/default-onboarding-steps";
import {
  computeFarthestReachedIndexFromSteps,
  nextFarthestReachedIndex,
  resolveApplicantNavBoundaries,
} from "@/lib/onboarding/farthest-reached-step";
import { computeMaxAllowedStepIndexFromProgress } from "@/lib/onboarding/compute-max-allowed-from-progress";
import type { TenantOnboardingStep, WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";

function legacySteps(): TenantOnboardingStep[] {
  return createDefaultOnboardingStepDrafts().map((d) => ({
    id: `step-${d.step_key}`,
    step_key: d.step_key,
    title: d.title,
    description: d.description,
    step_type: d.step_type,
    sort_order: d.sort_order,
    is_required: d.is_required,
    is_enabled: d.is_enabled,
    metadata: d.metadata,
  }));
}

describe("farthest reached step", () => {
  it("extends farthest when a step is skipped", () => {
    const steps = legacySteps();
    const skillStep = steps.find((s) => s.step_key === "skill_assessment")!;
    const next = nextFarthestReachedIndex(steps, skillStep.id, "skipped", 2);
    expect(next).toBeGreaterThan(2);
  });

  it("uses persisted farthest when higher than derived progress", () => {
    const steps = legacySteps();
    const summaryIndex = steps.findIndex((s) => s.step_key === "review_submit") + 1;
    const progress: WorkerOnboardingProgressPayload = {
      progressId: "p1",
      status: "in_progress",
      farthestReachedStepIndex: summaryIndex,
      steps: [
        {
          onboarding_step_id: steps[0]!.id,
          status: "completed",
          completed_at: "2026-01-01",
          data: {},
        },
      ],
    };

    const { farthestReachedIndex } = resolveApplicantNavBoundaries(
      steps,
      progress,
      computeMaxAllowedStepIndexFromProgress(steps, progress)
    );

    expect(farthestReachedIndex).toBe(summaryIndex);
  });

  it("derives farthest from visited step rows", () => {
    const steps = legacySteps();
    const progress: WorkerOnboardingProgressPayload = {
      progressId: "p1",
      status: "in_progress",
      steps: [
        { onboarding_step_id: steps[0]!.id, status: "completed", completed_at: "2026-01-01", data: {} },
        { onboarding_step_id: steps[1]!.id, status: "skipped", completed_at: null, data: {} },
      ],
    };

    expect(computeFarthestReachedIndexFromSteps(steps, progress)).toBeGreaterThanOrEqual(3);
  });
});
