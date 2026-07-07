export const OWNER_TRIAL_PREPARATION_TTL_SECONDS = 4 * 60 * 60;

export type OwnerTrialPreparationPhase =
  | "preparing"
  | "email_sent"
  | "onboarding_complete";

export type OwnerTrialPreparationStatus = {
  phase: OwnerTrialPreparationPhase;
  emailSent: boolean;
  tenantOnboardingCompleted: boolean;
  continuationReason: string | null;
};
