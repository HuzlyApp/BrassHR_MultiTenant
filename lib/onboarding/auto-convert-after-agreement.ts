import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  convertCandidateToWorker,
  type ConvertCandidateResult,
} from "@/lib/admin/convert-candidate-to-worker.server";
import type { ConvertWorkerType } from "@/lib/admin/convert-candidate-to-worker";
import { isAgreementEsignStep } from "@/lib/onboarding/lock-post-hire";
import { readStepLifecyclePhase } from "@/lib/onboarding/workflow-phase";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function convertWorkerTypeFromEmploymentType(value: unknown): ConvertWorkerType {
  const normalized = normalizeStatus(value).replace(/[-_\s]/g, "");
  return normalized === "1099" || normalized.includes("contractor") ? "1099" : "w2";
}

async function resolveWorkerType(
  supabase: SupabaseClient,
  params: { tenantId: string; applicationId: string | null }
): Promise<ConvertWorkerType> {
  if (!params.applicationId) return "w2";

  const { data, error } = await supabase
    .from("job_applications")
    .select("job_requisitions(employment_type), onboarding_flows(employment_type)")
    .eq("id", params.applicationId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();

  if (error) {
    console.warn("[auto-convert-after-agreement] worker type lookup failed", error.message);
    return "w2";
  }

  const job = Array.isArray(data?.job_requisitions)
    ? data?.job_requisitions[0]
    : data?.job_requisitions;
  const flow = Array.isArray(data?.onboarding_flows)
    ? data?.onboarding_flows[0]
    : data?.onboarding_flows;

  return convertWorkerTypeFromEmploymentType(
    job?.employment_type ?? flow?.employment_type ?? null
  );
}

async function ensureConvertibleCandidateStatus(
  supabase: SupabaseClient,
  params: { tenantId: string; workerId: string }
): Promise<boolean> {
  const { data, error } = await supabase
    .from("worker")
    .select("status")
    .eq("id", params.workerId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();
  if (error) throw error;

  const status = normalizeStatus(data?.status);
  if (status === "converted") return false;
  if (status === "approved" || status === "for_approval") return true;
  if (["rejected", "disapproved", "withdrawn", "archived"].includes(status)) return false;

  const { error: updateError } = await supabase
    .from("worker")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", params.workerId)
    .eq("tenant_id", params.tenantId);
  if (updateError) throw updateError;
  return true;
}

export async function autoConvertCandidateAfterAgreement(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    workerId: string;
    applicationId: string | null;
    step: TenantOnboardingStep | null | undefined;
    origin?: string | null;
  }
): Promise<ConvertCandidateResult | null> {
  if (!input.step) return null;
  if (readStepLifecyclePhase(input.step) !== "pre_hire") return null;
  if (!isAgreementEsignStep({
    snapshotStepId: String(input.step.metadata?.workflow_step_id ?? ""),
    stepKey: input.step.step_key,
    stepType: input.step.step_type,
    title: input.step.title,
  })) {
    return null;
  }

  const convertible = await ensureConvertibleCandidateStatus(supabase, {
    tenantId: input.tenantId,
    workerId: input.workerId,
  });
  if (!convertible) return null;

  const workerType = await resolveWorkerType(supabase, {
    tenantId: input.tenantId,
    applicationId: input.applicationId,
  });

  return convertCandidateToWorker(supabase, {
    candidateId: input.workerId,
    workerType,
    sourceJobApplicationId: input.applicationId,
    origin: input.origin ?? null,
  });
}
