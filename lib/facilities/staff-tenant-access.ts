import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logFacilityTenantDebug, resolveFacilityTenantId } from "@/lib/facilities/tenant-scope";

export type StaffFacilityTenantContext = {
  supabase: SupabaseClient;
  tenantId: string;
  staffUserId: string | null;
};

export async function resolveStaffFacilityTenantContext(workerTenantId?: string | null) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return { error: auth };

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return {
      error: NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 }),
    };
  }

  const scope = await resolveStaffTenantScope(auth.authUser);
  let tenantId: string;
  try {
    tenantId = resolveFacilityTenantId({
      workerTenantId,
      staffScope: scope,
      staffUserId: auth.devBypass ? null : auth.userId,
    }).tenantId;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to determine tenant for facility operations.";
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
  }

  logFacilityTenantDebug("resolve-staff-tenant-context", {
    tenantId,
    staffUserId: auth.devBypass ? null : auth.userId,
    staffScope: scope,
    workerTenantId: workerTenantId ?? null,
  });

  return {
    supabase,
    tenantId,
    staffUserId: auth.devBypass ? null : auth.userId,
  } satisfies StaffFacilityTenantContext;
}
