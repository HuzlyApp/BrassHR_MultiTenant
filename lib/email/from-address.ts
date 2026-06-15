import type { EmailTemplateRow } from "@/lib/email-templates/types";
import { SendEmailError } from "@/lib/email/errors";

export const DEFAULT_FROM_EMAIL_LOCAL_PART = "notifications";

/** RFC 5321-ish local-part: lowercase alphanumeric, dots, hyphens, underscores. */
export const FROM_EMAIL_LOCAL_PART_RE = /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$|^[a-z0-9]$/;

/**
 * Parses UI/API input: keeps only the segment before `@`, lowercases, trims.
 */
export function parseFromEmailLocalPartInput(raw: string): string {
  let s = raw.trim();
  if (!s) return DEFAULT_FROM_EMAIL_LOCAL_PART;

  const angle = s.match(/<([^>]+)>/);
  if (angle?.[1]) s = angle[1].trim();

  const at = s.indexOf("@");
  if (at >= 0) s = s.slice(0, at).trim();

  return s.toLowerCase();
}

export function validateFromEmailLocalPart(localPart: string): void {
  if (!FROM_EMAIL_LOCAL_PART_RE.test(localPart)) {
    throw new SendEmailError(
      "VALIDATION_ERROR",
      "From email local part may only contain letters, numbers, dots, hyphens, and underscores",
      400
    );
  }
}

export function normalizeFromEmailLocalPart(raw: string | null | undefined): string {
  const parsed = parseFromEmailLocalPartInput(raw ?? "");
  validateFromEmailLocalPart(parsed);
  return parsed;
}

export function getResendFromDomain(): string {
  const domain = process.env.RESEND_FROM_DOMAIN?.trim().toLowerCase();
  if (domain && !domain.includes("@") && domain.includes(".")) {
    return domain;
  }

  const legacy = process.env.RESEND_FROM_EMAIL?.trim();
  if (legacy) {
    const angle = legacy.match(/<([^>]+@[^>]+)>/);
    const email = (angle?.[1] ?? legacy).trim().toLowerCase();
    const at = email.lastIndexOf("@");
    if (at > 0) {
      const fromLegacy = email.slice(at + 1).trim();
      if (fromLegacy.includes(".")) return fromLegacy;
    }
  }

  const fallback = "brasshr.com";
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[email] RESEND_FROM_DOMAIN not set; using fallback domain "${fallback}". Set RESEND_FROM_DOMAIN in .env.local for production.`
    );
  }
  return fallback;
}

/** Domain for admin UI (safe to expose; not tenant-specific). */
export function getResendFromDomainForUi(): string | null {
  try {
    return getResendFromDomain();
  } catch {
    const legacy = process.env.RESEND_FROM_EMAIL?.trim();
    if (legacy?.includes("@")) {
      return legacy.split("@").pop()?.toLowerCase() ?? null;
    }
    return null;
  }
}

export function resolveFromEmailLocalPart(tpl: Pick<EmailTemplateRow, "from_email_local_part">): string {
  const stored = tpl.from_email_local_part?.trim().toLowerCase();
  if (stored && FROM_EMAIL_LOCAL_PART_RE.test(stored)) return stored;
  return DEFAULT_FROM_EMAIL_LOCAL_PART;
}

export function buildFromEmailAddress(localPart: string): string {
  const domain = getResendFromDomain();
  return `${localPart}@${domain}`;
}

const DEFAULT_FROM_DISPLAY_NAME = "Brass HR";

export function buildResendFromHeader(tpl: Pick<EmailTemplateRow, "from_email_local_part">): string {
  const localPart = resolveFromEmailLocalPart(tpl);
  const address = buildFromEmailAddress(localPart);
  const displayName =
    process.env.RESEND_FROM_DISPLAY_NAME?.trim() || DEFAULT_FROM_DISPLAY_NAME;
  return `${displayName} <${address}>`;
}
