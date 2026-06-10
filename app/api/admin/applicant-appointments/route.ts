import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  applicantDisplayName,
  interviewOrdinalTitle,
  type AppointmentStatus,
  type MeetingType,
} from "@/lib/interviews/format";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type AppointmentRow = {
  id: string;
  tenant_id: string;
  worker_id: string;
  slot_id: string | null;
  status: AppointmentStatus;
  meeting_type: MeetingType | null;
  confirmed_starts_at: string | null;
  confirmed_ends_at: string | null;
  meeting_link: string | null;
  location: string | null;
  requested_at: string;
  updated_at: string;
};

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
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
  status: AppointmentStatus;
  meetingType: MeetingType | null;
  meetingLink: string | null;
  location: string | null;
};

function parseMeetingType(value: unknown): MeetingType | null {
  const type = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (type === "online" || type === "phone" || type === "in_person") return type;
  return null;
}

function parseTab(value: string | null): "upcoming" | "recent" {
  return value === "recent" ? "recent" : "upcoming";
}

function buildInterviewItems(
  appointments: AppointmentRow[],
  workersById: Map<string, WorkerRow>,
  sequenceByAppointmentId: Map<string, number>
): AdminInterviewItem[] {
  return appointments.map((row) => {
    const worker = workersById.get(row.worker_id);
    const applicantName = applicantDisplayName(worker?.first_name ?? null, worker?.last_name ?? null);
    const sequence = sequenceByAppointmentId.get(row.id) ?? 1;
    const title = interviewOrdinalTitle(sequence);
    return {
      id: row.id,
      workerId: row.worker_id,
      applicantName,
      title,
      description: `${title} schedule with ${applicantName}`,
      startsAt: row.confirmed_starts_at ?? row.requested_at,
      endsAt: row.confirmed_ends_at,
      status: row.status,
      meetingType: row.meeting_type,
      meetingLink: row.meeting_link,
      location: row.location,
    };
  });
}

async function loadSequenceMap(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  tenantId: string,
  workerIds: string[]
) {
  const sequenceByAppointmentId = new Map<string, number>();
  if (workerIds.length === 0) return sequenceByAppointmentId;

  const { data, error } = await supabase
    .from("applicant_appointments")
    .select("id, worker_id, confirmed_starts_at, requested_at")
    .eq("tenant_id", tenantId)
    .in("worker_id", workerIds)
    .neq("status", "cancelled")
    .order("confirmed_starts_at", { ascending: true, nullsFirst: false })
    .order("requested_at", { ascending: true });

  if (error) throw error;

  const byWorker = new Map<string, { id: string; sortKey: number }[]>();
  for (const row of data ?? []) {
    const sortKey = new Date(row.confirmed_starts_at ?? row.requested_at).getTime();
    const list = byWorker.get(row.worker_id) ?? [];
    list.push({ id: row.id, sortKey });
    byWorker.set(row.worker_id, list);
  }

  byWorker.forEach((list) => {
    list.sort((a, b) => a.sortKey - b.sortKey);
    list.forEach((item, index) => sequenceByAppointmentId.set(item.id, index + 1));
  });

  return sequenceByAppointmentId;
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
    const now = new Date().toISOString();

    let query = supabase
      .from("applicant_appointments")
      .select(
        "id, tenant_id, worker_id, slot_id, status, meeting_type, confirmed_starts_at, confirmed_ends_at, meeting_link, location, requested_at, updated_at"
      )
      .eq("tenant_id", scope.tenantId)
      .neq("status", "cancelled")
      .order("confirmed_starts_at", { ascending: tab === "upcoming", nullsFirst: false })
      .limit(200);

    if (tab === "upcoming") {
      query = query.or(`confirmed_starts_at.gte.${now},and(confirmed_starts_at.is.null,status.eq.requested)`);
    } else {
      query = query.lt("confirmed_starts_at", now);
    }

    const [{ data: appointmentData, error: appointmentError }, { data: workerData, error: workerError }] =
      await Promise.all([
        query,
        supabase
          .from("worker")
          .select("id, first_name, last_name, status")
          .eq("tenant_id", scope.tenantId)
          .in("status", ["new", "pending", "approved"])
          .order("first_name", { ascending: true })
          .limit(500),
      ]);

    if (appointmentError) throw appointmentError;
    if (workerError) throw workerError;

    const appointments = (appointmentData as AppointmentRow[] | null) ?? [];
    const workers = (workerData as WorkerRow[] | null) ?? [];
    const workersById = new Map(workers.map((w) => [w.id, w]));
    const workerIds = Array.from(new Set(appointments.map((a) => a.worker_id)));

    const missingWorkerIds = workerIds.filter((id) => !workersById.has(id));
    if (missingWorkerIds.length > 0) {
      const { data: extraWorkers, error: extraError } = await supabase
        .from("worker")
        .select("id, first_name, last_name, status")
        .in("id", missingWorkerIds);
      if (extraError) throw extraError;
      (extraWorkers as WorkerRow[] | null)?.forEach((w) => workersById.set(w.id, w));
    }

    const sequenceByAppointmentId = await loadSequenceMap(supabase, scope.tenantId, workerIds);
    const interviews = buildInterviewItems(appointments, workersById, sequenceByAppointmentId);

    const applicants: ApplicantOption[] = workers.map((w) => ({
      id: w.id,
      name: applicantDisplayName(w.first_name, w.last_name),
      status: (w.status ?? "new").toLowerCase(),
    }));

    const [{ count: upcomingCount }, { count: recentCount }] = await Promise.all([
      supabase
        .from("applicant_appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", scope.tenantId)
        .neq("status", "cancelled")
        .or(`confirmed_starts_at.gte.${now},and(confirmed_starts_at.is.null,status.eq.requested)`),
      supabase
        .from("applicant_appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", scope.tenantId)
        .neq("status", "cancelled")
        .lt("confirmed_starts_at", now),
    ]);

    return NextResponse.json({
      interviews,
      applicants,
      counts: { upcoming: upcomingCount ?? 0, recent: recentCount ?? 0 },
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
      location?: string | null;
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

    const meetingType = parseMeetingType(body.meetingType) ?? "online";

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, first_name, last_name, tenant_id, status")
      .eq("id", workerIdCheck.value)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();

    if (workerError) throw workerError;
    if (!worker?.id) return NextResponse.json({ error: "Applicant not found." }, { status: 404 });

    const { data: slot, error: slotError } = await supabase
      .from("applicant_appointment_slots")
      .insert({
        tenant_id: scope.tenantId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        meeting_type: meetingType,
        meeting_link: body.meetingLink?.trim() || null,
        location: body.location?.trim() || null,
        is_available: false,
        created_by_user_id: auth.devBypass ? null : auth.userId,
      })
      .select("id")
      .single();

    if (slotError) throw slotError;

    const { data: appointment, error: appointmentError } = await supabase
      .from("applicant_appointments")
      .insert({
        tenant_id: scope.tenantId,
        worker_id: worker.id,
        slot_id: slot.id,
        status: "confirmed",
        meeting_type: meetingType,
        confirmed_starts_at: startsAt.toISOString(),
        confirmed_ends_at: endsAt.toISOString(),
        meeting_link: body.meetingLink?.trim() || null,
        location: body.location?.trim() || null,
        confirmed_at: new Date().toISOString(),
      })
      .select(
        "id, tenant_id, worker_id, slot_id, status, meeting_type, confirmed_starts_at, confirmed_ends_at, meeting_link, location, requested_at, updated_at"
      )
      .single();

    if (appointmentError) throw appointmentError;

    const sequenceByAppointmentId = await loadSequenceMap(supabase, scope.tenantId, [worker.id]);
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

    const [interview] = buildInterviewItems(
      [appointment as AppointmentRow],
      workersById,
      sequenceByAppointmentId
    );

    return NextResponse.json({ ok: true, interview });
  } catch (err) {
    console.error("[admin/applicant-appointments:post]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
