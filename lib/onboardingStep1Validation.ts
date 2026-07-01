/** Shared step-1 review validation (client + API). */

import { getStateCodeFromName } from "@/lib/us-state-names"
import { zipPrefixBelongsToState } from "@/lib/us-zip-by-state"

export const STEP1_INCOMPLETE_MESSAGE =
  "Please complete all required fields before proceeding."

export const STEP1_ADDRESS_NOT_VERIFIED_MESSAGE =
  "We couldn't verify this address. Please enter a valid address or location."

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
  /** When true, address2 mirrors address1 and is not required separately. */
  sameAsAddress1?: boolean
}

/** Address line 2 stored on the worker row (mirrors line 1 when flagged). */
export function resolveStep1Address2(
  fields: Pick<Step1FormFields, "address1" | "address2" | "sameAsAddress1">
): string {
  if (fields.sameAsAddress1) return fields.address1.trim()
  return fields.address2.trim()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidStep1Email(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

/** Internal placeholder addresses used before step 1 review — not deliverable by Firma. */
export function isPlaceholderApplicantEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return normalized.endsWith(".local") || normalized.endsWith("@placeholder.local")
}

/** Real inbox suitable for Firma signing (format valid and not a placeholder). */
export function isDeliverableApplicantEmail(email: string): boolean {
  return isValidStep1Email(email) && !isPlaceholderApplicantEmail(email)
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
  const address2Ok = Boolean(b.sameAsAddress1) || b.address2.trim().length > 0
  return (
    b.firstName.trim().length > 0 &&
    b.lastName.trim().length > 0 &&
    b.address1.trim().length > 0 &&
    address2Ok &&
    b.city.trim().length > 0 &&
    b.state.trim().length > 0 &&
    b.zipCode.trim().length > 0 &&
    b.phone.trim().length > 0 &&
    b.email.trim().length > 0 &&
    b.jobRole.trim().length > 0
  )
}

export type Step1ValidationIssue = {
  code: "INCOMPLETE" | "ZIP" | "EMAIL" | "PHONE" | "ADDRESS"
  message: string
}

export type Step1ValidationOptions = {
  /** When false, address must be verified via Mapbox before continuing. */
  addressVerified?: boolean
}

/**
 * Returns null if valid. Otherwise the first blocking issue (incomplete before format checks).
 */
export function validateStep1Form(
  b: Step1FormFields,
  options?: Step1ValidationOptions
): Step1ValidationIssue | null {
  if (!allRequiredTrimmedNonEmpty(b)) {
    return { code: "INCOMPLETE", message: STEP1_INCOMPLETE_MESSAGE }
  }
  if (options?.addressVerified === false) {
    return { code: "ADDRESS", message: STEP1_ADDRESS_NOT_VERIFIED_MESSAGE }
  }
  if (!isValidStep1Zip5(b.zipCode)) {
    return { code: "ZIP", message: "Enter a valid 5-digit ZIP code." }
  }
  const zipStateMessage = step1ZipStateMessage(b.zipCode, b.state)
  if (zipStateMessage) {
    return { code: "ZIP", message: zipStateMessage }
  }
  if (!isValidStep1Email(b.email)) {
    return { code: "EMAIL", message: "Enter a valid email address." }
  }
  if (!isValidStep1Phone(b.phone)) {
    return { code: "PHONE", message: "Enter a valid 10-digit US phone number." }
  }
  return null
}

export function step1ZipInlineMessage(zipCode: string, stateName?: string): string | null {
  const t = zipCode.trim()
  if (!t) return null
  if (!isValidStep1Zip5(zipCode)) return "Enter a valid 5-digit ZIP code."
  return step1ZipStateMessage(zipCode, stateName)
}

/** US ZIP must match the selected state (country is US on this step). */
export function step1ZipStateMessage(zipCode: string, stateName?: string): string | null {
  if (!isValidStep1Zip5(zipCode)) return null

  const state = stateName?.trim()
  if (!state) return "Select a state before entering a ZIP code."

  const stateCode = getStateCodeFromName(state)
  if (!stateCode) return null

  if (!zipPrefixBelongsToState(zipCode, stateCode)) {
    return `This ZIP code does not match ${state}.`
  }

  return null
}
