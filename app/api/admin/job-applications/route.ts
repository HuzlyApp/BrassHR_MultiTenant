import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    let query = supabase
      .from("job_applications")
      .select(
        "id, status, created_at, submitted_at, updated_at, job_requisition_id, workflow_id, applicant_workflow_instance_id, job_requisitions(public_title, profession_id, employment_type, location, facility, facility_name, professions(name)), onboarding_flows(name), applicant_profiles(first_name, last_name, email)"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    const jobId = req.nextUrl.searchParams.get("jobId");
    const status = req.nextUrl.searchParams.get("status");
    const workflowId = req.nextUrl.searchParams.get("workflowId");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    if (jobId) query = query.eq("job_requisition_id", jobId);
    if (status) query = query.eq("status", status);
    if (workflowId) query = query.eq("workflow_id", workflowId);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);

    const { data, error } = await query;
    if (error) throw error;

    let applications = data ?? [];
    const professionId = req.nextUrl.searchParams.get("professionId");
    const employmentType = req.nextUrl.searchParams.get("employmentType");
    if (professionId || employmentType) {
      applications = applications.filter((row) => {
        const job = Array.isArray(row.job_requisitions)
          ? row.job_requisitions[0]
          : row.job_requisitions;
        return (
          (!professionId || job?.profession_id === professionId) &&
          (!employmentType || job?.employment_type === employmentType)
        );
      });
    }

    return NextResponse.json({ applications });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load applications" },
      { status: 500 }
    );
  }
}
