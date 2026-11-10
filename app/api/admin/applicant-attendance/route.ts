import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildClockInRows,
  clockInMetrics,
  type ClockInAttendanceLog,
  type ClockInRow,
  type ClockInScheduleShift,
} from "@/lib/attendance/clock-ins";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { addEasternDays, easternDateString, startOfEasternWeek } from "@/lib/datetime/eastern";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";
import { syncAttendanceDayToTimesheet } from "@/lib/timesheets/sync-from-attendance";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { getApplicationAppliedJobsByWorker } from "@/lib/workers/worker-application-job-titles";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_OPTIONS = ["On Shift", "Not Clocked In", "On Break", "Completed"] as const;

type NamedRow = { id: string; name: string | null };

type EmploymentWorker = {
  id: string;
  candidate_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_role: string | null;
};

type CandidateWorker = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_role: string | null;
};

type ScheduleShiftRow = {
  id: string;
  worker_id: string;
  facility_id: string | null;
  department_id: string | null;
  work_date: string;
  start_time: string;
  end_time: string;
};

type AttendanceLogRow = {
  id: string;
  worker_id: string;
  attendance_date: string;
  status: "clocked_in" | "clocked_out";
  clock_in_at: string;
  clock_out_at: string | null;
  total_seconds: number | null;
  break_started_at?: string | null;
  break_seconds?: number | null;
  clock_in_latitude?: number | null;
  clock_in_longitude?: number | null;
  clock_in_address?: string | null;
  clock_out_address?: string | null;
  claimed_at?: string | null;
};

function currentEasternWeek(): { start: string; end: string } {
  const weekStart = startOfEasternWeek(new Date());
  return {
    start: easternDateString(weekStart),
    end: easternDateString(addEasternDays(weekStart, 6)),
  };
}

function parseDateParam(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return DATE_RE.test(trimmed) ? trimmed : null;
}

function personName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].filter(Boolean).join(" ").trim();
}

async function supportsClaimTracking(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.from("applicant_attendance_logs").select("claimed_at").limit(0);
  if (!error) return true;
  if (error.message.toLowerCase().includes("claimed_at")) return false;
  throw error;
}

function matchesText(row: ClockInRow, search: string): boolean {
  if (!search) return true;
  const haystack = [row.applicant_name, row.applicant_email, row.job_role, row.facility_name, row.department_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const url = req.nextUrl;
    const fallbackWeek = currentEasternWeek();
    const start = parseDateParam(url.searchParams.get("start")) ?? fallbackWeek.start;
    const end = parseDateParam(url.searchParams.get("end")) ?? fallbackWeek.end;
    if (start > end) {
      return NextResponse.json({ error: "Start date must be on or before end date." }, { status: 400 });
    }

    const search = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const facilityFilter = url.searchParams.get("facility")?.trim() ?? "";
    const departmentFilter = url.searchParams.get("department")?.trim() ?? "";
    const statusParam = url.searchParams.get("status")?.trim() ?? "";
    const tenantId = scope.mode === "scoped" ? scope.tenantId : null;

    let shiftQuery = supabase
      .from("employee_schedule_shifts")
      .select("id, worker_id, facility_id, department_id, work_date, start_time, end_time")
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(1000);
    let logQuery = supabase
      .from("applicant_attendance_logs")
      .select(
        "id, worker_id, attendance_date, status, clock_in_at, clock_out_at, total_seconds, break_started_at, break_seconds, clock_in_latitude, clock_in_longitude, clock_in_address, clock_out_address, claimed_at"
      )
      .gte("attendance_date", start)
      .lte("attendance_date", end)
      .order("clock_in_at", { ascending: false })
      .limit(1000);
    let facilityQuery = supabase.from("facility").select("id, name").order("name", { ascending: true });
    let departmentQuery = supabase.from("departments").select("id, name").order("name", { ascending: true });

    if (tenantId) {
      shiftQuery = shiftQuery.eq("tenant_id", tenantId);
      logQuery = logQuery.eq("tenant_id", tenantId);
      facilityQuery = facilityQuery.eq("tenant_id", tenantId);
      departmentQuery = departmentQuery.eq("tenant_id", tenantId);
    }

    const [shiftRes, logRes, facilityRes, departmentRes] = await Promise.all([
      shiftQuery,
      logQuery,
      facilityQuery,
      departmentQuery,
    ]);
    if (shiftRes.error) throw shiftRes.error;
    if (logRes.error) throw logRes.error;
    if (facilityRes.error) throw facilityRes.error;
    if (departmentRes.error) throw departmentRes.error;

    const shiftRows = (shiftRes.data ?? []) as ScheduleShiftRow[];
    const logRows = (logRes.data ?? []) as AttendanceLogRow[];
    const facilities = ((facilityRes.data ?? []) as NamedRow[])
      .map((row) => ({ id: row.id, name: row.name?.trim() || "" }))
      .filter((row) => row.name);
    const departments = ((departmentRes.data ?? []) as NamedRow[])
      .map((row) => ({ id: row.id, name: row.name?.trim() || "" }))
      .filter((row) => row.name);

    const facilityById = new Map(facilities.map((row) => [row.id, row.name]));
    const departmentById = new Map(departments.map((row) => [row.id, row.name]));

    const employmentIds = shiftRows.map((row) => row.worker_id);
    const candidateIdsFromLogs = logRows.map((row) => row.worker_id);

    const [employmentRes, employmentByCandidateRes, candidateRes] = await Promise.all([
      queryInChunks<EmploymentWorker>(employmentIds, (chunk) =>
        supabase
          .from("workers")
          .select("id, candidate_id, first_name, last_name, email, job_role")
          .in("id", chunk)
      ),
      queryInChunks<EmploymentWorker>(candidateIdsFromLogs, (chunk) =>
        supabase
          .from("workers")
          .select("id, candidate_id, first_name, last_name, email, job_role")
          .in("candidate_id", chunk)
      ),
      queryInChunks<CandidateWorker>(candidateIdsFromLogs, (chunk) =>
        supabase.from("worker").select("id, first_name, last_name, email, job_role").in("id", chunk)
      ),
    ]);
    if (employmentRes.error) throw employmentRes.error;
    if (employmentByCandidateRes.error) throw employmentByCandidateRes.error;
    if (candidateRes.error) throw candidateRes.error;

    const employmentById = new Map<string, EmploymentWorker>();
    const employmentByCandidate = new Map<string, EmploymentWorker>();
    for (const worker of [...employmentRes.data, ...employmentByCandidateRes.data]) {
      employmentById.set(worker.id, worker);
      if (worker.candidate_id) employmentByCandidate.set(worker.candidate_id, worker);
    }
    const candidateById = new Map(candidateRes.data.map((worker) => [worker.id, worker]));

    const candidateIds = Array.from(
      new Set(
        [
          ...shiftRows.map((row) => employmentById.get(row.worker_id)?.candidate_id ?? ""),
          ...candidateIdsFromLogs,
        ].filter(Boolean)
      )
    );
    const appliedJobs = await getApplicationAppliedJobsByWorker(supabase, {
      tenantId,
      workerIds: candidateIds,
    });

    const shifts: ClockInScheduleShift[] = shiftRows.map((row) => {
      const employee = employmentById.get(row.worker_id);
      const candidateId = employee?.candidate_id ?? null;
      const candidate = candidateId ? candidateById.get(candidateId) : undefined;
      const applied = candidateId ? appliedJobs.get(candidateId)?.[0] : undefined;
      return {
        id: row.id,
        workerId: row.worker_id,
        candidateId,
        workDate: row.work_date,
        startTime: row.start_time,
        endTime: row.end_time,
        facilityName: row.facility_id ? (facilityById.get(row.facility_id) ?? null) : null,
        departmentName: row.department_id ? (departmentById.get(row.department_id) ?? null) : null,
        employeeName:
          personName(employee?.first_name, employee?.last_name) ||
          personName(candidate?.first_name, candidate?.last_name) ||
          "Worker",
        email: employee?.email ?? candidate?.email ?? null,
        jobRole: employee?.job_role?.trim() || candidate?.job_role?.trim() || applied?.title?.trim() || null,
        jobRequisitionId: applied?.jobId?.trim() || null,
      };
    });

    const logs: ClockInAttendanceLog[] = logRows.map((row) => {
      const employee = employmentByCandidate.get(row.worker_id);
      const candidate = candidateById.get(row.worker_id);
      const applied = appliedJobs.get(row.worker_id)?.[0];
      return {
        id: row.id,
        workerId: row.worker_id,
        attendanceDate: row.attendance_date,
        status: row.status,
        clockInAt: row.clock_in_at,
        clockOutAt: row.clock_out_at,
        totalSeconds: row.total_seconds,
        breakStartedAt: row.break_started_at ?? null,
        breakSeconds: row.break_seconds ?? null,
        clockInLatitude: row.clock_in_latitude ?? null,
        clockInLongitude: row.clock_in_longitude ?? null,
        clockInAddress: row.clock_in_address ?? null,
        clockOutAddress: row.clock_out_address ?? null,
        claimedAt: row.claimed_at ?? null,
        employeeName:
          personName(employee?.first_name, employee?.last_name) ||
          personName(candidate?.first_name, candidate?.last_name) ||
          "Worker",
        email: employee?.email ?? candidate?.email ?? null,
        jobRole: employee?.job_role?.trim() || candidate?.job_role?.trim() || applied?.title?.trim() || null,
        jobRequisitionId: applied?.jobId?.trim() || null,
      };
    });

    const merged = buildClockInRows(shifts, logs);
    const scopedRows = merged.filter((row) => {
      if (!matchesText(row, search)) return false;
      if (facilityFilter && facilityFilter !== "all" && row.facility_name !== facilityFilter) return false;
      if (departmentFilter && departmentFilter !== "all" && row.department_name !== departmentFilter) return false;
      return true;
    });
    const metrics = clockInMetrics(scopedRows);
    const visibleRows =
      statusParam && statusParam !== "all"
        ? scopedRows.filter((row) => row.computed_status.toLowerCase() === statusParam.toLowerCase())
        : scopedRows;

    const departmentOptions = Array.from(
      new Set([
        ...departments.map((row) => row.name),
        ...merged.map((row) => row.department_name?.trim() || ""),
      ].filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    const facilityOptions = Array.from(
      new Set([
        ...facilities.map((row) => row.name),
        ...merged.map((row) => row.facility_name?.trim() || ""),
      ].filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      logs: visibleRows,
      range: { start, end },
      metrics,
      filterOptions: {
        facilities: facilityOptions,
        departments: departmentOptions,
        statuses: [...STATUS_OPTIONS],
      },
    });
  } catch (err) {
    console.error("[admin/applicant-attendance:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const claimTrackingEnabled = await supportsClaimTracking(supabase);
    if (!claimTrackingEnabled) {
      return NextResponse.json(
        {
          error:
            "Claim tracking is not enabled yet. Run the attendance claim migration in Supabase SQL editor.",
        },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      action?: "claim";
    };

    if (body.action !== "claim") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const idCheck = parseRequiredUuid(body.id?.trim() ?? "", "id");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    let lookup = supabase
      .from("applicant_attendance_logs")
      .select("id, tenant_id, worker_id, attendance_date, status, claimed_at")
      .eq("id", idCheck.value);

    if (scope.mode === "scoped") lookup = lookup.eq("tenant_id", scope.tenantId);

    const { data: existing, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
    if (existing.status !== "clocked_out") {
      return NextResponse.json({ error: "Only completed records can be claimed." }, { status: 409 });
    }
    if (existing.claimed_at) {
      return NextResponse.json({ error: "This record is already claimed." }, { status: 409 });
    }

    const claimedAt = new Date().toISOString();
    let update = supabase
      .from("applicant_attendance_logs")
      .update({
        claimed_at: claimedAt,
        claimed_by: auth.authUser.id,
        updated_at: claimedAt,
      })
      .eq("id", idCheck.value);

    if (scope.mode === "scoped") update = update.eq("tenant_id", scope.tenantId);

    const { error: updateError } = await update;
    if (updateError) throw updateError;

    try {
      await syncAttendanceDayToTimesheet(supabase, {
        tenantId: existing.tenant_id,
        applicantWorkerId: existing.worker_id,
        attendanceDate: existing.attendance_date,
      });
    } catch (syncError) {
      console.warn("[admin/applicant-attendance] timesheet sync after claim failed", syncError);
    }

    return NextResponse.json({ ok: true, claimedAt });
  } catch (err) {
    console.error("[admin/applicant-attendance:patch]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
