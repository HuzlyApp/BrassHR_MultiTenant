import { normalizeApplicationStatus } from "@/lib/jobs/application-status";
import { isVisibleOnJobCandidatesAllTab } from "@/lib/jobs/application-status-tab";

/** FSD-JOB-UX-001 / Stage Pipeline Spec v4.1 pipeline-summary response. */
export type JobPipelineSummary = {
  all: number;
  intake: number;
  screening: number;
  interview: number;
  submission: number;
  selected: number;
  onboarding: number;
  closed: number;
  show_submission: boolean;
};

export type JobPipelineSummaryRow = {
  status?: string | null;
  status_id?: string | null;
  application_statuses?:
    | { system_key?: string | null; name?: string | null }
    | { system_key?: string | null; name?: string | null }[]
    | null;
};

const AT_MSP_SYSTEM_KEYS = new Set([
  "profile_ready",
  "submitted",
  "presented",
  "approved_by_msp",
  "at_msp",
  "msp_submitted",
  "msp_presented",
]);

function applicationSystemKey(row: JobPipelineSummaryRow): string {
  const joined = Array.isArray(row.application_statuses)
    ? row.application_statuses[0]
    : row.application_statuses;
  return String(joined?.system_key ?? "")
    .trim()
    .toLowerCase();
}

function applicationStatusName(row: JobPipelineSummaryRow): string {
  const joined = Array.isArray(row.application_statuses)
    ? row.application_statuses[0]
    : row.application_statuses;
  return String(joined?.name ?? "")
    .trim()
    .toLowerCase();
}

export function isAtMspPipelineApplication(row: JobPipelineSummaryRow): boolean {
  const key = applicationSystemKey(row);
  if (key && AT_MSP_SYSTEM_KEYS.has(key)) return true;
  if (key.includes("msp") && key !== "msp") return true;
  const name = applicationStatusName(row);
  return (
    name.includes("msp") ||
    name === "profile ready" ||
    name === "presented to client" ||
    name === "submitted for msp review" ||
    name === "approved by msp"
  );
}

function isOnboardingPipelineApplication(row: JobPipelineSummaryRow): boolean {
  const key = applicationSystemKey(row);
  if (key === "onboarding" || key === "onboarded" || key === "post_hire") return true;
  const name = applicationStatusName(row);
  return name.includes("onboard");
}

export function emptyJobPipelineSummary(
  showSubmission = false
): JobPipelineSummary {
  return {
    all: 0,
    intake: 0,
    screening: 0,
    interview: 0,
    submission: 0,
    selected: 0,
    onboarding: 0,
    closed: 0,
    show_submission: showSubmission,
  };
}

/**
 * Per-box counts for Job Details cards / list chips.
 * Mapping (FSD): New=intake; In process=screening+interview;
 * At MSP=submission when show_submission; Hired=selected+onboarding.
 */
export function tallyJobPipelineSummary(
  rows: JobPipelineSummaryRow[],
  options: { showSubmission: boolean }
): JobPipelineSummary {
  const summary = emptyJobPipelineSummary(options.showSubmission);

  for (const row of rows) {
    if (!isVisibleOnJobCandidatesAllTab(row)) continue;
    summary.all += 1;

    if (options.showSubmission && isAtMspPipelineApplication(row)) {
      summary.submission += 1;
      continue;
    }

    if (isOnboardingPipelineApplication(row)) {
      summary.onboarding += 1;
      continue;
    }

    const pipeline = normalizeApplicationStatus(String(row.status ?? ""));
    switch (pipeline) {
      case "new":
        summary.intake += 1;
        break;
      case "reviewing":
        summary.screening += 1;
        break;
      case "shortlisted":
      case "interviewing":
        summary.interview += 1;
        break;
      case "hired":
        summary.selected += 1;
        break;
      case "rejected":
      case "undecided":
      case "archived":
        summary.closed += 1;
        break;
      default:
        summary.screening += 1;
        break;
    }
  }

  return summary;
}

/** Legacy Job Details `stats` fields derived from the FSD pipeline-summary buckets. */
export function jobDetailsStatsFromPipelineSummary(summary: JobPipelineSummary) {
  return {
    applicationsAll: summary.all,
    applicationsNew: summary.intake,
    applicationsInProcess: summary.screening + summary.interview,
    applicationsAtMsp: summary.submission,
    applicationsHired: summary.selected + summary.onboarding,
    applicationsClosed: summary.closed,
    applicationsStarted: summary.screening + summary.interview,
    applicationsSubmittedOrHired: summary.intake + summary.selected + summary.onboarding,
    showSubmission: summary.show_submission,
    impressions: 0,
    clicks: 0,
    totalCost: 0,
  };
}
