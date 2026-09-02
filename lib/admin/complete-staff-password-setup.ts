import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { sanitizeStaffAuditMetadata } from "@/lib/admin/staff-directory-status";
import { invalidateUserCache } from "@/lib/cache";
import { normalizeTenantEmail } from "@/lib/tenant/tenant-email-uniqueness";

/**
 * After a successful password update, clear first-login gates and accept pending invites.
 * Never reads or writes password material.
 */
export async function completeStaffPasswordSetup(
  supabase: SupabaseClient,
  params: { userId: string; email?: string | null; request?: Request }
): Promise<void> {
  const now = new Date().toISOString();
  const email = params.email ? normalizeTenantEmail(params.email) : null;

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

  let pendingQuery = supabase
    .from("staff_invitations")
    .select("id, tenant_id, email, invited_user_id")
    .eq("status", "pending")
    .eq("invited_user_id", params.userId);

  const { data: pendingByUser } = await pendingQuery;
  let invitations = (pendingByUser ?? []) as Array<{
    id: string;
    tenant_id: string;
    email?: string | null;
    invited_user_id?: string | null;
  }>;

  if (email) {
    const { data: pendingByEmail } = await supabase
      .from("staff_invitations")
      .select("id, tenant_id, email, invited_user_id")
      .eq("status", "pending")
      .ilike("email", email);
    const extra = (pendingByEmail ?? []) as typeof invitations;
    const seen = new Set(invitations.map((item) => item.id));
    for (const item of extra) {
      if (!seen.has(item.id)) invitations.push(item);
    }
  }

  if (invitations.length > 0) {
    const ids = invitations.map((item) => item.id);
    await supabase
      .from("staff_invitations")
      .update({
        status: "accepted",
        accepted_at: now,
        last_error_code: null,
        updated_at: now,
        invited_user_id: params.userId,
      })
      .in("id", ids);
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
