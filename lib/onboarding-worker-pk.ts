import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-tenant-id-by-slug"
import { resolveDefaultTenantId } from "@/lib/tenant/resolve-default-tenant-id"
import { resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug"

export type WorkerSessionContext = {
  id: string
  tenantId: string
}

type WorkerRow = {
  id: string
  tenant_id: string | null
}

/** Active onboarding tenant from ?tenant= or subdomain cookie (browser only). */
async function resolveActiveOnboardingTenantId(
  supabase: SupabaseClient
): Promise<string | null> {
  if (typeof window === "undefined") return null
  const slug = resolveClientOnboardingTenantSlug(window.location.search)
  if (!slug) return null
  try {
    return await resolveTenantIdBySlug(supabase, slug)
  } catch (err) {
    console.warn("[resolveActiveOnboardingTenantId]", err)
    return null
  }
}

async function loadWorkerRowForUser(
  supabase: SupabaseClient,
  uid: string,
  tenantId?: string | null
): Promise<WorkerRow | null> {
  let query = supabase.from("worker").select("id, tenant_id").eq("user_id", uid)

  if (tenantId) {
    const { data: worker, error } = await query.eq("tenant_id", tenantId).maybeSingle()
    if (error) {
      console.warn("[loadWorkerRowForUser]", error.message)
      return null
    }
    return worker?.id ? worker : null
  }

  const { data: rows, error } = await query.limit(2)
  if (error) {
    console.warn("[loadWorkerRowForUser]", error.message)
    return null
  }
  if (!rows?.length) return null
  if (rows.length > 1) {
    console.warn(
      "[loadWorkerRowForUser] Multiple worker rows without tenant scope; use tenant subdomain or ?tenant=."
    )
    return null
  }
  return rows[0]
}

/**
 * Signed-in applicant worker row (`user_id` matches session) plus tenant for FK columns
 * (`skill_assessments.tenant_id`, etc.). Scoped to the active onboarding tenant when known.
 */
export async function getWorkerSessionContext(
  supabase: SupabaseClient
): Promise<WorkerSessionContext | null> {
  const { data: userData } = await supabase.auth.getUser()
  const authId = userData?.user?.id
  const applicantFromLs =
    typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || null : null
  const uid = authId ?? applicantFromLs
  if (!uid) return null

  const scopedTenantId = await resolveActiveOnboardingTenantId(supabase)
  const worker = await loadWorkerRowForUser(supabase, uid, scopedTenantId)
  if (!worker?.id) return null

  const wt = worker.tenant_id as string | null
  if (wt) {
    return { id: String(worker.id), tenantId: String(wt) }
  }

  const resolved = await resolveDefaultTenantId(supabase)
  if (!resolved.ok) {
    console.warn("[getWorkerSessionContext]", resolved.error)
    return null
  }
  return { id: String(worker.id), tenantId: resolved.tenantId }
}

/**
 * Loads worker context; when `ensure` is true, creates a worker row from parsed resume
 * if profile review was skipped in the tenant onboarding flow.
 */
export async function resolveWorkerSessionContext(
  supabase: SupabaseClient,
  options?: { ensure?: boolean }
): Promise<WorkerSessionContext | null> {
  const existing = await getWorkerSessionContext(supabase)
  if (existing) return existing
  if (!options?.ensure || typeof window === "undefined") return null

  const { ensureApplicantWorker } = await import("@/lib/onboarding/ensure-applicant-worker")
  const ensured = await ensureApplicantWorker()
  if (!ensured.ok) {
    console.warn("[resolveWorkerSessionContext]", ensured.error)
    return null
  }
  return getWorkerSessionContext(supabase)
}

/** Returns `worker.id` when a worker row exists for the session applicant / auth user. */
export async function getWorkerPrimaryKey(supabase: SupabaseClient): Promise<string | null> {
  const ctx = await getWorkerSessionContext(supabase)
  return ctx?.id ?? null
}

/** Legacy `skill_assessments.worker_id`: worker PK or stable user id string. */
export async function getSkillAssessmentWorkerKey(supabase: SupabaseClient): Promise<string | null> {
  const pk = await getWorkerPrimaryKey(supabase)
  if (pk) return pk
  const { data: userData } = await supabase.auth.getUser()
  return userData?.user?.id ?? null
}
