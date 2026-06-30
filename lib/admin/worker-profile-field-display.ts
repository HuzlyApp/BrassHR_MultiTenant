export function formatReferenceDisplay(ref: {
  name?: string | null
  email?: string | null
  phone?: string | null
} | null | undefined): string {
  if (!ref || referenceIsMissing(ref)) return ""
  const parts = [ref.name, ref.email, ref.phone].map((p) => (p ?? "").trim()).filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : ""
}

export function isMissingCandidateValue(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return true
    const normalized = trimmed.toLowerCase()
    return (
      trimmed === "—" ||
      trimmed === "-" ||
      normalized === "n/a" ||
      normalized === "na" ||
      normalized === "none"
    )
  }
  return false
}

/** @deprecated Use isMissingCandidateValue */
export const isMissingValue = isMissingCandidateValue

export function referenceIsMissing(ref: {
  name?: string | null
  email?: string | null
  phone?: string | null
} | null | undefined): boolean {
  if (!ref) return true
  const name = (ref.name ?? "").trim()
  const email = (ref.email ?? "").trim()
  const phone = (ref.phone ?? "").trim()
  return isMissingCandidateValue(name) || (!email && !phone)
}

export function isPlaceholderZip(value: string | null | undefined): boolean {
  const digits = (value ?? "").replace(/\D/g, "")
  return digits.length === 0 || /^0+$/.test(digits)
}

export function isPlaceholderPhone(value: string | null | undefined): boolean {
  const digits = (value ?? "").replace(/\D/g, "")
  return digits.length === 0 || /^0+$/.test(digits)
}
