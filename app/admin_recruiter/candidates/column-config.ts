export type CandidateColumnId =
  | "name"
  | "status"
  | "reference"
  | "jobRole"
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
  { id: "reference", label: "Reference" },
  { id: "jobRole", label: "Job Role" },
  { id: "createdDate", label: "Created Date" },
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
  "reference",
  "jobRole",
  "createdDate",
  "location",
]

const STORAGE_KEY = "nexus-candidates-list-columns"

export function loadColumnOrder(): CandidateColumnId[] {
  if (typeof window === "undefined") return [...DEFAULT_CANDIDATE_COLUMNS]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_CANDIDATE_COLUMNS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_CANDIDATE_COLUMNS]
    const allowed = new Set(CANDIDATE_COLUMN_OPTIONS.map((c) => c.id))
    const cleaned = parsed.filter((id): id is CandidateColumnId => typeof id === "string" && allowed.has(id as CandidateColumnId))
    return cleaned.length ? cleaned : [...DEFAULT_CANDIDATE_COLUMNS]
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
