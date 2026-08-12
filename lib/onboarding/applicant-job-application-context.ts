import { normalizeJobToken } from "@/lib/jobs/public-application-routing";

/** True when the applicant is in a job-specific apply flow (`job_token` in query). */
export function searchHasJobToken(search: string): boolean {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw.trim()) return false;
  return Boolean(normalizeJobToken(new URLSearchParams(raw).get("job_token")));
}
