import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import {
  findWorkerTenantEmailConflict,
  normalizeTenantEmail,
  tenantEmailTakenResult,
} from "@/lib/tenant/tenant-email-uniqueness";

export type EnsureAdminCandidateWorkerInput = {
  tenantId: string;
  applicantProfileId: string;
  existingWorkerId?: string | null;
  email: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  streetAddress?: string | null;
  cityStateZip?: string | null;
  lastJobTitle?: string | null;
  resumePath?: string | null;
};

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function isMissingColumnErr(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === "42703") return true;
  return typeof err.message === "string" && err.message.includes(" does not exist");
}

function isUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === "23505") return true;
  return typeof err.message === "string" && /duplicate key|unique constraint/i.test(err.message);
}

function describeDbErr(error: unknown, fallback = "Database error"): string {
  const err = error as { message?: string; details?: string; hint?: string } | null;
  if (!err) return fallback;
  return [err.message, err.details, err.hint].filter(Boolean).join(" — ") || fallback;
}

async function findWorkerById(
  supabase: SupabaseClient,
  tenantId: string,
  workerId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("worker")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", workerId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ? { id: String(data.id) } : null;
}

async function findWorkerLinkedToAnotherProfile(
  supabase: SupabaseClient,
  tenantId: string,
  workerId: string,
  applicantProfileId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("applicant_profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("worker_id", workerId)
    .neq("id", applicantProfileId)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

async function persistWorkerResumePath(
  supabase: SupabaseClient,
  tenantId: string,
  workerId: string,
  resumePath: string
): Promise<void> {
  const trimmed = resumePath.trim();
  if (!trimmed) return;

  const { data: existingRows, error: selectError } = await supabase
    .from("worker_requirements")
    .select("id")
    .eq("worker_id", workerId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (selectError) throw selectError;

  const updatedAt = new Date().toISOString();
  const existing = existingRows?.[0] as { id: string | number } | undefined;
  if (existing?.id != null) {
    const { error } = await supabase
      .from("worker_requirements")
      .update({ resume_path: trimmed, updated_at: updatedAt })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error: insertError } = await supabase.from("worker_requirements").insert({
    tenant_id: tenantId,
    worker_id: workerId,
    resume_path: trimmed,
    updated_at: updatedAt,
  });
  if (insertError) throw insertError;
}

async function upsertWorkerRow(
  supabase: SupabaseClient,
  input: EnsureAdminCandidateWorkerInput,
  workerId: string | null,
  emailNorm: string,
  workerPayload: Record<string, unknown>
): Promise<string> {
  if (workerId) {
    const { error: updateError } = await supabase
      .from("worker")
      .update(workerPayload)
      .eq("id", workerId)
      .eq("tenant_id", input.tenantId);
    if (updateError) {
      if (isUniqueViolation(updateError)) {
        throw new Error(tenantEmailTakenResult().error);
      }
      throw new Error(describeDbErr(updateError, "Failed to update worker profile"));
    }
    return workerId;
  }

  const insertAttempts: Record<string, unknown>[] = [
    workerPayload,
    { ...workerPayload, status: undefined },
  ];
  let lastError: unknown = null;

  for (const attempt of insertAttempts) {
    const { data, error } = await supabase
      .from("worker")
      .insert(attempt)
      .select("id")
      .single();
    if (!error && data?.id) return String(data.id);
    lastError = error;
    if (!isMissingColumnErr(error)) break;
  }

  if (isUniqueViolation(lastError) && emailNorm) {
    const conflict = await findWorkerTenantEmailConflict(supabase, {
      tenantId: input.tenantId,
      email: emailNorm,
    });
    if (conflict?.id) {
      return upsertWorkerRow(supabase, input, conflict.id, emailNorm, workerPayload);
    }
  }

  if (isUniqueViolation(lastError)) {
    throw new Error(tenantEmailTakenResult().error);
  }
  throw new Error(describeDbErr(lastError, "Failed to create worker profile"));
}

/**
 * Ensure admin-added candidates have a linked `worker` row + resume on worker_requirements
 * so recruiter detail (resume preview, message, call, interview) works immediately.
 */
export async function ensureAdminCandidateWorker(
  supabase: SupabaseClient,
  input: EnsureAdminCandidateWorkerInput
): Promise<{ workerId: string }> {
  const emailNorm = normalizeTenantEmail(input.email);
  const nowIso = new Date().toISOString();
  const workerPayload: Record<string, unknown> = {
    tenant_id: input.tenantId,
    first_name: input.firstName.trim(),
    last_name: clean(input.lastName),
    phone: clean(input.phone),
    email: emailNorm,
    address1: clean(input.streetAddress),
    city: clean(input.cityStateZip),
    job_role: clean(input.lastJobTitle),
    status: "new",
    updated_at: nowIso,
  };

  let workerId = clean(input.existingWorkerId);
  if (workerId) {
    const existing = await findWorkerById(supabase, input.tenantId, workerId);
    if (!existing) workerId = null;
  }

  if (!workerId && emailNorm) {
    const conflict = await findWorkerTenantEmailConflict(supabase, {
      tenantId: input.tenantId,
      email: emailNorm,
    });
    if (conflict?.id) workerId = conflict.id;
  }

  if (workerId) {
    const linkedElsewhere = await findWorkerLinkedToAnotherProfile(
      supabase,
      input.tenantId,
      workerId,
      input.applicantProfileId
    );
    if (linkedElsewhere) {
      throw new Error(tenantEmailTakenResult().error);
    }
  }

  const resolvedWorkerId = await upsertWorkerRow(
    supabase,
    input,
    workerId,
    emailNorm,
    workerPayload
  );

  try {
    await ensureWorkerOnboardingProgress(supabase, resolvedWorkerId, input.tenantId);
  } catch (progressError) {
    console.error("[ensure-admin-candidate-worker] progress init", progressError);
  }

  const resumePath = clean(input.resumePath);
  if (resumePath) {
    await persistWorkerResumePath(supabase, input.tenantId, resolvedWorkerId, resumePath);
  }

  const { error: profileLinkError } = await supabase
    .from("applicant_profiles")
    .update({ worker_id: resolvedWorkerId, updated_at: nowIso })
    .eq("id", input.applicantProfileId)
    .eq("tenant_id", input.tenantId);
  if (profileLinkError) {
    if (isUniqueViolation(profileLinkError)) {
      throw new Error(tenantEmailTakenResult().error);
    }
    throw new Error(describeDbErr(profileLinkError, "Failed to link applicant profile"));
  }

  return { workerId: resolvedWorkerId };
}
