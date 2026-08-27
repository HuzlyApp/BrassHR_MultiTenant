import LegalDocumentPage from "@/app/components/legal/LegalDocumentPage"
import { PRIVACY_POLICY } from "@/lib/legal/privacy-policy"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | BrassHR",
  description: "BrassHR Privacy Policy — how ZipStaff Inc. collects, uses, and protects personal information.",
}

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage document={PRIVACY_POLICY} fallbackHref="/signup" />
}
