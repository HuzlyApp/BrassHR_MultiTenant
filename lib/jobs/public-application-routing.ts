export const NO_OPEN_POSITIONS_MESSAGE =
  "There are currently no open positions available. Please check back later.";

export type OpenJobSummary = {
  publicJobToken: string;
};

export type ApplicationEntryRoute =
  | { kind: "apply"; tenantSlug: string; jobToken: string; path: string; ctaLabel: string }
  | { kind: "jobs"; tenantSlug: string; path: string; ctaLabel: string }
  | {
      kind: "onboarding";
      tenantSlug: string;
      path: string;
      ctaLabel: string;
    }
  /** @deprecated Prefer kind "onboarding" for welcome/start-application when no jobs exist. */
  | { kind: "empty"; tenantSlug: string; path: string; message: string; ctaLabel: string };

export const APPLICANT_ENTRY_CTA_VIEW_POSITIONS = "View positions";
export const APPLICANT_ENTRY_CTA_START_APPLICATION = "Start Application";

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

/**
 * Public job board / detail title.
 * Contract (MSP R&R) jobs should show Source Job Title, not an opaque public title.
 */
export function publicJobDisplayTitle(job: {
  public_title?: string | null;
  source_job_title?: string | null;
  source_type?: string | null;
  employment_type?: string | null;
}): string {
  const isContract =
    String(job.employment_type ?? "").trim() === "Contract" ||
    String(job.source_type ?? "").trim().toLowerCase() === "msp";
  if (isContract) {
    return (
      job.source_job_title?.trim() ||
      job.public_title?.trim() ||
      "Untitled job"
    );
  }
  return job.public_title?.trim() || "Untitled job";
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

export function buildAddResumePath(tenantSlug: string, jobToken?: string | null): string {
  const params = new URLSearchParams({
    tenant: tenantSlug,
  });
  const normalized = normalizeJobToken(jobToken);
  if (normalized) {
    params.set("job_token", normalized);
  }
  return `/application/add-resume?${params}`;
}

/** Direct applicant onboarding when the tenant has no open published jobs yet. */
export function buildDirectOnboardingPath(tenantSlug: string): string {
  return buildAddResumePath(tenantSlug);
}

export function resolveApplicationEntryRoute(
  tenantSlug: string,
  openJobs: OpenJobSummary[]
): ApplicationEntryRoute {
  const slug = tenantSlug.trim().toLowerCase();
  const validJobs = openJobs.filter((job) => normalizeJobToken(job.publicJobToken));
  if (validJobs.length === 0) {
    return {
      kind: "onboarding",
      tenantSlug: slug,
      path: buildDirectOnboardingPath(slug),
      ctaLabel: APPLICANT_ENTRY_CTA_START_APPLICATION,
    };
  }
  return {
    kind: "jobs",
    tenantSlug: slug,
    path: buildJobsPortalPath(slug),
    ctaLabel: APPLICANT_ENTRY_CTA_VIEW_POSITIONS,
  };
}
