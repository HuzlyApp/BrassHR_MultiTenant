import type { TenantOnboardingStep } from "@/lib/onboarding/types";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import {
  isPreviewOnboardingStepId,
  loadApplicantDraftOnboardingConfig,
} from "@/lib/onboarding/load-applicant-draft-config";
import {
  findOnboardingStepForFirmaSession,
  stepUsesFirmaSigning,
} from "@/lib/onboarding/firma-step-settings";
import {
  resolveOrEnsureWorkerForApplicant,
  resolveTenantIdBySlug,
  resolveWorkerByApplicantId,
} from "@/lib/onboarding/resolve-worker-context";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolveFirmaOnboardingContextInput = {
  supabase: SupabaseClient;
  applicantId: string;
  stepKey: string;
  tenantSlug?: string | null;
  stepId?: string | null;
  preferDraftConfig?: boolean;
};

export type ResolveFirmaOnboardingContextResult =
  | {
      ok: true;
      workerId: string;
      tenantId: string;
      step: TenantOnboardingStep;
    }
  | {
      ok: false;
      error: string;
      code:
        | "WORKER_NOT_FOUND"
        | "STEP_NOT_FOUND"
        | "STEP_NOT_FIRMA"
        | "STEP_NOT_PUBLISHED";
      status: number;
    };

async function resolveFirmaStepFromConfig(
  steps: TenantOnboardingStep[],
  input: { stepKey: string; stepId?: string | null }
): Promise<TenantOnboardingStep | null> {
  return findOnboardingStepForFirmaSession(steps, {
    stepKey: input.stepKey,
    stepId: input.stepId,
  });
}

export async function resolveFirmaOnboardingContext(
  input: ResolveFirmaOnboardingContextInput
): Promise<ResolveFirmaOnboardingContextResult> {
  const tenantIdFromSlug = input.tenantSlug
    ? await resolveTenantIdBySlug(input.supabase, input.tenantSlug)
    : null;

  const ctx =
    (tenantIdFromSlug
      ? await resolveWorkerByApplicantId(input.supabase, input.applicantId, tenantIdFromSlug)
      : await resolveWorkerByApplicantId(input.supabase, input.applicantId)) ??
    (await resolveOrEnsureWorkerForApplicant(
      input.supabase,
      input.applicantId,
      input.tenantSlug
    ));

  if (!ctx) {
    return {
      ok: false,
      error: "Worker not found",
      code: "WORKER_NOT_FOUND",
      status: 404,
    };
  }

  const configTenantId = tenantIdFromSlug ?? ctx.tenantId;
  const publishedConfig = await loadTenantOnboardingConfig(input.supabase, configTenantId, {
    workerFacing: true,
  });

  let step = await resolveFirmaStepFromConfig(publishedConfig?.steps ?? [], {
    stepKey: input.stepKey,
    stepId: input.stepId,
  });

  if (!step && input.preferDraftConfig) {
    const draftConfig = await loadApplicantDraftOnboardingConfig(input.supabase, configTenantId);
    step = await resolveFirmaStepFromConfig(draftConfig?.steps ?? [], {
      stepKey: input.stepKey,
      stepId: input.stepId,
    });
  }

  if (!step) {
    return {
      ok: false,
      error: input.preferDraftConfig
        ? "Onboarding step not found in the published workflow or builder draft."
        : "Onboarding step not found. Publish your workflow from the builder, or open preview with ?preview=draft.",
      code: "STEP_NOT_FOUND",
      status: 404,
    };
  }

  if (!stepUsesFirmaSigning(step)) {
    return {
      ok: false,
      error: "This step is not configured for Firma signing",
      code: "STEP_NOT_FIRMA",
      status: 400,
    };
  }

  if (isPreviewOnboardingStepId(step.id)) {
    return {
      ok: false,
      error:
        "This Firma signing step is only in your builder draft. Publish the workflow from Onboarding Builder to enable signing.",
      code: "STEP_NOT_PUBLISHED",
      status: 409,
    };
  }

  if (ctx.tenantId !== configTenantId) {
    return {
      ok: false,
      error: "Worker not found for this company onboarding flow",
      code: "WORKER_NOT_FOUND",
      status: 404,
    };
  }

  return {
    ok: true,
    workerId: ctx.workerId,
    tenantId: configTenantId,
    step,
  };
}
