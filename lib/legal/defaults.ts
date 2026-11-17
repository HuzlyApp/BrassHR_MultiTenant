import { APPLICANT_TERMS } from "@/lib/legal/applicant-terms";
import { applyCompanyNameToLegalDocument } from "@/lib/legal/company-tokens";
import { DATA_PROCESSING_ADDENDUM } from "@/lib/legal/data-processing-addendum";
import {
  SYSTEM_LEGAL_DOCUMENT_META,
  type SystemLegalDocumentKey,
} from "@/lib/legal/document-keys";
import { PRIVACY_POLICY } from "@/lib/legal/privacy-policy";
import { TENANT_TERMS } from "@/lib/legal/tenant-terms";
import type { LegalDocument } from "@/lib/legal/types";

const DEFAULT_BY_KEY: Record<SystemLegalDocumentKey, LegalDocument> = {
  privacy_policy: PRIVACY_POLICY,
  tenant_terms: TENANT_TERMS,
  applicant_terms: APPLICANT_TERMS,
  data_processing_addendum: DATA_PROCESSING_ADDENDUM,
};

/** Platform template. Pass companyName to personalize for a tenant. */
export function getDefaultLegalDocument(
  key: SystemLegalDocumentKey,
  companyName?: string | null
): LegalDocument {
  const base = DEFAULT_BY_KEY[key];
  if (!companyName?.trim()) return base;
  return applyCompanyNameToLegalDocument(base, companyName);
}

export function getDefaultLegalDocumentPayload(
  key: SystemLegalDocumentKey,
  companyName?: string | null
) {
  const doc = getDefaultLegalDocument(key, companyName);
  const meta = SYSTEM_LEGAL_DOCUMENT_META[key];
  return {
    document_key: key,
    title: doc.title || meta.title,
    last_updated_label: doc.lastUpdated,
    audience: meta.audience,
    sections: doc.sections,
    is_system: true,
    is_published: true,
    sort_order: meta.sortOrder,
  };
}
