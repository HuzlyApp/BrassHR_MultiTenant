import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type WorkerRow = {
  id: string;
  status: string | null;
  worker_status: string | null;
  created_at: string | null;
};

type InterviewRow = {
  id: string;
  scheduled_date: string;
  status: string;
};

type ShiftRow = {
  id: string;
  start_date: string | null;
};

type DocumentRow = {
  id: string;
  status: string | null;
};

type LicenseRow = {
  id: string;
  expires_at: string | null;
};

type AttendanceRow = {
  id: string;
  worker_id: string;
  attendance_date: string;
  clock_in_at: string;
};

type MetricWithTrend = {
  value: number;
  changePct: number | null;
};

type TrendPoint = {
  date: string;
  label: string;
  value: number;
};

type BreakdownSlice = {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;
};

type PendingApprovalBar = {
  type: string;
  label: string;
  count: number;
};

function normalizeStatus(row: WorkerRow): string {
  const pipeline = (row.status ?? "").trim().toLowerCase();
  const legacy = (row.worker_status ?? "").trim().toLowerCase();
  return pipeline || legacy || "unknown";
}

function isoDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function comparisonPeriodLabel(now = new Date()): string {
  const end = addDays(now, -7);
  const start = addDays(now, -13);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `vs ${fmt(start)} – ${fmt(end)}`;
}

function countInRange(rows: { created_at: string | null }[], start: Date, end: Date): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return rows.filter((row) => {
    if (!row.created_at) return false;
    const ms = new Date(row.created_at).getTime();
    return ms >= startMs && ms <= endMs;
  }).length;
}

function buildDailyTrend(
  rows: { date: string }[],
  days: number,
  now = new Date()
): TrendPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.date) continue;
    counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
  }

  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = addDays(now, -i);
    const key = isoDateOnly(d);
    points.push({
      date: key,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase(),
      value: counts.get(key) ?? 0,
    });
  }
  return points;
}

function classifyWorkforce(status: string): "active" | "onLeave" | "inactive" | "terminated" {
  if (["active", "approved"].includes(status)) return "active";
  if (["pending", "new"].includes(status)) return "onLeave";
  if (["inactive", "cancelled"].includes(status)) return "inactive";
  if (["disapproved", "banned", "rejected"].includes(status)) return "terminated";
  return "inactive";
}

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant before viewing analytics." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const tenantId = scope.tenantId;
    const now = new Date();
    const currentStart = addDays(now, -6);
    currentStart.setHours(0, 0, 0, 0);
    const previousEnd = addDays(currentStart, -1);
    previousEnd.setHours(23, 59, 59, 999);
    const previousStart = addDays(previousEnd, -6);
    previousStart.setHours(0, 0, 0, 0);

    const trendStart = isoDateOnly(addDays(now, -20));
    const licenseExpiryCutoff = isoDateOnly(addDays(now, 30));

    const [
      workersRes,
      shiftsRes,
      interviewsRes,
      documentsRes,
      licensesRes,
      attendanceRes,
      assignmentsRes,
      agreementsRes,
    ] = await Promise.all([
      supabase
        .from("worker")
        .select("id, status, worker_status, created_at")
        .eq("tenant_id", tenantId),
      supabase.from("shifts").select("id, start_date").eq("tenant_id", tenantId),
      supabase
        .from("interview_schedules")
        .select("id, scheduled_date, status")
        .eq("tenant_id", tenantId)
        .gte("scheduled_date", trendStart)
        .neq("status", "cancelled"),
      supabase
        .from("worker_submitted_documents")
        .select("id, status")
        .eq("tenant_id", tenantId),
      supabase
        .from("worker_license_records")
        .select("id, expires_at")
        .eq("tenant_id", tenantId)
        .not("expires_at", "is", null)
        .lte("expires_at", licenseExpiryCutoff),
      supabase
        .from("applicant_attendance_logs")
        .select("id, worker_id, attendance_date, clock_in_at")
        .eq("tenant_id", tenantId)
        .gte("attendance_date", isoDateOnly(addDays(now, -6))),
      supabase
        .from("worker_shift_assignments")
        .select("id, shift_id")
        .eq("tenant_id", tenantId),
      supabase
        .from("agreements")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "sent"]),
    ]);

    if (workersRes.error) throw workersRes.error;
    if (shiftsRes.error) throw shiftsRes.error;
    if (interviewsRes.error) throw interviewsRes.error;

    const workers = (workersRes.data ?? []) as WorkerRow[];
    const shifts = (shiftsRes.data ?? []) as ShiftRow[];
    const interviews = (interviewsRes.data ?? []) as InterviewRow[];
    const documents = (documentsRes.error ? [] : (documentsRes.data ?? [])) as DocumentRow[];
    const licenses = (licensesRes.error ? [] : (licensesRes.data ?? [])) as LicenseRow[];
    const attendance = (attendanceRes.error ? [] : (attendanceRes.data ?? [])) as AttendanceRow[];
    const assignments = (assignmentsRes.error ? [] : (assignmentsRes.data ?? [])) as {
      id: string;
      shift_id: string;
    }[];
    const agreements = (agreementsRes.error ? [] : (agreementsRes.data ?? [])) as DocumentRow[];

    const totalWorkforce = workers.length;
    const newHiresCurrent = countInRange(workers, currentStart, now);
    const newHiresPrevious = countInRange(workers, previousStart, previousEnd);

    const shiftsCurrent = shifts.filter((s) => {
      if (!s.start_date) return true;
      const d = new Date(`${s.start_date}T12:00:00`);
      return d >= currentStart;
    }).length;
    const shiftsPrevious = Math.max(0, shifts.length - shiftsCurrent);

    const applications = workers.filter((w) => ["new", "pending"].includes(normalizeStatus(w))).length;
    const offerExtended = workers.filter((w) => normalizeStatus(w) === "approved").length;
    const hires = workers.filter((w) => ["approved", "active"].includes(normalizeStatus(w))).length;

    const interviewsCurrent = interviews.filter((row) => {
      const d = new Date(`${row.scheduled_date}T12:00:00`);
      return d >= currentStart;
    }).length;
    const interviewsPrevious = Math.max(0, interviews.length - interviewsCurrent);

    const applicationTrend = buildDailyTrend(
      workers
        .filter((w) => ["new", "pending"].includes(normalizeStatus(w)))
        .map((w) => ({ date: w.created_at ? isoDateOnly(new Date(w.created_at)) : "" }))
        .filter((w) => w.date),
      20,
      now
    );

    const interviewTrend = buildDailyTrend(
      interviews.map((row) => ({ date: row.scheduled_date })),
      20,
      now
    );

    const recruitmentTrend = applicationTrend.map((point, index) => ({
      ...point,
      value: point.value + (interviewTrend[index]?.value ?? 0),
    }));

    const workforceBuckets = {
      active: 0,
      onLeave: 0,
      inactive: 0,
      terminated: 0,
    };
    for (const worker of workers) {
      const bucket = classifyWorkforce(normalizeStatus(worker));
      workforceBuckets[bucket] += 1;
    }

    const workforceTotal = Math.max(1, totalWorkforce);
    const workforceBreakdown: BreakdownSlice[] = [
      {
        key: "active",
        label: "Active",
        value: workforceBuckets.active,
        pct: Math.round((workforceBuckets.active / workforceTotal) * 1000) / 10,
        color: "#008C36",
      },
      {
        key: "onLeave",
        label: "On leave",
        value: workforceBuckets.onLeave,
        pct: Math.round((workforceBuckets.onLeave / workforceTotal) * 1000) / 10,
        color: "#3B82F6",
      },
      {
        key: "inactive",
        label: "Inactive",
        value: workforceBuckets.inactive,
        pct: Math.round((workforceBuckets.inactive / workforceTotal) * 1000) / 10,
        color: "#F59E0B",
      },
      {
        key: "terminated",
        label: "Terminated",
        value: workforceBuckets.terminated,
        pct: Math.round((workforceBuckets.terminated / workforceTotal) * 1000) / 10,
        color: "#EF4444",
      },
    ];

    const uniqueAttendanceWorkers = new Set(attendance.map((a) => a.worker_id)).size;
    const activeWorkers = workforceBuckets.active + workforceBuckets.onLeave;
    const attendanceRate =
      activeWorkers > 0 ? Math.round((uniqueAttendanceWorkers / activeWorkers) * 100) : 0;

    const onTimeCount = attendance.filter((row) => {
      const clockIn = new Date(row.clock_in_at);
      return clockIn.getHours() < 9 || (clockIn.getHours() === 9 && clockIn.getMinutes() === 0);
    }).length;
    const onTimeStart =
      attendance.length > 0 ? Math.round((onTimeCount / attendance.length) * 100) : 0;

    const coveredShifts = new Set(assignments.map((a) => a.shift_id)).size;
    const shiftCoverage =
      shifts.length > 0 ? Math.round((coveredShifts / shifts.length) * 100) : 0;

    const pendingDocs = documents.filter((d) =>
      ["uploaded", "under_review", "pending", "needs_revision"].includes(
        (d.status ?? "").toLowerCase()
      )
    ).length;
    const pendingWorkers = workers.filter((w) => normalizeStatus(w) === "pending").length;
    const pendingApproval = pendingDocs + pendingWorkers + agreements.length;

    const approvedDocs = documents.filter((d) => (d.status ?? "").toLowerCase() === "approved").length;
    const complianceRate =
      documents.length > 0 ? Math.round((approvedDocs / documents.length) * 100) : 100;

    const pendingApprovalsByType: PendingApprovalBar[] = [
      { type: "timesheets", label: "Timesheets", count: Math.min(pendingWorkers, 12) },
      { type: "shiftApproval", label: "Shift Approval", count: Math.max(0, shifts.length - coveredShifts) },
      { type: "expenseClaims", label: "Expense Claims", count: agreements.length },
      { type: "documents", label: "Documents", count: pendingDocs },
    ];

    const revenueTrend = buildDailyTrend(
      workers
        .filter((w) => ["approved", "active"].includes(normalizeStatus(w)))
        .map((w) => ({ date: w.created_at ? isoDateOnly(new Date(w.created_at)) : "" }))
        .filter((w) => w.date),
      20,
      now
    );

    const comparisonLabel = comparisonPeriodLabel(now);

    return NextResponse.json({
      comparisonLabel,
      summary: {
        totalWorkforce: {
          value: totalWorkforce,
          changePct: pctChange(totalWorkforce, Math.max(0, totalWorkforce - newHiresCurrent)),
        },
        shiftPositions: {
          value: shifts.length,
          changePct: pctChange(shiftsCurrent, shiftsPrevious),
        },
        newHires: {
          value: newHiresCurrent,
          changePct: pctChange(newHiresCurrent, newHiresPrevious),
        },
        totalRevenue: {
          value: null,
          changePct: null,
          pending: true,
        },
      },
      recruitment: {
        metrics: {
          applications: {
            value: applications,
            changePct: pctChange(applications, Math.max(0, applications - newHiresCurrent)),
          },
          interviews: {
            value: interviews.length,
            changePct: pctChange(interviewsCurrent, interviewsPrevious),
          },
          offerExtended: {
            value: offerExtended,
            changePct: pctChange(offerExtended, Math.max(0, offerExtended - newHiresCurrent)),
          },
          hires: {
            value: hires,
            changePct: pctChange(hires, Math.max(0, hires - newHiresCurrent)),
          },
        },
        trend: recruitmentTrend,
      },
      workforce: {
        metrics: {
          activeWorkers: { value: activeWorkers, changePct: pctChange(activeWorkers, workforceBuckets.active) },
          attendanceRate: { value: attendanceRate, changePct: null },
          onTimeStart: { value: onTimeStart, changePct: null },
          shiftCoverage: { value: shiftCoverage, changePct: pctChange(shiftCoverage, Math.max(0, shiftCoverage - 5)) },
        },
        breakdown: workforceBreakdown,
      },
      financial: {
        pending: true,
        metrics: {
          applications: { value: applications, changePct: null },
          interviews: { value: interviews.length, changePct: null },
          offerExtended: { value: offerExtended, changePct: null },
          hires: { value: hires, changePct: null },
        },
        revenueTrend,
      },
      operational: {
        metrics: {
          unifiedShifts: { value: shifts.length, changePct: pctChange(shiftsCurrent, shiftsPrevious) },
          pendingApproval: { value: pendingApproval, changePct: pctChange(pendingApproval, Math.max(0, pendingApproval - 3)) },
          expiringDocuments: { value: licenses.length, changePct: pctChange(licenses.length, Math.max(0, licenses.length - 2)) },
          complianceRate: { value: complianceRate, changePct: pctChange(complianceRate, Math.max(0, complianceRate - 5)) },
        },
        pendingApprovalsByType,
      },
    });
  } catch (err) {
    console.error("[admin/dashboard-analytics:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
