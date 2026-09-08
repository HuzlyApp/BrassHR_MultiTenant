import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { tallyJobPipelineSummary, type JobPipelineSummary } from "@/lib/jobs/pipeline-summary";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function loadJobPipelineSummaryForStaff(
  supabase: SupabaseClient,
  tenantId: string,
  jobId: string
): Promise<JobPipelineSummary | { error: string; status: number }> {
  const { data: job, error: jobError } = await supabase
    .from("job_requisitions")
    .select("id, source_type")
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job) return { error: "Job not found", status: 404 };

  const { data: applications, error: appsError } = await supabase
    .from("job_applications")
    .select("id, status, status_id, application_statuses!status_id(system_key, name)")
    .eq("job_requisition_id", jobId)
    .eq("tenant_id", tenantId);
  if (appsError) throw appsError;

  const showSubmission =
    String(job.source_type ?? "")
      .trim()
      .toLowerCase() === "msp";

  return tallyJobPipelineSummary(applications ?? [], { showSubmission });
}

export async function getJobPipelineSummaryResponse(
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const { id } = await context.params;
    const result = await loadJobPipelineSummaryForStaff(supabase, tenantId, id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load pipeline summary" },
      { status: 500 }
    );
  }
}
