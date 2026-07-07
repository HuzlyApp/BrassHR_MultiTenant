import { isValidStep1Email } from "@/lib/onboardingStep1Validation";

const EMAIL_FROM_TEXT_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

/** Extract the first plausible email address from raw resume text. */
export function extractEmailFromResumeText(text: string | null | undefined): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  const match = raw.match(EMAIL_FROM_TEXT_RE);
  if (!match?.[0]) return null;
  const candidate = match[0].trim().toLowerCase();
  return isValidStep1Email(candidate) ? candidate : null;
}
