export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  lastUpdated: string | null;
  sections: LegalSection[];
};

export type LegalDocumentRecord = {
  id: string;
  tenant_id: string;
  document_key: string;
  title: string;
  last_updated_label: string | null;
  audience: "all" | "tenant" | "worker" | "applicant";
  sections: LegalSection[];
  is_system: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function legalRecordToDocument(record: Pick<LegalDocumentRecord, "title" | "last_updated_label" | "sections">): LegalDocument {
  return {
    title: record.title,
    lastUpdated: record.last_updated_label,
    sections: Array.isArray(record.sections) ? record.sections : [],
  };
}
