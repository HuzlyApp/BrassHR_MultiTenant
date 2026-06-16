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
  "position_title",
  "compensation",
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
  position_title: "Position title",
  compensation: "Compensation",
  start_date: "Start date",
  recruiter_name: "Recruiter name",
  recruiter_email: "Recruiter email",
  hiring_manager_name: "Hiring manager name",
  company_name: "Company name",
  department: "Department",
  location: "Location",
};

export const RECRUITER_TEMPLATE_DOCUMENT_BUCKET = "recruiter-template-documents";

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
