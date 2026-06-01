import { writeActivityLog } from "@/lib/audit/activity-log";

const IMPERSONATION_ROLE = "admin_recruiter";

export type GodAdminImpersonationAuditInput = {
  actorUserId: string;
  actorEmail: string | null;
  tenantId: string;
  tenantSlug?: string | null;
  tenantName?: string | null;
  event: "start" | "end";
  request?: Request;
};

/** Audit trail for God Admin tenant impersonation (view-as). */
export async function logGodAdminImpersonation(
  input: GodAdminImpersonationAuditInput
): Promise<void> {
  const timestamp = new Date().toISOString();
  const action =
    input.event === "start" ? "god_admin_impersonation_start" : "god_admin_impersonation_end";

  await writeActivityLog({
    actorUserId: input.actorUserId,
    action,
    entityType: "tenant",
    entityId: input.tenantId,
    tenantId: input.tenantId,
    metadata: {
      tenant_id: input.tenantId,
      tenant_slug: input.tenantSlug ?? null,
      tenant_name: input.tenantName ?? null,
      god_admin_user_id: input.actorUserId,
      god_admin_email: input.actorEmail,
      timestamp,
      target_role: IMPERSONATION_ROLE,
      impersonation_context: IMPERSONATION_ROLE,
    },
    request: input.request,
  });
}
