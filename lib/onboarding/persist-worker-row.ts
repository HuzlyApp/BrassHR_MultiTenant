import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Step1FormFields } from "@/lib/onboardingStep1Validation";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { invalidateResourceCache, invalidateTenantCache, invalidateUserCache, invalidateTableCache } from "@/lib/cache";
import { normalizeTenantEmail, tenantEmailTakenResult } from "@/lib/tenant/tenant-email-uniqueness";
import { isDraftPreviewApplicantId } from "@/lib/onboarding/is-draft-preview";
import { invalidateCandidateKpiCache } from "@/lib/workers/candidate-kpi-cache";

export type PersistWorkerRowInput = {
  applicantId: string; tenantId: string; fields: Step1FormFields;
  status?: string; addressLat?: number; addressLng?: number; addressNormalized?: string;
  skipOnboardingProgressInit?: boolean;
};
export type PersistWorkerRowResult = { ok: true; workerId: string } | { ok: false; error: string; code?: string; status?: number };

/** Caller verifies the applicant session; this function never transfers another identity's row. */
export async function persistWorkerRow(supabase: SupabaseClient, input: PersistWorkerRowInput): Promise<PersistWorkerRowResult> {
  if (isDraftPreviewApplicantId(input.applicantId)) return { ok: false, error: "Draft preview cannot persist a worker", code: "DRAFT_PREVIEW", status: 400 };
  const { applicantId, tenantId, fields } = input;
  const { data: existing, error: lookupError } = await supabase.from("worker").select("id")
    .eq("user_id", applicantId).eq("tenant_id", tenantId).maybeSingle();
  if (lookupError) return { ok: false, error: "Could not load worker", status: 500 };
  const row: Record<string, unknown> = {
    first_name: fields.firstName.trim(), last_name: fields.lastName.trim(),
    address1: fields.address1.trim(), address2: fields.address2.trim(),
    city: fields.city.trim(), state: fields.state.trim(), zip: fields.zipCode.trim(),
    phone: fields.phone.trim(), email: normalizeTenantEmail(fields.email),
    job_role: fields.jobRole.trim(), updated_at: new Date().toISOString(),
  };
  if (Number.isFinite(input.addressLat) && Number.isFinite(input.addressLng)) {
    row.lat = input.addressLat; row.lng = input.addressLng;
  }
  // Status, user_id and tenant_id cannot be overwritten by an applicant profile save.
  const result = existing
    ? await supabase.from("worker").update(row).eq("id", existing.id).eq("tenant_id", tenantId).eq("user_id", applicantId).select("id").single()
    : await supabase.from("worker").insert({ ...row, tenant_id: tenantId, user_id: applicantId, status: "new" }).select("id").single();
  if (result.error) {
    if (result.error.code === "23505") {
      const taken = tenantEmailTakenResult();
      return { ok: false, error: taken.error, code: taken.code, status: 409 };
    }
    return { ok: false, error: "Could not save worker profile", status: 500 };
  }
  const workerId = String(result.data.id);
  if (!input.skipOnboardingProgressInit) await ensureWorkerOnboardingProgress(supabase, workerId, tenantId);
  await Promise.all([
    invalidateResourceCache("worker", workerId), invalidateTenantCache("worker_search", tenantId),
    invalidateTenantCache("worker", tenantId), invalidateUserCache("worker", applicantId),
    invalidateTableCache("worker_search"), invalidateCandidateKpiCache(tenantId),
  ]);
  return { ok: true, workerId };
}
