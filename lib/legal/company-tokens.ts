import type { LegalDocument, LegalSection } from "@/lib/legal/types";

/** Normalize tenant display name for legal copy. */
export function normalizeLegalCompanyName(companyName: string | null | undefined): string {
  const name = companyName?.trim() || "";
  return name.length > 0 ? name : "Company";
}

/**
 * Replace platform / placeholder company identity with the tenant company name.
 * Order matters: longer ZipStaff phrases first.
 */
export function applyCompanyNameToText(text: string, companyName: string | null | undefined): string {
  const name = normalizeLegalCompanyName(companyName);
  if (!text) return text;

  return text
    .replaceAll("{{company_name}}", name)
    .replaceAll("{{company}}", name)
    .replaceAll("[ZipStaff Legal Entity]", name)
    .replaceAll("ZipStaff Inc.", name)
    .replaceAll("ZipStaff", name);
}

export function applyCompanyNameToSections(
  sections: LegalSection[],
  companyName: string | null | undefined
): LegalSection[] {
  return sections.map((section) => ({
    title: applyCompanyNameToText(section.title, companyName),
    paragraphs: section.paragraphs.map((paragraph) =>
      applyCompanyNameToText(paragraph, companyName)
    ),
  }));
}

export function applyCompanyNameToLegalDocument(
  document: LegalDocument,
  companyName: string | null | undefined
): LegalDocument {
  return {
    title: applyCompanyNameToText(document.title, companyName),
    lastUpdated: document.lastUpdated
      ? applyCompanyNameToText(document.lastUpdated, companyName)
      : null,
    sections: applyCompanyNameToSections(document.sections, companyName),
  };
}
