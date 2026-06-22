"use client";

import { useEffect } from "react";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import {
  dedicatedRouteForWorkflowStep,
  routeForApplicantStep,
} from "@/lib/onboarding/resolve-applicant-step-route";
import { useOnboardingTenant } from "@/lib/tenant/use-onboarding-tenant";

type Props = {
  step: TenantOnboardingStep;
  onStayOnCustomPage: () => void;
};

/**
 * When a workflow step maps to a dedicated applicant screen, redirect there with stepKey preserved.
 */
export default function ApplicantWorkflowStepRedirect({ step, onStayOnCustomPage }: Props) {
  const { replace } = useOnboardingTenant();

  useEffect(() => {
    const dedicated = dedicatedRouteForWorkflowStep(step);
    if (!dedicated) {
      onStayOnCustomPage();
      return;
    }

    const target = routeForApplicantStep(step);
    const customPath = APPLICATION_ROUTES.customStep(step.step_key).split("?")[0];
    if (dedicated === customPath) {
      onStayOnCustomPage();
      return;
    }

    replace(target);
  }, [step, replace, onStayOnCustomPage]);

  return null;
}
