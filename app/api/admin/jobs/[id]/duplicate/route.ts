import { NextResponse } from "next/server";
import { formatApiError } from "@/lib/api/format-api-error";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { JobValidationError } from "@/lib/jobs/types";
import { duplicateJobRequisition } from "@/lib/jobs/service";

export const runtime = "nodejs";

/**
 * FSD POST /api/requisitions/{id}/duplicate — draft copy, no applicants.
 * Admin path: POST /api/admin/jobs/{id}/duplicate
 */
export async function POST(
  _req: Request,
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
    const job = await duplicateJobRequisition(supabase, tenantId, auth.userId, id);
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof JobValidationError) {
      return NextResponse.json(
        { error: error.message, code: error.code, fieldErrors: error.fieldErrors },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: formatApiError(error) || "Failed to duplicate job" },
      { status: 500 }
    );
  }
}
