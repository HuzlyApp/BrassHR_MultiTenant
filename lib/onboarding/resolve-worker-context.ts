import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isDraftPreviewApplicantId } from "@/lib/onboarding/is-draft-preview";
import { persistWorkerRow } from "@/lib/onboarding/persist-worker-row";
import { resumeToStep1Fields } from "@/lib/onboarding/resume-to-step1-fields";
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-tenant-id-by-slug";

export { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-tenant-id-by-slug";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidLike(value: string | null | undefined): boolean {
  return UUID_RE.test((value ?? "").trim());
}

export type WorkerContext = {
  workerId: string;
  tenantId: string;
  userId: string;
};

async function loadWorkerContext(
  supabase: SupabaseClient,
  column: "user_id" | "id",
  value: string,
  tenantId?: string | null
): Promise<WorkerContext | null> {
  let query = supabase
    .from("worker")
    .select("id, tenant_id, user_id")
    .eq(column, value);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: worker, error } = await query.maybeSingle();

  if (error) throw error;
  if (!worker?.id || worker.tenant_id == null) return null;

  return {
    workerId: String(worker.id),
    tenantId: String(worker.tenant_id),
    userId: String(worker.user_id ?? value),
  };
}

export async function resolveWorkerByApplicantId(
  supabase: SupabaseClient,
  applicantId: string,
  tenantId?: string | null
): Promise<WorkerContext | null> {
  if (isDraftPreviewApplicantId(applicantId)) return null;

  if (tenantId) {
    const scoped = await loadWorkerContext(supabase, "user_id", applicantId, tenantId);
    if (scoped) return scoped;
  }

  const byUserId = await loadWorkerContext(supabase, "user_id", applicantId);
  if (byUserId) return byUserId;

  if (!isUuidLike(applicantId)) return null;

  return loadWorkerContext(supabase, "id", applicantId, tenantId);
}

/** Ensures a worker row exists for onboarding APIs when only the auth applicant id is known. */
export async function resolveOrEnsureWorkerForApplicant(
  supabase: SupabaseClient,
  applicantId: string,
  tenantSlug?: string | null
): Promise<WorkerContext | null> {
  if (isDraftPreviewApplicantId(applicantId)) return null;

  // Fast path: worker already exists (common during resume upload).
  const existing = await resolveWorkerByApplicantId(supabase, applicantId);
  if (existing) return existing;

  const slug = tenantSlug?.trim().toLowerCase() || "";
  if (!slug) return null;

  const tenantId = await resolveTenantIdBySlug(supabase, slug);
  if (!tenantId) return null;

  const scoped = await resolveWorkerByApplicantId(supabase, applicantId, tenantId);
  if (scoped) return scoped;

  const saved = await persistWorkerRow(supabase, {
    applicantId,
    tenantId,
    fields: resumeToStep1Fields({}, applicantId),
    skipOnboardingProgressInit: true,
  });
  if (!saved.ok) return null;

  return resolveWorkerByApplicantId(supabase, applicantId, tenantId);
}
