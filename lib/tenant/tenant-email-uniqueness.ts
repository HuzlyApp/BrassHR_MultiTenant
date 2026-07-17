import type { SupabaseClient } from "@supabase/supabase-js";
import { findAuthUserIdByEmail } from "@/lib/auth/find-auth-user-by-email";

export const TENANT_EMAIL_TAKEN_MESSAGE =
  "This email is already used in this organization.";

export const TENANT_EMAIL_TAKEN_CODE = "DUPLICATE_EMAIL";

export const OWNER_SIGNUP_EMAIL_TAKEN_MESSAGE =
  "This email is already registered. Please sign in or use a different work email.";

export const OWNER_SIGNUP_EMAIL_TAKEN_CODE = "EMAIL_TAKEN";

export type OwnerSignupEmailAvailability = {
  available: boolean;
  reason: "invalid" | "taken" | "new" | "resume";
};

/** Normalize email for tenant-scoped uniqueness checks (case-insensitive). */
export function normalizeTenantEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type WorkerTenantEmailConflictOptions = {
  tenantId: string;
  email: string;
  excludeUserId?: string | null;
  excludeWorkerId?: string | null;
};

export type StaffTenantEmailConflictOptions = {
  tenantId: string;
  email: string;
  excludeUserId?: string | null;
};

/** Returns a conflicting worker id when email is already used in the same tenant. */
export async function findWorkerTenantEmailConflict(
  supabase: SupabaseClient,
  options: WorkerTenantEmailConflictOptions
): Promise<{ id: string } | null> {
  const emailNorm = normalizeTenantEmail(options.email);
  const tenantId = options.tenantId.trim().toLowerCase();
  if (!emailNorm || !tenantId) return null;

  let query = supabase
    .from("worker")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("email", emailNorm)
    .limit(1);

  const excludeUserId = options.excludeUserId?.trim();
  if (excludeUserId) {
    query = query.neq("user_id", excludeUserId);
  }

  const excludeWorkerId = options.excludeWorkerId?.trim();
  if (excludeWorkerId) {
    query = query.neq("id", excludeWorkerId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.id ? { id: String(data.id) } : null;
}

/** Returns a conflicting staff profile id when email is already used in the same tenant. */
export async function findStaffTenantEmailConflict(
  supabase: SupabaseClient,
  options: StaffTenantEmailConflictOptions
): Promise<{ id: string } | null> {
  const emailNorm = normalizeTenantEmail(options.email);
  const tenantId = options.tenantId.trim().toLowerCase();
  if (!emailNorm || !tenantId) return null;

  let query = supabase
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("email", emailNorm);

  const excludeUserId = options.excludeUserId?.trim();
  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ? { id: String(data.id) } : null;
}

export type PlatformOwnerEmailProfile = {
  id: string;
  signup_completed_at: string | null;
};

/**
 * Platform owner signup (tenant_id null) — only conflicts with another completed owner profile.
 * Does not block when the email exists only under a tenant-scoped staff/worker record.
 */
export async function findPlatformOwnerEmailConflict(
  supabase: SupabaseClient,
  email: string,
  excludeUserId?: string | null
): Promise<PlatformOwnerEmailProfile | null> {
  const emailNorm = normalizeTenantEmail(email);
  if (!emailNorm) return null;

  let query = supabase
    .from("users")
    .select("id, signup_completed_at")
    .is("tenant_id", null)
    .ilike("email", emailNorm);

  const excludeUserIdTrimmed = excludeUserId?.trim();
  if (excludeUserIdTrimmed) {
    query = query.neq("id", excludeUserIdTrimmed);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.id) return null;

  const profile = data as PlatformOwnerEmailProfile;
  if (!profile.signup_completed_at) return null;
  return profile;
}

/** Returns a worker id when the email is used by any worker account. */
export async function findGlobalWorkerEmailConflict(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string } | null> {
  const emailNorm = normalizeTenantEmail(email);
  if (!emailNorm) return null;

  const { data, error } = await supabase
    .from("worker")
    .select("id")
    .ilike("email", emailNorm)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ? { id: String(data.id) } : null;
}

/** Returns a staff profile id when the email is used by any tenant admin/recruiter. */
export async function findGlobalStaffEmailConflict(
  supabase: SupabaseClient,
  email: string,
  excludeUserId?: string | null
): Promise<{ id: string } | null> {
  const emailNorm = normalizeTenantEmail(email);
  if (!emailNorm) return null;

  let query = supabase
    .from("users")
    .select("id")
    .not("tenant_id", "is", null)
    .ilike("email", emailNorm);

  const excludeUserIdTrimmed = excludeUserId?.trim();
  if (excludeUserIdTrimmed) {
    query = query.neq("id", excludeUserIdTrimmed);
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ? { id: String(data.id) } : null;
}

async function findAuthUserRecordByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string } | null> {
  const byProfile = await findAuthUserIdByEmail(supabase, email);
  if (byProfile) return { id: byProfile };

  const { data: list, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;

  const match = list?.users?.find(
    (user) => normalizeTenantEmail(user.email || "") === email
  );
  return match?.id ? { id: match.id } : null;
}

/**
 * Owner signup must reject emails already used by workers, tenant staff, or
 * completed platform owners. Incomplete owner signups may resume.
 */
export async function resolveOwnerSignupEmailAvailability(
  supabase: SupabaseClient,
  emailInput: string,
  options?: { authUserIdHint?: string | null }
): Promise<OwnerSignupEmailAvailability> {
  const email = normalizeTenantEmail(emailInput);
  if (!email.includes("@")) {
    return { available: false, reason: "invalid" };
  }

  if (await findGlobalWorkerEmailConflict(supabase, email)) {
    return { available: false, reason: "taken" };
  }

  if (await findGlobalStaffEmailConflict(supabase, email, options?.authUserIdHint)) {
    return { available: false, reason: "taken" };
  }

  if (await findPlatformOwnerEmailConflict(supabase, email, options?.authUserIdHint)) {
    return { available: false, reason: "taken" };
  }

  const { data: incompleteOwner, error: ownerErr } = await supabase
    .from("users")
    .select("id, signup_completed_at")
    .is("tenant_id", null)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (ownerErr) throw ownerErr;
  if (incompleteOwner?.id && !incompleteOwner.signup_completed_at) {
    return { available: true, reason: "resume" };
  }

  const authUser = await findAuthUserRecordByEmail(supabase, email);
  if (authUser?.id) {
    const { data: profile, error: profileErr } = await supabase
      .from("users")
      .select("id, tenant_id, signup_completed_at")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profileErr) throw profileErr;

    if (profile?.tenant_id) {
      return { available: false, reason: "taken" };
    }
    if (profile?.signup_completed_at) {
      return { available: false, reason: "taken" };
    }

    return { available: true, reason: "resume" };
  }

  return { available: true, reason: "new" };
}

export function tenantEmailTakenResult(status = 409) {
  return {
    error: TENANT_EMAIL_TAKEN_MESSAGE,
    code: TENANT_EMAIL_TAKEN_CODE,
    status,
  } as const;
}

/** True when Postgres reports a violation of tenant-scoped worker email uniqueness. */
export function isWorkerTenantEmailUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string; details?: string; hint?: string } | null;
  if (!e || e.code !== "23505") return false;
  const text = `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();
  if (text.includes("worker_tenant_email_lower_uidx")) return true;
  if (text.includes("worker_user_id_key")) return false;
  return text.includes("email") && text.includes("worker");
}
