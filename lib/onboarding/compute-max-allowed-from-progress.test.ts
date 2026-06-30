import { describe, expect, it } from "vitest";
import { computeMaxAllowedStepIndexFromProgress } from "@/lib/onboarding/compute-max-allowed-from-progress";
import { createDefaultOnboardingStepDrafts } from "@/lib/onboarding/default-onboarding-steps";
import type { TenantOnboardingStep, WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";
import { resolveApplicantStepFromPath } from "@/lib/onboarding/find-applicant-step";

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

describe("resolveApplicantStepFromPath", () => {
  it("returns null for unknown routes instead of defaulting to the first step", () => {
    const steps = legacySteps();
    expect(resolveApplicantStepFromPath("/application/not-in-flow", "", steps)).toBeNull();
  });
});

describe("computeMaxAllowedStepIndexFromProgress", () => {
  it("allows profile review when resume step is completed in DB", () => {
    const steps = legacySteps();
    const progress: WorkerOnboardingProgressPayload = {
      progressId: "p1",
      status: "in_progress",
      steps: [
        {
          onboarding_step_id: steps[0]!.id,
          status: "completed",
          completed_at: new Date().toISOString(),
          data: {},
        },
      ],
    };

    expect(computeMaxAllowedStepIndexFromProgress(steps, progress)).toBe(2);
  });

  it("does not treat missing progress as fully unlocked", () => {
    const steps = legacySteps();
    expect(computeMaxAllowedStepIndexFromProgress(steps, null)).toBe(1);
  });

  it("includes later in_progress steps even when an earlier optional step is still pending", () => {
    const steps = legacySteps();
    const progress: WorkerOnboardingProgressPayload = {
      progressId: "p1",
      status: "in_progress",
      steps: [
        { onboarding_step_id: steps[0]!.id, status: "completed", completed_at: "2026-01-01", data: {} },
        { onboarding_step_id: steps[1]!.id, status: "completed", completed_at: "2026-01-01", data: {} },
        { onboarding_step_id: steps[2]!.id, status: "pending", completed_at: null, data: {} },
        { onboarding_step_id: steps[3]!.id, status: "in_progress", completed_at: null, data: {} },
      ],
    };

    expect(computeMaxAllowedStepIndexFromProgress(steps, progress)).toBe(4);
  });
});
