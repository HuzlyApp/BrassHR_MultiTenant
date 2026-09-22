import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runMatchAnalysisBulk,
  runMatchAnalysisForApplication,
  type RunMatchAnalysisResult,
} from "./pipeline";
import {
  DEFAULT_ANALYSIS_PROVIDER,
  type AnalysisProvider,
} from "./schema";

export type AutoQuickMatchResult = {
  status: RunMatchAnalysisResult["status"] | "FAILED";
  error: string | null;
  model: string | null;
  score: number | null;
  category: string | null;
  action: string | null;
  readiness: string | null;
  displayCategory: string | null;
  stage: string | null;
  requirementCounts: { confirmed: number; verify: number; notMet: number } | null;
};

function emptyAutoResult(error: string | null): AutoQuickMatchResult {
  return {
    status: "FAILED",
    error,
    model: null,
    score: null,
    category: null,
    action: null,
    readiness: null,
    displayCategory: null,
    stage: null,
    requirementCounts: null,
  };
}

function toAutoResult(result: RunMatchAnalysisResult): AutoQuickMatchResult {
  const displayCategory =
    typeof result.analysis?.candidate_match?.display_category === "string"
      ? result.analysis.candidate_match.display_category
      : null;
  return {
    status: result.status,
    error: result.error,
    model: result.model,
    score: result.score,
    category: result.category,
    action: result.action,
    readiness: result.readiness,
    displayCategory,
    stage: result.status === "ANALYZED" ? "quick" : null,
    requirementCounts: result.requirementCounts,
  };
}

/**
 * Step 1 Quick Match after a résumé is attached to an application.
 * Failures are returned (or logged) so upload/import still succeeds and
 * recruiters can use Re-run Quick Match manually.
 */
export async function runAutoQuickMatchForApplication(args: {
  supabase: SupabaseClient;
  tenantId: string;
  jobApplicationId: string;
  analyzedByUserId?: string | null;
  analysisProvider?: AnalysisProvider;
  reason?: string;
}): Promise<AutoQuickMatchResult> {
  const applicationId = args.jobApplicationId.trim();
  const tenantId = args.tenantId.trim();
  if (!applicationId || !tenantId) {
    return emptyAutoResult("Missing application or tenant for auto Quick Match.");
  }

  try {
    const result = await runMatchAnalysisForApplication({
      supabase: args.supabase,
      tenantId,
      jobApplicationId: applicationId,
      analyzedByUserId: args.analyzedByUserId ?? null,
      analysisMode: "analyze",
      analysisProvider: args.analysisProvider ?? DEFAULT_ANALYSIS_PROVIDER,
    });
    if (result.status !== "ANALYZED") {
      console.warn("[auto-quick-match] finished without ANALYZED", {
        applicationId,
        reason: args.reason ?? null,
        status: result.status,
        error: result.error,
      });
    }
    return toAutoResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auto Quick Match failed";
    console.error("[auto-quick-match] failed", {
      applicationId,
      reason: args.reason ?? null,
      message,
    });
    return emptyAutoResult(message);
  }
}

/** Fire-and-forget Quick Match (does not block the caller). */
export function scheduleAutoQuickMatchForApplication(args: {
  supabase: SupabaseClient;
  tenantId: string;
  jobApplicationId: string;
  analyzedByUserId?: string | null;
  analysisProvider?: AnalysisProvider;
  reason?: string;
}): void {
  void runAutoQuickMatchForApplication(args);
}

export function scheduleAutoQuickMatchForApplications(args: {
  supabase: SupabaseClient;
  tenantId: string;
  jobApplicationIds: string[];
  analyzedByUserId?: string | null;
  analysisProvider?: AnalysisProvider;
  reason?: string;
}): void {
  const ids = [...new Set(args.jobApplicationIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return;
  void runMatchAnalysisBulk({
    supabase: args.supabase,
    tenantId: args.tenantId,
    jobApplicationIds: ids,
    analyzedByUserId: args.analyzedByUserId ?? null,
    analysisMode: "analyze",
    analysisProvider: args.analysisProvider ?? DEFAULT_ANALYSIS_PROVIDER,
  })
    .then((results) => {
      const failed = results.filter((row) => row.result.status !== "ANALYZED");
      if (failed.length) {
        console.warn("[auto-quick-match] bulk finished with failures", {
          reason: args.reason ?? null,
          total: results.length,
          failed: failed.length,
        });
      }
    })
    .catch((error) => {
      console.error("[auto-quick-match] bulk failed", {
        reason: args.reason ?? null,
        message: error instanceof Error ? error.message : "unknown",
      });
    });
}
