import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findApplicantByUserId } from "@/lib/applicant-portal";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type MeetingType = "online" | "phone" | "in_person";
type AppointmentStatus = "requested" | "confirmed" | "rescheduled" | "cancelled";

type AppointmentSlot = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  meeting_type: MeetingType;
  meeting_link: string | null;
  location: string | null;
  notes: string | null;
};

type AppointmentRow = {
  id: string;
  slot_id: string | null;
  status: AppointmentStatus;
  meeting_type: MeetingType | null;
  confirmed_starts_at: string | null;
  confirmed_ends_at: string | null;
  meeting_link: string | null;
  location: string | null;
  reschedule_reason: string | null;
  requested_at: string;
  updated_at: string;
};

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function resolveApplicant(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) return null;

  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Supabase service role not configured");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;

  const applicant = await findApplicantByUserId(supabase, data.user.id);
  if (!applicant?.id) return null;

  return { supabase, workerId: applicant.id, tenantId: applicant.tenant_id };
}

async function getAppointmentPayload(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  workerId: string,
  tenantId: string
) {
  const now = new Date().toISOString();
  const [{ data: slots, error: slotsError }, { data: appointment, error: appointmentError }] =
    await Promise.all([
      supabase
        .from("applicant_appointment_slots")
        .select("id, starts_at, ends_at, meeting_type, meeting_link, location, notes")
        .eq("tenant_id", tenantId)
        .eq("is_available", true)
        .gte("starts_at", now)
        .order("starts_at", { ascending: true })
        .limit(25),
      supabase
        .from("applicant_appointments")
        .select(
          "id, slot_id, status, meeting_type, confirmed_starts_at, confirmed_ends_at, meeting_link, location, reschedule_reason, requested_at, updated_at"
        )
        .eq("worker_id", workerId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (slotsError) throw slotsError;
  if (appointmentError) throw appointmentError;

  let selectedSlot: AppointmentSlot | null = null;
  const appointmentRow = appointment as AppointmentRow | null;
  if (appointmentRow?.slot_id) {
    const { data: slot, error: slotError } = await supabase
      .from("applicant_appointment_slots")
      .select("id, starts_at, ends_at, meeting_type, meeting_link, location, notes")
      .eq("id", appointmentRow.slot_id)
      .maybeSingle();
    if (slotError) throw slotError;
    selectedSlot = (slot as AppointmentSlot | null) ?? null;
  }

  return {
    availableSlots: (slots as AppointmentSlot[] | null) ?? [],
    appointment: appointmentRow,
    selectedSlot,
  };
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveApplicant(req);
    if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await getAppointmentPayload(
      resolved.supabase,
      resolved.workerId,
      resolved.tenantId
    );
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[applicant-portal/appointments:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveApplicant(req);
    if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { slotId?: string };
    const idCheck = parseRequiredUuid(body.slotId?.trim() ?? "", "slotId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const { data: slot, error: slotError } = await resolved.supabase
      .from("applicant_appointment_slots")
      .select("id, tenant_id, starts_at, ends_at, meeting_type, meeting_link, location")
      .eq("id", idCheck.value)
      .eq("tenant_id", resolved.tenantId)
      .eq("is_available", true)
      .maybeSingle();

    if (slotError) throw slotError;
    if (!slot?.id) return NextResponse.json({ error: "Selected schedule is not available." }, { status: 404 });

    const slotRow = slot as {
      id: string;
      starts_at: string;
      ends_at: string | null;
      meeting_type: MeetingType;
      meeting_link: string | null;
      location: string | null;
    };

    const { error } = await resolved.supabase.from("applicant_appointments").insert({
      tenant_id: resolved.tenantId,
      worker_id: resolved.workerId,
      slot_id: slotRow.id,
      status: "requested",
      meeting_type: slotRow.meeting_type,
      confirmed_starts_at: slotRow.starts_at,
      confirmed_ends_at: slotRow.ends_at,
      meeting_link: slotRow.meeting_link,
      location: slotRow.location,
    });
    if (error) throw error;

    const payload = await getAppointmentPayload(
      resolved.supabase,
      resolved.workerId,
      resolved.tenantId
    );
    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    console.error("[applicant-portal/appointments:post]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const resolved = await resolveApplicant(req);
    if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      appointmentId?: string;
      reason?: string;
    };
    const idCheck = parseRequiredUuid(body.appointmentId?.trim() ?? "", "appointmentId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const reason = body.reason?.trim() ?? "";
    if (!reason) return NextResponse.json({ error: "Enter a reschedule reason." }, { status: 400 });

    const { error } = await resolved.supabase
      .from("applicant_appointments")
      .update({
        status: "rescheduled",
        reschedule_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", idCheck.value)
      .eq("worker_id", resolved.workerId);
    if (error) throw error;

    const payload = await getAppointmentPayload(
      resolved.supabase,
      resolved.workerId,
      resolved.tenantId
    );
    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    console.error("[applicant-portal/appointments:patch]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
