import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

export const ONBOARDING_PREVIEW_STORAGE_KEY = "brasshr_onboarding_builder_preview";

export type OnboardingPreviewPayload = {
  tenantId: string;
  tenantSlug: string | null;
  config: TenantOnboardingConfig;
  expiresAt: number;
};

export function writeOnboardingPreview(payload: Omit<OnboardingPreviewPayload, "expiresAt">) {
  if (typeof window === "undefined") return;
  const full: OnboardingPreviewPayload = {
    ...payload,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
  localStorage.setItem(ONBOARDING_PREVIEW_STORAGE_KEY, JSON.stringify(full));
}

export function readOnboardingPreview(
  tenantSlug: string | null
): OnboardingPreviewPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingPreviewPayload;
    if (!parsed?.config || Date.now() > (parsed.expiresAt ?? 0)) {
      localStorage.removeItem(ONBOARDING_PREVIEW_STORAGE_KEY);
      return null;
    }
    if (tenantSlug && parsed.tenantSlug && parsed.tenantSlug !== tenantSlug) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOnboardingPreview() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ONBOARDING_PREVIEW_STORAGE_KEY);
}
