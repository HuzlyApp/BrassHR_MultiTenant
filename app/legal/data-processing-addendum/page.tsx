import LegalDocumentPage from "@/app/components/legal/LegalDocumentPage"
import { DATA_PROCESSING_ADDENDUM } from "@/lib/legal/data-processing-addendum"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Data Processing Addendum | BrassHR",
  description: "BrassHR Data Processing Addendum between Tenant (Controller) and ZipStaff Inc. (Processor).",
}

export default function DataProcessingAddendumPage() {
  return <LegalDocumentPage document={DATA_PROCESSING_ADDENDUM} />
}
