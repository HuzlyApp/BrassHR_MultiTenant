import type { ApiAuthContext } from "@/lib/auth/api-session";
import { isStaffRole } from "@/lib/auth/app-role";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";

export async function canAccessWorkerRecord(
  auth: ApiAuthContext,
  worker: { id: string; user_id?: unknown }
): Promise<boolean> {
  if (isStaffRole(auth.role) || auth.godAdmin) {
    if (!auth.authUser) return false;
    const svc = createServiceRoleClient();
    if (!svc) return false;
    const tenantId = await resolveEffectiveAdminTenantId(svc, {
      userId: auth.userId, authUser: auth.authUser, godAdmin: auth.godAdmin,
    });
    if (!tenantId) return false;
    const { data, error } = await svc.from("worker").select("id")
      .eq("id", worker.id).eq("tenant_id", tenantId).maybeSingle();
    return !error && Boolean(data);
  }
  if (auth.role !== "worker") return false;
  const uid = worker.user_id != null ? String(worker.user_id).trim() : "";
  return uid.length > 0 && uid === auth.userId;
}
