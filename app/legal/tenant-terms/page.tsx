import LegalDocumentPage from "@/app/components/legal/LegalDocumentPage"
import { loadSystemLegalDocument } from "@/lib/legal/load-document"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tenant Terms | BrassHR",
  description: "BrassHR tenant / employer terms and conditions.",
}

type PageProps = {
  searchParams: Promise<{ tenant?: string; returnTo?: string }>
}

export default async function TenantTermsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const document = await loadSystemLegalDocument("tenant_terms", params.tenant ?? null)
  return <LegalDocumentPage document={document} fallbackHref="/signup" />
}
