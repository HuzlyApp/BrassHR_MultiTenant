import { unassignWorkerFromFacility } from "@/lib/facilities/facility-service";
import { FacilityValidationError } from "@/lib/facilities/errors";
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

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveStaffFacilityTenantContext();
    if ("error" in resolved && resolved.error) return resolved.error;
    const { facilityId } = await context.params;
    const body = await req.json().catch(() => null);
    const facility = parseRequiredUuid(facilityId, "facilityId");
    const assignment = parseRequiredUuid(typeof body?.assignmentId === "string" ? body.assignmentId : "", "assignmentId");
    if (!facility.ok || !assignment.ok) return NextResponse.json({ error: "Invalid facility or assignment ID." }, { status: 400 });
    const cancelled = await unassignWorkerFromFacility(resolved.supabase, resolved.tenantId, facility.value, assignment.value);
    return NextResponse.json({ cancelled });
  } catch (error) {
    if (error instanceof FacilityValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[admin/facilities/assignments DELETE]", error);
    return NextResponse.json({ error: "Could not unassign worker." }, { status: 500 });
  }
}
