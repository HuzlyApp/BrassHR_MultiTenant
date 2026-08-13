export type ApplicationScopedResume = {
  id?: string;
  job_application_id?: string | null;
  worker_id?: string | null;
};

/**
 * Prefer the résumé uploaded for this application. Never fall back to another
 * application's file for the same worker — that leaks Job B into Job A.
 */
export function pickResumeForApplication<T extends ApplicationScopedResume>(
  rows: T[] | null | undefined,
  applicationId: string
): T | null {
  const id = applicationId.trim();
  if (!id) return null;
  const list = rows ?? [];
  return list.find((row) => String(row.job_application_id ?? "") === id) ?? null;
}
