import { notFound } from "next/navigation"
import LegalDocumentPage from "@/app/components/legal/LegalDocumentPage"
import { isSystemLegalDocumentKey } from "@/lib/legal/document-keys"
import { loadPublishedLegalDocument } from "@/lib/legal/load-document"
import type { Metadata } from "next"

type PageProps = {
  params: Promise<{ documentKey: string }>
  searchParams: Promise<{ tenant?: string; returnTo?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { documentKey } = await params
  const key = documentKey.trim().toLowerCase()
  return {
    title: `${key.replace(/_/g, " ")} | BrassHR`,
  }
}

/** Dynamic custom legal policies. System keys keep their dedicated routes. */
export default async function DynamicLegalDocumentPage({ params, searchParams }: PageProps) {
  const [{ documentKey }, query] = await Promise.all([params, searchParams])
  const key = documentKey.trim().toLowerCase()

  if (isSystemLegalDocumentKey(key)) {
    notFound()
  }

  const document = await loadPublishedLegalDocument({
    documentKey: key,
    tenantSlug: query.tenant ?? null,
  })

  if (!document.sections.length) {
    notFound()
  }

  return <LegalDocumentPage document={document} fallbackHref="/signup" />
}
