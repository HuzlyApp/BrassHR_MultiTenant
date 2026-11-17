/** Stable keys for system legal documents (seeded per tenant on first admin load). */
export const SYSTEM_LEGAL_DOCUMENT_KEYS = [
  "privacy_policy",
  "tenant_terms",
  "applicant_terms",
  "data_processing_addendum",
] as const;

export type SystemLegalDocumentKey = (typeof SYSTEM_LEGAL_DOCUMENT_KEYS)[number];

export type LegalDocumentAudience = "all" | "tenant" | "worker" | "applicant";

export const LEGAL_DOCUMENT_AUDIENCE_LABELS: Record<LegalDocumentAudience, string> = {
  all: "Everyone",
  tenant: "Tenant / employer users",
  worker: "Workers",
  applicant: "Applicants / candidates",
};

export const SYSTEM_LEGAL_DOCUMENT_META: Record<
  SystemLegalDocumentKey,
  {
    title: string;
    audience: LegalDocumentAudience;
    sortOrder: number;
    routePath: string;
    description: string;
  }
> = {
  privacy_policy: {
    title: "Privacy Policy",
    audience: "all",
    sortOrder: 10,
    routePath: "/legal/privacy-policy",
    description: "Shown wherever Privacy Policy links appear for this tenant.",
  },
  tenant_terms: {
    title: "Tenant Terms and Conditions",
    audience: "tenant",
    sortOrder: 20,
    routePath: "/legal/tenant-terms",
    description: "Employer / recruiter terms used at signup and job publish.",
  },
  applicant_terms: {
    title: "Applicant / Candidate Terms",
    audience: "applicant",
    sortOrder: 30,
    routePath: "/legal/applicant-terms",
    description: "Applicant and worker sign-in acceptance terms.",
  },
  data_processing_addendum: {
    title: "Data Processing Addendum",
    audience: "tenant",
    sortOrder: 40,
    routePath: "/legal/data-processing-addendum",
    description: "DPA linked from tenant signup and related employer flows.",
  },
};

export function isSystemLegalDocumentKey(value: string): value is SystemLegalDocumentKey {
  return (SYSTEM_LEGAL_DOCUMENT_KEYS as readonly string[]).includes(value);
}

export function slugifyLegalDocumentKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 64);
}
