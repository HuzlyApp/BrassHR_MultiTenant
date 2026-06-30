import { describe, expect, it } from "vitest";
import {
  computeIncompleteStepKeys,
  stepTitlesForKeys,
} from "@/lib/onboarding/compute-incomplete-step-keys";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

function step(
  overrides: Partial<TenantOnboardingStep> & Pick<TenantOnboardingStep, "id" | "step_key" | "step_type">
): TenantOnboardingStep {
  return {
    title: overrides.step_key,
    description: null,
    sort_order: 0,
    is_required: true,
    is_enabled: true,
    metadata: {},
    ...overrides,
  };
}

describe("computeIncompleteStepKeys", () => {
  const enabledSteps: TenantOnboardingStep[] = [
    step({ id: "s1", step_key: "resume_upload", step_type: "resume_upload" }),
    step({ id: "s2", step_key: "professional_license", step_type: "professional_license" }),
    step({ id: "s3", step_key: "skill_assessment", step_type: "skill_assessment" }),
    step({ id: "s4", step_key: "references", step_type: "references" }),
    step({ id: "s5", step_key: "review_submit", step_type: "review_submit" }),
  ];

  it("returns keys for steps that are not completed or skipped", () => {
    const keys = computeIncompleteStepKeys(enabledSteps, [
      { onboarding_step_id: "s1", status: "completed", completed_at: null, data: {} },
      { onboarding_step_id: "s2", status: "pending", completed_at: null, data: {} },
      { onboarding_step_id: "s3", status: "in_progress", completed_at: null, data: {} },
      { onboarding_step_id: "s4", status: "skipped", completed_at: null, data: {} },
    ]);
    expect(keys).toEqual(["professional_license", "skill_assessment"]);
  });

  it("excludes review_submit from incomplete keys", () => {
    const keys = computeIncompleteStepKeys(enabledSteps, []);
    expect(keys).not.toContain("review_submit");
    expect(keys).toHaveLength(4);
  });

  it("maps step keys to titles", () => {
    const labels = stepTitlesForKeys(enabledSteps, ["skill_assessment", "missing_key"]);
    expect(labels).toEqual(["skill_assessment", "missing_key"]);
  });
});
