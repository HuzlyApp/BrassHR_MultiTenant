/** Recruiting pipeline statuses for job applications (candidates listing + detail). */

export const APPLICATION_PIPELINE_STATUSES = [
  "new",
  "reviewing",
  "interviewing",
  "rejected",
  "hired",
  "shortlisted",
  "undecided",
] as const;

export type ApplicationPipelineStatus = (typeof APPLICATION_PIPELINE_STATUSES)[number];

export type ApplicationStatusTab =
  | "all"
  | ApplicationPipelineStatus;

export const APPLICATION_STATUS_TABS: Array<{ id: ApplicationStatusTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "reviewing", label: "Reviewing" },
  { id: "interviewing", label: "Interviewing" },
  { id: "rejected", label: "Rejected" },
  { id: "hired", label: "Hired" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "undecided", label: "Undecided" },
];

/** Dropdown options for candidate detail status (excludes All). */
export const APPLICATION_STATUS_OPTIONS = APPLICATION_STATUS_TABS.filter(
  (tab): tab is { id: ApplicationPipelineStatus; label: string } => tab.id !== "all"
);

export function normalizeApplicationStatus(status: string): ApplicationPipelineStatus {
  switch (status) {
    case "submitted":
      return "new";
    case "in_progress":
      return "reviewing";
    case "withdrawn":
      return "undecided";
    case "new":
    case "reviewing":
    case "interviewing":
    case "rejected":
    case "hired":
    case "shortlisted":
    case "undecided":
      return status;
    default:
      return "reviewing";
  }
}

export function applicationStatusLabel(status: string): string {
  const normalized = normalizeApplicationStatus(status);
  return APPLICATION_STATUS_OPTIONS.find((option) => option.id === normalized)?.label ?? normalized;
}

export function isApplicationPipelineStatus(value: string): value is ApplicationPipelineStatus {
  return (APPLICATION_PIPELINE_STATUSES as readonly string[]).includes(value);
}

export function matchesApplicationStatusTab(
  status: string,
  tab: ApplicationStatusTab
): boolean {
  if (tab === "all") return true;
  return normalizeApplicationStatus(status) === tab;
}
