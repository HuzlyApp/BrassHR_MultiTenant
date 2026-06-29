import { NextRequest, NextResponse } from "next/server";
import { getCachedStaffApiSession, getCachedStaffTenantScope } from "@/lib/auth/cached-staff-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadFacilitiesForTenant } from "@/lib/facilities/facility-management-service";
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache } from "@/lib/cache";
import { createPerfTimer, logPerf } from "@/lib/perf";
import {
  applicantDisplayName,
  interviewOrdinalTitle,
} from "@/lib/interviews/format";
import { localDateString, localTimeString, scheduleRowToIso } from "@/lib/interviews/schedule-fields";

export const runtime = "nodejs";

type InterviewScheduleRow = {
  id: string;
  applicant_id: string;
  worker_id: string | null;
  title: string | null;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
};

type ShiftRow = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  facility_id: string | null;
};

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  status: string | null;
  created_at: string | null;
};

function parseDateParam(value: string | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return localDateString(new Date());
}

function formatTime12h(time: string): string {
  const normalized = time.length === 5 ? `${time}:00` : time;
  const date = new Date(`1970-01-01T${normalized}`);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatShiftTimeRange(title: string | null): string {
  const t = (title ?? "").toLowerCase();
  if (t.includes("night")) return "7pm - 11pm";
  if (t.includes("morning")) return "7am - 3pm";
  if (t.includes("mid")) return "11am - 7pm";
  return "8am - 5pm";
}

function formatHumanDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatWeekdayDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function relativeTimeLabel(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function daysUntilLabel(iso: string | null): string {
  if (!iso) return "—";
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = target.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  if (diff > 0) return `${formatted} (In ${diff} day${diff === 1 ? "" : "s"})`;
  if (diff === 0) return `${formatted} (Today)`;
  return formatted;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export async function GET(req: NextRequest) {
  const routeTimer = createPerfTimer();
  try {
    const auth = await getCachedStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await getCachedStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant before viewing the dashboard." }, { status: 400 });
    }

    const selectedDate = parseDateParam(req.nextUrl.searchParams.get("date"));
    const cacheKey = buildCacheKey("dashboard_overview", ["tenant", scope.tenantId], {
      date: selectedDate,
    });

    const payload = await getOrSetCache(
      cacheKey,
      async () => buildDashboardOverviewPayload(scope.tenantId, selectedDate, auth.userId),
      CACHE_TTL_SECONDS.dashboards,
    );

    logPerf("GET /api/admin/dashboard-overview", {
      totalMs: routeTimer.elapsedMs(),
      tenantId: scope.tenantId,
      date: selectedDate,
    });
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[admin/dashboard-overview:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function buildDashboardOverviewPayload(tenantId: string, selectedDate: string, userId: string) {
    const supabase = createServiceRoleClient();
    if (!supabase) {
      throw new Error("Supabase service role not configured");
    }

    const todayKey = localDateString(new Date());

    const [
      profileRes,
      scheduleRes,
      notificationsRes,
      shiftsRes,
      workersRes,
      facilitiesData,
    ] = await Promise.all([
      supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("interview_schedules")
        .select(
          "id, applicant_id, worker_id, title, description, scheduled_date, start_time, end_time, status"
        )
        .eq("tenant_id", tenantId)
        .eq("scheduled_date", selectedDate)
        .neq("status", "cancelled")
        .order("start_time", { ascending: true })
        .limit(20),
      supabase
        .from("notifications")
        .select("id, title, body, sent_at, is_read")
        .eq("user_id", userId)
        .order("sent_at", { ascending: false })
        .limit(6),
      supabase
        .from("shifts")
        .select("id, title, start_date, end_date, facility_id")
        .eq("tenant_id", tenantId)
        .gte("start_date", todayKey)
        .order("start_date", { ascending: true })
        .limit(8),
      supabase
        .from("worker")
        .select("id, first_name, last_name, job_role, status, created_at")
        .eq("tenant_id", tenantId)
        .in("status", ["new", "approved", "pending", "New", "Approved", "Pending"])
        .order("created_at", { ascending: false })
        .limit(6),
      loadFacilitiesForTenant(supabase, tenantId),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (scheduleRes.error) throw scheduleRes.error;
    if (notificationsRes.error) throw notificationsRes.error;
    if (shiftsRes.error) throw shiftsRes.error;
    if (workersRes.error) throw workersRes.error;

    const schedules = (scheduleRes.data ?? []) as InterviewScheduleRow[];
    const workerIds = Array.from(
      new Set(schedules.map((row) => row.worker_id).filter((id): id is string => Boolean(id)))
    );

    const { data: workerRows } = workerIds.length
      ? await supabase
          .from("worker")
          .select("id, first_name, last_name, job_role")
          .in("id", workerIds)
      : { data: [] };

    const workersById = new Map(
      ((workerRows ?? []) as WorkerRow[]).map((worker) => [worker.id, worker])
    );

    const interviews = schedules.map((row, index) => {
      const worker = row.worker_id ? workersById.get(row.worker_id) : undefined;
      const name = worker
        ? applicantDisplayName(worker.first_name, worker.last_name)
        : "Applicant";
      const title = row.title?.trim() || interviewOrdinalTitle(index + 1);
      const { startsAt } = scheduleRowToIso(row.scheduled_date, row.start_time, row.end_time);
      return {
        id: row.id,
        time: formatTime12h(row.start_time),
        label: "Interview",
        description: row.description?.trim() || `${title} with ${name}`,
        startsAt,
      };
    });

    const meetings = (notificationsRes.data ?? [])
      .filter((item) => {
        if (!item.sent_at) return false;
        const sentKey = localDateString(new Date(item.sent_at));
        return sentKey === selectedDate;
      })
      .map((item) => ({
        id: `meeting-${item.id}`,
        time: item.sent_at
          ? formatTime12h(localTimeString(new Date(item.sent_at)))
          : "—",
        label: "Meeting",
        description: item.body?.trim() || item.title?.trim() || "Scheduled item",
        startsAt: item.sent_at,
      }));

    const shiftRows = (shiftsRes.data ?? []) as ShiftRow[];
    const shiftIds = shiftRows.map((row) => row.id);
    const facilityIds = Array.from(
      new Set(shiftRows.map((row) => row.facility_id).filter((id): id is string => Boolean(id)))
    );

    const [{ data: assignmentRows }, { data: facilityRows }] = await Promise.all([
      shiftIds.length
        ? supabase
            .from("worker_shift_assignments")
            .select("shift_id, worker_id")
            .eq("tenant_id", tenantId)
            .in("shift_id", shiftIds)
        : Promise.resolve({ data: [] }),
      facilityIds.length
        ? supabase.from("facility").select("id, name, address").in("id", facilityIds)
        : Promise.resolve({ data: [] }),
    ]);

    const workerCountByShift = new Map<string, number>();
    for (const assignment of assignmentRows ?? []) {
      const shiftId = String(assignment.shift_id);
      workerCountByShift.set(shiftId, (workerCountByShift.get(shiftId) ?? 0) + 1);
    }

    const facilityById = new Map(
      (facilityRows ?? []).map((facility) => [
        String(facility.id),
        {
          name: String(facility.name ?? "Facility"),
          address: String(facility.address ?? "—"),
        },
      ])
    );

    const shifts = shiftRows.map((row) => {
      const facility = row.facility_id ? facilityById.get(String(row.facility_id)) : null;
      return {
        id: row.id,
        date: row.start_date ? formatHumanDate(row.start_date) : "—",
        timeRange: formatShiftTimeRange(row.title),
        facilityAddress: facility?.address ?? "—",
        workerCount: workerCountByShift.get(row.id) ?? 0,
        managerName: "—",
      };
    });

    const onboardHires = ((workersRes.data ?? []) as WorkerRow[]).map((worker) => ({
      id: worker.id,
      name: applicantDisplayName(worker.first_name, worker.last_name),
      role: worker.job_role?.trim() || "Worker",
      startLabel: daysUntilLabel(worker.created_at),
      status: (worker.status ?? "new").toLowerCase(),
    }));

    const facilityWorkers = facilitiesData.facilities
      .filter((facility) => facility.assignedCount > 0)
      .slice(0, 6)
      .map((facility) => ({
        id: facility.id,
        name: facility.name,
        address: facility.address ?? "—",
        workerCount: facility.assignedCount,
      }));

    const profileName =
      [profileRes.data?.first_name, profileRes.data?.last_name].filter(Boolean).join(" ").trim() ||
      "there";

    const todos = (notificationsRes.data ?? []).map((item) => ({
      id: String(item.id),
      title: item.title?.trim() || "Update",
      description: item.body?.trim() || "Check this item",
      agoLabel: relativeTimeLabel(item.sent_at),
      isRead: Boolean(item.is_read),
    }));

    return {
      greeting: greetingForHour(new Date().getHours()),
      userName: profileName,
      selectedDate,
      selectedDateLabel: formatWeekdayDate(selectedDate),
      schedule: {
        meetings,
        interviews,
        meetingCount: meetings.length,
        interviewCount: interviews.length,
      },
      todos,
      shifts,
      onboardHires,
      facilityWorkers,
    };
}
