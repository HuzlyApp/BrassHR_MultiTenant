/**
 * Shared resume upload gates — same spirit as /application/add-resume + /api/upload-resume.
 * Accepts PDF / DOC / DOCX formats only, then verifies the file looks like a résumé
 * (not a license, W-2, authorization form, etc.).
 */

const ACCEPTED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;

const ALLOWED_RESUME_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_RE =
  /(?:\+?1[\s.-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/;

const RESUME_SECTION_HINTS = [
  /\b(experience|employment\s*history|work\s*history|professional\s*summary|objective|profile)\b/i,
  /\b(education|university|college|degree|bachelor|associate|diploma)\b/i,
  /\b(skills|certifications?|licen[sc]es?|qualifications?)\b/i,
  /\b(references?|achievements?|accomplishments?)\b/i,
  /\b(CNA|RN|LPN|LVN|Caregiver|Medical\s*Assistant|Nurse|Nursing\s*Assistant|Home\s*Health)\b/i,
];

const STRONG_NON_RESUME_DOCUMENT_HINTS =
  /\b(form\s*w-?2|w-?2\s+wage\s+and\s+tax|form\s*i-?9|i-?9\s+employment\s+eligibility)\b/i;

const WEAK_NON_RESUME_DOCUMENT_HINTS =
  /\b(driver'?s?\s*licen[sc]e|social\s*security\s*card|ssn\s*card|pay\s*stub)\b/i;

export class ResumeUploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeUploadValidationError";
  }
}

export function isResumeUploadValidationError(error: unknown): boolean {
  if (error instanceof ResumeUploadValidationError) return true;
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("does not look like a resume") ||
    message.includes("not a resume") ||
    message.includes("please upload a resume") ||
    message.includes("pdf, doc, or docx") ||
    message.includes("max file size") ||
    message.includes("choose a resume") ||
    message.includes("legacy .doc") ||
    message.includes("only pdf") ||
    message.includes("another document") ||
    message.includes("select a job") ||
    message.includes("select a valid job")
  );
}

function countResumeSignals(text: string): number {
  let signals = 0;
  if (EMAIL_RE.test(text)) signals += 1;
  if (PHONE_RE.test(text)) signals += 1;
  for (const hint of RESUME_SECTION_HINTS) {
    if (hint.test(text)) signals += 1;
  }
  return signals;
}

export function isAcceptedResumeFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_RESUME_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isAcceptedResumeMime(mime: string): boolean {
  return ALLOWED_RESUME_MIME.has((mime || "").toLowerCase());
}

/** Client + server format gate (PDF / DOC / DOCX, max 10MB). */
export function validateResumeUploadFile(input: {
  name: string;
  type?: string;
  size: number;
  maxBytes?: number;
}): string | null {
  const maxBytes = input.maxBytes ?? 10 * 1024 * 1024;
  const mime = (input.type || "").toLowerCase();
  if (!isAcceptedResumeFileName(input.name) && !isAcceptedResumeMime(mime)) {
    return "Please upload a resume in PDF, DOC, or DOCX format.";
  }
  if (input.size > maxBytes) {
    return "Max file size is 10 MB.";
  }
  return null;
}

/**
 * Content gate after text extraction.
 * Rejects empty / unreadable files and obvious non-resume documents.
 */
export function validateExtractedResumeText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 80) {
    return "This file does not look like a resume. Please upload a readable resume (PDF or DOCX).";
  }

  const signals = countResumeSignals(trimmed);

  if (STRONG_NON_RESUME_DOCUMENT_HINTS.test(trimmed) && signals < 3) {
    return "This file looks like another document, not a resume. Please upload the candidate’s resume only.";
  }

  if (WEAK_NON_RESUME_DOCUMENT_HINTS.test(trimmed) && signals < 2) {
    return "This file looks like another document, not a resume. Please upload the candidate’s resume only.";
  }

  if (signals < 2) {
    return "This file does not look like a resume. Please upload a resume with work history or contact details.";
  }

  return null;
}

export function resolveResumeFileType(file: { name: string; type?: string }): "pdf" | "docx" | "doc" | "unknown" {
  const lower = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mime === "application/msword" || lower.endsWith(".doc")) return "doc";
  return "unknown";
}
