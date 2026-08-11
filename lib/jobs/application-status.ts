/** Recruiting pipeline statuses for job applications (candidates listing + detail). */

export const APPLICATION_PIPELINE_STATUSES = [
  "new",
  "reviewing",
  "interviewing",
  "rejected",
  "hired",
  "shortlisted",
  "undecided",
  "archived",
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
  { id: "archived", label: "Archived" },
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
    case "archived":
      return status;
    default:
      return "reviewing";
  }
}

export function applicationStatusLabel(status: string): string {
  const normalized = normalizeApplicationStatus(status);
  return APPLICATION_STATUS_OPTIONS.find((option) => option.id === normalized)?.label ?? normalized;
}

/** Colored status dot — same pattern as jobs list / job details status UI. */
export function applicationStatusDotClassName(status: string): string {
  switch (normalizeApplicationStatus(status)) {
    case "new":
      return "bg-[#3B82F6]";
    case "reviewing":
      return "bg-[#F59E0B]";
    case "shortlisted":
      return "bg-[#22C55E]";
    case "interviewing":
      return "bg-[#8B5CF6]";
    case "hired":
      return "bg-[#16A34A]";
    case "rejected":
      return "bg-[#EF4444]";
    case "undecided":
      return "bg-[#94A3B8]";
    case "archived":
      return "bg-[#64748B]";
    default:
      return "bg-[#94A3B8]";
  }
}

/** Outlined pill (legacy). Prefer list cell: surface + colored dot + label. */
export function applicationStatusBadgeClassName(status: string): string {
  const normalized = normalizeApplicationStatus(status);
  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-full border bg-white px-3 py-0.5 text-xs font-medium";

  if (normalized === "new") {
    return `${base} border-[color:var(--brand-secondary)] text-[color:var(--brand-secondary)]`;
  }

  return `${base} border-[#CBD5E1] text-[#475569]`;
}

export function isApplicationPipelineStatus(value: string): value is ApplicationPipelineStatus {
  return (APPLICATION_PIPELINE_STATUSES as readonly string[]).includes(value);
}

export function isArchivedApplicationStatus(
  status: string | null | undefined,
  systemKey?: string | null
): boolean {
  if (systemKey === "archived") return true;
  return String(status ?? "").trim().toLowerCase() === "archived";
}

export function matchesApplicationStatusTab(
  status: string,
  tab: ApplicationStatusTab
): boolean {
  if (tab === "all") return !isArchivedApplicationStatus(status);
  return normalizeApplicationStatus(status) === tab;
}
