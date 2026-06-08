import type { User } from "@supabase/supabase-js";
import type { AccountChecklist, AccountOrganization, AccountProfile, AccountSettings } from "./types";

export function isProfileComplete(profile: AccountProfile | null | undefined): boolean {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}

export function isBusinessInfoComplete(organization: AccountOrganization | null | undefined): boolean {
  return Boolean(organization?.name?.trim());
}

export function isAccountSettingsComplete(settings: AccountSettings | null | undefined): boolean {
  return Boolean(settings?.user_id);
}

export function isEmailVerified(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at ?? (user as User & { confirmed_at?: string }).confirmed_at);
}

export function isOrganizationCreated(
  profile: AccountProfile | null | undefined,
  organization: AccountOrganization | null | undefined
): boolean {
  return Boolean(profile?.organization_id && organization?.id);
}

export function isSecurityComplete(
  user: User | null | undefined,
  checklist: AccountChecklist | null | undefined
): boolean {
  if (checklist?.security_completed) return true;
  const identities = user?.identities ?? [];
  return identities.some((identity) => identity.provider !== "email");
}

/** After a successful password update, force security step complete. */
export function withSecurityCompleted(
  checklist: AccountChecklist | null | undefined,
  userId: string
): AccountChecklist | null {
  if (!checklist) {
    return {
      user_id: userId,
      profile_completed: false,
      business_info_completed: false,
      account_settings_completed: false,
      security_completed: true,
      email_verified: false,
      organization_created: false,
      payment_setup_completed: false,
      team_invited: false,
      completed_at: null,
      created_at: null,
      updated_at: null,
    };
  }
  return { ...checklist, security_completed: true };
}

export function computeChecklistState(input: {
  user: User | null;
  profile: AccountProfile | null;
  organization: AccountOrganization | null;
  settings: AccountSettings | null;
  checklist: AccountChecklist | null;
}): Omit<AccountChecklist, "created_at" | "updated_at" | "completed_at"> & {
  completed_at: string | null;
} {
  const profile_completed = isProfileComplete(input.profile);
  const business_info_completed = isBusinessInfoComplete(input.organization);
  const account_settings_completed = isAccountSettingsComplete(input.settings);
  const email_verified = isEmailVerified(input.user);
  const organization_created = isOrganizationCreated(input.profile, input.organization);
  const security_completed = isSecurityComplete(input.user, input.checklist);

  const flags = [
    profile_completed,
    business_info_completed,
    account_settings_completed,
    security_completed,
    email_verified,
    organization_created,
  ];
  const allCoreComplete = flags.every(Boolean);

  return {
    user_id: input.user?.id ?? input.checklist?.user_id ?? "",
    profile_completed,
    business_info_completed,
    account_settings_completed,
    security_completed,
    email_verified,
    organization_created,
    payment_setup_completed: input.checklist?.payment_setup_completed ?? false,
    team_invited: input.checklist?.team_invited ?? false,
    completed_at: allCoreComplete ? new Date().toISOString() : null,
  };
}
