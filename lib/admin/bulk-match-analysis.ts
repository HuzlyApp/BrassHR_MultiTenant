export const MATCH_ANALYSIS_BULK_CHUNK = 25;

export type BulkMatchAnalysisItem = {
  jobApplicationId: string;
  result?: {
    status?: string;
    score?: number | null;
    category?: string | null;
    action?: string | null;
    readiness?: string | null;
    error?: string | null;
    analysis?: { candidate_match?: { display_category?: string } } | null;
  };
};

export function isMatchAnalyzedStatus(status: string | null | undefined): boolean {
  return (status ?? "").trim().toUpperCase() === "ANALYZED";
}

export function partitionMatchAnalysisTargets(
  rows: Array<{ applicationId?: string | null; status?: string | null }>
): { analyzeIds: string[]; reanalyzeIds: string[] } {
  const analyzeIds: string[] = [];
  const reanalyzeIds: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const id = row.applicationId?.trim() ?? "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (isMatchAnalyzedStatus(row.status)) reanalyzeIds.push(id);
    else analyzeIds.push(id);
  }

  return { analyzeIds, reanalyzeIds };
}

export function bulkAnalyzeSelectedLabel(count: number): string {
  return count === 1 ? "Analyze" : "Analyze selected";
}

export function bulkReanalyzeSelectedLabel(count: number): string {
  return count === 1 ? "Reanalyze" : "Reanalyze selected";
}

export function describeBulkMatchAnalysisOutcome(input: {
  analyzed: number;
  needsReview: number;
  failed: number;
}): { ok: boolean; message: string } {
  const { analyzed, needsReview, failed } = input;
  if (analyzed && !needsReview && !failed) {
    return {
      ok: true,
      message: analyzed === 1 ? "Match analysis complete" : `Analyzed ${analyzed} candidates`,
    };
  }
  const parts = [
    analyzed ? `${analyzed} analyzed` : null,
    needsReview ? `${needsReview} need résumé text` : null,
    failed ? `${failed} failed` : null,
  ].filter(Boolean);
  return { ok: false, message: parts.join(" · ") || "Match analysis failed" };
}

export async function postBulkMatchAnalysis(
  jobApplicationIds: string[],
  onChunk?: (results: BulkMatchAnalysisItem[]) => void
): Promise<{ analyzed: number; needsReview: number; failed: number; results: BulkMatchAnalysisItem[] }> {
  const uniqueIds = [...new Set(jobApplicationIds.map((id) => id.trim()).filter(Boolean))];
  const results: BulkMatchAnalysisItem[] = [];
  let analyzed = 0;
  let needsReview = 0;
  let failed = 0;

  for (let offset = 0; offset < uniqueIds.length; offset += MATCH_ANALYSIS_BULK_CHUNK) {
    const chunk = uniqueIds.slice(offset, offset + MATCH_ANALYSIS_BULK_CHUNK);
    const response = await fetch("/api/admin/job-applications/match-analysis/bulk", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobApplicationIds: chunk }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      results?: BulkMatchAnalysisItem[];
    };
    if (!response.ok) {
      throw new Error(payload.error || "Bulk match analysis failed");
    }

    const chunkResults = payload.results ?? [];
    results.push(...chunkResults);
    onChunk?.(chunkResults);

    const byId = new Map(chunkResults.map((item) => [item.jobApplicationId, item]));
    for (const id of chunk) {
      const status = byId.get(id)?.result?.status;
      if (status === "ANALYZED") analyzed += 1;
      else if (status === "NEEDS_REVIEW") needsReview += 1;
      else failed += 1;
    }
  }

  return { analyzed, needsReview, failed, results };
}
