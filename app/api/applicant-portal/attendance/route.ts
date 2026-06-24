import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findApplicantByUserId, normalizeApplicantStatus } from "@/lib/applicant-portal";

export const runtime = "nodejs";

const NOT_APPROVED_MESSAGE = "Only approved applicants can use the attendance feature.";
const LOCATION_REQUIRED_MESSAGE =
  "Location access is required to verify your attendance. Please enable location permissions and try again.";
const VERIFY_FAILED_MESSAGE =
  "We could not verify your location or network information. Please try again or contact the tenant/recruiter.";

type LocationPayload = {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  permissionStatus?: string;
};

type AttendanceLog = {
  id: string;
  status: "clocked_in" | "clocked_out";
  attendance_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  total_seconds: number | null;
  clock_in_ip: string;
  clock_out_ip: string | null;
  clock_in_address: string | null;
  clock_out_address: string | null;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_location_timestamp: string;
  clock_out_location_timestamp: string | null;
  clock_in_location_permission_status: string;
  clock_out_location_permission_status: string | null;
};

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function requestIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

function validLocation(input: LocationPayload | undefined): {
  latitude: number;
  longitude: number;
  timestamp: string;
} | null {
  if (!input || input.permissionStatus !== "granted") return null;
  if (typeof input.latitude !== "number" || typeof input.longitude !== "number") return null;
  if (input.latitude < -90 || input.latitude > 90) return null;
  if (input.longitude < -180 || input.longitude > 180) return null;
  const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) return null;
  return {
    latitude: input.latitude,
    longitude: input.longitude,
    timestamp: timestamp.toISOString(),
  };
}

async function reverseGeocodeAddress(latitude: number, longitude: number): Promise<string | null> {
  const token =
    process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  if (!token) return null;

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("limit", "1");
    url.searchParams.set("types", "address,poi,place,locality,neighborhood");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: Array<{ place_name?: string }> };
    const placeName = data.features?.[0]?.place_name?.trim();
    return placeName || null;
  } catch (error) {
    console.warn("[applicant-portal/attendance] reverse geocode failed", error);
    return null;
  }
}

function statusLabel(log: AttendanceLog | null | undefined) {
  if (!log) return "Not clocked in";
  return log.status === "clocked_in" ? "Clocked in" : "Clocked out";
}

async function resolveApprovedApplicant(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) return null;

  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Supabase service role not configured");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;

  const applicant = await findApplicantByUserId(supabase, data.user.id);
  if (!applicant?.id) return null;
  if (normalizeApplicantStatus(applicant.status) !== "approved") {
    return { error: NextResponse.json({ error: NOT_APPROVED_MESSAGE }, { status: 403 }) };
  }

  return { supabase, workerId: applicant.id, tenantId: applicant.tenant_id };
}

async function attendancePayload(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  workerId: string
) {
  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: todayLog, error: todayError },
    { data: activeLog, error: activeError },
    { data: recentLogs, error: recentError },
  ] = await Promise.all([
    supabase
      .from("applicant_attendance_logs")
      .select("*")
      .eq("worker_id", workerId)
      .eq("attendance_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("applicant_attendance_logs")
      .select("*")
      .eq("worker_id", workerId)
      .eq("status", "clocked_in")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("applicant_attendance_logs")
      .select("*")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (todayError) throw todayError;
  if (activeError) throw activeError;
  if (recentError) throw recentError;

  const todayEntry = (todayLog as AttendanceLog | null) ?? null;
  const active = (activeLog as AttendanceLog | null) ?? null;
  return {
    today: todayEntry,
    active,
    recent: (recentLogs as AttendanceLog[] | null) ?? [],
    currentStatus: active ? "Clocked in" : statusLabel(todayEntry),
  };
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveApprovedApplicant(req);
    if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ("error" in resolved) return resolved.error;

    return NextResponse.json(await attendancePayload(resolved.supabase, resolved.workerId));
  } catch (err) {
    console.error("[applicant-portal/attendance:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveApprovedApplicant(req);
    if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ("error" in resolved) return resolved.error;

    const ip = requestIp(req);
    if (!ip) return NextResponse.json({ error: VERIFY_FAILED_MESSAGE }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as {
      action?: "clock_in" | "clock_out";
      location?: LocationPayload;
    };
    const location = validLocation(body.location);
    if (!location) return NextResponse.json({ error: LOCATION_REQUIRED_MESSAGE }, { status: 400 });

    const activeQuery = resolved.supabase
      .from("applicant_attendance_logs")
      .select("*")
      .eq("worker_id", resolved.workerId)
      .eq("status", "clocked_in")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: activeLog, error: activeError } = await activeQuery;
    if (activeError) throw activeError;
    const active = (activeLog as AttendanceLog | null) ?? null;

    if (body.action === "clock_in") {
      if (active) return NextResponse.json({ error: "You are already clocked in." }, { status: 409 });
      const address = await reverseGeocodeAddress(location.latitude, location.longitude);

      const { error } = await resolved.supabase.from("applicant_attendance_logs").insert({
        tenant_id: resolved.tenantId,
        worker_id: resolved.workerId,
        status: "clocked_in",
        clock_in_ip: ip,
        clock_in_address: address,
        clock_in_latitude: location.latitude,
        clock_in_longitude: location.longitude,
        clock_in_location_timestamp: location.timestamp,
        clock_in_location_permission_status: "granted",
      });
      if (error) throw error;
    } else if (body.action === "clock_out") {
      if (!active) {
        return NextResponse.json({ error: "You must clock in before clocking out." }, { status: 409 });
      }

      const clockOutAt = new Date();
      const clockInAt = new Date(active.clock_in_at);
      const totalSeconds = Math.max(0, Math.round((clockOutAt.getTime() - clockInAt.getTime()) / 1000));
      const address = await reverseGeocodeAddress(location.latitude, location.longitude);
      const { error } = await resolved.supabase
        .from("applicant_attendance_logs")
        .update({
          status: "clocked_out",
          clock_out_at: clockOutAt.toISOString(),
          total_seconds: totalSeconds,
          clock_out_ip: ip,
          clock_out_address: address,
          clock_out_latitude: location.latitude,
          clock_out_longitude: location.longitude,
          clock_out_location_timestamp: location.timestamp,
          clock_out_location_permission_status: "granted",
          updated_at: clockOutAt.toISOString(),
        })
        .eq("id", active.id)
        .eq("status", "clocked_in");
      if (error) throw error;
    } else {
      return NextResponse.json({ error: "Invalid attendance action." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...(await attendancePayload(resolved.supabase, resolved.workerId)) });
  } catch (err) {
    console.error("[applicant-portal/attendance:post]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
