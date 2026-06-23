import { describe, expect, it } from "vitest";
import { publishedWorkflow } from "@/lib/onboarding/applicant-workflow-fixtures";
import { publishedWorkflowToTenantConfig } from "@/lib/onboarding/applicant-workflow";
import {
  buildLegacyAddReferencesRedirectUrl,
  isReferencesWorkflowStep,
  mergeOnboardingQuery,
  resolveLegacyAddReferencesTarget,
} from "@/lib/onboarding/legacy-add-references-redirect";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

const publishedConfig = publishedWorkflowToTenantConfig(publishedWorkflow);

function referencesStep(stepKey: string): TenantOnboardingStep {
  return {
    id: `id-${stepKey}`,
    step_key: stepKey,
    title: "Reference Verification",
    description: null,
    step_type: "references",
    sort_order: 40,
    is_required: true,
    is_enabled: true,
    metadata: { workflow_step_id: "reference-verification" },
  };
}

describe("legacy add-references redirect", () => {
  it("redirects when references is not in the published workflow", () => {
    const target = resolveLegacyAddReferencesTarget(
      publishedConfig,
      publishedConfig.steps,
      "?stepKey=references_2&tenant=subdomaintest&preview=draft",
      "subdomaintest"
    );

    expect(target).not.toBeNull();
    expect(target).toContain("/application/skills-intro");
    expect(target).toContain("preview=draft");
    expect(target).toContain("tenant=subdomaintest");
    expect(target).not.toContain("add-references");
  });

  it("stays on references when the keyed step is a references workflow step", () => {
    const steps = [...publishedConfig.steps, referencesStep("references_2")];
    const config = { ...publishedConfig, steps };

    const target = resolveLegacyAddReferencesTarget(
      config,
      steps,
      "?stepKey=references_2&tenant=subdomaintest&preview=draft",
      "subdomaintest"
    );

    expect(target).toBeNull();
  });

  it("builds onboarding redirect URLs for legacy bookmarks", () => {
    const url = buildLegacyAddReferencesRedirectUrl(
      "http://localhost:3000",
      new URLSearchParams(
        "stepKey=references&tenant=subdomaintest&applicationId=app_123&preview=draft"
      )
    );

    expect(url).toContain("/application/onboarding");
    expect(url).toContain("applicationId=app_123");
    expect(url).toContain("preview=draft");
  });

  it("merges preview query params onto workflow routes", () => {
    expect(
      mergeOnboardingQuery(
        "/application/skills-intro?stepKey=skill_assessment&tenant=subdomaintest",
        "?preview=draft"
      )
    ).toBe(
      "/application/skills-intro?stepKey=skill_assessment&tenant=subdomaintest&preview=draft"
    );
  });
});

describe("isReferencesWorkflowStep", () => {
  it("detects references builder steps", () => {
    expect(isReferencesWorkflowStep(referencesStep("references_2"))).toBe(true);
  });

  it("does not treat skill assessment as references", () => {
    expect(isReferencesWorkflowStep(publishedConfig.steps[0])).toBe(false);
  });
});
