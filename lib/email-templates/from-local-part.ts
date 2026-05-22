import { EmailTemplateError } from "@/lib/email-templates/errors";
import {
  DEFAULT_FROM_EMAIL_LOCAL_PART,
  FROM_EMAIL_LOCAL_PART_RE,
  parseFromEmailLocalPartInput,
} from "@/lib/email/from-address";

export function normalizeStoredFromEmailLocalPart(
  raw: string | null | undefined,
  fallback: string = DEFAULT_FROM_EMAIL_LOCAL_PART
): string {
  const parsed = parseFromEmailLocalPartInput(raw ?? fallback);
  if (!FROM_EMAIL_LOCAL_PART_RE.test(parsed)) {
    throw new EmailTemplateError(
      "VALIDATION_ERROR",
      "From email local part may only contain letters, numbers, dots, hyphens, and underscores",
      400
    );
  }
  return parsed;
}

export function effectiveFromEmailLocalPart(
  ...candidates: (string | null | undefined)[]
): string {
  for (const c of candidates) {
    const s = c?.trim().toLowerCase();
    if (s && FROM_EMAIL_LOCAL_PART_RE.test(s)) return s;
  }
  return DEFAULT_FROM_EMAIL_LOCAL_PART;
}
