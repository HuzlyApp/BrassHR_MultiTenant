export type EmbeddedRecord =
  | Record<string, unknown>
  | Record<string, unknown>[]
  | null
  | undefined;

export type ApplicationApplicantSource = {
  applicant_profiles?: EmbeddedRecord;
  worker?: EmbeddedRecord;
};

export const JOB_APPLICATION_APPLICANT_EMBED =
  "applicant_profiles!applicant_profile_id(id, first_name, last_name, email, worker_id), worker:worker_id(id, first_name, last_name, email)";

function oneEmbedded(value: EmbeddedRecord): Record<string, unknown> {
  if (!value) return {};
  return (Array.isArray(value) ? value[0] : value) ?? {};
}

export function resolveApplicationApplicantName(row: ApplicationApplicantSource): string {
  const profile = oneEmbedded(row.applicant_profiles);
  const worker = oneEmbedded(row.worker);

  const fromProfile = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  if (fromProfile) return fromProfile;

  const fromWorker = [worker.first_name, worker.last_name].filter(Boolean).join(" ").trim();
  if (fromWorker) return fromWorker;

  const email = String(profile.email ?? worker.email ?? "").trim();
  return email || "Applicant";
}

export function resolveApplicationApplicantEmail(row: ApplicationApplicantSource): string {
  const profile = oneEmbedded(row.applicant_profiles);
  const worker = oneEmbedded(row.worker);
  return String(profile.email ?? worker.email ?? "").trim();
}
