import { extractEmailFromResumeText } from "@/lib/onboarding/extract-email-from-resume-text";
import { isDeliverableApplicantEmail } from "@/lib/onboardingStep1Validation";
import { normalizeParsedResume } from "@/lib/resumeParseQuality";

/** Known email field aliases on worker / resume / form records. */
export const APPLICANT_EMAIL_FIELD_KEYS = [
  "email",
  "work_email",
  "applicant_email",
  "candidate_email",
  "worker_email",
  "contact_email",
] as const;

export function normalizeApplicantEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

/** Returns the first deliverable email found on a loosely shaped record. */
export function pickDeliverableEmailFromRecord(
  record: Record<string, unknown> | null | undefined
): string | null {
  if (!record) return null;
  for (const key of APPLICANT_EMAIL_FIELD_KEYS) {
    const value = record[key];
    if (typeof value === "string") {
      const normalized = normalizeApplicantEmail(value);
      if (isDeliverableApplicantEmail(normalized)) return normalized;
    }
  }
  return null;
}

/** Returns the first deliverable email from an ordered list of candidates. */
export function pickDeliverableEmailFromSources(
  ...sources: Array<string | null | undefined>
): string | null {
  for (const source of sources) {
    const normalized = normalizeApplicantEmail(source);
    if (isDeliverableApplicantEmail(normalized)) return normalized;
  }
  return null;
}

export function readApplicantEmailFromParsedResumeJson(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const fromRecord = pickDeliverableEmailFromRecord(parsed);
    if (fromRecord) return fromRecord;
    const normalized = normalizeParsedResume(parsed);
    const email = normalizeApplicantEmail(normalized.email);
    if (isDeliverableApplicantEmail(email)) return email;
  } catch {
    return null;
  }
  return null;
}

export type ApplicantSigningEmailLocalSnapshot = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

/** Best-effort applicant email from browser onboarding draft storage. */
export function readApplicantSigningEmailFromLocalStorage(): ApplicantSigningEmailLocalSnapshot {
  if (typeof window === "undefined") {
    return { email: null, firstName: null, lastName: null };
  }

  let email = readApplicantEmailFromParsedResumeJson(localStorage.getItem("parsedResume"));
  let firstName: string | null = null;
  let lastName: string | null = null;

  try {
    const saved = localStorage.getItem("parsedResume");
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, string>;
      firstName = (parsed.firstName || parsed.first_name || "").trim() || null;
      lastName = (parsed.lastName || parsed.last_name || "").trim() || null;
    }
  } catch {
    /* ignore */
  }

  try {
    const raw = localStorage.getItem("step4DocumentsDraft");
    if (raw) {
      const draft = JSON.parse(raw) as { signerEmail?: string; signerName?: string };
      if (!email) {
        const draftEmail = normalizeApplicantEmail(draft.signerEmail);
        if (isDeliverableApplicantEmail(draftEmail)) email = draftEmail;
      }
      if (!firstName && !lastName && draft.signerName?.trim()) {
        const parts = draft.signerName.trim().split(/\s+/);
        firstName = parts[0] ?? null;
        lastName = parts.slice(1).join(" ") || null;
      }
    }
  } catch {
    /* ignore */
  }

  return { email, firstName, lastName };
}

export function resolveEmailFromResumeRow(row: {
  parsed_data?: Record<string, unknown> | null;
  extracted_text?: string | null;
} | null): string | null {
  if (!row) return null;
  const fromRecord = pickDeliverableEmailFromRecord(row.parsed_data ?? null);
  if (fromRecord) return fromRecord;
  if (row.parsed_data && Object.keys(row.parsed_data).length > 0) {
    const parsed = normalizeParsedResume(row.parsed_data);
    const email = normalizeApplicantEmail(parsed.email);
    if (isDeliverableApplicantEmail(email)) return email;
  }
  return extractEmailFromResumeText(row.extracted_text);
}
