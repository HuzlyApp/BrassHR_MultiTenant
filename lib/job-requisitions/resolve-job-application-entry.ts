import type { SupabaseClient } from "@supabase/supabase-js";
import { firstOnboardingStepRoute, getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { snapshotToTenantConfig } from "@/lib/job-requisitions/applicant-workflow-instance";
import type { WorkflowSnapshot } from "@/lib/job-requisitions/applicant-workflow-instance";
import { withTenant } from "@/lib/tenant/with-tenant";

export type JobApplicationEntryErrorCode =
  | "JOB_REQUIRED"
  | "JOB_NOT_FOUND"
  | "JOB_INACTIVE"
  | "JOB_WRONG_TENANT"
  | "JOB_NO_WORKFLOW"
  | "TENANT_NOT_FOUND";

export type JobApplicationEntryResult =
  | { kind: "redirect"; url: string; tenantSlug: string; jobRequisitionId: string; workflowTemplateId: string }
  | {
      kind: "error";
      code: JobApplicationEntryErrorCode;
      message: string;
      tenantSlug?: string | null;
    };

type JobRow = {
  id: string;
  tenant_id: string;
  status: string;
  workflow_template_id: string | null;
  public_job_token: string | null;
  workflow_assignment_error: string | null;
  workflow_snapshot?: WorkflowSnapshot;
};

export async function resolveJobApplicationEntry(params: {
  supabase: SupabaseClient;
  tenantSlug: string;
  jobId?: string | null;
  jobToken?: string | null;
}): Promise<JobApplicationEntryResult> {
  const slug = params.tenantSlug.trim().toLowerCase();
  if (!slug) {
    return {
      kind: "error",
      code: "TENANT_NOT_FOUND",
      message: "No organization was specified.",
    };
  }

  const jobId = params.jobId?.trim() || null;
  const jobToken = params.jobToken?.trim() || null;
  if (!jobId && !jobToken) {
    return {
      kind: "error",
      code: "JOB_REQUIRED",
      message: "A job is required to start an application. Use the apply link provided for this position.",
      tenantSlug: slug,
    };
  }

  const { data: tenantRow, error: tenantErr } = await params.supabase
    .from("tenants")
    .select("id, slug, subdomain, is_active")
    .or(`slug.eq.${slug},subdomain.eq.${slug}`)
    .maybeSingle();

  if (tenantErr || !tenantRow?.id || tenantRow.is_active === false) {
    return {
      kind: "error",
      code: "TENANT_NOT_FOUND",
      message: "This organization was not found or is no longer active.",
      tenantSlug: slug,
    };
  }

  const tenantId = String(tenantRow.id);
  const canonicalSlug = String(tenantRow.slug ?? tenantRow.subdomain ?? slug).toLowerCase();

  let jobQuery = params.supabase
    .from("job_requisitions")
    .select(
      "id, tenant_id, status, workflow_template_id, public_job_token, workflow_assignment_error"
    )
    .eq("tenant_id", tenantId);

  if (jobToken) {
    jobQuery = jobQuery.eq("public_job_token", jobToken);
  } else if (jobId) {
    jobQuery = jobQuery.eq("id", jobId);
  }

  const { data: job, error: jobErr } = await jobQuery.maybeSingle();
  if (jobErr) throw jobErr;

  const row = job as JobRow | null;
  if (!row?.id) {
    return {
      kind: "error",
      code: "JOB_NOT_FOUND",
      message: "This job posting was not found.",
      tenantSlug: canonicalSlug,
    };
  }

  if (row.status !== "Open") {
    return {
      kind: "error",
      code: "JOB_INACTIVE",
      message: "This job is not currently accepting applications.",
      tenantSlug: canonicalSlug,
    };
  }

  if (!row.workflow_template_id) {
    return {
      kind: "error",
      code: "JOB_NO_WORKFLOW",
      message:
        row.workflow_assignment_error ??
        "This job does not have an onboarding workflow configured.",
      tenantSlug: canonicalSlug,
    };
  }

  const config =
    (await loadTenantOnboardingConfig(params.supabase, tenantId, { workerFacing: true })) ??
    null;
  const enabledSteps = getEnabledTenantSteps(config);
  if (!enabledSteps.length) {
    return {
      kind: "error",
      code: "JOB_NO_WORKFLOW",
      message: "Onboarding is not available for this organization yet.",
      tenantSlug: canonicalSlug,
    };
  }

  const firstPath = firstOnboardingStepRoute(config, canonicalSlug);
  const url = new URL(firstPath.startsWith("/") ? firstPath : withTenant(firstPath, canonicalSlug), "https://local");
  url.searchParams.set("job_id", row.id);
  if (row.public_job_token) {
    url.searchParams.set("job_token", row.public_job_token);
  }

  return {
    kind: "redirect",
    url: `${url.pathname}${url.search}`,
    tenantSlug: canonicalSlug,
    jobRequisitionId: row.id,
    workflowTemplateId: row.workflow_template_id,
  };
}

/** Reject client attempts to override workflow via URL. */
export function stripUntrustedWorkflowParams(searchParams: URLSearchParams): URLSearchParams {
  const cleaned = new URLSearchParams(searchParams);
  cleaned.delete("workflow_id");
  cleaned.delete("workflow_template_id");
  cleaned.delete("onboarding_flow_id");
  cleaned.delete("flow_id");
  return cleaned;
}
