"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider";
import {
  adjacentStepRoute,
  computeMaxAllowedStepIndex,
  findStepForPathname,
  firstOnboardingStepRoute,
  resolveApplicantEnabledSteps,
  stepIndexFromPathname,
} from "@/lib/onboarding/tenant-step-navigation";
import { useOnboardingTenant } from "@/lib/tenant/use-onboarding-tenant";

/** Tenant-ordered onboarding navigation for applicant pages. */
export function useOnboardingStepNav() {
  const pathname = usePathname() ?? "";
  const { slug, push, replace, path } = useOnboardingTenant();
  const onboarding = useOnboardingConfigOptional();

  const enabledSteps = useMemo(
    () => resolveApplicantEnabledSteps(onboarding?.config, onboarding?.loading ?? true),
    [onboarding?.config, onboarding?.loading]
  );

  const currentIndex = useMemo(() => {
    if (!enabledSteps?.length) return 1;
    return stepIndexFromPathname(pathname, enabledSteps);
  }, [pathname, enabledSteps]);

  const currentStep = useMemo(() => {
    if (!enabledSteps?.length) return null;
    return findStepForPathname(pathname, enabledSteps);
  }, [pathname, enabledSteps]);

  const maxAllowedStepIndex = useMemo(
    () =>
      computeMaxAllowedStepIndex(onboarding?.config ?? null, onboarding?.progress ?? null, pathname),
    [onboarding?.config, onboarding?.progress, pathname]
  );

  const completedThrough = Math.max(0, maxAllowedStepIndex - 1);

  const nextRoute = useMemo(
    () => adjacentStepRoute(onboarding?.config, currentStep, 1, slug),
    [onboarding?.config, currentStep, slug]
  );

  const prevRoute = useMemo(
    () => adjacentStepRoute(onboarding?.config, currentStep, -1, slug),
    [onboarding?.config, currentStep, slug]
  );

  const firstRoute = useMemo(
    () => firstOnboardingStepRoute(onboarding?.config, slug),
    [onboarding?.config, slug]
  );

  return {
    slug,
    path,
    push,
    replace,
    enabledSteps,
    currentIndex,
    currentStep,
    maxAllowedStepIndex,
    completedThrough,
    nextRoute,
    prevRoute,
    firstRoute,
    goNext: () => {
      if (nextRoute) push(nextRoute);
    },
    goPrev: () => {
      if (prevRoute) push(prevRoute);
    },
    configLoading: onboarding?.loading ?? true,
    config: onboarding?.config ?? null,
    updateStepStatus: onboarding?.updateStepStatus,
  };
}
