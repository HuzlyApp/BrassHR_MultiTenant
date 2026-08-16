import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Points worker_requirements.resume_path at the newest non-deleted resume for this worker.
 */
export async function syncWorkerPrimaryResumePath(
  supabase: SupabaseClient,
  workerId: string,
  userId?: string | null
): Promise<void> {
  const { data: latest, error: latestErr } = await supabase
    .from("worker_resumes")
    .select("file_url, storage_path")
    .eq("worker_id", workerId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) throw latestErr;

  const resumePath =
    (latest?.storage_path as string | null)?.trim() ||
    (latest?.file_url as string | null)?.trim() ||
    null;

  const { data: existingRows, error: selErr } = await supabase
    .from("worker_requirements")
    .select("id")
    .or(
      userId && userId.trim()
        ? `worker_id.eq.${workerId},worker_id.eq.${userId.trim()}`
        : `worker_id.eq.${workerId}`
    )
    .order("updated_at", { ascending: false })
    .limit(1);

  if (selErr) throw selErr;

  const updated_at = new Date().toISOString();
  const existing = existingRows?.[0] as { id: string | number } | undefined;

  if (!resumePath) {
    if (existing?.id != null) {
      const { error } = await supabase
        .from("worker_requirements")
        .update({ resume_path: null, updated_at })
        .eq("id", existing.id);
      if (error) throw error;
    }
    return;
  }

  if (existing?.id != null) {
    const { error } = await supabase
      .from("worker_requirements")
      .update({ resume_path: resumePath, updated_at })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { data: workerRow, error: workerErr } = await supabase
    .from("worker")
    .select("tenant_id")
    .eq("id", workerId)
    .maybeSingle();
  if (workerErr) throw workerErr;
  const tenantId = workerRow?.tenant_id != null ? String(workerRow.tenant_id) : null;
  if (!tenantId) return;

  const { error: insErr } = await supabase.from("worker_requirements").insert({
    tenant_id: tenantId,
    worker_id: workerId,
    resume_path: resumePath,
    updated_at,
  });
  if (insErr) throw insErr;
}
