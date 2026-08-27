import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ensureApplicantForWorker } from "@/lib/interviews/ensure-applicant";
import {
  applicantDisplayName,
  interviewOrdinalTitle,
} from "@/lib/interviews/format";
import { listInterviewApplicants } from "@/lib/interviews/list-interview-applicants";
import { markApplicationInterviewing } from "@/lib/interviews/mark-application-interviewing";
import { buildInterviewCalendarUid } from "@/lib/interviews/ics";
import {
  sendInterviewInvitations,
  type InterviewAttendeeInput,
  type InterviewScheduleRecord,
} from "@/lib/interviews/send-interview-invitations";
import { isoToScheduleFields, scheduleRowToIso } from "@/lib/interviews/schedule-fields";
import type { InterviewMeetingType } from "@/lib/interviews/schedule-payload";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type InterviewScheduleStatus = "upcoming" | "completed" | "cancelled" | "rescheduled";

type InterviewScheduleRow = {
  id: string;
  tenant_id: string;
  applicant_id: string;
  worker_id: string | null;
  application_id: string | null;
  job_id: string | null;
  title: string;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: InterviewScheduleStatus;
  meeting_link: string | null;
  location: string | null;
  meeting_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  email?: string | null;
};

export type AdminInterviewInterviewer = {
  userId: string | null;
  email: string;
  name: string;
};

export type AdminInterviewItem = {
  id: string;
  workerId: string;
  applicantName: string;
  applicantEmail: string | null;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: InterviewScheduleStatus;
  meetingType: InterviewMeetingType;
  meetingLink: string | null;
  location: string | null;
  notes: string | null;
  applicationId: string | null;
  jobId: string | null;
  jobTitle: string | null;
  interviewers: AdminInterviewInterviewer[];
};

function parseTab(value: string | null): "upcoming" | "recent" {
  return value === "recent" ? "recent" : "upcoming";
}

function scheduleStartMs(row: InterviewScheduleRow): number {
  const { startsAt } = scheduleRowToIso(row.scheduled_date, row.start_time, row.end_time);
  return new Date(startsAt).getTime();
}

function isUpcomingRow(row: InterviewScheduleRow, nowMs: number): boolean {
  if (row.status === "cancelled" || row.status === "completed") return false;
  return scheduleStartMs(row) >= nowMs;
}

function isRecentRow(row: InterviewScheduleRow, nowMs: number): boolean {
  if (row.status === "completed" || row.status === "cancelled") return true;
  return scheduleStartMs(row) < nowMs;
}

async function loadSequenceMap(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  tenantId: string,
  applicantIds: string[]
) {
  const sequenceByScheduleId = new Map<string, number>();
  if (applicantIds.length === 0) return sequenceByScheduleId;

  const { data, error } = await supabase
    .from("interview_schedules")
    .select("id, applicant_id, scheduled_date, start_time")
    .eq("tenant_id", tenantId)
    .in("applicant_id", applicantIds)
    .neq("status", "cancelled")
    .order("scheduled_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;

  const byApplicant = new Map<string, { id: string; sortKey: number }[]>();
  for (const row of data ?? []) {
    const sortKey = scheduleStartMs(row as InterviewScheduleRow);
    const list = byApplicant.get(row.applicant_id) ?? [];
    list.push({ id: row.id, sortKey });
    byApplicant.set(row.applicant_id, list);
  }

  byApplicant.forEach((list) => {
    list.sort((a, b) => a.sortKey - b.sortKey);
    list.forEach((item, index) => sequenceByScheduleId.set(item.id, index + 1));
  });

  return sequenceByScheduleId;
}

function parseMeetingTypeValue(raw: string | null | undefined): InterviewMeetingType {
  const value = String(raw ?? "online").trim().toLowerCase();
  if (value === "phone" || value === "in_person") return value;
  return "online";
}

function buildInterviewItems(
  schedules: InterviewScheduleRow[],
  workersById: Map<string, WorkerRow>,
  applicantsById: Map<string, { full_name: string | null; worker_id: string | null }>,
  sequenceByScheduleId: Map<string, number>,
  jobsById: Map<string, string>,
  interviewersByInterviewId: Map<string, AdminInterviewInterviewer[]>
): AdminInterviewItem[] {
  return schedules.map((row) => {
    const workerId = row.worker_id ?? applicantsById.get(row.applicant_id)?.worker_id ?? "";
    const worker = workerId ? workersById.get(workerId) : undefined;
    const applicantName =
      worker
        ? applicantDisplayName(worker.first_name, worker.last_name)
        : applicantsById.get(row.applicant_id)?.full_name?.trim() || "Unnamed applicant";

    const sequence = sequenceByScheduleId.get(row.id) ?? 1;
    const title = row.title?.trim() || interviewOrdinalTitle(sequence);
    const { startsAt, endsAt } = scheduleRowToIso(
      row.scheduled_date,
      row.start_time,
      row.end_time
    );
    const jobId = row.job_id?.trim() || null;

    return {
      id: row.id,
      workerId: workerId || row.applicant_id,
      applicantName,
      applicantEmail: worker?.email?.trim() || null,
      title,
      description: row.description?.trim() || `${title} schedule with ${applicantName}`,
      startsAt,
      endsAt,
      timezone: row.timezone || "UTC",
      status: row.status,
      meetingType: parseMeetingTypeValue(row.meeting_type),
      meetingLink: row.meeting_link,
      location: row.location,
      notes: row.notes,
      applicationId: row.application_id?.trim() || null,
      jobId,
      jobTitle: jobId ? jobsById.get(jobId) ?? null : null,
      interviewers: interviewersByInterviewId.get(row.id) ?? [],
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant before viewing interviews." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const tab = parseTab(req.nextUrl.searchParams.get("tab"));
    const workerIdFilter = req.nextUrl.searchParams.get("workerId")?.trim() ?? "";
    const applicationIdFilter = req.nextUrl.searchParams.get("applicationId")?.trim() ?? "";
    const nowMs = Date.now();

    let scheduleQuery = supabase
      .from("interview_schedules")
      .select(
        "id, tenant_id, applicant_id, worker_id, application_id, job_id, title, description, scheduled_date, start_time, end_time, timezone, status, meeting_link, location, meeting_type, notes, created_at, updated_at"
      )
      .eq("tenant_id", scope.tenantId)
      .order("scheduled_date", { ascending: tab === "upcoming" })
      .order("start_time", { ascending: tab === "upcoming" })
      .limit(200);

    if (applicationIdFilter) {
      scheduleQuery = scheduleQuery.eq("application_id", applicationIdFilter);
    }

    const [{ data: scheduleData, error: scheduleError }, applicants] = await Promise.all([
      scheduleQuery,
      listInterviewApplicants(supabase, scope.tenantId),
    ]);

    if (scheduleError) throw scheduleError;

    const allSchedules = (scheduleData as InterviewScheduleRow[] | null) ?? [];
    const schedules = allSchedules
      .filter((row) =>
        tab === "upcoming" ? isUpcomingRow(row, nowMs) : isRecentRow(row, nowMs)
      )
      .filter((row) => !workerIdFilter || row.worker_id === workerIdFilter);

    const workersById = new Map<string, WorkerRow>();

    const applicantIds = Array.from(new Set(schedules.map((s) => s.applicant_id)));
    const { data: applicantRows, error: applicantError } = applicantIds.length
      ? await supabase
          .from("applicants")
          .select("id, full_name, worker_id")
          .eq("tenant_id", scope.tenantId)
          .in("id", applicantIds)
      : { data: [], error: null };

    if (applicantError) throw applicantError;

    const applicantsById = new Map(
      (applicantRows ?? []).map((a) => [
        a.id,
        { full_name: a.full_name as string | null, worker_id: a.worker_id as string | null },
      ])
    );

    const workerIds = Array.from(
      new Set(
        schedules
          .map((s) => s.worker_id ?? applicantsById.get(s.applicant_id)?.worker_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const missingWorkerIds = workerIds.filter((id) => !workersById.has(id));
    if (missingWorkerIds.length > 0) {
      const { data: extraWorkers, error: extraError } = await supabase
        .from("worker")
        .select("id, first_name, last_name, status, email")
        .in("id", missingWorkerIds);
      if (extraError) throw extraError;
      (extraWorkers as WorkerRow[] | null)?.forEach((w) => workersById.set(w.id, w));
    }

    const jobIds = Array.from(
      new Set(schedules.map((s) => s.job_id).filter((id): id is string => Boolean(id)))
    );
    const jobsById = new Map<string, string>();
    if (jobIds.length > 0) {
      const { data: jobRows, error: jobError } = await supabase
        .from("job_requisitions")
        .select("id, public_title")
        .eq("tenant_id", scope.tenantId)
        .in("id", jobIds);
      if (jobError) throw jobError;
      for (const job of jobRows ?? []) {
        const title = String(job.public_title ?? "").trim();
        if (title) jobsById.set(String(job.id), title);
      }
    }

    const interviewIds = schedules.map((s) => s.id);
    const interviewersByInterviewId = new Map<string, AdminInterviewInterviewer[]>();
    if (interviewIds.length > 0) {
      const { data: attendeeRows, error: attendeeError } = await supabase
        .from("interview_attendees")
        .select("interview_id, user_id, email, name, attendee_type")
        .eq("tenant_id", scope.tenantId)
        .in("interview_id", interviewIds)
        .eq("attendee_type", "interviewer");
      if (attendeeError) throw attendeeError;
      for (const row of attendeeRows ?? []) {
        const interviewId = String(row.interview_id);
        const list = interviewersByInterviewId.get(interviewId) ?? [];
        list.push({
          userId: row.user_id ? String(row.user_id) : null,
          email: String(row.email ?? "").trim().toLowerCase(),
          name: String(row.name ?? row.email ?? "").trim() || String(row.email ?? ""),
        });
        interviewersByInterviewId.set(interviewId, list);
      }
    }

    const sequenceByScheduleId = await loadSequenceMap(supabase, scope.tenantId, applicantIds);
    const interviews = buildInterviewItems(
      schedules,
      workersById,
      applicantsById,
      sequenceByScheduleId,
      jobsById,
      interviewersByInterviewId
    );

    const upcomingCount = allSchedules.filter((row) => isUpcomingRow(row, nowMs)).length;
    const recentCount = allSchedules.filter((row) => isRecentRow(row, nowMs)).length;

    return NextResponse.json({
      interviews,
      applicants,
      counts: { upcoming: upcomingCount, recent: recentCount },
      tab,
    });
  } catch (err) {
    console.error("[admin/applicant-appointments:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseInterviewers(raw: unknown): InterviewAttendeeInput[] {
  if (!Array.isArray(raw)) return [];
  const interviewers: InterviewAttendeeInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const email = String(record.email ?? "").trim().toLowerCase();
    const name = String(record.name ?? email).trim();
    if (!email) continue;
    interviewers.push({
      userId: typeof record.userId === "string" ? record.userId : null,
      email,
      name,
      attendeeType: "interviewer",
    });
  }
  return interviewers;
}

function parseMeetingType(raw: unknown): InterviewMeetingType {
  const value = String(raw ?? "online").trim().toLowerCase();
  if (value === "phone" || value === "in_person") return value;
  return "online";
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant before scheduling interviews." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      workerId?: string;
      applicationId?: string | null;
      jobId?: string | null;
      startsAt?: string;
      endsAt?: string | null;
      timezone?: string;
      title?: string;
      meetingType?: string;
      meetingLink?: string | null;
      location?: string | null;
      notes?: string | null;
      candidateNotes?: string | null;
      interviewers?: unknown;
    };

    const workerIdCheck = parseRequiredUuid(body.workerId?.trim() ?? "", "workerId");
    if (!workerIdCheck.ok) return NextResponse.json({ error: workerIdCheck.error }, { status: 400 });

    if (typeof body.startsAt !== "string" || !body.startsAt.trim()) {
      return NextResponse.json({ error: "Select a date and time." }, { status: 400 });
    }

    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "Invalid start date/time." }, { status: 400 });
    }

    const endsAt = body.endsAt ? new Date(body.endsAt) : new Date(startsAt.getTime() + 30 * 60 * 1000);
    if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    }

    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "Asia/Manila";

    const meetingType = parseMeetingType(body.meetingType);

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, first_name, last_name, tenant_id, status, email")
      .eq("id", workerIdCheck.value)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();

    if (workerError) throw workerError;
    if (!worker?.id) return NextResponse.json({ error: "Applicant not found." }, { status: 404 });

    const { resolveApplicationContextForWorker } = await import(
      "@/lib/jobs/resolve-application-context"
    );
    const appCtx = await resolveApplicationContextForWorker({
      supabase,
      tenantId: scope.tenantId,
      workerId: worker.id,
      applicationId: body.applicationId ?? null,
    });
    if (body.applicationId?.trim() && !appCtx.applicationId) {
      return NextResponse.json({ error: "Application not found for this worker." }, { status: 404 });
    }
    if (appCtx.ambiguous && !appCtx.applicationId) {
      return NextResponse.json(
        { error: "applicationId is required when the worker has multiple applications." },
        { status: 400 }
      );
    }

    const applicantId = await ensureApplicantForWorker(
      supabase,
      scope.tenantId,
      worker,
      appCtx.applicationId
    );

    const scheduleFields = isoToScheduleFields(startsAt, endsAt, timezone);

    const sequenceByScheduleId = await loadSequenceMap(supabase, scope.tenantId, [applicantId]);
    const sequence = (sequenceByScheduleId.size || 0) + 1;
    const candidateName = applicantDisplayName(worker.first_name, worker.last_name);
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : interviewOrdinalTitle(sequence);

    const applicationId = appCtx.applicationId;
    const jobId = body.jobId?.trim() || null;

    const interviewId = crypto.randomUUID();
    const calendarUid = buildInterviewCalendarUid(interviewId);

    const { data: schedule, error: scheduleError } = await supabase
      .from("interview_schedules")
      .insert({
        id: interviewId,
        tenant_id: scope.tenantId,
        applicant_id: applicantId,
        worker_id: worker.id,
        application_id: applicationId,
        job_id: jobId,
        title,
        description: `${title} with ${candidateName}`,
        scheduled_date: scheduleFields.scheduled_date,
        start_time: scheduleFields.start_time,
        end_time: scheduleFields.end_time,
        timezone: scheduleFields.timezone,
        status: "upcoming",
        meeting_type: meetingType,
        meeting_link: body.meetingLink?.trim() || null,
        location: body.location?.trim() || null,
        notes: body.notes?.trim() || null,
        calendar_uid: calendarUid,
        calendar_sequence: 0,
        invitation_status: "pending",
        created_by: auth.devBypass ? null : auth.userId,
      })
      .select(
        "id, tenant_id, applicant_id, worker_id, application_id, job_id, title, description, scheduled_date, start_time, end_time, timezone, status, meeting_link, location, meeting_type, notes, calendar_uid, calendar_sequence, organizer_email, created_at, updated_at"
      )
      .single();

    if (scheduleError) throw scheduleError;

    const workersById = new Map<string, WorkerRow>([
      [
        worker.id,
        {
          id: worker.id,
          first_name: worker.first_name,
          last_name: worker.last_name,
          status: worker.status,
          email: (worker as { email?: string | null }).email ?? null,
        },
      ],
    ]);

    const applicantsById = new Map([
      [applicantId, { full_name: applicantDisplayName(worker.first_name, worker.last_name), worker_id: worker.id }],
    ]);

    const jobsById = new Map<string, string>();
    if (jobId) {
      const { data: jobRow } = await supabase
        .from("job_requisitions")
        .select("public_title")
        .eq("id", jobId)
        .eq("tenant_id", scope.tenantId)
        .maybeSingle();
      const title = jobRow?.public_title?.trim();
      if (title) jobsById.set(jobId, title);
    }

    const updatedSequence = await loadSequenceMap(supabase, scope.tenantId, [applicantId]);
    const [interview] = buildInterviewItems(
      [schedule as InterviewScheduleRow],
      workersById,
      applicantsById,
      updatedSequence,
      jobsById,
      new Map()
    );

    const applicationIdForStatus = applicationId;
    const statusResult = await markApplicationInterviewing({
      supabase,
      tenantId: scope.tenantId,
      workerId: worker.id,
      applicationId: applicationIdForStatus,
      jobId,
    });

    let jobTitle: string | null = null;
    if (jobId) {
      const { data: jobRow } = await supabase
        .from("job_requisitions")
        .select("public_title")
        .eq("id", jobId)
        .eq("tenant_id", scope.tenantId)
        .maybeSingle();
      jobTitle = jobRow?.public_title?.trim() || null;
    }

    const invitation = await sendInterviewInvitations({
      supabase,
      tenantId: scope.tenantId,
      interview: schedule as InterviewScheduleRecord,
      schedulerUserId: auth.devBypass ? null : auth.userId,
      candidateName,
      jobTitle,
      interviewers: parseInterviewers(body.interviewers),
      deliveryType: "request",
      candidateFacingNotes:
        typeof body.candidateNotes === "string" ? body.candidateNotes : null,
    });

    return NextResponse.json({
      ok: true,
      interview,
      statusUpdated: statusResult.updated,
      applicationId: statusResult.applicationId,
      invitation,
    });
  } catch (err) {
    console.error("[admin/applicant-appointments:post]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
