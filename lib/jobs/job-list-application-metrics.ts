import { normalizeApplicationStatus } from "@/lib/jobs/application-status";
import { isVisibleOnJobCandidatesAllTab } from "@/lib/jobs/application-status-tab";
import { isStrongAiMatchScore } from "@/lib/jobs/match-analysis/display";

export type JobListApplicationMetricRow = {
  job_requisition_id?: string | null;
  status?: string | null;
  status_id?: string | null;
  application_statuses?:
    | { system_key?: string | null }
    | { system_key?: string | null }[]
    | null;
  ai_match_status?: string | null;
  ai_match_score?: number | string | null;
  ai_match_readiness?: string | null;
  ai_analyzed_at?: string | null;
};

export type JobListMetricCounts = {
  applicantCount: number;
  newCount: number;
  analyzedCount: number;
  strongCount: number;
  readyCount: number;
  hiredCount: number;
};

function emptyCounts(): JobListMetricCounts {
  return {
    applicantCount: 0,
    newCount: 0,
    analyzedCount: 0,
    strongCount: 0,
    readyCount: 0,
    hiredCount: 0,
  };
}

function addApplicationToCounts(
  current: JobListMetricCounts,
  row: JobListApplicationMetricRow
): void {
  if (!isVisibleOnJobCandidatesAllTab(row)) return;

  const status = String(row.status ?? "").toLowerCase();
  current.applicantCount += 1;
  if (status === "new" || status === "submitted") current.newCount += 1;
  if (normalizeApplicationStatus(status) === "hired") current.hiredCount += 1;

  const matchStatus = String(row.ai_match_status ?? "");
  const score = Number(row.ai_match_score);
  const hasMatchScore = Number.isFinite(score);
  const analysisDone =
    matchStatus === "ANALYZED" || hasMatchScore || Boolean(row.ai_analyzed_at);

  if (analysisDone) current.analyzedCount += 1;
  if (isStrongAiMatchScore(row.ai_match_score)) current.strongCount += 1;
  if (analysisDone && String(row.ai_match_readiness ?? "") === "READY_TO_SUBMIT") {
    current.readyCount += 1;
  }
}

/** Metrics for one job's nested `job_applications` rows. */
export function tallyApplicationMetrics(
  rows: JobListApplicationMetricRow[]
): JobListMetricCounts {
  const current = emptyCounts();
  for (const row of rows) addApplicationToCounts(current, row);
  return current;
}

/**
 * Per-job metrics for the jobs grid/list. Counts match the Job candidates "All" tab
 * (every application for the job, including archived, rejected, and withdrawn).
 */
export function tallyJobListApplicationMetrics(
  rows: JobListApplicationMetricRow[]
): Map<string, JobListMetricCounts> {
  const metricsByJob = new Map<string, JobListMetricCounts>();
  for (const row of rows) {
    const id = String(row.job_requisition_id ?? "");
    if (!id) continue;
    const current = metricsByJob.get(id) ?? emptyCounts();
    addApplicationToCounts(current, row);
    metricsByJob.set(id, current);
  }
  return metricsByJob;
}
