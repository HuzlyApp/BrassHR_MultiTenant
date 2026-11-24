import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { sanitizeStaffAuditMetadata } from "@/lib/admin/staff-directory-status";
import { invalidateUserCache } from "@/lib/cache";

/**
 * After a successful password update, clear first-login gates and accept pending invites.
 * Never reads or writes password material.
 */
export async function completeStaffPasswordSetup(
  supabase: SupabaseClient,
  params: { userId: string; email?: string | null; request?: Request }
): Promise<void> {
  const now = new Date().toISOString();

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, tenant_id, must_change_password, email")
    .eq("id", params.userId)
    .maybeSingle();
  if (profileError) throw profileError;

  const row = profile as {
    id?: string;
    tenant_id?: string | null;
    must_change_password?: boolean | null;
    email?: string | null;
  } | null;

  if (row?.must_change_password === true) {
    const { error } = await supabase.from("users").update({ must_change_password: false }).eq("id", params.userId);
    if (error) throw error;
  }

  const pendingQuery = supabase
    .from("staff_invitations")
    .select("id, tenant_id, email, invited_user_id")
    .eq("status", "pending")
    .eq("invited_user_id", params.userId);

  const { data: pendingByUser, error: pendingError } = await pendingQuery;
  if (pendingError) throw pendingError;
  const invitations = (pendingByUser ?? []) as Array<{
    id: string;
    tenant_id: string;
    email?: string | null;
    invited_user_id?: string | null;
  }>;

  // Invitations are bound to Auth IDs when issued. An email match must never
  // rebind an invitation that belongs to a different account.

  if (invitations.length > 0) {
    const ids = invitations.map((item) => item.id);
    const { error } = await supabase
      .from("staff_invitations")
      .update({
        status: "accepted",
        accepted_at: now,
        last_error_code: null,
        updated_at: now,
        invited_user_id: params.userId,
      })
      .in("id", ids)
      .eq("invited_user_id", params.userId);
    if (error) throw error;
  }

  await invalidateUserCache("users", params.userId);

  const tenantId = invitations[0]?.tenant_id ?? row?.tenant_id ?? null;
  await writeActivityLog({
    actorUserId: params.userId,
    action: "staff.password_setup.completed",
    entityType: "user",
    entityId: params.userId,
    tenantId,
    metadata: sanitizeStaffAuditMetadata({
      outcome: "success",
      invitations_accepted: invitations.length,
    }),
    request: params.request,
  });
}
