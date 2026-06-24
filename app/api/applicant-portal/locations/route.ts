import { NextRequest, NextResponse } from "next/server";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { filterConfirmedAssignedFacilities } from "@/lib/facilities/assignment-status";
import { loadFacilityAssignmentsForWorker } from "@/lib/facilities/facility-service";
import type { WorkerLocationsResponse } from "@/lib/facilities/types";

export const runtime = "nodejs";

export type { WorkerLocationsResponse };

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireApprovedApplicant(req);
    if (ctx instanceof NextResponse) return ctx;

    const workerAuthId = ctx.applicant.user_id?.trim() || ctx.user.id;
    const assignments = await loadFacilityAssignmentsForWorker(
      ctx.supabase,
      ctx.applicant.tenant_id,
      workerAuthId,
      ctx.applicant.id
    );

    const locations = filterConfirmedAssignedFacilities(assignments.active);

    return NextResponse.json({
      locations,
      total: locations.length,
    } satisfies WorkerLocationsResponse);
  } catch (err) {
    console.error("[applicant-portal/locations GET]", err);
    return NextResponse.json({ error: "Unable to load locations. Please try again." }, { status: 500 });
  }
}
