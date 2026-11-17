/** Public legal document routes (shared across modules). */
export const LEGAL_ROUTES = {
  privacyPolicy: "/legal/privacy-policy",
  tenantTerms: "/legal/tenant-terms",
  applicantTerms: "/legal/applicant-terms",
  dataProcessingAddendum: "/legal/data-processing-addendum",
} as const

/** Public path for a custom (non-system) legal document key. */
export function legalDocumentPublicPath(documentKey: string): string {
  const key = documentKey.trim().toLowerCase()
  if (key === "privacy_policy") return LEGAL_ROUTES.privacyPolicy
  if (key === "tenant_terms") return LEGAL_ROUTES.tenantTerms
  if (key === "applicant_terms") return LEGAL_ROUTES.applicantTerms
  if (key === "data_processing_addendum") return LEGAL_ROUTES.dataProcessingAddendum
  return `/legal/${encodeURIComponent(key)}`
}
