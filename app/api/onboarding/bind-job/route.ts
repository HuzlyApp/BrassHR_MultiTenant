import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { createApplicantWorkflowInstance } from "@/lib/job-requisitions/applicant-workflow-instance";
import { stripUntrustedWorkflowParams } from "@/lib/job-requisitions/resolve-job-application-entry";
import { resolveOnboardingWorker } from "@/lib/onboarding/resolve-onboarding-worker";
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-worker-context";

export const runtime = "nodejs";

/** Binds an authenticated applicant to a job requisition and creates their workflow instance. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      applicantId?: string;
      tenantSlug?: string;
      jobId?: string;
      jobToken?: string;
    };

    const applicantId = body.applicantId?.trim() || "";
    const tenantSlug = body.tenantSlug?.trim().toLowerCase() || "";
    const jobId = body.jobId?.trim() || "";
    const jobToken = body.jobToken?.trim() || "";

    if (!applicantId || !tenantSlug || (!jobId && !jobToken)) {
      return NextResponse.json({ error: "Missing applicantId, tenantSlug, or job reference" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const tenantId = await resolveTenantIdBySlug(supabase, tenantSlug);
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    let jobQuery = supabase
      .from("job_requisitions")
      .select("id, tenant_id, status, workflow_template_id, public_job_token")
      .eq("tenant_id", tenantId);

    if (jobToken) jobQuery = jobQuery.eq("public_job_token", jobToken);
    else jobQuery = jobQuery.eq("id", jobId);

    const { data: job, error: jobErr } = await jobQuery.maybeSingle();
    if (jobErr) throw jobErr;
    if (!job?.id || job.status !== "Open" || !job.workflow_template_id) {
      return NextResponse.json({ error: "Job is not available for applications" }, { status: 400 });
    }

    if (jobToken && job.public_job_token !== jobToken) {
      return NextResponse.json({ error: "Invalid job token" }, { status: 403 });
    }

    const ctx = await resolveOnboardingWorker(supabase, applicantId, tenantSlug);
    if (!ctx || ctx.tenantId !== tenantId) {
      return NextResponse.json({ error: "Applicant session not found for tenant" }, { status: 404 });
    }

    const { data: existingWorker } = await supabase
      .from("worker")
      .select("job_requisition_id, applicant_workflow_instance_id")
      .eq("id", ctx.workerId)
      .maybeSingle();

    if (existingWorker?.applicant_workflow_instance_id) {
      return NextResponse.json({
        ok: true,
        alreadyBound: true,
        jobRequisitionId: existingWorker.job_requisition_id,
      });
    }

    const created = await createApplicantWorkflowInstance({
      supabase,
      tenantId,
      workerId: ctx.workerId,
      jobRequisitionId: String(job.id),
      onboardingFlowId: String(job.workflow_template_id),
    });

    if (!created) {
      return NextResponse.json({ error: "Failed to create workflow instance" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      jobRequisitionId: job.id,
      workflowInstanceId: created.instanceId,
      onboardingFlowId: job.workflow_template_id,
      allowedParams: Array.from(stripUntrustedWorkflowParams(new URLSearchParams()).keys()),
    });
  } catch (err: unknown) {
    console.error("[onboarding/bind-job]", err);
    const msg = err instanceof Error ? err.message : "Failed to bind job";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
