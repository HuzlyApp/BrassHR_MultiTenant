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
  params: { userId: string; request?: Request }
): Promise<void> {
  const now = new Date().toISOString();

  const { data: profile } = await supabase
    .from("users")
    .select("id, tenant_id, must_change_password, email")
    .eq("id", params.userId)
    .maybeSingle();

  const row = profile as {
    id?: string;
    tenant_id?: string | null;
    must_change_password?: boolean | null;
    email?: string | null;
  } | null;

  if (row?.must_change_password === true) {
    await supabase.from("users").update({ must_change_password: false }).eq("id", params.userId);
  }

  const { data: pending } = await supabase
    .from("staff_invitations")
    .select("id, tenant_id")
    .eq("invited_user_id", params.userId)
    .eq("status", "pending");

  const invitations = (pending ?? []) as Array<{ id: string; tenant_id: string }>;
  if (invitations.length > 0) {
    await supabase
      .from("staff_invitations")
      .update({ status: "accepted", accepted_at: now, last_error_code: null, updated_at: now })
      .eq("invited_user_id", params.userId)
      .eq("status", "pending");
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
