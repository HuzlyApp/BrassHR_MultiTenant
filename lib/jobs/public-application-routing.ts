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

export function normalizeJobToken(value: string | null | undefined): string | null {
  const token = value?.trim();
  if (!token) return null;
  const lowered = token.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return null;
  return token;
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
  const normalizedToken = normalizeJobToken(jobToken);
  if (!normalizedToken) {
    return buildJobsPortalPath(tenantSlug);
  }
  const params = new URLSearchParams({
    tenant: tenantSlug,
    job_token: normalizedToken,
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
  const validJobs = openJobs.filter((job) => normalizeJobToken(job.publicJobToken));
  if (validJobs.length === 0) {
    return {
      kind: "empty",
      tenantSlug: slug,
      path: buildJobsPortalPath(slug),
      message: NO_OPEN_POSITIONS_MESSAGE,
    };
  }
  return {
    kind: "jobs",
    tenantSlug: slug,
    path: buildJobsPortalPath(slug),
  };
}
