const CLIENT_ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/;

/** Optional client ZIP — when provided, mirror facility ZIP rules (5-digit or ZIP+4). */
export function validateClientZipCode(raw: string | null | undefined): string | null {
  const zip = raw?.trim() ?? "";
  if (!zip) return null;
  if (!CLIENT_ZIP_PATTERN.test(zip)) {
    return "Enter a valid 5-digit ZIP code or ZIP+4.";
  }
  return null;
}

/** Shared create/edit validation for staff-managed client organizations. */
export function validateClientCompanyName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "Company name is required.";
  if (name.length < 2) return "Company name must be at least 2 characters.";
  if (name.length > 120) return "Company name must be 120 characters or fewer.";
  if (/<\/?[a-z][^>]*>/i.test(name)) return "Company name must be plain text without HTML tags.";
  return null;
}
