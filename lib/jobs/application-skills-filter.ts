import type { SupabaseClient } from "@supabase/supabase-js";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";
import {
  IMPORT_RESUME_EXCERPT_CHARS,
  skillsPresentInHaystack,
} from "@/lib/jobs/candidate-import-match";

const MAX_SKILLS_FILTER = 16;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Parse a comma-separated skills query param into unique phrases (max 16). */
export function parseSkillsFilterParam(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const skill = part.trim();
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
    if (out.length >= MAX_SKILLS_FILTER) break;
  }
  return out;
}

/**
 * Keep workers whose resume text and/or profile skills contain every listed skill
 * (same phrase matching as Import Candidates).
 */
export async function filterWorkerIdsMatchingSkills(
  supabase: SupabaseClient,
  tenantId: string,
  workerIds: string[],
  skills: string[]
): Promise<Set<string>> {
  const uniqueWorkers = Array.from(new Set(workerIds.map((id) => id.trim()).filter(Boolean)));
  if (!skills.length) return new Set(uniqueWorkers);
  if (!uniqueWorkers.length) return new Set();

  const [resumesResult, skillsResult] = await Promise.all([
    queryInChunks(uniqueWorkers, async (chunk) => {
      const result = await supabase
        .from("worker_resumes")
        .select("worker_id, extracted_text, uploaded_at")
        .eq("tenant_id", tenantId)
        .in("worker_id", chunk)
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false });
      return { data: result.data ?? [], error: result.error };
    }),
    queryInChunks(uniqueWorkers, async (chunk) => {
      const result = await supabase
        .from("worker_profile_skills")
        .select("worker_id, skill_name")
        .eq("tenant_id", tenantId)
        .in("worker_id", chunk);
      return { data: result.data ?? [], error: result.error };
    }),
  ]);

  if (resumesResult.error) {
    throw new Error(
      (resumesResult.error as { message?: string }).message || "Failed to load resumes for skills filter"
    );
  }
  if (skillsResult.error) {
    throw new Error(
      (skillsResult.error as { message?: string }).message ||
        "Failed to load profile skills for skills filter"
    );
  }

  const resumes = new Map<string, string>();
  for (const row of resumesResult.data as Array<{
    worker_id?: string | null;
    extracted_text?: string | null;
  }>) {
    const workerId = asText(row.worker_id);
    if (!workerId || resumes.has(workerId)) continue;
    resumes.set(workerId, asText(row.extracted_text).slice(0, IMPORT_RESUME_EXCERPT_CHARS));
  }

  const profileSkills = new Map<string, string[]>();
  for (const row of skillsResult.data as Array<{
    worker_id?: string | null;
    skill_name?: string | null;
  }>) {
    const workerId = asText(row.worker_id);
    const skill = asText(row.skill_name);
    if (!workerId || !skill) continue;
    const list = profileSkills.get(workerId) ?? [];
    if (!list.some((item) => item.toLowerCase() === skill.toLowerCase())) list.push(skill);
    profileSkills.set(workerId, list);
  }

  const matched = new Set<string>();
  for (const workerId of uniqueWorkers) {
    const resumeText = resumes.get(workerId) ?? "";
    const skillsText = (profileSkills.get(workerId) ?? []).join(" ");
    const haystack = `${resumeText}\n${skillsText}`.toLowerCase();
    if (skillsPresentInHaystack(haystack, skills)) {
      matched.add(workerId);
    }
  }
  return matched;
}
