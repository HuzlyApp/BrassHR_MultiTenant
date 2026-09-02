export type JobColumnId =
  | "jobTitle"
  | "jobId"
  | "contractGroup"
  | "candidates"
  | "datePosted"
  | "assignee"
  | "jobStatus"
  | "payRate"
  | "commissionFee"
  | "location"
  | "placementType"
  | "employmentType"
  | "jobType"
  | "profession"
  | "specialty"
  | "workflow"
  | "createdDate"
  | "applicationDeadline"
  | "actions"

export const JOB_COLUMN_OPTIONS: { id: JobColumnId; label: string }[] = [
  { id: "jobTitle", label: "Job Title" },
  // { id: "jobId", label: "Job Id" }, // Job ID hidden for now
  { id: "contractGroup", label: "End client" },
  { id: "candidates", label: "# Applicants" },
  { id: "datePosted", label: "Date Posted" },
  { id: "assignee", label: "Created by" },
  { id: "jobStatus", label: "Job Status" },
  { id: "payRate", label: "Pay Rate" },
  { id: "commissionFee", label: "Commission Fee" },
  { id: "location", label: "Location" },
  { id: "placementType", label: "Placement type" },
  { id: "employmentType", label: "W2 / 1099" },
  { id: "jobType", label: "Employment Type" },
  { id: "profession", label: "Profession" },
  { id: "specialty", label: "Specialty" },
  { id: "workflow", label: "Assigned Workflow" },
  { id: "createdDate", label: "Created Date" },
  { id: "applicationDeadline", label: "Application Deadline" },
  { id: "actions", label: "Publish / Unpublish" },
]

export const DEFAULT_JOB_COLUMNS: JobColumnId[] = [
  "jobTitle",
  "contractGroup",
  "candidates",
  "datePosted",
  "location",
  "placementType",
  "jobType",
  "assignee",
  "jobStatus",
  "payRate",
  "commissionFee",
  "actions",
]

const STORAGE_KEY = "nexus-jobs-list-columns"
const COLUMN_MIGRATION_KEY = "nexus-jobs-list-columns-v4-commission-fee"

/** Columns added after initial release — inject into saved layouts once. */
const ENSURE_VISIBLE_COLUMNS: { id: JobColumnId; after?: JobColumnId }[] = [
  { id: "payRate", after: "jobStatus" },
  { id: "commissionFee", after: "payRate" },
  { id: "placementType", after: "location" },
  { id: "jobType", after: "placementType" },
  { id: "contractGroup", after: "jobTitle" },
]

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
    if (!cleaned.length) return [...DEFAULT_JOB_COLUMNS]

    const migrated = localStorage.getItem(COLUMN_MIGRATION_KEY) === "1"
    if (!migrated) {
      for (const { id, after } of ENSURE_VISIBLE_COLUMNS) {
        if (cleaned.includes(id)) continue
        const afterIdx = after ? cleaned.indexOf(after) : -1
        if (afterIdx >= 0) cleaned.splice(afterIdx + 1, 0, id)
        else cleaned.push(id)
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
        localStorage.setItem(COLUMN_MIGRATION_KEY, "1")
      } catch {
        /* ignore quota */
      }
    }

    return cleaned
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
  "contractGroup",
  "candidates",
  "datePosted",
  "assignee",
  "jobStatus",
  "payRate",
  "commissionFee",
  "location",
  "placementType",
  "employmentType",
  "jobType",
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
    // case "jobId":
    //   return `min-w-[100px]${nowrap}${center}`
    case "contractGroup":
      return `min-w-[150px]${nowrap}${center}`
    case "candidates":
      return `w-[390px] min-w-[390px]${nowrap}${center}`
    case "datePosted":
    case "createdDate":
      return `min-w-[140px]${nowrap}${center}`
    case "applicationDeadline":
      return `min-w-[170px]${nowrap}${center}`
    case "assignee":
      return `min-w-[140px]${nowrap}${center}`.trim()
    case "jobStatus":
      return `min-w-[120px] w-[1%]${nowrap}${center}`.trim()
    case "payRate":
      return `min-w-[140px]${nowrap}${center}`.trim()
    case "commissionFee":
      return `min-w-[150px]${nowrap}${center}`.trim()
    case "placementType":
    case "jobType":
    case "employmentType":
      return `min-w-[140px]${nowrap}${center}`
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
