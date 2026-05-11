import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Saves the resume storage object path (within worker-resumes bucket) to worker_requirements.
 * No-op if there is no worker row for applicantId.
 */
export async function persistWorkerResumePath(
  supabase: SupabaseClient,
  applicantId: string,
  resumePath: string
): Promise<void> {
  const trimmed = resumePath.trim()
  if (!trimmed) return

  const { data: worker, error: wErr } = await supabase
    .from("worker")
    .select("id, tenant_id")
    .eq("user_id", applicantId)
    .maybeSingle()

  if (wErr) throw wErr
  if (!worker?.id || worker.tenant_id == null) return

  const tenantId = String(worker.tenant_id)

  const { data: existingRows, error: selErr } = await supabase
    .from("worker_requirements")
    .select("id")
    .or(`worker_id.eq.${worker.id},worker_id.eq.${applicantId}`)
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
    tenant_id: tenantId,
    worker_id: worker.id,
    resume_path: trimmed,
    updated_at,
  })

  if (insErr) throw insErr
}
