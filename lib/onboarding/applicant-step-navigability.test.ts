import { describe, expect, it } from "vitest";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import {
  applicantStepHasNavigableScreen,
  findNavigableStepIndex,
} from "@/lib/onboarding/applicant-step-navigability";
import { adjacentStepRoute } from "@/lib/onboarding/tenant-step-navigation";
import { resolveNextIncompleteStepIndex } from "@/lib/onboarding/compute-max-allowed-from-progress";
import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";

function step(partial: Partial<TenantOnboardingStep> & Pick<TenantOnboardingStep, "step_key" | "step_type">): TenantOnboardingStep {
  return {
    id: partial.id ?? `id-${partial.step_key}`,
    title: partial.title ?? partial.step_key,
    description: null,
    sort_order: partial.sort_order ?? 10,
    is_required: true,
    is_enabled: true,
    metadata: partial.metadata ?? {},
    ...partial,
  };
}

function jobWorkflowConfig(): TenantOnboardingConfig {
  const steps: TenantOnboardingStep[] = [
    step({
      id: "step-resume",
      step_key: "resume_upload",
      step_type: "resume_upload",
      sort_order: 10,
      metadata: { workflow_step_id: "resume-basic-profile" },
    }),
    step({
      id: "step-parameterized",
      step_key: "profile_information",
      step_type: "profile_information",
      sort_order: 20,
      title: "Parameterized Job Application",
      metadata: { workflow_step_id: "parameterized-job-application" },
    }),
    step({
      id: "step-references",
      step_key: "references",
      step_type: "references",
      sort_order: 30,
      metadata: { workflow_step_id: "references-collection" },
    }),
  ];

  return {
    configId: "cfg-test",
    tenantId: "tenant-test",
    version: 1,
    steps,
    requiredDocuments: [],
    skillAssessments: [],
  };
}

describe("applicant-step-navigability", () => {
  it("treats parameterized job application as non-navigable", () => {
    const config = jobWorkflowConfig();
    const parameterized = config.steps[1]!;
    expect(applicantStepHasNavigableScreen(parameterized, config.steps)).toBe(false);
  });

  it("finds references after resume when parameterized is in between", () => {
    const config = jobWorkflowConfig();
    const nextIdx = findNavigableStepIndex(config.steps, 0, 1);
    expect(nextIdx).toBe(2);
  });

  it("adjacentStepRoute skips parameterized job application", () => {
    const config = jobWorkflowConfig();
    const resume = config.steps[0]!;
    const route = adjacentStepRoute(config, resume, 1, "demo");
    expect(route).toContain(APPLICATION_ROUTES.addReferences);
    expect(route).not.toContain("stepKey=profile_information");
  });

  it("resolveNextIncompleteStepIndex skips non-navigable pending steps", () => {
    const config = jobWorkflowConfig();
    const progress = {
      progressId: "p1",
      status: "in_progress" as const,
      steps: [
        {
          onboarding_step_id: "step-resume",
          status: "completed" as const,
          completed_at: new Date().toISOString(),
          data: {},
        },
      ],
    };
    expect(resolveNextIncompleteStepIndex(config.steps, progress)).toBe(3);
  });
});
