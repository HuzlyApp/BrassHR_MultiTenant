import type { SupabaseClient } from "@supabase/supabase-js"

export type WorkerProfileSkill = {
  id: string
  skill_name: string
  created_at: string | null
}

function isMissingTableError(error: { message?: string }): boolean {
  return /not find|does not exist|schema cache/i.test(error.message ?? "")
}

export function normalizeWorkerProfileSkillName(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().replace(/\s+/g, " ")
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null
}

export async function loadWorkerProfileSkills(
  supabase: SupabaseClient,
  workerId: string
): Promise<WorkerProfileSkill[]> {
  const { data, error } = await supabase
    .from("worker_profile_skills")
    .select("id, skill_name, created_at")
    .eq("worker_id", workerId)
    .order("created_at", { ascending: true })

  if (error) {
    if (isMissingTableError(error)) return []
    throw error
  }

  return ((data ?? []) as Array<{ id?: string; skill_name?: string; created_at?: string | null }>)
    .filter((row) => row.id && row.skill_name)
    .map((row) => ({
      id: String(row.id),
      skill_name: String(row.skill_name).trim(),
      created_at: row.created_at != null ? String(row.created_at) : null,
    }))
}
