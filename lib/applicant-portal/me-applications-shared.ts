import type { ApplicationPipelineStatus } from "@/lib/jobs/application-status";

export type MeApplicationStage = {
  label: string;
  sublabel: string;
  progressPercent: number;
  barColor: string;
};

export type MeApplicationItem = {
  applicationId: string;
  workerId: string;
  status: string;
  statusLabel: string;
  statusKey: ApplicationPipelineStatus;
  appliedAt: string;
  submittedAt: string | null;
  tenant: { id: string; name: string };
  job: {
    id: string;
    title: string;
    location: string | null;
    facility: string | null;
    employmentType: string;
    employmentTypeLabel: string;
  };
  stage: MeApplicationStage;
};

export type MeApplicationsSummary = {
  total: number;
  w2Count: number;
  count1099: number;
  overallStatusLabel: string;
  statusCounts: Array<{ key: string; label: string; count: number; color: string }>;
  workTypeCounts: Array<{ key: string; label: string; count: number; color: string }>;
};

export type MeApplicationsPayload = {
  applications: MeApplicationItem[];
  summary: MeApplicationsSummary;
};

export function buildApplicationsInsight(
  displayName: string,
  summary: MeApplicationsSummary
): string {
  if (summary.total === 0) {
    return "You have not applied to any jobs yet. Browse open positions to get started.";
  }
  if (summary.w2Count > 0 && summary.count1099 > 0) {
    return `${displayName} has a strong interest in both employee and contractor opportunities. Consider fast-tracking high match roles.`;
  }
  if (summary.count1099 > 0) {
    return `${displayName} is focused on independent contractor opportunities across ${summary.total} application${summary.total === 1 ? "" : "s"}.`;
  }
  return `${displayName} is actively pursuing employee roles with ${summary.total} application${summary.total === 1 ? "" : "s"} in progress.`;
}
