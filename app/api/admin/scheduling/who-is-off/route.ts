import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const OFF_TYPES = ["Vacation", "Sick Leave", "Personal Leave", "Training", "Regular Off"] as const;

export type OffType = (typeof OFF_TYPES)[number];

export type OffRecord = {
  id: string;
  workerId: string;
  name: string;
  jobRole: string;
  facility: string;
  facilityId: string | null;
  offType: OffType;
  startDate: string;
  endDate: string;
  days: number;
};

type WorkerEmbed = {
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
};

type FacilityEmbed = {
  name: string | null;
};

type TimeOffRow = {
  id: string;
  worker_id: string;
  facility_id: string | null;
  off_type: string;
  start_date: string;
  end_date: string;
  days: number | null;
  worker: WorkerEmbed | WorkerEmbed[] | null;
  facility: FacilityEmbed | FacilityEmbed[] | null;
};

function parseDateParam(value: string | null, label: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { ok: false, error: `Missing ${label}` };
  if (!DATE_RE.test(trimmed)) return { ok: false, error: `Invalid ${label}` };
  return { ok: true, value: trimmed };
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function workerName(worker: WorkerEmbed | null): string {
  const name = `${worker?.first_name ?? ""} ${worker?.last_name ?? ""}`.trim();
  return name || "Worker";
}

function inclusiveDays(startDate: string, endDate: string, stored: number | null): number {
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) return stored;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.round((end - start) / 86_400_000) + 1;
}

function isOffType(value: string): value is OffType {
  return (OFF_TYPES as readonly string[]).includes(value);
}

function emptyPayload(page: number, limit: number) {
  return {
    records: [] as OffRecord[],
    total: 0,
    page,
    limit,
    totalPages: 1,
    facilities: [] as Array<{ id: string; name: string }>,
    offTypes: OFF_TYPES,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const facilityFilter = searchParams.get("facility")?.trim() ?? "";
    const offTypeFilter = searchParams.get("offType")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "5", 10) || 5));

    const startCheck = parseDateParam(searchParams.get("start"), "start");
    if (!startCheck.ok) {
      return NextResponse.json({ error: startCheck.error }, { status: 400 });
    }
    const endCheck = parseDateParam(searchParams.get("end"), "end");
    if (!endCheck.ok) {
      return NextResponse.json({ error: endCheck.error }, { status: 400 });
    }
    if (startCheck.value > endCheck.value) {
      return NextResponse.json({ error: "Start date must be on or before end date." }, { status: 400 });
    }

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json(emptyPayload(page, limit));
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable. Please try again later." }, { status: 503 });
    }

    let timeOffQuery = supabase
      .from("worker_time_off")
      .select(
        "id, worker_id, facility_id, off_type, start_date, end_date, days, worker!inner(first_name, last_name, job_role), facility(name)"
      )
      .eq("tenant_id", scope.tenantId)
      .lte("start_date", endCheck.value)
      .gte("end_date", startCheck.value)
      .order("start_date", { ascending: true })
      .limit(1000);

    if (facilityFilter && facilityFilter !== "all" && UUID_RE.test(facilityFilter)) {
      timeOffQuery = timeOffQuery.eq("facility_id", facilityFilter);
    }
    if (offTypeFilter && offTypeFilter !== "all" && isOffType(offTypeFilter)) {
      timeOffQuery = timeOffQuery.eq("off_type", offTypeFilter);
    }

    const [{ data: timeOffData, error: timeOffError }, { data: facilityData, error: facilityError }] =
      await Promise.all([
        timeOffQuery,
        supabase.from("facility").select("id, name").eq("tenant_id", scope.tenantId).order("name", { ascending: true }),
      ]);

    if (timeOffError) throw timeOffError;
    if (facilityError) throw facilityError;

    const facilities = (facilityData ?? []).map((facility) => ({
      id: String(facility.id),
      name: facility.name?.trim() || "Facility",
    }));

    const records = ((timeOffData ?? []) as TimeOffRow[])
      .map((row) => {
        const worker = one(row.worker);
        const facility = one(row.facility);
        const offType = isOffType(row.off_type) ? row.off_type : "Regular Off";
        const startDate = String(row.start_date).slice(0, 10);
        const endDate = String(row.end_date).slice(0, 10);
        return {
          id: String(row.id),
          workerId: String(row.worker_id),
          name: workerName(worker),
          jobRole: worker?.job_role?.trim() || "—",
          facility: facility?.name?.trim() || "—",
          facilityId: row.facility_id ? String(row.facility_id) : null,
          offType,
          startDate,
          endDate,
          days: inclusiveDays(startDate, endDate, row.days),
        } satisfies OffRecord;
      })
      .filter((record) => {
        if (!q) return true;
        return record.name.toLowerCase().includes(q) || record.jobRole.toLowerCase().includes(q);
      });

    const total = records.length;
    const startIndex = (page - 1) * limit;

    return NextResponse.json({
      records: records.slice(startIndex, startIndex + limit),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      facilities,
      offTypes: OFF_TYPES,
    });
  } catch (err) {
    console.error("[who-is-off GET]", err);
    return NextResponse.json({ error: "Failed to load time-off records." }, { status: 500 });
  }
}
