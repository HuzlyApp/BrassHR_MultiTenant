import type { SupabaseClient } from "@supabase/supabase-js";
import { publicJobDisplayTitle } from "@/lib/jobs/public-application-routing";

export type InterviewApplicantOption = {
  id: string;
  name: string;
  /** Email or job title shown next to the name when other applicants share it. */
  detail: string;
  status: string;
};

type ApplicationRow = {
  worker_id: string | null;
  job_requisition_id: string | null;
  created_at: string | null;
};

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
};

type ProfileRow = {
  worker_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type JobRow = {
  id: string;
  public_title?: string | null;
  source_job_title?: string | null;
  source_type?: string | null;
  employment_type?: string | null;
};

type Candidate = {
  workerId: string;
  name: string;
  detail: string;
  status: string;
  appliedAt: number;
};

const APPLICATION_LIMIT = 1000;
const ID_CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function joinName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

/**
 * Applicants a recruiter can schedule an interview with: everyone with a live application,
 * listed once each. Names repeat across records (test data, applicants who never entered a
 * name), so duplicates are labelled with an email or the job they applied for, and records
 * with nothing left to tell them apart collapse into the most recent one.
 */
export async function listInterviewApplicants(
  supabase: SupabaseClient,
  tenantId: string
): Promise<InterviewApplicantOption[]> {
  const { data: applicationRows, error: applicationError } = await supabase
    .from("job_applications")
    .select("worker_id, job_requisition_id, created_at")
    .eq("tenant_id", tenantId)
    .not("status", "in", '("rejected","withdrawn")')
    .order("created_at", { ascending: false })
    .limit(APPLICATION_LIMIT);
  if (applicationError) throw applicationError;

  const latestJobIdByWorker = new Map<string, string>();
  const appliedAtByWorker = new Map<string, number>();
  for (const row of ((applicationRows ?? []) as unknown as ApplicationRow[])) {
    const workerId = String(row.worker_id ?? "").trim();
    if (!workerId) continue;
    const appliedAt = row.created_at ? Date.parse(row.created_at) : 0;
    if (!appliedAtByWorker.has(workerId)) {
      appliedAtByWorker.set(workerId, Number.isNaN(appliedAt) ? 0 : appliedAt);
    }
    const jobId = String(row.job_requisition_id ?? "").trim();
    if (jobId && !latestJobIdByWorker.has(workerId)) latestJobIdByWorker.set(workerId, jobId);
  }

  const workerIds = Array.from(appliedAtByWorker.keys());
  if (workerIds.length === 0) return [];

  const workerById = new Map<string, WorkerRow>();
  const profileByWorkerId = new Map<string, ProfileRow>();
  for (const ids of chunk(workerIds, ID_CHUNK_SIZE)) {
    const [{ data: workerRows, error: workerError }, { data: profileRows, error: profileError }] =
      await Promise.all([
        supabase.from("worker").select("id, first_name, last_name, email, status").in("id", ids),
        supabase
          .from("applicant_profiles")
          .select("worker_id, first_name, last_name, email")
          .in("worker_id", ids),
      ]);
    if (workerError) throw workerError;
    if (profileError) throw profileError;

    for (const row of ((workerRows ?? []) as unknown as WorkerRow[])) {
      workerById.set(String(row.id), row);
    }
    for (const row of ((profileRows ?? []) as unknown as ProfileRow[])) {
      const workerId = String(row.worker_id ?? "").trim();
      if (workerId) profileByWorkerId.set(workerId, row);
    }
  }

  const candidates: Candidate[] = workerIds
    .filter((workerId) => workerById.has(workerId))
    .map((workerId) => {
      const worker = workerById.get(workerId) as WorkerRow;
      const profile = profileByWorkerId.get(workerId);
      const email = profile?.email?.trim() || worker.email?.trim() || "";
      const name =
        joinName(profile?.first_name, profile?.last_name) ||
        joinName(worker.first_name, worker.last_name) ||
        email ||
        "Unnamed applicant";
      return {
        workerId,
        name,
        detail: email,
        status: (worker.status ?? "new").toLowerCase(),
        appliedAt: appliedAtByWorker.get(workerId) ?? 0,
      };
    });

  await addJobTitleDetails(supabase, tenantId, candidates, latestJobIdByWorker);

  const nameCounts = countNames(candidates);
  const byLabel = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const shared = (nameCounts.get(candidate.name.toLowerCase()) ?? 0) > 1;
    const detail = shared ? candidate.detail : "";
    const labelKey = `${candidate.name}|${detail}`.toLowerCase();
    const existing = byLabel.get(labelKey);
    if (!existing || candidate.appliedAt > existing.appliedAt) {
      byLabel.set(labelKey, { ...candidate, detail });
    }
  }

  return Array.from(byLabel.values())
    .sort((a, b) => a.name.localeCompare(b.name) || a.detail.localeCompare(b.detail))
    .map((candidate) => ({
      id: candidate.workerId,
      name: candidate.name,
      detail: candidate.detail,
      status: candidate.status,
    }));
}

function countNames(candidates: Candidate[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const nameKey = candidate.name.toLowerCase();
    counts.set(nameKey, (counts.get(nameKey) ?? 0) + 1);
  }
  return counts;
}

/** Fill the disambiguating detail with a job title for duplicated names that have no email. */
async function addJobTitleDetails(
  supabase: SupabaseClient,
  tenantId: string,
  candidates: Candidate[],
  latestJobIdByWorker: Map<string, string>
): Promise<void> {
  const nameCounts = countNames(candidates);

  const needsTitle = candidates.filter(
    (candidate) =>
      !candidate.detail && (nameCounts.get(candidate.name.toLowerCase()) ?? 0) > 1
  );
  const jobIds = Array.from(
    new Set(
      needsTitle
        .map((candidate) => latestJobIdByWorker.get(candidate.workerId) ?? "")
        .filter(Boolean)
    )
  );
  if (jobIds.length === 0) return;

  const titleByJobId = new Map<string, string>();
  for (const ids of chunk(jobIds, ID_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("job_requisitions")
      .select("id, public_title, source_job_title, source_type, employment_type")
      .eq("tenant_id", tenantId)
      .in("id", ids);
    if (error) throw error;
    for (const row of ((data ?? []) as unknown as JobRow[])) {
      titleByJobId.set(String(row.id), publicJobDisplayTitle(row).trim());
    }
  }

  for (const candidate of needsTitle) {
    const jobId = latestJobIdByWorker.get(candidate.workerId) ?? "";
    const title = jobId ? titleByJobId.get(jobId) ?? "" : "";
    if (title) candidate.detail = title;
  }
}
