/** US ZIP: 12345 or optional ZIP+4 12345-6789 (digits + single hyphen after 5th digit). */

const ZIP5 = /^\d{5}$/
const ZIP9 = /^\d{5}-\d{4}$/

export function sanitizeUsZipInput(raw: string): string {
  const s = raw.replace(/[^\d-]/g, "")
  if (!s) return ""
  const digits = s.replace(/\D/g, "")
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`
}

export function isValidUsZip(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  return ZIP5.test(v) || ZIP9.test(v)
}

export function usZipValidationMessage(value: string): string | null {
  const v = value.trim()
  if (!v) return "ZIP code is required."
  if (!isValidUsZip(v)) {
    return "Enter a valid US ZIP (5 digits) or ZIP+4 (e.g. 12345-6789)."
  }
  return null
}
