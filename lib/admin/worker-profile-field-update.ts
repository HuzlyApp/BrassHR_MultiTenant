import "server-only"

export type WorkerProfileFieldKey =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "address1"
  | "city"
  | "zip"
  | "state"
  | "date_of_birth"
  | "years_experience"
  | "hourly_rate"
  | "ssn_last_four"

export type ReferenceFieldValue = {
  first: string
  last: string
  email: string
  phone: string
}

const WORKER_COLUMN_MAP: Record<WorkerProfileFieldKey, string> = {
  first_name: "first_name",
  last_name: "last_name",
  email: "email",
  phone: "phone",
  address1: "address1",
  city: "city",
  zip: "zip",
  state: "state",
  date_of_birth: "date_of_birth",
  years_experience: "experience_years",
  hourly_rate: "hourly_rate",
  ssn_last_four: "ssn_last_four",
}

export function isWorkerProfileFieldKey(value: string): value is WorkerProfileFieldKey {
  return value in WORKER_COLUMN_MAP
}

function parseDobToIso(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (slash) {
    const month = Number(slash[1])
    const day = Number(slash[2])
    const year = Number(slash[3])
    const d = new Date(year, month - 1, day)
    if (
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    ) {
      return null
    }
    const mm = String(month).padStart(2, "0")
    const dd = String(day).padStart(2, "0")
    return `${year}-${mm}-${dd}`
  }

  const iso = /^\d{4}-\d{2}-\d{2}$/.exec(trimmed)
  if (iso) {
    const d = new Date(`${trimmed}T12:00:00`)
    if (Number.isNaN(d.getTime())) return null
    return trimmed
  }

  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function normalizeWorkerFieldValue(
  field: WorkerProfileFieldKey,
  rawValue: unknown
): { ok: true; dbValue: string | number | null } | { ok: false; error: string } {
  const value = rawValue == null ? "" : String(rawValue).trim()

  switch (field) {
    case "first_name":
    case "last_name":
    case "address1":
    case "city":
    case "state":
      if (!value) return { ok: false, error: "This field cannot be empty." }
      return { ok: true, dbValue: value }

    case "email": {
      if (!value) return { ok: false, error: "Email is required." }
      const email = value.toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: "Enter a valid email address." }
      }
      return { ok: true, dbValue: email }
    }

    case "phone": {
      if (!value) return { ok: false, error: "Phone is required." }
      const digits = value.replace(/\D/g, "")
      if (digits.length < 10) return { ok: false, error: "Enter at least 10 digits." }
      return { ok: true, dbValue: digits.slice(-10) }
    }

    case "zip": {
      if (!value) return { ok: false, error: "Zip code is required." }
      const digits = value.replace(/\D/g, "")
      if (digits.length < 5) return { ok: false, error: "Enter a 5-digit zip code." }
      return { ok: true, dbValue: digits.slice(0, 5) }
    }

    case "date_of_birth": {
      if (!value) return { ok: true, dbValue: null }
      const iso = parseDobToIso(value)
      if (!iso) return { ok: false, error: "Use MM/DD/YYYY format." }
      return { ok: true, dbValue: iso }
    }

    case "years_experience": {
      if (!value) return { ok: true, dbValue: null }
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0 || n > 80) {
        return { ok: false, error: "Enter years between 0 and 80." }
      }
      return { ok: true, dbValue: Math.round(n) }
    }

    case "hourly_rate": {
      if (!value) return { ok: true, dbValue: null }
      const cleaned = value.replace(/[^0-9.]/g, "")
      const n = Number(cleaned)
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: "Enter a valid hourly rate." }
      }
      return { ok: true, dbValue: n.toFixed(2) }
    }

    case "ssn_last_four": {
      if (!value) return { ok: true, dbValue: null }
      const digits = value.replace(/\D/g, "")
      if (digits.length !== 4) {
        return { ok: false, error: "Enter exactly 4 digits." }
      }
      return { ok: true, dbValue: digits }
    }

    default:
      return { ok: false, error: "Unknown field." }
  }
}

export function workerFieldToDbColumn(field: WorkerProfileFieldKey): string {
  return WORKER_COLUMN_MAP[field]
}

export function buildWorkerUpdatePayload(
  field: WorkerProfileFieldKey,
  dbValue: string | number | null
): Record<string, unknown> {
  const column = workerFieldToDbColumn(field)
  return {
    [column]: dbValue,
    updated_at: new Date().toISOString(),
  }
}

export function normalizeReferenceFieldValue(
  raw: unknown
): { ok: true; value: ReferenceFieldValue } | { ok: false; error: string } {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const first = String(obj.first ?? "").trim()
  const last = String(obj.last ?? "").trim()
  const email = String(obj.email ?? "").trim().toLowerCase()
  const phone = String(obj.phone ?? "").trim().replace(/\D/g, "")

  if (!first || !last || !email || !phone) {
    return { ok: false, error: "Name, email, and phone are all required." }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." }
  }
  if (phone.length < 10) {
    return { ok: false, error: "Enter at least 10 digits for phone." }
  }

  return {
    ok: true,
    value: {
      first,
      last,
      email,
      phone: phone.slice(-10),
    },
  }
}
