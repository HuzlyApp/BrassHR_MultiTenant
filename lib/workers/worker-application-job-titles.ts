import type { SupabaseClient } from "@supabase/supabase-js";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";

type AppTitleRow = {
  worker_id: string | null;
  job_requisition_id?: string | null;
  job_requisitions:
    | { public_title: string | null; source_job_title?: string | null }
    | { public_title: string | null; source_job_title?: string | null }[]
    | null;
};

type AppAssigneeRow = AppTitleRow & {
  id?: string | null;
  assigned_recruiter_user_id?: string | null;
  created_at?: string | null;
};

export type WorkerAppliedJob = {
  jobId: string;
  title: string;
};

export type WorkerJobAssigneeEntry = {
  applicationId: string;
  jobTitle: string;
  assignedRecruiterUserId: string | null;
};

function oneJobTitle(
  value: AppTitleRow["job_requisitions"]
): string {
  if (!value) return "";
  const job = Array.isArray(value) ? value[0] : value;
  return (
    String(job?.public_title ?? "").trim() ||
    String(job?.source_job_title ?? "").trim()
  );
}

/** Applied jobs (id + title) per worker for candidate list links. */
export async function getApplicationAppliedJobsByWorker(
  supabase: SupabaseClient,
  args: { tenantId?: string | null; workerIds: string[] }
): Promise<Map<string, WorkerAppliedJob[]>> {
  const workerIds = Array.from(new Set(args.workerIds.filter(Boolean)));
  const result = new Map<string, WorkerAppliedJob[]>();
  if (workerIds.length === 0) return result;

  const { data, error } = await queryInChunks(workerIds, async (chunk) => {
    let query = supabase
      .from("job_applications")
      .select("worker_id, job_requisition_id, job_requisitions(public_title, source_job_title)")
      .in("worker_id", chunk)
      .not("status", "in", '("rejected","withdrawn")')
      .order("created_at", { ascending: false });

    if (args.tenantId) {
      query = query.eq("tenant_id", args.tenantId);
    }

    const result = await query;
    return { data: (result.data ?? []) as AppTitleRow[], error: result.error };
  });
  if (error) throw error;

  for (const row of data) {
    const workerId = row.worker_id?.trim();
    const jobId =
      typeof row.job_requisition_id === "string" ? row.job_requisition_id.trim() : "";
    const title = oneJobTitle(row.job_requisitions);
    if (!workerId || !jobId || !title) continue;
    const list = result.get(workerId) ?? [];
    if (list.some((entry) => entry.jobId === jobId)) continue;
    list.push({ jobId, title });
    result.set(workerId, list);
  }

  return result;
}

export function mergeWorkerAppliedJobs(
  groups: Array<WorkerAppliedJob[] | undefined>
): WorkerAppliedJob[] {
  const byId = new Map<string, WorkerAppliedJob>();
  for (const group of groups) {
    for (const entry of group ?? []) {
      const id = entry.jobId.trim();
      if (!id || byId.has(id)) continue;
      byId.set(id, entry);
    }
  }
  return Array.from(byId.values());
}

/** All applied job titles per worker (used for candidate search parity with applications list). */
export async function getApplicationJobTitlesByWorker(
  supabase: SupabaseClient,
  args: { tenantId?: string | null; workerIds: string[] }
): Promise<Map<string, string[]>> {
  const applied = await getApplicationAppliedJobsByWorker(supabase, args);
  const result = new Map<string, string[]>();
  for (const [workerId, jobs] of applied) {
    result.set(
      workerId,
      jobs.map((job) => job.title).filter(Boolean)
    );
  }
  return result;
}

/** Per-application job title + assignee for the Candidates Assignee column. */
export async function getApplicationJobAssigneesByWorker(
  supabase: SupabaseClient,
  args: { tenantId?: string | null; workerIds: string[] }
): Promise<Map<string, WorkerJobAssigneeEntry[]>> {
  const workerIds = Array.from(new Set(args.workerIds.filter(Boolean)));
  const result = new Map<string, WorkerJobAssigneeEntry[]>();
  if (workerIds.length === 0) return result;

  const { data, error } = await queryInChunks(workerIds, async (chunk) => {
    let query = supabase
      .from("job_applications")
      .select(
        "id, worker_id, assigned_recruiter_user_id, created_at, job_requisitions(public_title, source_job_title)"
      )
      .in("worker_id", chunk)
      .not("status", "in", '("rejected","withdrawn")')
      .order("created_at", { ascending: false });

    if (args.tenantId) {
      query = query.eq("tenant_id", args.tenantId);
    }

    const result = await query;
    return { data: (result.data ?? []) as AppAssigneeRow[], error: result.error };
  });
  if (error) throw error;

  for (const row of data) {
    const workerId = row.worker_id?.trim();
    const applicationId = typeof row.id === "string" ? row.id.trim() : "";
    const title = oneJobTitle(row.job_requisitions);
    if (!workerId || !applicationId || !title) continue;
    const assigneeId =
      typeof row.assigned_recruiter_user_id === "string"
        ? row.assigned_recruiter_user_id.trim()
        : "";
    const list = result.get(workerId) ?? [];
    if (list.some((entry) => entry.applicationId === applicationId)) continue;
    list.push({
      applicationId,
      jobTitle: title,
      assignedRecruiterUserId: assigneeId || null,
    });
    result.set(workerId, list);
  }

  return result;
}

export function mergeWorkerJobAssigneeEntries(
  groups: Array<WorkerJobAssigneeEntry[] | undefined>
): WorkerJobAssigneeEntry[] {
  const byApp = new Map<string, WorkerJobAssigneeEntry>();
  for (const group of groups) {
    for (const entry of group ?? []) {
      const id = entry.applicationId.trim();
      if (!id || byApp.has(id)) continue;
      byApp.set(id, entry);
    }
  }
  return Array.from(byApp.values());
}

export function joinApplicationJobTitles(titles: string[] | undefined): string {
  return (titles ?? []).join(" | ");
}
