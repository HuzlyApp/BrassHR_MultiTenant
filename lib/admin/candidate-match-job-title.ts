/** Primary applied job title (`job_requisitions.public_title`) for old candidates list parity. */
export function resolveCandidateMatchJobTitle(row: {
  applicationJobTitle?: string | null;
  applicationJobTitlesText?: string | null;
}): string {
  const primary = row.applicationJobTitle?.trim();
  if (primary) return primary;

  const combined = row.applicationJobTitlesText?.trim();
  if (!combined) return "";

  return combined.split(" | ").map((part) => part.trim()).find(Boolean) ?? "";
}
