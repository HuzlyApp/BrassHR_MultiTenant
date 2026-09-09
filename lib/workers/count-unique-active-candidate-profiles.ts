import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { selectUniqueCandidateProfilesInOrder } from "@/lib/workers/candidate-identity";
import { ACTIVE_CANDIDATE_PIPELINE_STATUSES } from "@/lib/workers/candidate-status-label";

type WorkerIdentityRow = {
  id?: string;
  status?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at?: string | null;
};

function isPipelineBaseStatus(status: string): boolean {
  if (!status) return true;
  return (ACTIVE_CANDIDATE_PIPELINE_STATUSES as readonly string[]).includes(status);
}

/**
 * Count unique candidate profiles for a tenant (email, or phone+name),
 * using the same pipeline + conversion scope as the Candidates screen Active KPI.
 */
export async function countUniqueActiveCandidateProfiles(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const pageSize = 1000;
  const workerRows: WorkerIdentityRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("worker")
      .select("id, status, email, phone, first_name, last_name, created_at")
      .eq("tenant_id", tenantId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as WorkerIdentityRow[];
    workerRows.push(...page);
    if (page.length < pageSize) break;
  }

  const convertedIds = new Set<string>();
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("workers")
      .select("candidate_id")
      .eq("tenant_id", tenantId)
      .not("candidate_id", "is", null)
      .range(from, from + pageSize - 1);
    if (error) {
      if (!String(error.message ?? "").includes("does not exist")) throw error;
      break;
    }
    const page = (data ?? []) as Array<{ candidate_id?: string | null }>;
    for (const row of page) {
      const id = String(row.candidate_id ?? "").trim();
      if (id) convertedIds.add(id);
    }
    if (page.length < pageSize) break;
  }

  const baseRows = workerRows.filter((row) => {
    const id = String(row.id ?? "").trim();
    const status = String(row.status ?? "").trim().toLowerCase();
    if (!id || convertedIds.has(id) || status === "converted") return false;
    if (!isPipelineBaseStatus(status)) return false;
    return status !== "disapproved" && status !== "rejected";
  });

  return selectUniqueCandidateProfilesInOrder(baseRows.map((row) => ({ ...row }))).length;
}
