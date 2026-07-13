import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { stripUntrustedWorkflowParams } from "@/lib/job-requisitions/resolve-job-application-entry";

export const runtime = "nodejs";

/**
 * Public job landing details for /apply.
 * Rejects workflow override query params and never exposes internal sequential-only secrets
 * beyond the already-supplied public token.
 */
export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const cleaned = stripUntrustedWorkflowParams(new URLSearchParams(search));

  const tenant = cleaned.get("tenant")?.trim().toLowerCase() || "";
  const jobId = cleaned.get("job_id")?.trim() || "";
  const jobToken = cleaned.get("job_token")?.trim() || "";

  if (!tenant) {
    return NextResponse.json(
      { code: "TENANT_REQUIRED", message: "Organization is required." },
      { status: 400 }
    );
  }

  if (!jobId && !jobToken) {
    return NextResponse.json({
      mode: "legacy",
      tenantSlug: tenant,
      message: "Continue with the organization's default onboarding application.",
    });
  }

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const supabase = createClient(url, key);
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("id, slug, subdomain, is_active, name")
    .or(`slug.eq.${tenant},subdomain.eq.${tenant}`)
    .maybeSingle();

  if (!tenantRow?.id || tenantRow.is_active === false) {
    return NextResponse.json(
      { code: "TENANT_NOT_FOUND", message: "This organization was not found." },
      { status: 404 }
    );
  }

  let jobQuery = supabase
    .from("job_requisitions")
    .select(
      "id, title, description, job_role, location, department, employment_type, placement_type, status, workflow_template_id, public_job_token, workflow_assignment_error"
    )
    .eq("tenant_id", tenantRow.id);

  if (jobToken) jobQuery = jobQuery.eq("public_job_token", jobToken);
  else jobQuery = jobQuery.eq("id", jobId);

  const { data: job } = await jobQuery.maybeSingle();
  if (!job) {
    return NextResponse.json(
      { code: "JOB_NOT_FOUND", message: "This job posting was not found." },
      { status: 404 }
    );
  }

  if (job.status !== "Open") {
    return NextResponse.json(
      {
        code: "JOB_INACTIVE",
        message:
          job.status === "Draft"
            ? "This job is not published yet."
            : "This job is not currently accepting applications.",
        job: {
          title: job.title,
          status: job.status,
        },
      },
      { status: 403 }
    );
  }

  if (!job.workflow_template_id) {
    return NextResponse.json(
      {
        code: "JOB_NO_WORKFLOW",
        message:
          job.workflow_assignment_error ||
          "This job does not have an onboarding workflow configured.",
      },
      { status: 403 }
    );
  }

  const { data: flow } = await supabase
    .from("onboarding_flows")
    .select("id, name, status, is_active")
    .eq("id", job.workflow_template_id)
    .eq("tenant_id", tenantRow.id)
    .maybeSingle();

  if (!flow || flow.is_active === false || flow.status !== "published") {
    return NextResponse.json(
      {
        code: "JOB_NO_WORKFLOW",
        message: "The workflow assigned to this job is not published yet.",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    mode: "job",
    tenantSlug: String(tenantRow.slug ?? tenant).toLowerCase(),
    tenantName: tenantRow.name ?? null,
    job: {
      id: job.id,
      title: job.title,
      description: job.description,
      jobRole: job.job_role,
      location: job.location,
      department: job.department,
      employmentType: job.employment_type,
      placementType: job.placement_type,
      publicJobToken: job.public_job_token,
    },
    workflowName: flow.name,
  });
}
