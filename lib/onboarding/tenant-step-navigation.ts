import { createDefaultOnboardingStepDrafts } from "@/lib/onboarding/default-onboarding-steps";
import { routeForApplicantStep } from "@/lib/onboarding/resolve-applicant-step-route";
import { stepIndexFromPathname } from "@/lib/onboarding/step-index-from-pathname";
import {
  resolveApplicantStepFromPath,
} from "@/lib/onboarding/find-applicant-step";
import type {
  OnboardingStepType,
  TenantOnboardingConfig,
  TenantOnboardingStep,
  WorkerOnboardingProgressPayload,
} from "@/lib/onboarding/types";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import { filterApplicantVisibleSteps } from "@/lib/onboarding/filter-applicant-steps";
import { withTenant } from "@/lib/tenant/with-tenant";
import { isUploadResumeStep } from "@/lib/onboarding/enforce-upload-resume-first";

/** Enabled steps for applicants, ordered by tenant `sort_order`. */
export function getEnabledTenantSteps(
  config: TenantOnboardingConfig | null | undefined
): TenantOnboardingStep[] {
  if (!config?.steps?.length) return [];
  return filterApplicantVisibleSteps(config.steps).slice().sort((a, b) => a.sort_order - b.sort_order);
}

/** Platform default 1–6 flow when tenant config is unavailable (pre-seed / offline). */
export function getLegacyFallbackSteps(): TenantOnboardingStep[] {
  return createDefaultOnboardingStepDrafts()
    .filter((s) => s.is_enabled)
    .map((d) => ({
      id: `legacy-${d.step_key}`,
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

export function resolveApplicantEnabledSteps(
  config: TenantOnboardingConfig | null | undefined,
  loading: boolean
): TenantOnboardingStep[] | null {
  if (loading) return null;
  const fromTenant = getEnabledTenantSteps(config);
  if (fromTenant.length > 0) return fromTenant;
  if (config) return [];
  return getLegacyFallbackSteps();
}

export function findStepForPathname(
  pathname: string,
  enabledSteps: TenantOnboardingStep[],
  search?: string
): TenantOnboardingStep | null {
  const searchStr =
    search ??
    (typeof window !== "undefined" ? window.location.search : "");
  return resolveApplicantStepFromPath(pathname, searchStr, enabledSteps);
}

export function findStepByKeyOrType(
  config: TenantOnboardingConfig | null | undefined,
  opts: { stepKey?: string; stepType?: OnboardingStepType }
): TenantOnboardingStep | null {
  const enabled = getEnabledTenantSteps(config);
  if (!enabled.length) return null;
  if (opts.stepKey) {
    const byKey = enabled.find((s) => s.step_key === opts.stepKey);
    if (byKey) return byKey;
  }
  if (opts.stepType) {
    return enabled.find((s) => s.step_type === opts.stepType) ?? null;
  }
  return null;
}

export function adjacentStepRoute(
  config: TenantOnboardingConfig | null | undefined,
  current: TenantOnboardingStep | null,
  direction: 1 | -1,
  tenantSlug?: string | null
): string | null {
  const enabled = getEnabledTenantSteps(config);
  if (!enabled.length) {
    if (config) return null;
    const legacy = getLegacyFallbackSteps();
    if (!legacy.length) return null;
    if (!current) {
      const target = direction > 0 ? legacy[0] : null;
      return target ? routeForApplicantStep(target, tenantSlug) : null;
    }
    const idx = legacy.findIndex((s) => s.id === current.id || s.step_key === current.step_key);
    const next = legacy[idx + direction];
    return next ? routeForApplicantStep(next, tenantSlug) : null;
  }

  if (!current) {
    if (direction < 0) return null;
    const first = enabled[0];
    return routeForApplicantStep(first, tenantSlug);
  }

  const idx = enabled.findIndex((s) => s.id === current.id);
  const resolvedIdx = idx >= 0 ? idx : enabled.findIndex((s) => s.step_key === current.step_key);
  const next = enabled[resolvedIdx + direction];
  if (!next) return null;
  return routeForApplicantStep(next, tenantSlug);
}

export function firstOnboardingStepRoute(
  config: TenantOnboardingConfig | null | undefined,
  tenantSlug?: string | null
): string {
  return (
    adjacentStepRoute(config, null, 1, tenantSlug) ??
    withTenant(APPLICATION_ROUTES.addResume, tenantSlug)
  );
}

export function computeMaxAllowedStepIndex(
  config: TenantOnboardingConfig | null | undefined,
  progress: WorkerOnboardingProgressPayload | null,
  pathname?: string | null
): number {
  const enabled = getEnabledTenantSteps(config);
  const steps = enabled.length ? enabled : config ? [] : getLegacyFallbackSteps();
  if (!steps.length) return 1;

  if (typeof window !== "undefined") {
    const preview = new URLSearchParams(window.location.search).get("preview");
    if (preview === "draft") {
      const idx = stepIndexFromPathname(pathname ?? "", steps, window.location.search);
      return Math.max(idx, steps.length);
    }
  }

  const statusByStepId = new Map(
    (progress?.steps ?? []).map((p) => [p.onboarding_step_id, p.status])
  );

  let max = 1;
  if (progress?.steps?.length) {
    for (let i = 0; i < steps.length; i++) {
      const st = statusByStepId.get(steps[i].id);
      if (st === "completed" || st === "skipped") {
        if (st === "skipped" && isUploadResumeStep(steps[i])) {
          max = Math.max(max, i + 1);
          break;
        }
        max = Math.max(max, i + 2);
      } else if (st === "in_progress") {
        max = Math.max(max, i + 1);
        break;
      } else {
        max = Math.max(max, i + 1);
        break;
      }
    }
  }

  if (typeof window !== "undefined") {
    if (localStorage.getItem("step1ReviewCompleted") === "true") {
      const resumeIdx = steps.findIndex(
        (s) => s.step_type === "resume_upload" || s.step_key === "resume_upload"
      );
      if (resumeIdx >= 0) max = Math.max(max, resumeIdx + 2);
    }
    if (localStorage.getItem("step4Skipped") === "1") {
      const authIdx = steps.findIndex(
        (s) => s.step_type === "authorizations" || s.step_key === "authorizations"
      );
      if (authIdx >= 0) max = Math.max(max, authIdx + 2);
    }
  }

  if (pathname?.trim()) {
    max = Math.max(max, stepIndexFromPathname(pathname, steps));
  }

  return Math.min(max, steps.length);
}

export { stepIndexFromPathname };
