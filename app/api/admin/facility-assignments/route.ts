import { NextRequest, NextResponse } from "next/server";
import {
  assignFacilityToWorker,
  createFacility,
  loadFacilityAssignmentsForWorker,
  validateFacilityFormInput,
} from "@/lib/facilities/facility-service";
import type { FacilityFormInput } from "@/lib/facilities/types";
import { logFacilityTenantDebug } from "@/lib/facilities/tenant-scope";
import { resolveWorkerContext } from "@/lib/facilities/worker-access";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || "";
    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
    }

    const resolved = await resolveWorkerContext(workerIdRaw);
    if ("error" in resolved && resolved.error) return resolved.error;

    const data = await loadFacilityAssignmentsForWorker(
      resolved.supabase,
      resolved.tenantId,
      resolved.workerAuthId,
      resolved.workerId
    );

    logFacilityTenantDebug("facility-assignments-get", {
      workerId: resolved.workerId,
      tenantId: resolved.tenantId,
      unassignedCount: data.meta.unassignedCount,
      assignedCount: data.meta.assignedCount,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/facility-assignments GET]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { workerId?: string; facilityId?: string };
    const workerIdRaw = body.workerId?.trim() || "";
    const facilityIdCheck = parseRequiredUuid(body.facilityId, "facilityId");

    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
    }
    if (!facilityIdCheck.ok) {
      return NextResponse.json({ error: facilityIdCheck.error }, { status: 400 });
    }

    const resolved = await resolveWorkerContext(workerIdRaw);
    if ("error" in resolved && resolved.error) return resolved.error;

    const result = await assignFacilityToWorker(
      resolved.supabase,
      resolved.tenantId,
      resolved.workerAuthId,
      facilityIdCheck.value
    );

    return NextResponse.json({
      assignmentId: result.assignmentId,
      alreadyAssigned: result.alreadyAssigned,
    });
  } catch (err) {
    console.error("[admin/facility-assignments POST]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
