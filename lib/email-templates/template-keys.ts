/** DB `template_key` values for applicant onboarding notifications. */
export const ONBOARDING_EMAIL_TEMPLATE_KEYS = [
  "application_status",
  "resume_continuation",
  "approved",
  "welcome",
  "declined",
] as const;

export type OnboardingEmailTemplateKey = (typeof ONBOARDING_EMAIL_TEMPLATE_KEYS)[number];

/** Logical template types (map 1:1 to `template_key` in this app). */
export const EMAIL_TEMPLATE_TYPE = {
  APPLICATION_STATUS: "application_status",
  RESUME_CONTINUATION: "resume_continuation",
  APPROVED: "approved",
  WELCOME: "welcome",
  DECLINED: "declined",
} as const;

export type EmailTemplateType =
  (typeof EMAIL_TEMPLATE_TYPE)[keyof typeof EMAIL_TEMPLATE_TYPE];

export const EMAIL_TEMPLATE_TYPE_LABELS: Record<OnboardingEmailTemplateKey, string> = {
  application_status: "Application status link",
  resume_continuation: "Resume upload continuation",
  approved: "Applicant approved email",
  welcome: "Welcome email",
  declined: "Declined email",
};

export function isOnboardingEmailTemplateKey(key: string): key is OnboardingEmailTemplateKey {
  return (ONBOARDING_EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key);
}

/** Platform-level templates (global only; not tenant-customizable in admin UI). */
export const PLATFORM_EMAIL_TEMPLATE_KEYS = ["tenant_onboarding_continuation"] as const;

export type PlatformEmailTemplateKey = (typeof PLATFORM_EMAIL_TEMPLATE_KEYS)[number];

export const EMAIL_TEMPLATE_TYPE_PLATFORM = {
  TENANT_ONBOARDING_CONTINUATION: "tenant_onboarding_continuation",
} as const;

export type ManagedEmailTemplateKey = OnboardingEmailTemplateKey | PlatformEmailTemplateKey;

export function isManagedEmailTemplateKey(key: string): key is ManagedEmailTemplateKey {
  return (
    isOnboardingEmailTemplateKey(key) ||
    (PLATFORM_EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key)
  );
}
