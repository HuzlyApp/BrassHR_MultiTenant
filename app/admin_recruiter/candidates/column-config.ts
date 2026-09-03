export type CandidateColumnId =
  | "name"
  | "status"
  | "progressStatus"
  | "reference"
  | "jobRole"
  | "matchJob"
  | "jobMatch"
  | "conf"
  | "verify"
  | "notMet"
  | "currentStage"
  | "evaluation"
  | "createdDate"
  | "location"
  | "city"
  | "zipCode"
  | "state"
  | "address1"
  | "phone"
  | "email"
  | "dateOfBirth"
  | "firstName"
  | "lastName"
  | "country"
  | "address2"
  | "middleName"
  | "suffix"
  | "preferredName"
  | "licenseNumber"
  | "emergencyContact"
  | "notes"
  | "lastUpdated"
  | "source"
  | "referredBy"
  | "department"
  | "shift"
  | "payRate"
  | "startDate"

export const CANDIDATE_COLUMN_OPTIONS: { id: CandidateColumnId; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "status", label: "Status" },
  { id: "progressStatus", label: "Progress Status" },
  { id: "reference", label: "Reference" },
  { id: "jobRole", label: "Job Role" },
  { id: "matchJob", label: "Job title" },
  { id: "jobMatch", label: "Match Score" },
  { id: "conf", label: "Conf." },
  { id: "verify", label: "Verify" },
  { id: "notMet", label: "Not Met" },
  { id: "currentStage", label: "Current Stage" },
  { id: "evaluation", label: "Evaluation" },
  { id: "createdDate", label: "Applied date" },
  { id: "location", label: "Location" },
  { id: "city", label: "City" },
  { id: "zipCode", label: "Zip Code" },
  { id: "state", label: "State" },
  { id: "address1", label: "Street address" },
  { id: "phone", label: "Phone Number" },
  { id: "email", label: "Email" },
  { id: "dateOfBirth", label: "Date of Birth (mm/dd/yyyy)" },
  { id: "firstName", label: "First name" },
  { id: "lastName", label: "Last name" },
  { id: "country", label: "Country" },
  { id: "address2", label: "Address line 2" },
  { id: "middleName", label: "Middle name" },
  { id: "suffix", label: "Suffix" },
  { id: "preferredName", label: "Preferred name" },
  { id: "licenseNumber", label: "License number" },
  { id: "emergencyContact", label: "Emergency contact" },
  { id: "notes", label: "Notes" },
  { id: "lastUpdated", label: "Last updated" },
  { id: "source", label: "Source" },
  { id: "referredBy", label: "Referred by" },
  { id: "department", label: "Department" },
  { id: "shift", label: "Shift" },
  { id: "payRate", label: "Pay rate" },
  { id: "startDate", label: "Start date" },
]

export const DEFAULT_CANDIDATE_COLUMNS: CandidateColumnId[] = [
  "name",
  "status",
  "progressStatus",
  "matchJob",
  "jobMatch",
  "conf",
  "verify",
  "notMet",
  "currentStage",
  "evaluation",
  "createdDate",
  "location",
]

const STORAGE_KEY = "nexus-candidates-list-columns-v3"

/** Ensure saved column layouts include newer default columns. */
function ensureDefaultCandidateColumns(order: CandidateColumnId[]): CandidateColumnId[] {
  let next = [...order]

  const insertAfter = (anchor: CandidateColumnId, columnId: CandidateColumnId) => {
    if (next.includes(columnId)) return
    const anchorIndex = next.indexOf(anchor)
    if (anchorIndex >= 0) next.splice(anchorIndex + 1, 0, columnId)
    else next.push(columnId)
  }

  insertAfter("status", "progressStatus")
  insertAfter("progressStatus", "matchJob")
  insertAfter("matchJob", "jobMatch")
  insertAfter("jobMatch", "conf")
  insertAfter("conf", "verify")
  insertAfter("verify", "notMet")
  insertAfter("notMet", "currentStage")
  insertAfter("currentStage", "evaluation")

  return next
}

export function loadColumnOrder(): CandidateColumnId[] {
  if (typeof window === "undefined") return [...DEFAULT_CANDIDATE_COLUMNS]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_CANDIDATE_COLUMNS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_CANDIDATE_COLUMNS]
    const allowed = new Set(CANDIDATE_COLUMN_OPTIONS.map((c) => c.id))
    const cleaned = parsed.filter((id): id is CandidateColumnId => typeof id === "string" && allowed.has(id as CandidateColumnId))
    const order = cleaned.length ? cleaned : [...DEFAULT_CANDIDATE_COLUMNS]
    return ensureDefaultCandidateColumns(order)
  } catch {
    return [...DEFAULT_CANDIDATE_COLUMNS]
  }
}

export function saveColumnOrder(order: CandidateColumnId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    /* ignore quota */
  }
}

export function columnLabel(id: CandidateColumnId): string {
  return CANDIDATE_COLUMN_OPTIONS.find((c) => c.id === id)?.label ?? id
}

/** List table sizing — keeps status labels like "Under Review" on one line. */
export function candidateListColumnClassName(colId: CandidateColumnId): string {
  if (colId === "createdDate") return "min-w-[140px] whitespace-nowrap"
  if (colId === "status") return "min-w-[132px] whitespace-nowrap"
  if (colId === "progressStatus") return "min-w-[160px] whitespace-nowrap"
  if (colId === "jobMatch") return "min-w-[88px] whitespace-nowrap"
  if (colId === "conf" || colId === "verify" || colId === "notMet") {
    return "min-w-[72px] whitespace-nowrap"
  }
  if (colId === "currentStage") return "min-w-[170px]"
  if (colId === "evaluation") return "min-w-[110px] whitespace-nowrap"
  if (colId === "matchJob") return "min-w-[200px] whitespace-nowrap"
  if (colId === "location") return "min-w-[220px] whitespace-nowrap"
  return ""
}

export function candidateListHeaderAlign(colId: CandidateColumnId): "left" | "center" {
  return colId === "name" || colId === "currentStage" ? "left" : "center"
}

/** Name and Current Stage stay left-aligned; other list columns are centered. */
export function candidateListColumnAlignmentClassName(colId: CandidateColumnId): string {
  return candidateListHeaderAlign(colId) === "left" ? "text-left" : "text-center"
}

export const CANDIDATE_LIST_TABLE_SCROLL_CLASS = "w-full overflow-x-auto"
export const CANDIDATE_LIST_TABLE_CLASS = "w-max min-w-full border-collapse"
