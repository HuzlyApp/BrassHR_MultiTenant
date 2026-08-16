import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { EMPLOYMENT_TYPES } from "@/lib/jobs/types";
import { resolveWorkflowForCriteria } from "@/lib/workflow-mappings/service";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const employmentType = req.nextUrl.searchParams.get("employmentType")?.trim() ?? "";
  if (!EMPLOYMENT_TYPES.includes(employmentType as (typeof EMPLOYMENT_TYPES)[number])) {
    return NextResponse.json({ error: "Employment type is required" }, { status: 400 });
  }

  const professionId = req.nextUrl.searchParams.get("professionId")?.trim() || null;
  const specialtyId = req.nextUrl.searchParams.get("specialtyId")?.trim() || null;
  const location = req.nextUrl.searchParams.get("location")?.trim() || null;
  const locationType =
    req.nextUrl.searchParams.get("locationType")?.trim() ||
    req.nextUrl.searchParams.get("jobLocationType")?.trim() ||
    null;
  const yearsOfExperience = req.nextUrl.searchParams.get("yearsOfExperience")?.trim() || null;

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const result = await resolveWorkflowForCriteria(supabase, tenantId, {
      professionId,
      specialtyId,
      employmentType: employmentType as (typeof EMPLOYMENT_TYPES)[number],
      location,
      locationType,
      jobLocationType: locationType,
      yearsOfExperience,
    });

    if (result.matched) {
      return NextResponse.json({
        match: {
          mappingId: result.mappingId,
          workflowId: result.workflowId,
          workflowName: result.workflowName,
          source: result.source,
          specificity: result.specificity,
          mappingCriteria: result.criteriaLabel,
        },
      });
    }

    return NextResponse.json(
      {
        match: null,
        warning: result.message,
      },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve workflow" },
      { status: 500 }
    );
  }
}
