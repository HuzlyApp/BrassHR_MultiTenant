import { NextRequest, NextResponse } from "next/server";
import { loadAssignedWorkersForFacility } from "@/lib/facilities/facility-management-service";
import { resolveStaffFacilityTenantContext } from "@/lib/facilities/staff-tenant-access";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ facilityId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { facilityId: facilityIdRaw } = await context.params;
    const facilityIdCheck = parseRequiredUuid(facilityIdRaw, "facilityId");
    if (!facilityIdCheck.ok) {
      return NextResponse.json({ error: facilityIdCheck.error }, { status: 400 });
    }

    const resolved = await resolveStaffFacilityTenantContext();
    if ("error" in resolved && resolved.error) return resolved.error;

    const workers = await loadAssignedWorkersForFacility(
      resolved.supabase,
      resolved.tenantId,
      facilityIdCheck.value
    );

    return NextResponse.json({ workers, meta: { tenantId: resolved.tenantId, facilityId: facilityIdCheck.value } });
  } catch (err) {
    console.error("[admin/facilities/[facilityId]/assignments GET]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
