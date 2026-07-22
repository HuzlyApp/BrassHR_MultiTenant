export type JobColumnId =
  | "jobTitle"
  | "jobId"
  | "candidates"
  | "datePosted"
  | "assignee"
  | "jobStatus"
  | "location"
  | "employmentType"
  | "profession"
  | "specialty"
  | "workflow"
  | "createdDate"
  | "applicationDeadline"
  | "actions"

export const JOB_COLUMN_OPTIONS: { id: JobColumnId; label: string }[] = [
  { id: "jobTitle", label: "Job Title" },
  { id: "jobId", label: "Job Id" },
  { id: "candidates", label: "Candidates" },
  { id: "datePosted", label: "Date Posted" },
  { id: "assignee", label: "Assignee" },
  { id: "jobStatus", label: "Job Status" },
  { id: "location", label: "Location" },
  { id: "employmentType", label: "Employment Type" },
  { id: "profession", label: "Profession" },
  { id: "specialty", label: "Specialty" },
  { id: "workflow", label: "Assigned Workflow" },
  { id: "createdDate", label: "Created Date" },
  { id: "applicationDeadline", label: "Application Deadline" },
  { id: "actions", label: "Actions" },
]

export const DEFAULT_JOB_COLUMNS: JobColumnId[] = [
  "jobTitle",
  "candidates",
  "datePosted",
  "assignee",
  "jobStatus",
  "actions",
]

const STORAGE_KEY = "nexus-jobs-list-columns"

export function loadJobColumnOrder(): JobColumnId[] {
  if (typeof window === "undefined") return [...DEFAULT_JOB_COLUMNS]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_JOB_COLUMNS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_JOB_COLUMNS]
    const allowed = new Set(JOB_COLUMN_OPTIONS.map((c) => c.id))
    const cleaned = parsed.filter(
      (id): id is JobColumnId => typeof id === "string" && allowed.has(id as JobColumnId)
    )
    return cleaned.length ? cleaned : [...DEFAULT_JOB_COLUMNS]
  } catch {
    return [...DEFAULT_JOB_COLUMNS]
  }
}

export function saveJobColumnOrder(order: JobColumnId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    /* ignore quota */
  }
}

export function jobColumnLabel(id: JobColumnId): string {
  return JOB_COLUMN_OPTIONS.find((c) => c.id === id)?.label ?? id
}

export type JobSortField = "jobTitle" | "jobStatus"

export const SORTABLE_JOB_COLUMNS = new Set<JobColumnId>(["jobTitle", "jobStatus"])

export function isSortableJobColumn(colId: JobColumnId): colId is JobSortField {
  return SORTABLE_JOB_COLUMNS.has(colId)
}

const CENTER_ALIGNED_COLUMNS = new Set<JobColumnId>(["datePosted", "assignee", "jobStatus"])

export function jobListColumnClassName(colId: JobColumnId): string {
  const center = CENTER_ALIGNED_COLUMNS.has(colId) ? " text-center" : ""
  if (colId === "datePosted" || colId === "createdDate" || colId === "applicationDeadline") {
    return `min-w-[140px] whitespace-nowrap${center}`
  }
  if (colId === "assignee") {
    return `${center.trim()} whitespace-nowrap`.trim()
  }
  if (colId === "jobStatus") {
    return `${center.trim()} w-[1%] whitespace-nowrap`.trim()
  }
  if (colId === "candidates") return "min-w-[280px]"
  if (colId === "actions") return "w-12"
  return ""
}
