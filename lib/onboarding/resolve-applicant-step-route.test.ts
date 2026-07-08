import { describe, expect, it } from "vitest";
import { routeForApplicantStep, WORKFLOW_STEP_APPLICANT_ROUTE } from "@/lib/onboarding/resolve-applicant-step-route";
import { resolveApplicantStepFromPath } from "@/lib/onboarding/find-applicant-step";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

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

describe("resolve-applicant-step-route", () => {
  it("maps background check to authorizations documents", () => {
    expect(WORKFLOW_STEP_APPLICANT_ROUTE["background-check"]).toBe(
      "/application/authorizations-documents"
    );
    const route = routeForApplicantStep(
      step({
        step_key: "authorization_background_check",
        step_type: "custom_question",
        metadata: { workflow_step_id: "background-check" },
      })
    );
    expect(route).toContain("/application/authorizations-documents");
    expect(route).toContain("stepKey=authorization_background_check");
  });

  it("maps builder library steps to dedicated applicant routes", () => {
    expect(WORKFLOW_STEP_APPLICANT_ROUTE["welcome-packet-esign"]).toBe(
      "/application/authorizations-documents"
    );
    const route = routeForApplicantStep(
      step({
        step_key: "authorizations",
        step_type: "authorizations",
        metadata: { workflow_step_id: "welcome-packet-esign" },
      }),
      "acme"
    );
    expect(route).toContain("/application/authorizations-documents");
    expect(route).toContain("stepKey=authorizations");
    expect(route).toContain("tenant=acme");
  });

  it("resolves current step from stepKey query param", () => {
    const steps = [
      step({ step_key: "resume_upload", step_type: "resume_upload", sort_order: 10 }),
      step({
        step_key: "references",
        step_type: "references",
        sort_order: 20,
        metadata: { workflow_step_id: "references-collection" },
      }),
      step({ step_key: "review_submit", step_type: "review_submit", sort_order: 30 }),
    ];
    const current = resolveApplicantStepFromPath(
      "/application/add-references",
      "?stepKey=references&tenant=demo",
      steps
    );
    expect(current?.step_key).toBe("references");
  });

  it("resolves authorization_background_check from identity verification upload screen", () => {
    const steps = [
      step({
        step_key: "authorization_background_check",
        step_type: "custom_question",
        metadata: { workflow_step_id: "background-check" },
      }),
    ];
    const current = resolveApplicantStepFromPath(
      "/application/identity-verification",
      "?stepKey=authorization_background_check&tenant=zipstaff",
      steps
    );
    expect(current?.step_key).toBe("authorization_background_check");
  });

  it("resolves authorization_background_check from identity verification without stepKey", () => {
    const steps = [
      step({
        step_key: "authorization_background_check",
        step_type: "custom_question",
        metadata: { workflow_step_id: "background-check" },
      }),
    ];
    const current = resolveApplicantStepFromPath(
      "/application/identity-verification",
      "?tenant=zipstaff",
      steps
    );
    expect(current?.step_key).toBe("authorization_background_check");
  });
});
