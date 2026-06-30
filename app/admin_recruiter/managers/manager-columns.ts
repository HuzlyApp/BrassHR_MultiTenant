export type ManagerColumnId =
  | "name"
  | "role"
  | "department"
  | "location"
  | "status"
  | "email"
  | "phone"
  | "reference"
  | "createdDate"
  | "profile"

export const MANAGER_COLUMN_OPTIONS: { id: ManagerColumnId; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "role", label: "Role" },
  { id: "department", label: "Department" },
  { id: "location", label: "Location" },
  { id: "status", label: "Status" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone Number" },
  { id: "reference", label: "Reference" },
  { id: "createdDate", label: "Created Date" },
  { id: "profile", label: "Profile" },
]

export const DEFAULT_MANAGER_COLUMNS: ManagerColumnId[] = [
  "name",
  "role",
  "department",
  "status",
  "profile",
]

const STORAGE_KEY = "nexus-managers-list-columns"

export function loadManagerColumnOrder(): ManagerColumnId[] {
  if (typeof window === "undefined") return [...DEFAULT_MANAGER_COLUMNS]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_MANAGER_COLUMNS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_MANAGER_COLUMNS]
    const allowed = new Set(MANAGER_COLUMN_OPTIONS.map((c) => c.id))
    const cleaned = parsed.filter(
      (id): id is ManagerColumnId => typeof id === "string" && allowed.has(id as ManagerColumnId)
    )
    return cleaned.length ? cleaned : [...DEFAULT_MANAGER_COLUMNS]
  } catch {
    return [...DEFAULT_MANAGER_COLUMNS]
  }
}

export function saveManagerColumnOrder(order: ManagerColumnId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    /* ignore quota */
  }
}

export function managerColumnLabel(id: ManagerColumnId): string {
  return MANAGER_COLUMN_OPTIONS.find((c) => c.id === id)?.label ?? id
}
