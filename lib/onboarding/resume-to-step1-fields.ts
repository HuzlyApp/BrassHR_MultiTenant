import {
  isValidStep1Email,
  isValidStep1Phone,
  isValidStep1Zip5,
  type Step1FormFields,
} from "@/lib/onboardingStep1Validation"
import { normalizeParsedResume } from "@/lib/resumeParseQuality"

/** Build step-1 worker fields from parsed resume JSON, filling safe defaults when needed. */
export function resumeToStep1Fields(
  raw: unknown,
  applicantId: string
): Step1FormFields {
  const n = normalizeParsedResume(raw)
  const phoneDigits = n.phone.replace(/\D/g, "")
  const phone =
    isValidStep1Phone(n.phone) && phoneDigits.length >= 10
      ? phoneDigits.slice(-10)
      : "0000000000"
  const zip = isValidStep1Zip5(n.zip) ? n.zip.trim() : "00000"
  const email = isValidStep1Email(n.email) ? n.email.trim() : ""

  return {
    firstName: n.first_name.trim() || "Applicant",
    lastName: n.last_name.trim() || "User",
    address1: n.address1.trim() || "-",
    address2: n.address2.trim() || "-",
    city: n.city.trim() || "-",
    state: n.state.trim() || "-",
    zipCode: zip,
    phone,
    email,
    jobRole: n.job_role.trim() || "Applicant",
  }
}
