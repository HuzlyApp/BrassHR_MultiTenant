import type { SupabaseClient } from "@supabase/supabase-js";
import { JobApplicationGateError } from "@/lib/jobs/validate-job-application";
import { normalizeJobToken } from "@/lib/jobs/public-application-routing";
import { applyApplicantConfigFilters } from "@/lib/onboarding/filter-applicant-steps";
import {
  loadApplicantConfigForJobToken,
  loadApplicantConfigForTenantDefault,
} from "@/lib/onboarding/load-config-for-job-workflow";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { resolveApplicationWorkflowPhase } from "@/lib/onboarding/resolve-application-workflow-phase";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

type JobApplicationTokenRow = {
  job_requisitions:
    | { public_job_token?: string | null }
    | { public_job_token?: string | null }[]
    | null;
};

export async function resolveJobTokenForApplication(
  supabase: SupabaseClient,
  tenantId: string,
  jobApplicationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("job_applications")
    .select("job_requisition_id, job_requisitions(public_job_token)")
    .eq("id", jobApplicationId.trim())
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;

  const relation = (data as JobApplicationTokenRow | null)?.job_requisitions;
  const row = Array.isArray(relation) ? relation[0] : relation;
  const token = row?.public_job_token;
  return normalizeJobToken(typeof token === "string" ? token : null);
}

/**
 * Applicant-facing onboarding config for submit validation.
 * Matches the customized job / worker workflow shown in the UI — not the full tenant seed config.
 */
export async function resolveApplicantConfigForSubmit(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    tenantSlug: string;
    workerId: string;
    jobApplicationId?: string | null;
    jobToken?: string | null;
  }
): Promise<TenantOnboardingConfig> {
  const phaseRecord = await resolveApplicationWorkflowPhase(supabase, {
    tenantId: params.tenantId,
    workerId: params.workerId,
    applicationId: params.jobApplicationId ?? null,
    jobToken: params.jobToken ?? null,
  });
  const activePhase = phaseRecord?.phase ?? "pre_hire";

  let jobToken = normalizeJobToken(params.jobToken);
  if (!jobToken && params.jobApplicationId?.trim()) {
    jobToken = await resolveJobTokenForApplication(
      supabase,
      params.tenantId,
      params.jobApplicationId
    );
  }

  let baseConfig: TenantOnboardingConfig | null = null;

  if (jobToken) {
    try {
      const jobConfig = await loadApplicantConfigForJobToken(
        supabase,
        params.tenantSlug,
        jobToken
      );
      if (jobConfig.tenantId === params.tenantId) {
        baseConfig = jobConfig.config;
      }
    } catch (err) {
      if (!(err instanceof JobApplicationGateError)) throw err;
    }
  }

  if (!baseConfig) {
    try {
      const defaultConfig = await loadApplicantConfigForTenantDefault(
        supabase,
        params.tenantSlug
      );
      if (defaultConfig.tenantId === params.tenantId) {
        baseConfig = defaultConfig.config;
      }
    } catch (err) {
      if (!(err instanceof JobApplicationGateError)) throw err;
    }
  }

  if (!baseConfig) {
    baseConfig = await loadTenantOnboardingConfig(supabase, params.tenantId, {
      workerFacing: true,
    });
  }

  if (!baseConfig) {
    throw new Error("No onboarding configuration for tenant");
  }

  return applyApplicantConfigFilters(baseConfig, { activePhase });
}
