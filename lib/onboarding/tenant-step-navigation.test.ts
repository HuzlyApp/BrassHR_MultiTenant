import { describe, expect, it } from "vitest";
import { resolveApplicantEnabledSteps } from "@/lib/onboarding/tenant-step-navigation";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";
import { publishedWorkflow } from "@/lib/onboarding/applicant-workflow-fixtures";
import { publishedWorkflowToTenantConfig } from "@/lib/onboarding/applicant-workflow";

const publishedConfig = publishedWorkflowToTenantConfig(publishedWorkflow);

describe("resolveApplicantEnabledSteps", () => {
  it("uses published tenant steps instead of legacy fallback when config is loaded", () => {
    const steps = resolveApplicantEnabledSteps(publishedConfig, false);

    expect(steps?.map((s) => s.title)).toEqual([
      "Skill / Qualification Assessment",
      "Document Upload",
      "Background Check",
    ]);
    expect(steps?.map((s) => s.title)).not.toContain("Add References");
    expect(steps?.map((s) => s.title)).not.toContain("Add Resume");
  });

  it("returns empty array for published config with no visible steps instead of legacy fallback", () => {
    const emptyConfig: TenantOnboardingConfig = {
      ...publishedConfig,
      steps: [],
    };

    const steps = resolveApplicantEnabledSteps(emptyConfig, false);

    expect(steps).toEqual([]);
  });

  it("returns null while loading", () => {
    expect(resolveApplicantEnabledSteps(publishedConfig, true)).toBeNull();
  });

  it("falls back to legacy steps only when config is unavailable", () => {
    const steps = resolveApplicantEnabledSteps(null, false);

    expect(steps?.map((s) => s.title)).toContain("Add References");
    expect(steps?.map((s) => s.title)).toContain("Add Resume");
  });
});
