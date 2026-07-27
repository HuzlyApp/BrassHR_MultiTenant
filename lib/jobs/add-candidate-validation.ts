import { normalizePhoneInput } from "@/lib/phone";

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const ACCEPTED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"];
const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export type AddCandidateFieldKey =
  | "consideredFor"
  | "name"
  | "email"
  | "phone"
  | "resume";

export type AddCandidateFieldErrors = Partial<Record<AddCandidateFieldKey, string>>;

export function isAcceptedResumeFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_RESUME_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function validateResumeFile(file: File): string | null {
  if (!isAcceptedResumeFile(file)) {
    return "Please upload a resume in PDF, DOC, or DOCX format.";
  }
  if (file.size > MAX_RESUME_BYTES) {
    return "Max file size is 10 MB.";
  }
  return null;
}

export function validateAddCandidateField(
  field: AddCandidateFieldKey,
  value: {
    consideredFor?: string;
    name?: string;
    email?: string;
    phone?: string;
    resumeFile?: File | null;
  }
): string | null {
  switch (field) {
    case "consideredFor": {
      if (!String(value.consideredFor ?? "").trim()) {
        return "Select a job.";
      }
      return null;
    }
    case "name": {
      const name = String(value.name ?? "").trim();
      if (!name) return "Name is required.";
      if (name.length < 2) return "Enter at least 2 characters.";
      if (!/[a-zA-Z]/.test(name)) return "Enter a valid name.";
      return null;
    }
    case "email": {
      const email = String(value.email ?? "").trim();
      if (!email) return "Email address is required.";
      if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
      return null;
    }
    case "phone": {
      const digits = normalizePhoneInput(String(value.phone ?? ""));
      if (!digits) return "Phone is required.";
      if (digits.length !== 10) return "Enter a valid 10-digit phone number.";
      return null;
    }
    case "resume": {
      const file = value.resumeFile;
      if (!file) return null;
      return validateResumeFile(file);
    }
    default:
      return null;
  }
}

export function validateAddCandidateForm(value: {
  consideredFor: string;
  name: string;
  email: string;
  phone: string;
  resumeFile: File | null;
}): AddCandidateFieldErrors {
  const fields: AddCandidateFieldKey[] = [
    "consideredFor",
    "name",
    "email",
    "phone",
    "resume",
  ];
  const errors: AddCandidateFieldErrors = {};

  for (const field of fields) {
    const message = validateAddCandidateField(field, value);
    if (message) errors[field] = message;
  }

  return errors;
}

export function hasAddCandidateFieldErrors(errors: AddCandidateFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
