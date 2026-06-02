import type { SupabaseClient } from "@supabase/supabase-js";

const STAFF_ROLES = new Set(["admin", "recruiter", "owner"]);

/**
 * Recipients for onboarding failure alerts: env override first, then tenant staff users.
 */
export async function resolveHrNotifyEmails(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string[]> {
  const fromEnv =
    process.env.ONBOARDING_HR_NOTIFY_EMAILS?.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")) ?? [];

  if (fromEnv.length) {
    return [...new Set(fromEnv)];
  }

  const { data, error } = await supabase
    .from("users")
    .select("email, role")
    .eq("tenant_id", tenantId);

  if (error) {
    console.warn("[onboarding] resolveHrNotifyEmails", error.message);
    return [];
  }

  const emails = (data ?? [])
    .filter((row) => STAFF_ROLES.has(String(row.role ?? "").trim().toLowerCase()))
    .map((row) => String(row.email ?? "").trim().toLowerCase())
    .filter((e) => e.includes("@"));

  return [...new Set(emails)];
}
