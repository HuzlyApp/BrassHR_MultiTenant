/** Fields safe to leave in sessionStorage for a list repaint. */

export function toPersistedCandidateRow<
  T extends { profilePhotoUrl?: string | null; assignedRecruiterPhotoUrl?: string | null },
>(row: T): T {
  return {
    ...row,
    profilePhotoUrl: null,
    assignedRecruiterPhotoUrl: null,
  };
}

const JOB_BODY_KEYS = [
  "qualifications",
  "public_description",
  "responsibilities",
  "special_requirements",
  "required_credentials",
  "public_job_token",
] as const;

/** Drop description bodies, public tokens, and signed photo URLs before sessionStorage. */
export function toPersistedJobListRow<T extends Record<string, unknown>>(job: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(job)) {
    if ((JOB_BODY_KEYS as readonly string[]).includes(key)) continue;
    if (key === "createdBy" && value && typeof value === "object") {
      const createdBy = { ...(value as Record<string, unknown>) };
      delete createdBy.profilePhotoUrl;
      next[key] = createdBy;
      continue;
    }
    next[key] = value;
  }
  return next as T;
}
