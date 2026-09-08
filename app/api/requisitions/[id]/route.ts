import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { JobValidationError } from "@/lib/jobs/types";
import { parseJobRequisitionPatch } from "@/lib/jobs/job-requisition-patch";
import { patchJobRequisition } from "@/lib/jobs/service";

export const runtime = "nodejs";

/** FSD alias: PUT /api/requisitions/{id} */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const patch = parseJobRequisitionPatch(body);
    const job = await patchJobRequisition(supabase, tenantId, auth.userId, id, patch);
    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof JobValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code, fieldErrors: error.fieldErrors },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update job" },
      { status: 500 }
    );
  }
}
