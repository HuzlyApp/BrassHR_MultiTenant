/** Legacy tenant/user email domain replaced by Brass HR rebrand. */
export const LEGACY_EMAIL_DOMAIN = "nexusmedpro.com";

/** Current primary email domain (env override for staging). */
export const CURRENT_EMAIL_DOMAIN =
  process.env.RESEND_FROM_DOMAIN?.trim().toLowerCase() || "brasshr.com";

const EMAIL_RE = /^([^@\s]+)@([^\s@]+)$/i;

export function parseEmailAddress(raw: string): { localPart: string; domain: string } | null {
  const normalized = raw.trim().toLowerCase();
  const match = normalized.match(EMAIL_RE);
  if (!match) return null;
  return { localPart: match[1], domain: match[2] };
}

/** Replace only @nexusmedpro.com; preserve local-part and other domains. */
export function migrateEmailDomain(email: string): string {
  const parsed = parseEmailAddress(email);
  if (!parsed || parsed.domain !== LEGACY_EMAIL_DOMAIN) return email.trim();
  return `${parsed.localPart}@${CURRENT_EMAIL_DOMAIN}`;
}

/** Swap current domain to legacy for historical lookup (e.g. Communication History). */
export function toLegacyEmailVariant(email: string): string | null {
  const parsed = parseEmailAddress(email);
  if (!parsed || parsed.domain !== CURRENT_EMAIL_DOMAIN) return null;
  return `${parsed.localPart}@${LEGACY_EMAIL_DOMAIN}`;
}

/**
 * Email addresses to use when querying stored records that may still hold the legacy domain.
 * Order: normalized input, migrated domain, legacy variant.
 */
export function emailLookupVariants(email: string): string[] {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const add = (value: string | null | undefined) => {
    const v = value?.trim().toLowerCase();
    if (v && !seen.has(v)) seen.add(v);
  };

  add(trimmed);
  add(migrateEmailDomain(trimmed));
  add(toLegacyEmailVariant(trimmed));

  const parsed = parseEmailAddress(trimmed);
  if (parsed?.domain === LEGACY_EMAIL_DOMAIN) {
    add(`${parsed.localPart}@${CURRENT_EMAIL_DOMAIN}`);
  }

  return Array.from(seen);
}

/** True when two addresses are the same person, accounting for legacy domain swap. */
export function emailsMatchWithLegacyDomain(a: string, b: string): boolean {
  const variantsA = new Set(emailLookupVariants(a));
  return emailLookupVariants(b).some((v) => variantsA.has(v));
}

/** Extract bare email from `Name <user@domain.com>` headers. */
export function extractBareEmailAddress(raw: string): string {
  const trimmed = raw.trim();
  const angle = trimmed.match(/<([^>]+@[^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  return trimmed.toLowerCase();
}
