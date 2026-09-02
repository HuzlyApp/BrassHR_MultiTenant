import type { CandidateRow } from "@/app/admin_recruiter/candidates/types";
import { applicationCurrentStageMeta } from "@/lib/jobs/application-status";

/** Pipeline stage label for a candidate row (same source as Applications list). */
export function candidateCurrentStageLabel(candidate: CandidateRow): string {
  const raw = candidate.statusKey ?? candidate.status ?? "";
  return applicationCurrentStageMeta(raw).label;
}

export function candidateMatchesStageFilter(candidate: CandidateRow, stageLabel: string): boolean {
  const filter = stageLabel.trim();
  if (!filter) return true;
  return candidateCurrentStageLabel(candidate) === filter;
}

export function buildCandidateStageOptions(candidates: CandidateRow[]): string[] {
  const labels = new Set<string>();
  for (const candidate of candidates) {
    labels.add(candidateCurrentStageLabel(candidate));
  }
  return Array.from(labels).sort((a, b) => a.localeCompare(b));
}
