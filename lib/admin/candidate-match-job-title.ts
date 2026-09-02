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

/** All distinct applied job titles for a candidate (used by list job filters). */
export function getCandidateJobTitleOptions(row: {
  applicationJobTitle?: string | null;
  applicationJobTitlesText?: string | null;
}): string[] {
  const titles = new Set<string>();
  const primary = row.applicationJobTitle?.trim();
  if (primary) titles.add(primary);

  const combined = row.applicationJobTitlesText?.trim();
  if (combined) {
    for (const part of combined.split(" | ")) {
      const title = part.trim();
      if (title) titles.add(title);
    }
  }

  return Array.from(titles);
}

export function candidateMatchesJobTitleFilter(
  row: {
    applicationJobTitle?: string | null;
    applicationJobTitlesText?: string | null;
  },
  jobFilter: string
): boolean {
  const selected = jobFilter.trim();
  if (!selected) return true;
  return getCandidateJobTitleOptions(row).includes(selected);
}
