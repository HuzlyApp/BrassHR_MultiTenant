import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { routeForApplicantStep } from "@/lib/onboarding/resolve-applicant-step-route";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import type { OnboardingStepStatus, TenantOnboardingStep } from "@/lib/onboarding/types";
import {
  resolveVerificationPipelineStatus,
  resolveWorkerApplicationStatusLabel,
} from "@/lib/applicant-portal/worker-application-status";
import type {
  ApplicationPipelinePayload,
  ApplicationPipelineStep,
} from "@/lib/applicant-portal/application-pipeline-types";

export type {
  ApplicationPipelinePayload,
  ApplicationPipelineStep,
} from "@/lib/applicant-portal/application-pipeline-types";

function mapStepStatus(status: OnboardingStepStatus): ApplicationPipelineStep["status"] {
  if (status === "completed" || status === "skipped") return "completed";
  if (status === "in_progress") return "in_progress";
  return "pending";
}

function stepStatusLabel(status: ApplicationPipelineStep["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In Progress";
  return "Not Started";
}

function withTenantAndJobToken(
  href: string,
  tenantSlug: string | null,
  jobToken: string | null
): string {
  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  if (tenantSlug?.trim() && !params.get("tenant")) {
    params.set("tenant", tenantSlug.trim());
  }
  if (jobToken?.trim() && !params.get("job_token")) {
    params.set("job_token", jobToken.trim());
  }
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function progressStatusForStep(
  step: TenantOnboardingStep,
  progressByStepId: Map<string, { status: OnboardingStepStatus; completed_at: string | null }>
): { status: ApplicationPipelineStep["status"]; completedAt: string | null } {
  const row = progressByStepId.get(step.id);
  if (!row) return { status: "pending", completedAt: null };
  return {
    status: mapStepStatus(row.status),
    completedAt: row.completed_at,
  };
}

export async function loadApplicationPipeline(
  supabase: SupabaseClient,
  input: { applicationId: string; applicantAuthUserId: string }
): Promise<ApplicationPipelinePayload | null> {
  const { data: application, error } = await supabase
    .from("job_applications")
    .select(
      "id, status, submitted_at, worker_id, tenant_id, applicant_auth_user_id, job_requisitions(id, public_title, location, public_job_token), tenants:tenant_id(slug)"
    )
    .eq("id", input.applicationId)
    .maybeSingle();

  if (error) throw error;
  if (!application?.id) return null;

  const workerId = application.worker_id ? String(application.worker_id) : "";
  const authUserId = application.applicant_auth_user_id
    ? String(application.applicant_auth_user_id)
    : "";
  if (authUserId !== input.applicantAuthUserId && !workerId) {
    return null;
  }

  let workerStatus: string | null = null;
  if (workerId) {
    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("status, user_id")
      .eq("id", workerId)
      .maybeSingle();
    if (workerError) throw workerError;
    if (worker?.user_id && String(worker.user_id) !== input.applicantAuthUserId && authUserId !== input.applicantAuthUserId) {
      return null;
    }
    workerStatus = worker?.status ? String(worker.status) : null;
  } else if (authUserId !== input.applicantAuthUserId) {
    return null;
  }

  const jobRaw = application.job_requisitions;
  const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;
  const jobRecord = (job ?? {}) as {
    public_title?: string | null;
    location?: string | null;
    public_job_token?: string | null;
  };
  const tenantRaw = application.tenants;
  const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
  const tenantSlug = (tenant as { slug?: string | null } | null)?.slug?.trim() || null;
  const jobToken = jobRecord.public_job_token?.trim() || null;

  const applicationStatus = String(application.status ?? "");
  const applicationSubmittedAt = application.submitted_at
    ? String(application.submitted_at)
    : null;

  const progress = workerId
    ? await ensureWorkerOnboardingProgress(supabase, workerId, String(application.tenant_id)).catch(
        () => null
      )
    : null;

  const progressByStepId = new Map(
    (progress?.steps ?? []).map((step) => [
      step.onboarding_step_id,
      { status: step.status, completed_at: step.completed_at },
    ])
  );

  const config = await loadTenantOnboardingConfig(supabase, String(application.tenant_id), {
    workerFacing: true,
  });
  const enabledSteps = getEnabledTenantSteps(config);

  const firstIncompleteStep = enabledSteps.find((step) => {
    const { status } = progressStatusForStep(step, progressByStepId);
    return status !== "completed";
  });
  const allStepsComplete = enabledSteps.length > 0 && !firstIncompleteStep;
  const workerApproved = String(workerStatus ?? "").trim().toLowerCase() === "approved";
  const submittedAt = allStepsComplete
    ? applicationSubmittedAt ?? progress?.submittedAt ?? (workerApproved ? new Date().toISOString() : null)
    : null;
  const firstIncompleteStepHref = firstIncompleteStep
    ? withTenantAndJobToken(
        routeForApplicantStep(firstIncompleteStep, tenantSlug),
        tenantSlug,
        jobToken
      )
    : !submittedAt && !workerApproved
      ? withTenantAndJobToken(
          routeForApplicantStep(
            enabledSteps.find((s) => s.step_type === "review_submit") ?? {
              step_key: "review_submit",
              step_type: "review_submit",
              metadata: {},
            } as TenantOnboardingStep,
            tenantSlug
          ),
          tenantSlug,
          jobToken
        )
      : null;

  const onboardingSteps: ApplicationPipelineStep[] = enabledSteps.map((step) => {
    const { status, completedAt } = progressStatusForStep(step, progressByStepId);

    return {
      id: step.id,
      title: step.title,
      status,
      statusLabel: stepStatusLabel(status),
      completedAt,
      actionHref: null,
      actionLabel: null,
    };
  });

  const verification = resolveVerificationPipelineStatus({
    submittedAt,
    workerStatus,
    allStepsComplete,
  });

  const verificationStep: ApplicationPipelineStep = {
    id: "verification-status",
    title: "Verification Status",
    status: verification.status,
    statusLabel: verification.statusLabel,
    completedAt: verification.status === "completed" ? submittedAt : null,
    actionHref: null,
    actionLabel: null,
    isVerificationStep: true,
  };

  const showCompleteStep = Boolean(firstIncompleteStep);

  return {
    applicationId: String(application.id),
    jobTitle: jobRecord.public_title?.trim() || "Job Application",
    jobLocation: jobRecord.location?.trim() || null,
    jobToken,
    tenantSlug,
    statusLabel: resolveWorkerApplicationStatusLabel({
      applicationStatus,
      submittedAt,
      workerStatus,
      allStepsComplete,
    }),
    submittedAt,
    hasIncompleteSteps: Boolean(firstIncompleteStep),
    firstIncompleteStepHref: showCompleteStep ? firstIncompleteStepHref : null,
    workerVerificationStatus: verification.workerVerificationStatus,
    workerVerificationLabel: verification.workerVerificationLabel,
    steps: [...onboardingSteps, verificationStep],
  };
}
