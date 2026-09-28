/**
 * Resolve contact identity for submission résumé drafts.
 * Worker fields win so Match Analysis profile edits appear on new résumés.
 */
export function resolveSubmissionResumeIdentity(args: {
  worker?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    city_state_zip?: string | null;
  } | null;
  jobTitle?: string | null;
}): {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  jobTitle: string;
} {
  const worker = args.worker;
  const profile = args.profile;
  const firstName = String(worker?.first_name || profile?.first_name || "").trim();
  const lastName = String(worker?.last_name || profile?.last_name || "").trim();
  const fullName = `${firstName} ${lastName}`.trim() || "Candidate";
  const location =
    [worker?.city, worker?.state]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(", ") || String(profile?.city_state_zip || "").trim();
  return {
    fullName,
    email: String(worker?.email || profile?.email || "").trim(),
    phone: String(worker?.phone || profile?.phone || "").trim(),
    location,
    jobTitle: String(args.jobTitle || "").trim() || "this assignment",
  };
}
