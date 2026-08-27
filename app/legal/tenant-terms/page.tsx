import LegalDocumentPage from "@/app/components/legal/LegalDocumentPage"
import { TENANT_TERMS } from "@/lib/legal/tenant-terms"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tenant Terms of Service | BrassHR",
  description: "BrassHR Tenant Terms of Service for organizations creating a tenant account.",
}

export default function TenantTermsPage() {
  return <LegalDocumentPage document={TENANT_TERMS} fallbackHref="/signup" />
}
