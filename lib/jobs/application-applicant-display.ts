import { getStateNameFromCode } from "@/lib/us-state-names";

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
  "applicant_profiles!applicant_profile_id(id, first_name, last_name, email, worker_id, city_state_zip, phone), worker:worker_id(id, first_name, last_name, email, city, state, phone)";

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

export function resolveApplicationApplicantPhone(row: ApplicationApplicantSource): string {
  const profile = oneEmbedded(row.applicant_profiles);
  const worker = oneEmbedded(row.worker);
  return String(worker.phone ?? profile.phone ?? "").trim();
}

/** Resolves the worker id used by Final Approval / candidate detail routes. */
export function resolveApplicationWorkerId(
  row: ApplicationApplicantSource & { worker_id?: string | null }
): string | null {
  const direct = typeof row.worker_id === "string" ? row.worker_id.trim() : "";
  if (direct) return direct;

  const worker = oneEmbedded(row.worker);
  const fromWorker = typeof worker.id === "string" ? worker.id.trim() : "";
  if (fromWorker) return fromWorker;

  const profile = oneEmbedded(row.applicant_profiles);
  const fromProfile = typeof profile.worker_id === "string" ? profile.worker_id.trim() : "";
  return fromProfile || null;
}

/**
 * Candidate location for ranking table / filters.
 * Prefers worker state (full name when code), then city, then profile city_state_zip.
 */
export function resolveApplicationApplicantLocation(row: ApplicationApplicantSource): string {
  const worker = oneEmbedded(row.worker);
  const profile = oneEmbedded(row.applicant_profiles);

  const workerStateRaw = String(worker.state ?? "").trim();
  const stateDisplay = expandUsStateDisplay(workerStateRaw);
  if (stateDisplay) return stateDisplay;

  const workerCity = String(worker.city ?? "").trim();
  if (workerCity) return workerCity;

  const cityStateZip = String(profile.city_state_zip ?? "").trim();
  if (cityStateZip) {
    const stateFromZip = extractStateFromCityStateZip(cityStateZip);
    if (stateFromZip) return stateFromZip;
    return cityStateZip;
  }

  return "";
}

function expandUsStateDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length === 2) {
    return getStateNameFromCode(trimmed) || trimmed;
  }
  return trimmed;
}

function extractStateFromCityStateZip(value: string): string {
  // e.g. "Phoenix, AZ 85001" or "Arizona"
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const afterComma = parts[1]!.replace(/\d+/g, "").trim();
    const token = afterComma.split(/\s+/)[0] ?? "";
    return expandUsStateDisplay(token) || token;
  }
  if (parts.length === 1 && !/\d/.test(parts[0]!)) {
    return expandUsStateDisplay(parts[0]!) || parts[0]!;
  }
  return "";
}
