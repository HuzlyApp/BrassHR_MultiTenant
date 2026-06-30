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

export function filterCandidateFieldInput(kind: CandidateFieldKind, raw: string): string {
  switch (kind) {
    case "person_name":
      return raw.replace(/[^a-zA-Z\s'.-]/g, "")
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
      return formatHourlyRateInput(raw)
    default:
      return raw
  }
}

function formatDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
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
  const cleaned = raw.replace(/[^\d-]/g, "")
  const digits = cleaned.replace(/\D/g, "").slice(0, 9)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function formatHourlyRateInput(raw: string): string {
  let out = ""
  let hasDot = false
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      out += ch
      continue
    }
    if (ch === "." && !hasDot) {
      hasDot = true
      out += ch
    }
  }
  const parts = out.split(".")
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1].slice(0, 2)}`
  }
  return out
}

export function validateCandidateFieldInput(
  kind: CandidateFieldKind,
  raw: string
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim()

  switch (kind) {
    case "person_name": {
      if (!value) return { ok: false, error: "Name is required." }
      if (/\d/.test(value)) return { ok: false, error: "Name cannot include numbers." }
      if (!/^[a-zA-Z\s'.-]+$/.test(value)) {
        return { ok: false, error: "Use letters only." }
      }
      return { ok: true, value }
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
      const digits = value.replace(/\D/g, "")
      if (digits.length === 0) return { ok: false, error: "Zip code is required." }
      if (digits.length > 9) return { ok: false, error: "Enter a valid zip code." }
      const normalized =
        digits.length <= 5 ? digits.padStart(5, "0") : `${digits.slice(0, 5)}-${digits.slice(5, 9)}`
      return { ok: true, value: normalized }
    }
    case "ssn_last_four": {
      const digits = value.replace(/\D/g, "")
      if (digits.length !== 4) return { ok: false, error: "Enter exactly 4 digits." }
      return { ok: true, value: digits }
    }
    case "hourly_rate": {
      if (!value) return { ok: false, error: "Hourly rate is required." }
      const n = Number(value.replace(/[^0-9.]/g, ""))
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: "Enter a valid hourly rate." }
      }
      return { ok: true, value: n.toFixed(2) }
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
