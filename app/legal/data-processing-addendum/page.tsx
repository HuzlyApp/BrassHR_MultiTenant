import LegalDocumentPage from "@/app/components/legal/LegalDocumentPage"
import { loadSystemLegalDocument } from "@/lib/legal/load-document"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Data Processing Addendum | BrassHR",
  description: "BrassHR data processing addendum for tenant employers.",
}

type PageProps = {
  searchParams: Promise<{ tenant?: string; returnTo?: string }>
}

export default async function DataProcessingAddendumPage({ searchParams }: PageProps) {
  const params = await searchParams
  const document = await loadSystemLegalDocument("data_processing_addendum", params.tenant ?? null)
  return <LegalDocumentPage document={document} fallbackHref="/signup" />
}
