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
  { id: "candidates", label: "# Applicants" },
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
  { id: "actions", label: "Publish / Unpublish" },
]

export const DEFAULT_JOB_COLUMNS: JobColumnId[] = [
  "jobTitle",
  "candidates",
  "datePosted",
  "location",
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

export type JobSortField = Exclude<JobColumnId, "actions">

export function isSortableJobColumn(colId: JobColumnId): colId is JobSortField {
  return colId !== "actions"
}

export function isCenterAlignedJobColumn(colId: JobColumnId): boolean {
  return CENTER_ALIGNED_COLUMNS.has(colId)
}

const CENTER_ALIGNED_COLUMNS = new Set<JobColumnId>([
  "datePosted",
  "assignee",
  "jobStatus",
  "location",
  "employmentType",
  "profession",
  "specialty",
  "workflow",
  "createdDate",
  "applicationDeadline",
  "actions",
])

export function jobListColumnClassName(colId: JobColumnId): string {
  const center = CENTER_ALIGNED_COLUMNS.has(colId) ? " text-center" : ""
  const nowrap = " whitespace-nowrap"

  switch (colId) {
    case "jobTitle":
      return `min-w-[260px]${nowrap}`
    case "jobId":
      return `min-w-[100px]${nowrap}${center}`
    case "candidates":
      return `w-[350px] min-w-[350px]${nowrap}${center}`
    case "datePosted":
    case "createdDate":
      return `min-w-[140px]${nowrap}${center}`
    case "applicationDeadline":
      return `min-w-[170px]${nowrap}${center}`
    case "assignee":
      return `min-w-[140px]${nowrap}${center}`.trim()
    case "jobStatus":
      return `min-w-[120px] w-[1%]${nowrap}${center}`.trim()
    case "employmentType":
      return `min-w-[150px]${nowrap}${center}`
    case "profession":
      return `min-w-[120px]${nowrap}${center}`
    case "specialty":
      return `min-w-[120px]${nowrap}${center}`
    case "workflow":
      return `min-w-[160px]${nowrap}${center}`
    case "location":
      return `min-w-[120px]${nowrap}${center}`
    case "actions":
      return `min-w-[180px] w-[1%]${nowrap}${center}`
    default:
      return `${nowrap}${center}`.trim()
  }
}
