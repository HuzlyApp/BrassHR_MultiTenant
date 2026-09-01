import type { SupabaseClient } from "@supabase/supabase-js";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";

export type WorkerJobMatchSummary = {
  applicationId: string;
  status: string | null;
  score: number | null;
  category: string | null;
  displayCategory: string | null;
};

type MatchAppRow = {
  id: string;
  worker_id: string | null;
  ai_match_status: string | null;
  ai_match_score: number | null;
  ai_match_category: string | null;
  ai_match_display_category: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function rowTimestamp(row: MatchAppRow): number {
  const raw = row.updated_at || row.created_at || 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Pick the highest analyzed score per worker; otherwise the newest application to analyze. */
export function pickWorkerJobMatchSummary(apps: MatchAppRow[]): WorkerJobMatchSummary | null {
  if (apps.length === 0) return null;

  const analyzed = apps.filter(
    (row) =>
      row.ai_match_status === "ANALYZED" &&
      row.ai_match_score != null &&
      Number.isFinite(Number(row.ai_match_score))
  );

  const chosen =
    analyzed.length > 0
      ? [...analyzed].sort((a, b) => {
          const scoreDiff = Number(b.ai_match_score) - Number(a.ai_match_score);
          if (scoreDiff !== 0) return scoreDiff;
          return rowTimestamp(b) - rowTimestamp(a);
        })[0]
      : [...apps].sort((a, b) => rowTimestamp(b) - rowTimestamp(a))[0];

  if (!chosen) return null;

  return {
    applicationId: chosen.id,
    status: chosen.ai_match_status,
    score: chosen.ai_match_score,
    category: chosen.ai_match_category,
    displayCategory: chosen.ai_match_display_category,
  };
}

/** Best job-application match per worker for candidates listing. */
export async function getWorkerJobMatchSummaries(
  supabase: SupabaseClient,
  args: { tenantId?: string | null; workerIds: string[] }
): Promise<Map<string, WorkerJobMatchSummary>> {
  const workerIds = Array.from(new Set(args.workerIds.filter(Boolean)));
  const result = new Map<string, WorkerJobMatchSummary>();
  if (workerIds.length === 0) return result;

  const { data, error } = await queryInChunks(workerIds, async (chunk) => {
    let query = supabase
      .from("job_applications")
      .select(
        "id, worker_id, ai_match_status, ai_match_score, ai_match_category, ai_match_display_category, updated_at, created_at"
      )
      .in("worker_id", chunk)
      .not("status", "in", '("rejected","withdrawn")');

    if (args.tenantId) {
      query = query.eq("tenant_id", args.tenantId);
    }

    const result = await query;
    return { data: (result.data ?? []) as MatchAppRow[], error: result.error };
  });
  if (error) throw error;

  const byWorker = new Map<string, MatchAppRow[]>();
  for (const row of data) {
    const workerId = row.worker_id?.trim();
    if (!workerId) continue;
    const list = byWorker.get(workerId) ?? [];
    list.push(row);
    byWorker.set(workerId, list);
  }

  for (const [workerId, apps] of byWorker) {
    const summary = pickWorkerJobMatchSummary(apps);
    if (summary) result.set(workerId, summary);
  }

  return result;
}
