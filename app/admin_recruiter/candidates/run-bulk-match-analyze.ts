"use client";

import type { Dispatch, SetStateAction } from "react";
import toast from "react-hot-toast";
import {
  describeBulkMatchAnalysisOutcome,
  postBulkMatchAnalysis,
  type BulkMatchAnalysisItem,
} from "@/lib/admin/bulk-match-analysis";
import type { CandidateRow } from "./types";

const ACTION_TOAST_DURATION_MS = 3500;
const NO_APPLICATION_MESSAGE =
  "Select candidates who have a job application to analyze.";

export function applyCandidateBulkMatchItem(
  row: CandidateRow,
  item: BulkMatchAnalysisItem
): CandidateRow {
  if (!row.matchApplicationId || row.matchApplicationId !== item.jobApplicationId) {
    return row;
  }
  const result = item.result ?? {};
  if (result.status === "FAILED") {
    return { ...row, aiMatchStatus: "FAILED" };
  }
  return {
    ...row,
    aiMatchStatus: result.status ?? row.aiMatchStatus,
    aiMatchScore: result.score ?? row.aiMatchScore,
    aiMatchCategory: result.category ?? row.aiMatchCategory,
    aiMatchDisplayCategory:
      result.analysis?.candidate_match?.display_category ?? row.aiMatchDisplayCategory,
  };
}

export async function runCandidateListBulkMatchAnalyze(options: {
  applicationIds: string[];
  setCandidates: Dispatch<SetStateAction<CandidateRow[]>>;
  setAnalyzingIds: Dispatch<SetStateAction<Set<string>>>;
}): Promise<void> {
  const uniqueIds = [...new Set(options.applicationIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length) {
    toast.error(NO_APPLICATION_MESSAGE);
    return;
  }

  options.setAnalyzingIds((current) => {
    const next = new Set(current);
    for (const id of uniqueIds) next.add(id);
    return next;
  });
  options.setCandidates((current) =>
    current.map((row) =>
      row.matchApplicationId && uniqueIds.includes(row.matchApplicationId)
        ? { ...row, aiMatchStatus: "ANALYZING" }
        : row
    )
  );

  try {
    const summary = await postBulkMatchAnalysis(uniqueIds, (chunk) => {
      const byId = new Map(chunk.map((item) => [item.jobApplicationId, item]));
      options.setCandidates((current) =>
        current.map((row) => {
          const item = row.matchApplicationId ? byId.get(row.matchApplicationId) : undefined;
          return item ? applyCandidateBulkMatchItem(row, item) : row;
        })
      );
    });
    const outcome = describeBulkMatchAnalysisOutcome(summary);
    if (outcome.ok) {
      toast.success(outcome.message, { duration: ACTION_TOAST_DURATION_MS });
    } else {
      toast.error(outcome.message);
    }
  } catch (analyzeError) {
    options.setCandidates((current) =>
      current.map((row) =>
        row.matchApplicationId &&
        uniqueIds.includes(row.matchApplicationId) &&
        row.aiMatchStatus === "ANALYZING"
          ? { ...row, aiMatchStatus: "FAILED" }
          : row
      )
    );
    toast.error(analyzeError instanceof Error ? analyzeError.message : "Bulk match analysis failed");
  } finally {
    options.setAnalyzingIds((current) => {
      const next = new Set(current);
      for (const id of uniqueIds) next.delete(id);
      return next;
    });
  }
}

export { NO_APPLICATION_MESSAGE };
