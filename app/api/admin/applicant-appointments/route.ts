import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ensureApplicantForWorker } from "@/lib/interviews/ensure-applicant";
import {
  applicantDisplayName,
  interviewOrdinalTitle,
} from "@/lib/interviews/format";
import { isoToScheduleFields, scheduleRowToIso } from "@/lib/interviews/schedule-fields";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type InterviewScheduleStatus = "upcoming" | "completed" | "cancelled" | "rescheduled";

type InterviewScheduleRow = {
  id: string;
  tenant_id: string;
  applicant_id: string;
  worker_id: string | null;
  title: string;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: InterviewScheduleStatus;
  meeting_link: string | null;
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

type ApplicantOption = {
  id: string;
  name: string;
  status: string;
};

export type AdminInterviewItem = {
  id: string;
  workerId: string;
  applicantName: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  status: InterviewScheduleStatus;
  meetingType: "online" | null;
  meetingLink: string | null;
  location: string | null;
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

function buildInterviewItems(
  schedules: InterviewScheduleRow[],
  workersById: Map<string, WorkerRow>,
  applicantsById: Map<string, { full_name: string | null; worker_id: string | null }>,
  sequenceByScheduleId: Map<string, number>
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

    return {
      id: row.id,
      workerId: workerId || row.applicant_id,
      applicantName,
      title,
      description: row.description?.trim() || `${title} schedule with ${applicantName}`,
      startsAt,
      endsAt,
      status: row.status,
      meetingType: "online",
      meetingLink: row.meeting_link,
      location: null,
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
    const nowMs = Date.now();

    const [{ data: scheduleData, error: scheduleError }, { data: workerData, error: workerError }] =
      await Promise.all([
        supabase
          .from("interview_schedules")
          .select(
            "id, tenant_id, applicant_id, worker_id, title, description, scheduled_date, start_time, end_time, timezone, status, meeting_link, notes, created_at, updated_at"
          )
          .eq("tenant_id", scope.tenantId)
          .order("scheduled_date", { ascending: tab === "upcoming" })
          .order("start_time", { ascending: tab === "upcoming" })
          .limit(200),
        supabase
          .from("worker")
          .select("id, first_name, last_name, status")
          .eq("tenant_id", scope.tenantId)
          .in("status", ["new", "pending", "approved", "Active"])
          .order("first_name", { ascending: true })
          .limit(500),
      ]);

    if (scheduleError) throw scheduleError;
    if (workerError) throw workerError;

    const allSchedules = (scheduleData as InterviewScheduleRow[] | null) ?? [];
    const schedules = allSchedules.filter((row) =>
      tab === "upcoming" ? isUpcomingRow(row, nowMs) : isRecentRow(row, nowMs)
    );

    const workers = (workerData as WorkerRow[] | null) ?? [];
    const workersById = new Map(workers.map((w) => [w.id, w]));

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
        .select("id, first_name, last_name, status")
        .in("id", missingWorkerIds);
      if (extraError) throw extraError;
      (extraWorkers as WorkerRow[] | null)?.forEach((w) => workersById.set(w.id, w));
    }

    const sequenceByScheduleId = await loadSequenceMap(supabase, scope.tenantId, applicantIds);
    const interviews = buildInterviewItems(
      schedules,
      workersById,
      applicantsById,
      sequenceByScheduleId
    );

    const applicants: ApplicantOption[] = workers.map((w) => ({
      id: w.id,
      name: applicantDisplayName(w.first_name, w.last_name),
      status: (w.status ?? "new").toLowerCase(),
    }));

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
      startsAt?: string;
      endsAt?: string | null;
      meetingType?: string;
      meetingLink?: string | null;
      notes?: string | null;
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
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "Asia/Manila";

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

    const applicantId = await ensureApplicantForWorker(supabase, scope.tenantId, worker);

    const scheduleFields = isoToScheduleFields(startsAt, endsAt, timezone);

    const sequenceByScheduleId = await loadSequenceMap(supabase, scope.tenantId, [applicantId]);
    const sequence = (sequenceByScheduleId.size || 0) + 1;
    const title = interviewOrdinalTitle(sequence);

    const { data: schedule, error: scheduleError } = await supabase
      .from("interview_schedules")
      .insert({
        tenant_id: scope.tenantId,
        applicant_id: applicantId,
        worker_id: worker.id,
        title,
        description: `${title} schedule with ${applicantDisplayName(worker.first_name, worker.last_name)}`,
        scheduled_date: scheduleFields.scheduled_date,
        start_time: scheduleFields.start_time,
        end_time: scheduleFields.end_time,
        timezone: scheduleFields.timezone,
        status: "upcoming",
        meeting_link: body.meetingLink?.trim() || null,
        notes: body.notes?.trim() || null,
        created_by: auth.devBypass ? null : auth.userId,
      })
      .select(
        "id, tenant_id, applicant_id, worker_id, title, description, scheduled_date, start_time, end_time, timezone, status, meeting_link, notes, created_at, updated_at"
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
        },
      ],
    ]);

    const applicantsById = new Map([
      [applicantId, { full_name: applicantDisplayName(worker.first_name, worker.last_name), worker_id: worker.id }],
    ]);

    const updatedSequence = await loadSequenceMap(supabase, scope.tenantId, [applicantId]);
    const [interview] = buildInterviewItems(
      [schedule as InterviewScheduleRow],
      workersById,
      applicantsById,
      updatedSequence
    );

    return NextResponse.json({ ok: true, interview });
  } catch (err) {
    console.error("[admin/applicant-appointments:post]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
