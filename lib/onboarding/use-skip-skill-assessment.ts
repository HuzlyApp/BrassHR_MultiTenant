"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider";
import { skipOnboardingStep } from "@/lib/onboarding/skip-onboarding-step";
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav";

/** Skip the tenant-configured skill assessment step and advance to the next route. */
export function useSkipSkillAssessment() {
  const router = useRouter();
  const nav = useOnboardingStepNav();
  const onboarding = useOnboardingConfigOptional();
  const completingRef = useRef(false);

  const skillStep =
    nav.enabledSteps?.find(
      (s) => s.step_type === "skill_assessment" || s.step_key === "skill_assessment"
    ) ?? null;

  const skipSkillAssessment = () =>
    void skipOnboardingStep({
      step: skillStep,
      updateStepStatus: onboarding?.updateStepStatus,
      completingRef,
      onNavigate: () => {
        if (nav.nextRoute) router.push(nav.nextRoute);
      },
    });

  return { skipSkillAssessment };
}
