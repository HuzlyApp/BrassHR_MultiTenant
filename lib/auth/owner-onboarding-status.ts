import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isGodAdminUser } from "@/lib/auth/god-admin";

export type OwnerOnboardingStatus = {
  signupCompleted: boolean;
  tenantOnboardingCompleted: boolean;
  godAdmin: boolean;
};

type UsersOnboardingRow = {
  signup_completed_at: string | null;
  tenant_onboarding_completed_at: string | null;
  god_admin?: boolean | null;
};

function readMetadataFlag(user: User, key: string): boolean {
  if (!user.app_metadata || typeof user.app_metadata !== "object") return false;
  const value = (user.app_metadata as Record<string, unknown>)[key];
  return value === true || value === "true";
}

export function parseOwnerOnboardingRow(
  row: UsersOnboardingRow | null,
  options?: { godAdminFromAuth?: boolean; user?: User }
): OwnerOnboardingStatus {
  const godAdmin = options?.godAdminFromAuth === true || row?.god_admin === true;
  const user = options?.user;
  return {
    signupCompleted:
      Boolean(row?.signup_completed_at) ||
      (user ? readMetadataFlag(user, "signup_completed") : false),
    tenantOnboardingCompleted:
      Boolean(row?.tenant_onboarding_completed_at) ||
      (user ? readMetadataFlag(user, "tenant_onboarding_completed") : false),
    godAdmin,
  };
}

export async function fetchOwnerOnboardingStatus(
  supabase: SupabaseClient,
  user: User
): Promise<OwnerOnboardingStatus> {
  const godAdminFromAuth = isGodAdminUser(user);
  const { data, error } = await supabase
    .from("users")
    .select("signup_completed_at, tenant_onboarding_completed_at, god_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("[owner-onboarding-status] users lookup failed", error.message);
  }

  return parseOwnerOnboardingRow(data as UsersOnboardingRow | null, {
    godAdminFromAuth,
    user,
  });
}

/** Safe relative path for post-auth redirects. */
export function sanitizeAuthNextPath(next: string | null | undefined): string | null {
  if (typeof next !== "string") return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/login") || trimmed.startsWith("/signin")) return null;
  return trimmed;
}

/**
 * Default recruiter destination after login / onboarding, honoring optional `next`.
 */
export function resolvePostAuthRedirect(
  status: OwnerOnboardingStatus,
  next?: string | null
): string {
  const safeNext = sanitizeAuthNextPath(next);
  if (status.godAdmin) {
    return safeNext ?? "/admin_recruiter/dashboard";
  }
  if (!status.signupCompleted) {
    return "/signup";
  }
  if (!status.tenantOnboardingCompleted) {
    if (safeNext?.startsWith("/tenant-onboarding")) return safeNext;
    return "/tenant-onboarding";
  }
  return safeNext ?? "/admin_recruiter/dashboard";
}

export function shouldBlockTenantOnboardingAccess(status: OwnerOnboardingStatus): boolean {
  if (status.godAdmin) return true;
  if (!status.signupCompleted) return true;
  if (status.tenantOnboardingCompleted) return true;
  return false;
}

export function shouldBlockAdminDashboardAccess(status: OwnerOnboardingStatus): boolean {
  if (status.godAdmin) return false;
  if (!status.signupCompleted) return true;
  if (!status.tenantOnboardingCompleted) return true;
  return false;
}
