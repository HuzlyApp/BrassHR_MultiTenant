export const NO_OPEN_POSITIONS_MESSAGE =
  "There are currently no open positions available. Please check back later.";

export type OpenJobSummary = {
  publicJobToken: string;
};

export type ApplicationEntryRoute =
  | { kind: "apply"; tenantSlug: string; jobToken: string; path: string }
  | { kind: "jobs"; tenantSlug: string; path: string }
  | { kind: "empty"; tenantSlug: string; path: string; message: string };

export function formatDateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isJobRequisitionOpen(
  job: { application_deadline?: string | null },
  now: Date = new Date()
): boolean {
  const deadline = job.application_deadline?.trim();
  if (!deadline) return true;
  return deadline >= formatDateOnlyUtc(now);
}

export function buildJobsPortalPath(tenantSlug: string): string {
  return `/jobs?tenant=${encodeURIComponent(tenantSlug)}`;
}

export function buildApplyPath(tenantSlug: string, jobToken: string): string {
  const params = new URLSearchParams({
    tenant: tenantSlug,
    job_token: jobToken,
  });
  return `/apply?${params}`;
}

export function buildAddResumePath(tenantSlug: string, jobToken: string): string {
  const params = new URLSearchParams({
    tenant: tenantSlug,
    job_token: jobToken,
  });
  return `/application/add-resume?${params}`;
}

export function resolveApplicationEntryRoute(
  tenantSlug: string,
  openJobs: OpenJobSummary[]
): ApplicationEntryRoute {
  const slug = tenantSlug.trim().toLowerCase();
  if (openJobs.length === 0) {
    return {
      kind: "empty",
      tenantSlug: slug,
      path: buildJobsPortalPath(slug),
      message: NO_OPEN_POSITIONS_MESSAGE,
    };
  }
  if (openJobs.length === 1) {
    const jobToken = openJobs[0]!.publicJobToken;
    return {
      kind: "apply",
      tenantSlug: slug,
      jobToken,
      path: buildApplyPath(slug, jobToken),
    };
  }
  return {
    kind: "jobs",
    tenantSlug: slug,
    path: buildJobsPortalPath(slug),
  };
}
