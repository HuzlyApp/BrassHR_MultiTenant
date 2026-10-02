import { jobDescriptionPlainText } from "@/lib/jobs/job-description-html";

/**
 * List responses keep body text for in-page skill search.
 * One production job carried ~281 KB in these columns while p95 was under 5 KB.
 * Cap only oversized values so typical jobs stay byte-for-byte unchanged.
 */
export const JOB_LIST_BODY_TEXT_CAP = 8000;

const BODY_KEYS = [
  "qualifications",
  "public_description",
  "responsibilities",
  "special_requirements",
  "required_credentials",
] as const;

export function capJobListBodyFields<T extends object>(job: T): T {
  let changed = false;
  const next: Record<string, unknown> = { ...(job as Record<string, unknown>) };
  for (const key of BODY_KEYS) {
    const value = next[key];
    if (typeof value !== "string" || value.length <= JOB_LIST_BODY_TEXT_CAP) continue;
    const plain = jobDescriptionPlainText(value);
    next[key] =
      plain.length <= JOB_LIST_BODY_TEXT_CAP ? plain : plain.slice(0, JOB_LIST_BODY_TEXT_CAP);
    changed = true;
  }
  return (changed ? next : job) as T;
}
