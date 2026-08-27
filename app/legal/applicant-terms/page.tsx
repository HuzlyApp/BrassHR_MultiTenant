import LegalDocumentPage from "@/app/components/legal/LegalDocumentPage"
import { APPLICANT_TERMS } from "@/lib/legal/applicant-terms"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Applicant Terms and Conditions | BrassHR",
  description: "BrassHR Applicant / Candidate Terms and Conditions.",
}

export default function ApplicantTermsPage() {
  return <LegalDocumentPage document={APPLICANT_TERMS} fallbackHref="/worker-signin" />
}
