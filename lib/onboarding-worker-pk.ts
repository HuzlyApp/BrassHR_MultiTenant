import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveDefaultTenantId } from "@/lib/tenant/resolve-default-tenant-id"

export type WorkerSessionContext = {
  id: string
  tenantId: string
}

/**
 * Signed-in applicant worker row (`user_id` matches session) plus tenant for FK columns
 * (`skill_assessments.tenant_id`, etc.). Uses `tenant_id` on worker when present, else resolves default.
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

  const { data: worker, error } = await supabase
    .from("worker")
    .select("id, tenant_id")
    .eq("user_id", uid)
    .maybeSingle()

  if (error || !worker?.id) return null

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
