export type JobApplicationDedupeRow = {
  tenantId: string;
  jobId: string;
  submittedAt: string | null;
  appliedAt: string;
};

function applicationPriority(row: JobApplicationDedupeRow): number {
  let score = 0;
  if (row.submittedAt?.trim()) score += 1_000_000_000_000;
  score += new Date(row.appliedAt).getTime();
  return score;
}

/** Keep one canonical application per tenant + job (prefer submitted, then most recent). */
export function dedupeJobApplicationsByJob<T extends JobApplicationDedupeRow>(
  applications: T[]
): T[] {
  const bestByJob = new Map<string, T>();

  for (const app of applications) {
    const key = `${app.tenantId}:${app.jobId}`;
    const current = bestByJob.get(key);
    if (!current || applicationPriority(app) > applicationPriority(current)) {
      bestByJob.set(key, app);
    }
  }

  return [...bestByJob.values()].sort(
    (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
  );
}
