import { APPLICANT_TERMS } from "@/lib/legal/applicant-terms";
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

export function getDefaultLegalDocument(key: SystemLegalDocumentKey): LegalDocument {
  return DEFAULT_BY_KEY[key];
}

export function getDefaultLegalDocumentPayload(key: SystemLegalDocumentKey) {
  const doc = getDefaultLegalDocument(key);
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
