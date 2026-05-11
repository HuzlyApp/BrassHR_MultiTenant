/** Shared step-1 review validation (client + API). */

export const STEP1_INCOMPLETE_MESSAGE =
  "Please complete all required fields before proceeding."

export type Step1FormFields = {
  firstName: string
  lastName: string
  address1: string
  address2: string
  city: string
  state: string
  zipCode: string
  phone: string
  email: string
  jobRole: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidStep1Email(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

/** US phone: exactly 10 digits (normalized). */
export function isValidStep1Phone(phone: string): boolean {
  return /^\d{10}$/.test(phone.replace(/\D/g, ""))
}

/** Strict 5-digit US ZIP (no ZIP+4 on this step). */
export function isValidStep1Zip5(zip: string): boolean {
  return /^\d{5}$/.test(zip.trim())
}

function allRequiredTrimmedNonEmpty(b: Step1FormFields): boolean {
  return (
    b.firstName.trim().length > 0 &&
    b.lastName.trim().length > 0 &&
    b.address1.trim().length > 0 &&
    b.address2.trim().length > 0 &&
    b.city.trim().length > 0 &&
    b.state.trim().length > 0 &&
    b.zipCode.trim().length > 0 &&
    b.phone.trim().length > 0 &&
    b.email.trim().length > 0 &&
    b.jobRole.trim().length > 0
  )
}

export type Step1ValidationIssue = {
  code: "INCOMPLETE" | "ZIP" | "EMAIL" | "PHONE"
  message: string
}

/**
 * Returns null if valid. Otherwise the first blocking issue (incomplete before format checks).
 */
export function validateStep1Form(b: Step1FormFields): Step1ValidationIssue | null {
  if (!allRequiredTrimmedNonEmpty(b)) {
    return { code: "INCOMPLETE", message: STEP1_INCOMPLETE_MESSAGE }
  }
  if (!isValidStep1Zip5(b.zipCode)) {
    return { code: "ZIP", message: "Enter a valid 5-digit ZIP code." }
  }
  if (!isValidStep1Email(b.email)) {
    return { code: "EMAIL", message: "Enter a valid email address." }
  }
  if (!isValidStep1Phone(b.phone)) {
    return { code: "PHONE", message: "Enter a valid 10-digit US phone number." }
  }
  return null
}

export function step1ZipInlineMessage(zipCode: string): string | null {
  const t = zipCode.trim()
  if (!t) return null
  if (!isValidStep1Zip5(zipCode)) return "Enter a valid 5-digit ZIP code."
  return null
}
