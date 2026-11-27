/** Shared create/edit validation for staff-managed client organizations. */
export function validateClientCompanyName(raw: string, label = "Company name"): string | null {
  const name = raw.trim();
  if (!name) return `${label} is required.`;
  if (name.length < 2) return `${label} must be at least 2 characters.`;
  if (name.length > 120) return `${label} must be 120 characters or fewer.`;
  if (/<\/?[a-z][^>]*>/i.test(name)) return `${label} must be plain text without HTML tags.`;
  return null;
}
