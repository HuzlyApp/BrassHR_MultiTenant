/** Shared create/edit validation for staff-managed client organizations. */
export function validateClientCompanyName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "Company name is required.";
  if (name.length < 2) return "Company name must be at least 2 characters.";
  if (name.length > 120) return "Company name must be 120 characters or fewer.";
  if (/<\/?[a-z][^>]*>/i.test(name)) return "Company name must be plain text without HTML tags.";
  return null;
}
