import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import {
  jobScreeningQuestionToInput,
  loadJobScreeningQuestions,
} from "@/lib/jobs/screening-questions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { buildJobsBoardHref } from "@/lib/jobs/public-jobs-board";
import { isOpenJobRequisitionStatus, normalizeJobRequisitionStatus } from "@/lib/jobs/job-status";
import {
  jobDetailsStatsFromPipelineSummary,
  tallyJobPipelineSummary,
} from "@/lib/jobs/pipeline-summary";

export async function GET(
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

    const [{ data: job, error: jobError }, { data: tenant, error: tenantError }] = await Promise.all([
      supabase
        .from("job_requisitions")
        .select("*, onboarding_flows!workflow_id(id, name)")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("tenants")
        .select("id, slug, subdomain, name")
        .eq("id", tenantId)
        .maybeSingle(),
    ]);

    if (jobError) throw jobError;
    if (tenantError) throw tenantError;
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { data: applications, error: appsError } = await supabase
      .from("job_applications")
      .select("id, status, status_id, application_statuses!status_id(system_key, name)")
      .eq("job_requisition_id", id)
      .eq("tenant_id", tenantId);
    if (appsError) throw appsError;

    const showSubmission =
      String((job as { source_type?: string | null }).source_type ?? "")
        .trim()
        .toLowerCase() === "msp";

    const pipelineSummary = tallyJobPipelineSummary(applications ?? [], {
      showSubmission,
    });
    const stats = jobDetailsStatsFromPipelineSummary(pipelineSummary);

    const tenantSlug = String(tenant?.slug ?? tenant?.subdomain ?? "")
      .trim()
      .toLowerCase();
    const publicToken =
      typeof job.public_job_token === "string" ? job.public_job_token.trim() : "";
    const publicJobPath =
      isOpenJobRequisitionStatus(String(job.status ?? "")) && publicToken && tenantSlug
        ? buildJobsBoardHref({ tenant: tenantSlug, job: publicToken })
        : null;

    const screeningQuestionRows = await loadJobScreeningQuestions(supabase, tenantId, id);

    return NextResponse.json({
      job: {
        ...job,
        status: normalizeJobRequisitionStatus(String(job.status ?? "")),
      },
      tenant: tenant
        ? {
            id: String(tenant.id),
            slug: tenantSlug,
            name: String(tenant.name ?? ""),
          }
        : null,
      publicJobPath,
      screeningQuestions: screeningQuestionRows.map(jobScreeningQuestionToInput),
      /** @deprecated Prefer GET /api/admin/jobs/{id}/pipeline-summary */
      stats,
      pipelineSummary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load job" },
      { status: 500 }
    );
  }
}
