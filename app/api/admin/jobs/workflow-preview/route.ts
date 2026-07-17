import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { EMPLOYMENT_TYPES, PLACEMENT_TYPES } from "@/lib/jobs/types";
import { resolveWorkflowMatch } from "@/lib/jobs/service";
import { workflowNoMatchMessage } from "@/lib/jobs/validation";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const professionId = req.nextUrl.searchParams.get("professionId")?.trim() ?? "";
  const employmentType = req.nextUrl.searchParams.get("employmentType")?.trim() ?? "";
  const placementType = req.nextUrl.searchParams.get("placementType")?.trim() ?? "";
  if (
    !professionId ||
    !EMPLOYMENT_TYPES.includes(employmentType as (typeof EMPLOYMENT_TYPES)[number]) ||
    !PLACEMENT_TYPES.includes(placementType as (typeof PLACEMENT_TYPES)[number])
  ) {
    return NextResponse.json({ error: "All three matching attributes are required" }, { status: 400 });
  }

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const match = await resolveWorkflowMatch(supabase, tenantId, {
      professionId,
      employmentType: employmentType as (typeof EMPLOYMENT_TYPES)[number],
      placementType: placementType as (typeof PLACEMENT_TYPES)[number],
    });
    if (match) return NextResponse.json({ match });

    const { data: profession } = await supabase
      .from("professions")
      .select("name")
      .eq("id", professionId)
      .maybeSingle();
    return NextResponse.json(
      {
        match: null,
        warning: workflowNoMatchMessage(String(profession?.name ?? professionId), {
          employmentType: employmentType as (typeof EMPLOYMENT_TYPES)[number],
          placementType: placementType as (typeof PLACEMENT_TYPES)[number],
        }),
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
