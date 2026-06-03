import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type MeetingType = "online" | "phone" | "in_person";

function parseMeetingType(value: unknown): MeetingType | null {
  const type = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (type === "online" || type === "phone" || type === "in_person") return type;
  return null;
}

function parseFutureDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  return date.toISOString();
}

export async function GET() {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant before managing appointment slots." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data, error } = await supabase
      .from("applicant_appointment_slots")
      .select("id, starts_at, ends_at, meeting_type, meeting_link, location, notes, is_available")
      .eq("tenant_id", scope.tenantId)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ slots: data ?? [] });
  } catch (err) {
    console.error("[admin/applicant-appointments/slots:get]", err);
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
      return NextResponse.json({ error: "Select a tenant before creating appointment slots." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      startsAt?: string;
      endsAt?: string | null;
      meetingType?: string;
      meetingLink?: string | null;
      location?: string | null;
      notes?: string | null;
    };

    const startsAt = parseFutureDate(body.startsAt);
    if (!startsAt) return NextResponse.json({ error: "Enter a future start date/time." }, { status: 400 });

    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= new Date(startsAt).getTime())) {
      return NextResponse.json({ error: "End date/time must be after the start date/time." }, { status: 400 });
    }

    const meetingType = parseMeetingType(body.meetingType);
    if (!meetingType) return NextResponse.json({ error: "Invalid meeting type." }, { status: 400 });

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data, error } = await supabase
      .from("applicant_appointment_slots")
      .insert({
        tenant_id: scope.tenantId,
        starts_at: startsAt,
        ends_at: endsAt ? endsAt.toISOString() : null,
        meeting_type: meetingType,
        meeting_link: body.meetingLink?.trim() || null,
        location: body.location?.trim() || null,
        notes: body.notes?.trim() || null,
        created_by_user_id: auth.devBypass ? null : auth.userId,
      })
      .select("id, starts_at, ends_at, meeting_type, meeting_link, location, notes, is_available")
      .single();

    if (error) throw error;
    return NextResponse.json({ slot: data });
  } catch (err) {
    console.error("[admin/applicant-appointments/slots:post]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
