import type { SupabaseClient } from "@supabase/supabase-js";
import { publicJobDisplayTitle } from "@/lib/jobs/public-application-routing";
import { scheduleRowToIso } from "@/lib/interviews/schedule-fields";

export type WorkerInterviewStatus =
  | "upcoming"
  | "completed"
  | "cancelled"
  | "rescheduled";

export type WorkerInterviewItem = {
  id: string;
  title: string;
  jobTitle: string;
  startsAt: string;
  endsAt: string | null;
  status: WorkerInterviewStatus;
  meetingType: "online" | "phone" | "in_person" | null;
  meetingLink: string | null;
  location: string | null;
  notes: string | null;
};

type InterviewScheduleRow = {
  id: string;
  applicant_id: string | null;
  worker_id: string | null;
  application_id: string | null;
  job_id: string | null;
  title: string | null;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string | null;
  status: string | null;
  meeting_type: string | null;
  meeting_link: string | null;
  location: string | null;
  notes: string | null;
};

type JobRow = {
  id: string;
  public_title?: string | null;
  source_job_title?: string | null;
  source_type?: string | null;
  employment_type?: string | null;
};

function normalizeStatus(value: string | null): WorkerInterviewStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "completed" || status === "cancelled" || status === "rescheduled") {
    return status;
  }
  return "upcoming";
}

function normalizeMeetingType(value: string | null): WorkerInterviewItem["meetingType"] {
  const type = String(value ?? "").trim().toLowerCase();
  if (type === "phone" || type === "in_person" || type === "online") return type;
  return null;
}

/** Interview schedules the admin created for this worker, with job title and location resolved. */
export async function listWorkerInterviews(
  supabase: SupabaseClient,
  input: { workerId: string; tenantId: string }
): Promise<WorkerInterviewItem[]> {
  const { data: applicantRows, error: applicantError } = await supabase
    .from("applicants")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("worker_id", input.workerId);
  if (applicantError) throw applicantError;

  const applicantIds = (applicantRows ?? [])
    .map((row) => String(row.id ?? "").trim())
    .filter(Boolean);

  const orFilters = [`worker_id.eq.${input.workerId}`];
  if (applicantIds.length > 0) {
    orFilters.push(`applicant_id.in.(${applicantIds.join(",")})`);
  }

  const { data: scheduleRows, error: scheduleError } = await supabase
    .from("interview_schedules")
    .select(
      "id, applicant_id, worker_id, application_id, job_id, title, description, scheduled_date, start_time, end_time, status, meeting_type, meeting_link, location, notes"
    )
    .eq("tenant_id", input.tenantId)
    .or(orFilters.join(","))
    .order("scheduled_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(100);
  if (scheduleError) throw scheduleError;

  const rows = (scheduleRows ?? []) as unknown as InterviewScheduleRow[];
  if (rows.length === 0) return [];

  const applicationIds = Array.from(
    new Set(rows.map((row) => String(row.application_id ?? "").trim()).filter(Boolean))
  );

  const jobIdByApplication = new Map<string, string>();
  if (applicationIds.length > 0) {
    const { data: applicationRows, error: applicationError } = await supabase
      .from("job_applications")
      .select("id, job_requisition_id")
      .eq("tenant_id", input.tenantId)
      .in("id", applicationIds);
    if (applicationError) throw applicationError;

    for (const row of applicationRows ?? []) {
      const jobId = String(row.job_requisition_id ?? "").trim();
      if (jobId) jobIdByApplication.set(String(row.id), jobId);
    }
  }

  const jobIds = Array.from(
    new Set(
      [
        ...rows.map((row) => String(row.job_id ?? "").trim()),
        ...jobIdByApplication.values(),
      ].filter(Boolean)
    )
  );

  const jobById = new Map<string, JobRow>();
  if (jobIds.length > 0) {
    const { data: jobRows, error: jobError } = await supabase
      .from("job_requisitions")
      .select("id, public_title, source_job_title, source_type, employment_type")
      .eq("tenant_id", input.tenantId)
      .in("id", jobIds);
    if (jobError) throw jobError;

    for (const row of (jobRows ?? []) as unknown as JobRow[]) {
      jobById.set(String(row.id), row);
    }
  }

  return rows
    .map((row) => {
      const { startsAt, endsAt } = scheduleRowToIso(
        row.scheduled_date,
        row.start_time,
        row.end_time
      );

      const directJobId = String(row.job_id ?? "").trim();
      const applicationJobId = jobIdByApplication.get(String(row.application_id ?? "").trim());
      const job = jobById.get(directJobId) ?? jobById.get(applicationJobId ?? "") ?? null;

      return {
        id: String(row.id),
        title: row.title?.trim() || "Interview",
        jobTitle: job ? publicJobDisplayTitle(job) : "",
        startsAt,
        endsAt,
        status: normalizeStatus(row.status),
        meetingType: normalizeMeetingType(row.meeting_type),
        meetingLink: row.meeting_link?.trim() || null,
        location: row.location?.trim() || null,
        notes: row.notes?.trim() || null,
      } satisfies WorkerInterviewItem;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}
