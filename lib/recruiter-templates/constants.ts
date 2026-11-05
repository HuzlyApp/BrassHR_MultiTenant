export const RECRUITER_TEMPLATE_CATEGORIES = [
  "offer_letter",
  "nda",
  "contractor_agreement",
  "interview_consent",
  "background_check_authorization",
] as const;

export type RecruiterTemplateCategory = (typeof RECRUITER_TEMPLATE_CATEGORIES)[number];

export const RECRUITER_TEMPLATE_CATEGORY_LABELS: Record<RecruiterTemplateCategory, string> = {
  offer_letter: "Offer Letter",
  nda: "NDA",
  contractor_agreement: "Contractor Agreement",
  interview_consent: "Interview Consent",
  background_check_authorization: "Background Check Authorization",
};

export const RECRUITER_TEMPLATE_STATUSES = ["draft", "active", "archived"] as const;
export type RecruiterTemplateStatus = (typeof RECRUITER_TEMPLATE_STATUSES)[number];

export const SIGNING_ROLE_KEYS = [
  "candidate",
  "recruiter",
  "hiring_manager",
  "hr_admin",
] as const;

export type SigningRoleKey = (typeof SIGNING_ROLE_KEYS)[number];

export const SIGNING_ROLE_LABELS: Record<SigningRoleKey, string> = {
  candidate: "Candidate",
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
  hr_admin: "HR / Admin",
};

export const APP_DATA_SOURCES = [
  "candidate_name",
  "candidate_email",
  "candidate_phone",
  "candidate_address",
  "candidate_address_line_2",
  "candidate_city",
  "candidate_state",
  "candidate_postal_code",
  "candidate_country",
  "date_of_birth",
  "ssn_last_four",
  "position_title",
  "employment_type",
  "compensation",
  "pay_rate",
  "pay_frequency",
  "start_date",
  "recruiter_name",
  "recruiter_email",
  "hiring_manager_name",
  "company_name",
  "department",
  "location",
] as const;

export type AppDataSource = (typeof APP_DATA_SOURCES)[number];

export const APP_DATA_SOURCE_LABELS: Record<AppDataSource, string> = {
  candidate_name: "Candidate name",
  candidate_email: "Candidate email",
  candidate_phone: "Candidate phone",
  candidate_address: "Candidate address",
  candidate_address_line_2: "Address line 2",
  candidate_city: "City",
  candidate_state: "State / Province",
  candidate_postal_code: "ZIP / Postal code",
  candidate_country: "Country",
  date_of_birth: "Date of birth",
  ssn_last_four: "SSN (last 4)",
  position_title: "Position title",
  employment_type: "Employment type",
  compensation: "Compensation",
  pay_rate: "Pay rate",
  pay_frequency: "Pay frequency",
  start_date: "Start / hire date",
  recruiter_name: "Recruiter name",
  recruiter_email: "Recruiter email",
  hiring_manager_name: "Hiring manager name",
  company_name: "Company name",
  department: "Department",
  location: "Location",
};

export const RECRUITER_TEMPLATE_DOCUMENT_BUCKET = "recruiter-template-documents";

/**
 * In-app path for the Firma template editor embed.
 * Firma does not host a standalone `/template-editor` page on app.firma.dev —
 * the editor is embed-only via `template-editor.js` (see Firma docs).
 */
export function buildRecruiterTemplateBuilderPath(templateId: string): string {
  return `/admin_recruiter/template-builder/${encodeURIComponent(templateId)}?preview=1`;
}

export const RECRUITER_TEMPLATE_FIELD_TYPES = [
  "text",
  "date",
  "signature",
  "checkbox",
  "dropdown",
] as const;

export type RecruiterTemplateFieldType = (typeof RECRUITER_TEMPLATE_FIELD_TYPES)[number];

export const RECRUITER_TEMPLATE_DESIGNATIONS = ["Signer", "Approver", "CC"] as const;
export type RecruiterTemplateDesignation = (typeof RECRUITER_TEMPLATE_DESIGNATIONS)[number];
