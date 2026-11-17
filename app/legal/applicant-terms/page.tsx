import LegalDocumentPage from "@/app/components/legal/LegalDocumentPage"
import { loadSystemLegalDocument } from "@/lib/legal/load-document"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Applicant Terms | BrassHR",
  description: "BrassHR applicant and candidate terms and conditions.",
}

type PageProps = {
  searchParams: Promise<{ tenant?: string; returnTo?: string }>
}

export default async function ApplicantTermsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const document = await loadSystemLegalDocument("applicant_terms", params.tenant ?? null)
  return <LegalDocumentPage document={document} fallbackHref="/worker-signin" />
}
