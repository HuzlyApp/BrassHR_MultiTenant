import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context"

/**
 * Saves the resume storage object path (within worker-resumes bucket) to worker_requirements.
 * No-op if there is no worker row for applicantId.
 */
export async function persistWorkerResumePath(
  supabase: SupabaseClient,
  applicantId: string,
  resumePath: string,
  tenantId?: string | null
): Promise<void> {
  const trimmed = resumePath.trim()
  if (!trimmed) return

  const workerCtx = await resolveWorkerByApplicantId(supabase, applicantId, tenantId)
  if (!workerCtx?.workerId || !workerCtx.tenantId) return

  const { data: existingRows, error: selErr } = await supabase
    .from("worker_requirements")
    .select("id")
    .or(`worker_id.eq.${workerCtx.workerId},worker_id.eq.${applicantId}`)
    .order("updated_at", { ascending: false })
    .limit(1)

  if (selErr) throw selErr

  const existing = existingRows?.[0] as { id: string | number } | undefined
  const updated_at = new Date().toISOString()

  if (existing?.id != null) {
    const { error } = await supabase
      .from("worker_requirements")
      .update({ resume_path: trimmed, updated_at })
      .eq("id", existing.id)
    if (error) throw error
    return
  }

  const { error: insErr } = await supabase.from("worker_requirements").insert({
    tenant_id: workerCtx.tenantId,
    worker_id: workerCtx.workerId,
    resume_path: trimmed,
    updated_at,
  })

  if (insErr) throw insErr
}
