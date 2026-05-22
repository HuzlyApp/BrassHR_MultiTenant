/** DB `template_key` values for applicant onboarding notifications. */
export const ONBOARDING_EMAIL_TEMPLATE_KEYS = [
  "application_status",
  "welcome",
  "declined",
] as const;

export type OnboardingEmailTemplateKey = (typeof ONBOARDING_EMAIL_TEMPLATE_KEYS)[number];

/** Logical template types (map 1:1 to `template_key` in this app). */
export const EMAIL_TEMPLATE_TYPE = {
  APPLICATION_STATUS: "application_status",
  WELCOME: "welcome",
  DECLINED: "declined",
} as const;

export type EmailTemplateType =
  (typeof EMAIL_TEMPLATE_TYPE)[keyof typeof EMAIL_TEMPLATE_TYPE];

export const EMAIL_TEMPLATE_TYPE_LABELS: Record<OnboardingEmailTemplateKey, string> = {
  application_status: "Application status link",
  welcome: "Welcome email",
  declined: "Declined email",
};

export function isOnboardingEmailTemplateKey(key: string): key is OnboardingEmailTemplateKey {
  return (ONBOARDING_EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key);
}
