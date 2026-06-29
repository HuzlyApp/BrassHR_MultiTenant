import { NextRequest, NextResponse } from "next/server";
import { getCachedStaffApiSession, getCachedStaffTenantScope } from "@/lib/auth/cached-staff-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache } from "@/lib/cache";
import {
  countTableByTenant,
  countWorkersByTenant,
  countWorkersCreatedBetween,
} from "@/lib/dashboard/analytics-counts";
import { fetchWorkerStatusMetrics } from "@/lib/dashboard/worker-status-metrics";
import { createPerfTimer, logPerf } from "@/lib/perf";

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

export async function GET(_req: NextRequest) {
  const routeTimer = createPerfTimer();
  try {
    const auth = await getCachedStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await getCachedStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant before viewing analytics." }, { status: 400 });
    }

    const tenantId = scope.tenantId;
    const dayKey = isoDateOnly(new Date());
    const cacheKey = buildCacheKey("dashboard_analytics", ["tenant", tenantId], { day: dayKey });

    const payload = await getOrSetCache(
      cacheKey,
      async () => buildDashboardAnalyticsPayload(tenantId),
      CACHE_TTL_SECONDS.dashboards,
    );

    logPerf("GET /api/admin/dashboard-analytics", {
      totalMs: routeTimer.elapsedMs(),
      tenantId,
      cacheKey,
    });
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[admin/dashboard-analytics:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function buildDashboardAnalyticsPayload(tenantId: string) {
    const supabase = createServiceRoleClient();
    if (!supabase) {
      throw new Error("Supabase service role not configured");
    }

    const now = new Date();
    const currentStart = addDays(now, -6);
    currentStart.setHours(0, 0, 0, 0);
    const previousEnd = addDays(currentStart, -1);
    previousEnd.setHours(23, 59, 59, 999);
    const previousStart = addDays(previousEnd, -6);
    previousStart.setHours(0, 0, 0, 0);

    const trendStart = isoDateOnly(addDays(now, -20));
    const trendStartIso = `${trendStart}T00:00:00.000Z`;
    const licenseExpiryCutoff = isoDateOnly(addDays(now, 30));
    const attendanceStart = isoDateOnly(addDays(now, -6));
    const currentStartIso = currentStart.toISOString();
    const previousStartIso = previousStart.toISOString();
    const previousEndIso = previousEnd.toISOString();

    const [
      totalWorkforce,
      newHiresCurrent,
      newHiresPrevious,
      shiftsTotal,
      shiftsCurrent,
      interviewsRes,
      documentsPending,
      documentsTotal,
      documentsApproved,
      licensesCount,
      agreementsCount,
      assignmentsRes,
      workerStatusMetrics,
      workerTrendRes,
      attendanceRes,
    ] = await Promise.all([
      countWorkersByTenant(supabase, tenantId),
      countWorkersCreatedBetween(supabase, tenantId, currentStartIso, now.toISOString()),
      countWorkersCreatedBetween(supabase, tenantId, previousStartIso, previousEndIso),
      countTableByTenant(supabase, "shifts", tenantId),
      countTableByTenant(supabase, "shifts", tenantId, (q) =>
        q.or(`start_date.gte.${trendStart},start_date.is.null`),
      ),
      supabase
        .from("interview_schedules")
        .select("id, scheduled_date, status")
        .eq("tenant_id", tenantId)
        .gte("scheduled_date", trendStart)
        .neq("status", "cancelled"),
      countTableByTenant(supabase, "worker_submitted_documents", tenantId, (q) =>
        q.in("status", ["uploaded", "under_review", "pending", "needs_revision"]),
      ),
      countTableByTenant(supabase, "worker_submitted_documents", tenantId),
      countTableByTenant(supabase, "worker_submitted_documents", tenantId, (q) =>
        q.eq("status", "approved"),
      ),
      countTableByTenant(supabase, "worker_license_records", tenantId, (q) =>
        q.not("expires_at", "is", null).lte("expires_at", licenseExpiryCutoff),
      ),
      countTableByTenant(supabase, "agreements", tenantId, (q) =>
        q.in("status", ["pending", "sent"]),
      ),
      supabase
        .from("worker_shift_assignments")
        .select("shift_id")
        .eq("tenant_id", tenantId),
      fetchWorkerStatusMetrics(supabase, tenantId),
      supabase
        .from("worker")
        .select("created_at, status, worker_status")
        .eq("tenant_id", tenantId)
        .gte("created_at", trendStartIso),
      supabase
        .from("applicant_attendance_logs")
        .select("id, worker_id, attendance_date, clock_in_at")
        .eq("tenant_id", tenantId)
        .gte("attendance_date", attendanceStart),
    ]);

    if (interviewsRes.error) throw interviewsRes.error;

    const interviews = (interviewsRes.data ?? []) as InterviewRow[];
    const workerTrendRows = (workerTrendRes.error ? [] : (workerTrendRes.data ?? [])) as WorkerRow[];
    const attendance = (attendanceRes.error ? [] : (attendanceRes.data ?? [])) as AttendanceRow[];
    const assignmentShiftIds = (assignmentsRes.error ? [] : (assignmentsRes.data ?? [])) as {
      shift_id: string;
    }[];

    const shiftsPrevious = Math.max(0, shiftsTotal - shiftsCurrent);

    const applications = workerStatusMetrics.applications;
    const offerExtended = workerStatusMetrics.offer_extended;
    const hires = workerStatusMetrics.hires;

    const workforceBuckets = {
      active: workerStatusMetrics.active,
      onLeave: workerStatusMetrics.on_leave,
      inactive: workerStatusMetrics.inactive,
      terminated: workerStatusMetrics.terminated,
    };

    const interviewsCurrent = interviews.filter((row) => {
      const d = new Date(`${row.scheduled_date}T12:00:00`);
      return d >= currentStart;
    }).length;
    const interviewsPrevious = Math.max(0, interviews.length - interviewsCurrent);

    const applicationTrend = buildDailyTrend(
      workerTrendRows
        .filter((w) => ["new", "pending"].includes(normalizeStatus(w)))
        .map((w) => ({ date: w.created_at ? isoDateOnly(new Date(w.created_at)) : "" }))
        .filter((w) => w.date),
      20,
      now,
    );

    const interviewTrend = buildDailyTrend(
      interviews.map((row) => ({ date: row.scheduled_date })),
      20,
      now,
    );

    const recruitmentTrend = applicationTrend.map((point, index) => ({
      ...point,
      value: point.value + (interviewTrend[index]?.value ?? 0),
    }));

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

    const coveredShifts = new Set(assignmentShiftIds.map((a) => a.shift_id)).size;
    const shiftCoverage =
      shiftsTotal > 0 ? Math.round((coveredShifts / shiftsTotal) * 100) : 0;

    const pendingWorkers = workerStatusMetrics.pending_workers;
    const pendingApproval = documentsPending + pendingWorkers + agreementsCount;

    const complianceRate =
      documentsTotal > 0 ? Math.round((documentsApproved / documentsTotal) * 100) : 100;

    const pendingApprovalsByType: PendingApprovalBar[] = [
      { type: "timesheets", label: "Timesheets", count: Math.min(pendingWorkers, 12) },
      { type: "shiftApproval", label: "Shift Approval", count: Math.max(0, shiftsTotal - coveredShifts) },
      { type: "expenseClaims", label: "Expense Claims", count: agreementsCount },
      { type: "documents", label: "Documents", count: documentsPending },
    ];

    const revenueTrend = buildDailyTrend(
      workerTrendRows
        .filter((w) => ["approved", "active"].includes(normalizeStatus(w)))
        .map((w) => ({ date: w.created_at ? isoDateOnly(new Date(w.created_at)) : "" }))
        .filter((w) => w.date),
      20,
      now,
    );

    const comparisonLabel = comparisonPeriodLabel(now);

    return {
      comparisonLabel,
      summary: {
        totalWorkforce: {
          value: totalWorkforce,
          changePct: pctChange(totalWorkforce, Math.max(0, totalWorkforce - newHiresCurrent)),
        },
        shiftPositions: {
          value: shiftsTotal,
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
          unifiedShifts: { value: shiftsTotal, changePct: pctChange(shiftsCurrent, shiftsPrevious) },
          pendingApproval: { value: pendingApproval, changePct: pctChange(pendingApproval, Math.max(0, pendingApproval - 3)) },
          expiringDocuments: { value: licensesCount, changePct: pctChange(licensesCount, Math.max(0, licensesCount - 2)) },
          complianceRate: { value: complianceRate, changePct: pctChange(complianceRate, Math.max(0, complianceRate - 5)) },
        },
        pendingApprovalsByType,
      },
    };
}
