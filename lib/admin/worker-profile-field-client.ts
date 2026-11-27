import { normalizeWorkerPayRateAmount } from "@/lib/admin/worker-pay-rate"
import { filterPersonNameInput, validatePersonName } from "@/lib/person-name"

export type CandidateFieldKind =
  | "person_name"
  | "city"
  | "address"
  | "email"
  | "date_of_birth"
  | "years_experience"
  | "phone"
  | "zip"
  | "ssn_last_four"
  | "hourly_rate"
  | "short_text"

const SHORT_TEXT_MAX_LENGTH = 120

export function filterCandidateFieldInput(kind: CandidateFieldKind, raw: string): string {
  switch (kind) {
    case "person_name":
      return filterPersonNameInput(raw)
    case "city":
      return raw.replace(/[^a-zA-Z\s'.-]/g, "")
    case "address":
      return raw.replace(/[^a-zA-Z0-9\s#.,/-]/g, "")
    case "email":
      return raw.replace(/[^\w@.+-]/g, "")
    case "date_of_birth":
      return formatDobInput(raw)
    case "years_experience":
      return raw.replace(/\D/g, "").slice(0, 2)
    case "phone":
      return formatPhoneInput(raw)
    case "zip":
      return formatZipInput(raw)
    case "ssn_last_four":
      return raw.replace(/\D/g, "").slice(0, 4)
    case "hourly_rate":
      return raw
    case "short_text":
      return raw.replace(/\s+/g, " ").slice(0, SHORT_TEXT_MAX_LENGTH)
    default:
      return raw
  }
}

function formatDobInput(raw: string): string {
  if (/[^\d/]/.test(raw) || raw.replace(/\D/g, "").length > 8) return raw
  const digits = raw.replace(/\D/g, "")
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10)
  if (digits.length === 0) return ""
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function formatZipInput(raw: string): string {
  if (/[^\d-]/.test(raw) || raw.replace(/\D/g, "").length > 9) return raw
  const digits = raw.replace(/\D/g, "")
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function validateCandidateFieldInput(
  kind: CandidateFieldKind,
  raw: string
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim()

  switch (kind) {
    case "person_name": {
      const name = validatePersonName(value)
      return name.ok ? { ok: true, value: name.value } : { ok: false, error: name.error }
    }
    case "city": {
      if (!value) return { ok: false, error: "City is required." }
      if (/\d/.test(value)) return { ok: false, error: "City cannot include numbers." }
      if (!/^[a-zA-Z\s'.-]+$/.test(value)) {
        return { ok: false, error: "Use letters only." }
      }
      return { ok: true, value }
    }
    case "address": {
      if (!value) return { ok: false, error: "Address is required." }
      return { ok: true, value }
    }
    case "email": {
      if (!value) return { ok: false, error: "Email is required." }
      const email = value.toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: "Enter a valid email address." }
      }
      return { ok: true, value: email }
    }
    case "date_of_birth": {
      if (!value) return { ok: false, error: "Date of birth is required." }
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        return { ok: false, error: "Use MM/DD/YYYY format." }
      }
      const [mm, dd, yyyy] = value.split("/").map(Number)
      const d = new Date(yyyy, mm - 1, dd)
      if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) {
        return { ok: false, error: "Enter a valid date." }
      }
      const today = new Date().toISOString().slice(0, 10)
      const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
      if (iso > today) return { ok: false, error: "Date of birth cannot be in the future." }
      return { ok: true, value }
    }
    case "years_experience": {
      if (!value) return { ok: false, error: "Years of experience is required." }
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0 || n > 80) {
        return { ok: false, error: "Enter years between 0 and 80." }
      }
      return { ok: true, value: String(Math.round(n)) }
    }
    case "phone": {
      const digits = value.replace(/\D/g, "")
      if (digits.length < 10) return { ok: false, error: "Enter a 10-digit phone number." }
      return { ok: true, value: digits.slice(-10) }
    }
    case "zip": {
      if (!value) return { ok: false, error: "Zip code is required." }
      if (!/^\d{5}(?:-?\d{4})?$/.test(value)) {
        return { ok: false, error: "Enter a 5-digit ZIP or ZIP+4." }
      }
      const digits = value.replace(/-/g, "")
      return { ok: true, value: digits.length === 9 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits }
    }
    case "ssn_last_four": {
      const digits = value.replace(/\D/g, "")
      if (digits.length !== 4) return { ok: false, error: "Enter exactly 4 digits." }
      return { ok: true, value: digits }
    }
    case "hourly_rate":
      return normalizeWorkerPayRateAmount(value)
    case "short_text": {
      if (!value) return { ok: false, error: "This field cannot be empty." }
      if (value.length > SHORT_TEXT_MAX_LENGTH) {
        return { ok: false, error: `Keep under ${SHORT_TEXT_MAX_LENGTH} characters.` }
      }
      return { ok: true, value }
    }
    default:
      return { ok: true, value }
  }
}

export function formatPhoneForEdit(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(-10)
  if (digits.length === 0) return ""
  return formatPhoneInput(digits)
}

export function formatPhoneForDisplay(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(-10)
  if (digits.length < 10) return value?.trim() || "—"
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}
