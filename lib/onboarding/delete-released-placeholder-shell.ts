import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { deleteOrphanWorkersAfterApplicationDelete } from "@/lib/jobs/service"
import { isPlaceholderWorkerName } from "@/lib/resume/worker-resume-file-name"

const PLACEHOLDER_PHONE = "0000000000"

export type PlaceholderShellCandidate = {
  id: string
  user_id?: string | null
  email?: string | null
  phone?: string | null
  first_name?: string | null
  last_name?: string | null
}

/**
 * Only delete shells created by resume-first ensure-worker defaults after they were
 * released (user_id cleared) and applications moved to the real profile worker.
 */
export function isSafeReleasedPlaceholderShell(
  worker: PlaceholderShellCandidate,
  resolvedWorkerId: string
): boolean {
  const id = String(worker.id ?? "").trim()
  if (!id || id === resolvedWorkerId) return false
  if (worker.user_id) return false
  if (String(worker.email ?? "").trim()) return false

  if (!isPlaceholderWorkerName(worker.first_name, worker.last_name)) return false

  const phoneDigits = String(worker.phone ?? "").replace(/\D/g, "")
  if (phoneDigits && phoneDigits !== PLACEHOLDER_PHONE) return false

  return true
}

/**
 * After profile-review resolves an existing email worker, the early "Applicant User"
 * shell is released but used to remain on Candidates. Delete it only when safe.
 */
export async function deleteReleasedPlaceholderShell(
  supabase: SupabaseClient,
  params: {
    tenantId: string
    shellWorkerId: string
    resolvedWorkerId: string
  }
): Promise<{ deleted: boolean; reason?: string }> {
  const shellWorkerId = String(params.shellWorkerId ?? "").trim()
  const resolvedWorkerId = String(params.resolvedWorkerId ?? "").trim()
  if (!shellWorkerId || !resolvedWorkerId || shellWorkerId === resolvedWorkerId) {
    return { deleted: false, reason: "same_or_missing_worker" }
  }

  const { data, error } = await supabase
    .from("worker")
    .select("id, user_id, email, phone, first_name, last_name")
    .eq("id", shellWorkerId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle()
  if (error) throw error
  if (!data?.id) return { deleted: false, reason: "shell_not_found" }

  if (!isSafeReleasedPlaceholderShell(data, resolvedWorkerId)) {
    return { deleted: false, reason: "not_safe_placeholder" }
  }

  const { deletedWorkerIds } = await deleteOrphanWorkersAfterApplicationDelete(
    supabase,
    params.tenantId,
    [shellWorkerId]
  )
  return {
    deleted: deletedWorkerIds.includes(shellWorkerId),
    reason: deletedWorkerIds.includes(shellWorkerId) ? undefined : "still_has_applications",
  }
}
