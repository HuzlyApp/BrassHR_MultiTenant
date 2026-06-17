import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { logFacilityTenantDebug, resolveFacilityTenantId } from "@/lib/facilities/tenant-scope";

export type ResolvedWorkerContext = {
  supabase: SupabaseClient;
  workerId: string;
  workerAuthId: string;
  tenantId: string;
  staffUserId: string | null;
};

export async function resolveWorkerContext(workerIdRaw: string) {
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
  if (!idCheck.ok) {
    return { error: NextResponse.json({ error: idCheck.error }, { status: 400 }) };
  }

  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return { error: auth };

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return {
      error: NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 }),
    };
  }

  const { data: worker, error } = await supabase
    .from("worker")
    .select("id, user_id, tenant_id")
    .eq("id", idCheck.value)
    .maybeSingle();

  if (error) throw error;
  if (!worker?.id || !worker.tenant_id) {
    return { error: NextResponse.json({ error: "Applicant not found." }, { status: 404 }) };
  }

  if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const tenantId = String(worker.tenant_id);
  const scope = await resolveStaffTenantScope(auth.authUser);
  if (scope.mode === "scoped" && scope.tenantId !== tenantId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  let resolvedTenant;
  try {
    resolvedTenant = resolveFacilityTenantId({
      workerTenantId: tenantId,
      staffScope: scope,
      staffUserId: auth.devBypass ? null : auth.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to determine tenant for facility operations.";
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
  }

  logFacilityTenantDebug("resolve-worker-context", {
    workerId: String(worker.id),
    workerTenantId: tenantId,
    staffUserId: auth.devBypass ? null : auth.userId,
    staffScope: scope,
    resolvedTenantId: resolvedTenant.tenantId,
    resolvedSource: resolvedTenant.source,
  });

  const workerAuthId = worker.user_id != null ? String(worker.user_id).trim() : "";
  if (!workerAuthId) {
    return {
      error: NextResponse.json(
        { error: "Applicant account is not linked yet. Cannot assign facilities." },
        { status: 400 }
      ),
    };
  }

  return {
    supabase,
    workerId: String(worker.id),
    workerAuthId,
    tenantId: resolvedTenant.tenantId,
    staffUserId: auth.devBypass ? null : auth.userId,
  } satisfies ResolvedWorkerContext;
}
