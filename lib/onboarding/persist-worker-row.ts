import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Step1FormFields } from "@/lib/onboardingStep1Validation"
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress"
import {
  invalidateResourceCache,
  invalidateTableCache,
  invalidateTenantCache,
  invalidateUserCache,
} from "@/lib/cache"

function isMissingColumnErr(e: unknown) {
  const err = e as { code?: string; message?: string } | null
  if (!err) return false
  if (err.code === "42703") return true
  return typeof err.message === "string" && err.message.includes(" does not exist")
}

export type PersistWorkerRowInput = {
  applicantId: string
  tenantId: string
  fields: Step1FormFields
  status?: string
  addressLat?: number
  addressLng?: number
  addressNormalized?: string
}

export type PersistWorkerRowResult =
  | { ok: true; workerId: string }
  | { ok: false; error: string; code?: string; status?: number }

/** Insert or update `worker` by `user_id` (service-role onboarding APIs). */
export async function persistWorkerRow(
  supabase: SupabaseClient,
  input: PersistWorkerRowInput
): Promise<PersistWorkerRowResult> {
  const { applicantId, tenantId, fields } = input
  const emailNorm = fields.email.trim().toLowerCase()

  const baseRow: Record<string, unknown> = {
    tenant_id: tenantId,
    user_id: applicantId,
    first_name: fields.firstName.trim(),
    last_name: fields.lastName.trim(),
    address1: fields.address1.trim(),
    address2: fields.address2.trim(),
    city: fields.city.trim(),
    state: fields.state.trim(),
    zip: fields.zipCode.trim(),
    phone: fields.phone.trim(),
    email: emailNorm,
    job_role: fields.jobRole.trim(),
    updated_at: new Date().toISOString(),
  }

  const hasGeo =
    Number.isFinite(input.addressLat) &&
    Number.isFinite(input.addressLng) &&
    typeof input.addressNormalized === "string" &&
    input.addressNormalized.trim().length > 0

  if (hasGeo) {
    baseRow.lat = input.addressLat
    baseRow.lng = input.addressLng
  }

  if (emailNorm) {
    const { data: dupRows, error: dupErr } = await supabase
      .from("worker")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", emailNorm)
      .neq("user_id", applicantId)
      .limit(1)

    if (dupErr) throw dupErr
    if (dupRows && dupRows.length > 0) {
      return {
        ok: false,
        error:
          "This email is already used by another application. Sign in or use a different email.",
        code: "DUPLICATE_EMAIL",
        status: 409,
      }
    }
  }

  const rawStatus = String(input.status ?? "").trim()
  const rowAttempts: Record<string, unknown>[] = [
    rawStatus ? { ...baseRow, status: rawStatus } : { ...baseRow },
    rawStatus ? { ...baseRow, worker_status: rawStatus } : { ...baseRow },
    { ...baseRow },
  ]

  const { data: existingRows, error: selErr } = await supabase
    .from("worker")
    .select("id")
    .eq("user_id", applicantId)
    .limit(1)

  if (selErr) throw selErr
  const existingId = existingRows?.[0]?.id != null ? String(existingRows[0].id) : null

  if (existingId) {
    let lastErr: unknown = null
    for (const attempt of rowAttempts) {
      const { user_id: _u, ...updatePayload } = attempt as Record<string, unknown>
      const { error: upErr } = await supabase.from("worker").update(updatePayload).eq("id", existingId)
      if (!upErr) {
        lastErr = null
        break
      }
      lastErr = upErr
      if (!isMissingColumnErr(upErr)) break
    }
    if (lastErr) {
      const upErr = lastErr as { message?: string; details?: string; hint?: string; code?: string }
      if (upErr.code === "23505" && /email|worker/i.test(String(upErr.message))) {
        return {
          ok: false,
          error:
            "This email is already used by another application. Sign in or use a different email.",
          code: "DUPLICATE_EMAIL",
          status: 409,
        }
      }
      const msg = [upErr.message, upErr.details, upErr.hint].filter(Boolean).join(" — ")
      return { ok: false, error: msg || "Database error", status: 500 }
    }
  } else {
    let lastErr: unknown = null
    for (const attempt of rowAttempts) {
      const { error: insErr } = await supabase.from("worker").insert(attempt)
      if (!insErr) {
        lastErr = null
        break
      }
      lastErr = insErr
      if (!isMissingColumnErr(insErr)) break
    }
    if (lastErr) {
      const insErr = lastErr as { message?: string; details?: string; hint?: string; code?: string }
      if (insErr.code === "23505" && /email|worker/i.test(String(insErr.message))) {
        return {
          ok: false,
          error:
            "This email is already used by another application. Sign in or use a different email.",
          code: "DUPLICATE_EMAIL",
          status: 409,
        }
      }
      const msg = [insErr.message, insErr.details, insErr.hint].filter(Boolean).join(" — ")
      return { ok: false, error: msg || "Database error", status: 500 }
    }
  }

  const { data: workerAfter } = await supabase
    .from("worker")
    .select("id")
    .eq("user_id", applicantId)
    .maybeSingle()

  const workerId = workerAfter?.id ? String(workerAfter.id) : existingId
  if (!workerId) {
    return { ok: false, error: "Worker row missing after save", status: 500 }
  }

  try {
    await ensureWorkerOnboardingProgress(supabase, workerId, tenantId)
  } catch (e) {
    console.error("[persist-worker-row] progress init", e)
  }

  await Promise.all([
    invalidateResourceCache("worker", workerId),
    invalidateTenantCache("worker_search", tenantId),
    invalidateTenantCache("worker", tenantId),
    invalidateUserCache("worker", applicantId),
    invalidateTableCache("worker_search"),
  ])

  return { ok: true, workerId }
}
