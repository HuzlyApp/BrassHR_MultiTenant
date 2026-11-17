import LegalDocumentPage from "@/app/components/legal/LegalDocumentPage"
import { loadSystemLegalDocument } from "@/lib/legal/load-document"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | BrassHR",
  description: "BrassHR Privacy Policy — how ZipStaff Inc. collects, uses, and protects personal information.",
}

type PageProps = {
  searchParams: Promise<{ tenant?: string; returnTo?: string }>
}

export default async function PrivacyPolicyPage({ searchParams }: PageProps) {
  const params = await searchParams
  const document = await loadSystemLegalDocument("privacy_policy", params.tenant ?? null)
  return <LegalDocumentPage document={document} fallbackHref="/signup" />
}
