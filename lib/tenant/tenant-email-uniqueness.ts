import type { SupabaseClient } from "@supabase/supabase-js";

export const TENANT_EMAIL_TAKEN_MESSAGE =
  "This email is already used in this organization.";

export const TENANT_EMAIL_TAKEN_CODE = "DUPLICATE_EMAIL";

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
