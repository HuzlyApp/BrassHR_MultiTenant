import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { applicantDisplayName } from "@/lib/interviews/format";
import { buildInterviewCalendarUid } from "@/lib/interviews/ics";
import { isoToScheduleFields, scheduleRowToIso } from "@/lib/interviews/schedule-fields";
import {
  sendInterviewInvitations,
  type InterviewAttendeeInput,
  type InterviewScheduleRecord,
} from "@/lib/interviews/send-interview-invitations";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

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

async function loadInterview(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  tenantId: string,
  interviewId: string
) {
  const { data, error } = await supabase
    .from("interview_schedules")
    .select("*")
    .eq("id", interviewId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data as InterviewScheduleRecord | null;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant before updating interviews." }, { status: 400 });
    }

    const { id } = await context.params;
    const interviewIdCheck = parseRequiredUuid(id, "id");
    if (!interviewIdCheck.ok) {
      return NextResponse.json({ error: interviewIdCheck.error }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const existing = await loadInterview(supabase, scope.tenantId, interviewIdCheck.value);
    if (!existing) {
      return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    }
    if (existing.status === "cancelled") {
      return NextResponse.json({ error: "Cancelled interviews cannot be edited." }, { status: 409 });
    }

    const startsAt =
      typeof body.startsAt === "string" && body.startsAt.trim()
        ? new Date(body.startsAt)
        : scheduleRowToIso(existing.scheduled_date, existing.start_time, existing.end_time).startsAt
          ? new Date(scheduleRowToIso(existing.scheduled_date, existing.start_time, existing.end_time).startsAt)
          : null;
    const endsAt =
      typeof body.endsAt === "string" && body.endsAt.trim()
        ? new Date(body.endsAt)
        : scheduleRowToIso(existing.scheduled_date, existing.start_time, existing.end_time).endsAt
          ? new Date(
              scheduleRowToIso(existing.scheduled_date, existing.start_time, existing.end_time).endsAt as string
            )
          : null;

    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "Invalid start date/time." }, { status: 400 });
    }
    if (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    }

    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : existing.timezone;
    const scheduleFields = isoToScheduleFields(startsAt, endsAt, timezone);
    const nextSequence = (existing.calendar_sequence ?? 0) + 1;

    const patch = {
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : existing.title,
      description:
        typeof body.description === "string"
          ? body.description.trim() || null
          : existing.description,
      scheduled_date: scheduleFields.scheduled_date,
      start_time: scheduleFields.start_time,
      end_time: scheduleFields.end_time,
      timezone: scheduleFields.timezone,
      meeting_link:
        typeof body.meetingLink === "string" ? body.meetingLink.trim() || null : existing.meeting_link,
      location: typeof body.location === "string" ? body.location.trim() || null : existing.location,
      meeting_type:
        typeof body.meetingType === "string" && body.meetingType.trim()
          ? body.meetingType.trim()
          : existing.meeting_type,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : existing.notes,
      calendar_sequence: nextSequence,
      status: "upcoming" as const,
    };

    const { data: updated, error: updateError } = await supabase
      .from("interview_schedules")
      .update(patch)
      .eq("id", existing.id)
      .eq("tenant_id", scope.tenantId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    let jobTitle: string | null = null;
    const jobId =
      typeof body.jobId === "string" && body.jobId.trim()
        ? body.jobId.trim()
        : existing.job_id;
    if (jobId) {
      const { data: jobRow } = await supabase
        .from("job_requisitions")
        .select("public_title")
        .eq("id", jobId)
        .eq("tenant_id", scope.tenantId)
        .maybeSingle();
      jobTitle = jobRow?.public_title?.trim() || null;
    }

    let candidateName = "Candidate";
    if (existing.worker_id) {
      const { data: worker } = await supabase
        .from("worker")
        .select("first_name, last_name")
        .eq("id", existing.worker_id)
        .eq("tenant_id", scope.tenantId)
        .maybeSingle();
      candidateName = applicantDisplayName(worker?.first_name ?? null, worker?.last_name ?? null);
    }

    const invitation = await sendInterviewInvitations({
      supabase,
      tenantId: scope.tenantId,
      interview: updated as InterviewScheduleRecord,
      schedulerUserId: auth.devBypass ? null : auth.userId,
      candidateName,
      jobTitle,
      interviewers: parseInterviewers(body.interviewers),
      deliveryType: "update",
      candidateFacingNotes: typeof body.candidateNotes === "string" ? body.candidateNotes : null,
    });

    return NextResponse.json({
      ok: true,
      interview: updated,
      invitation,
    });
  } catch (error) {
    console.error("[admin/applicant-appointments:patch]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant before cancelling interviews." }, { status: 400 });
    }

    const { id } = await context.params;
    const interviewIdCheck = parseRequiredUuid(id, "id");
    if (!interviewIdCheck.ok) {
      return NextResponse.json({ error: interviewIdCheck.error }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const existing = await loadInterview(supabase, scope.tenantId, interviewIdCheck.value);
    if (!existing) {
      return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    }
    if (existing.status === "cancelled") {
      return NextResponse.json({ ok: true, interview: existing, alreadyCancelled: true });
    }

    const nextSequence = (existing.calendar_sequence ?? 0) + 1;
    const { data: cancelled, error: cancelError } = await supabase
      .from("interview_schedules")
      .update({
        status: "cancelled",
        calendar_sequence: nextSequence,
      })
      .eq("id", existing.id)
      .eq("tenant_id", scope.tenantId)
      .select("*")
      .single();
    if (cancelError) throw cancelError;

    let candidateName = "Candidate";
    if (existing.worker_id) {
      const { data: worker } = await supabase
        .from("worker")
        .select("first_name, last_name")
        .eq("id", existing.worker_id)
        .eq("tenant_id", scope.tenantId)
        .maybeSingle();
      candidateName = applicantDisplayName(worker?.first_name ?? null, worker?.last_name ?? null);
    }

    const { data: attendeeRows } = await supabase
      .from("interview_attendees")
      .select("user_id, email, name, attendee_type")
      .eq("tenant_id", scope.tenantId)
      .eq("interview_id", existing.id);

    const invitation = await sendInterviewInvitations({
      supabase,
      tenantId: scope.tenantId,
      interview: {
        ...(cancelled as InterviewScheduleRecord),
        calendar_uid: existing.calendar_uid || buildInterviewCalendarUid(existing.id),
      },
      schedulerUserId: auth.devBypass ? null : auth.userId,
      candidateName,
      jobTitle: null,
      interviewers: (attendeeRows ?? [])
        .filter((row) => row.attendee_type === "interviewer")
        .map((row) => ({
          userId: row.user_id,
          email: String(row.email),
          name: String(row.name ?? row.email),
        })),
      deliveryType: "cancel",
    });

    return NextResponse.json({
      ok: true,
      interview: cancelled,
      invitation,
    });
  } catch (error) {
    console.error("[admin/applicant-appointments:delete]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
