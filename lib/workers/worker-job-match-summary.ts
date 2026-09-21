import type { SupabaseClient } from "@supabase/supabase-js";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";
import type { ListingRequirementOutcomeCounts } from "@/lib/jobs/match-analysis/workspace";

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

function isAnalyzedWithScore(row: MatchAppRow): boolean {
  return (
    row.ai_match_status === "ANALYZED" &&
    row.ai_match_score != null &&
    Number.isFinite(Number(row.ai_match_score))
  );
}

function toSummary(row: MatchAppRow): WorkerJobMatchSummary {
  return {
    applicationId: row.id,
    status: row.ai_match_status,
    score: row.ai_match_score,
    category: row.ai_match_category,
    displayCategory: row.ai_match_display_category,
  };
}

/** Pick the highest analyzed score per worker; otherwise the newest application to analyze. */
export function pickWorkerJobMatchSummary(apps: MatchAppRow[]): WorkerJobMatchSummary | null {
  if (apps.length === 0) return null;

  const analyzed = apps.filter(isAnalyzedWithScore);

  const chosen =
    analyzed.length > 0
      ? [...analyzed].sort((a, b) => {
          const scoreDiff = Number(b.ai_match_score) - Number(a.ai_match_score);
          if (scoreDiff !== 0) return scoreDiff;
          return rowTimestamp(b) - rowTimestamp(a);
        })[0]
      : [...apps].sort((a, b) => rowTimestamp(b) - rowTimestamp(a))[0];

  if (!chosen) return null;
  return toSummary(chosen);
}

/**
 * Prefer analyzed applications that have Conf/Verify/Not Met checklist rows.
 * Falls back to highest score, then newest app.
 */
export function pickWorkerJobMatchSummaryPreferringRequirementCounts(
  apps: MatchAppRow[],
  countsByApplication: Map<string, ListingRequirementOutcomeCounts>
): WorkerJobMatchSummary | null {
  if (apps.length === 0) return null;

  const analyzed = apps.filter(isAnalyzedWithScore);
  if (analyzed.length === 0) {
    return pickWorkerJobMatchSummary(apps);
  }

  const chosen = [...analyzed].sort((a, b) => {
    const aHas = countsByApplication.has(a.id) ? 1 : 0;
    const bHas = countsByApplication.has(b.id) ? 1 : 0;
    if (bHas !== aHas) return bHas - aHas;
    const scoreDiff = Number(b.ai_match_score) - Number(a.ai_match_score);
    if (scoreDiff !== 0) return scoreDiff;
    return rowTimestamp(b) - rowTimestamp(a);
  })[0];

  return chosen ? toSummary(chosen) : null;
}

export type WorkerJobMatchSummariesResult = {
  summaries: Map<string, WorkerJobMatchSummary>;
  /** All ANALYZED application ids for the requested workers (for count loading). */
  analyzedApplicationIds: string[];
  appsByWorker: Map<string, MatchAppRow[]>;
};

/** Best job-application match per worker for candidates listing. */
export async function getWorkerJobMatchSummaries(
  supabase: SupabaseClient,
  args: { tenantId?: string | null; workerIds: string[] }
): Promise<WorkerJobMatchSummariesResult> {
  const workerIds = Array.from(new Set(args.workerIds.filter(Boolean)));
  const summaries = new Map<string, WorkerJobMatchSummary>();
  const appsByWorker = new Map<string, MatchAppRow[]>();
  const analyzedApplicationIds: string[] = [];
  if (workerIds.length === 0) {
    return { summaries, analyzedApplicationIds, appsByWorker };
  }

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

  for (const row of data) {
    const workerId = row.worker_id?.trim();
    if (!workerId) continue;
    const list = appsByWorker.get(workerId) ?? [];
    list.push(row);
    appsByWorker.set(workerId, list);
    if (isAnalyzedWithScore(row)) analyzedApplicationIds.push(row.id);
  }

  for (const [workerId, apps] of appsByWorker) {
    const summary = pickWorkerJobMatchSummary(apps);
    if (summary) summaries.set(workerId, summary);
  }

  return { summaries, analyzedApplicationIds, appsByWorker };
}
