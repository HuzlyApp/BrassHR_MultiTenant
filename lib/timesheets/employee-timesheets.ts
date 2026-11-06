import type { SupabaseClient } from "@supabase/supabase-js";

export type DailyHours = {
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
};

export type DayDetail = {
  day: string;
  date: string;
  hours: string;
  clockIn?: string;
  clockOut?: string;
  breaks?: string;
  status?: string;
};

export type TimesheetRow = {
  id: string;
  workerId: string;
  name: string;
  jobRole: string;
  facility: string;
  facilityId?: string | null;
  department: string;
  dailyHours: DailyHours;
  totalHours: string;
  otHours: string;
  status: "Complete" | "Incomplete" | "With OT";
  daysWorked: number;
  daysDetails: DayDetail[];
};

export type TimesheetMetrics = {
  totalHours: string;
  employees: number;
  withOvertime: number;
  incomplete: number;
};

export type TimesheetListResponse = {
  timesheets: TimesheetRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metrics: TimesheetMetrics;
  filterOptions: {
    facilities: string[];
    departments: string[];
    jobTitles: string[];
  };
};

type EntryRow = {
  id: string;
  worker_id: string;
  facility_id: string | null;
  department_id: string | null;
  work_date: string;
  regular_minutes: number;
  overtime_minutes: number;
  break_minutes: number;
  clock_in: string | null;
  clock_out: string | null;
};

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
};

type NamedRow = {
  id: string;
  name: string | null;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function emptyTimesheetList(page: number, limit: number): TimesheetListResponse {
  return {
    timesheets: [],
    total: 0,
    page,
    limit,
    totalPages: 1,
    metrics: {
      totalHours: "0h",
      employees: 0,
      withOvertime: 0,
      incomplete: 0,
    },
    filterOptions: {
      facilities: [],
      departments: [],
      jobTitles: [],
    },
  };
}

function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "0h";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function formatDayMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "—";
  return formatMinutes(total);
}

function formatClock(value: string | null): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${match[2]} ${suffix}`;
}

function isoDates(start: string, end: string): string[] {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const last = Date.UTC(endYear, endMonth - 1, endDay);
  const dates: string[] = [];
  while (cursor.getTime() <= last && dates.length < 14) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cursor.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function weekdayIndex(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatMonthDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function employeeName(row: WorkerRow | undefined, workerId: string): string {
  const name = `${row?.first_name ?? ""} ${row?.last_name ?? ""}`.trim();
  return name || `Employee ${workerId.slice(0, 8)}`;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let winner = values[0] ?? "";
  let winnerCount = 0;
  for (const [value, count] of counts) {
    if (count > winnerCount) {
      winner = value;
      winnerCount = count;
    }
  }
  return winner;
}

export async function loadEmployeeTimesheets(
  supabase: SupabaseClient,
  tenantId: string,
  startDate: string,
  endDate: string,
  options: {
    q?: string;
    facility?: string;
    department?: string;
    jobTitle?: string;
    page: number;
    limit: number;
  }
): Promise<TimesheetListResponse> {
  const { data: entryData, error: entryError } = await supabase
    .from("employee_timesheet_entries")
    .select(
      "id, worker_id, facility_id, department_id, work_date, regular_minutes, overtime_minutes, break_minutes, clock_in, clock_out"
    )
    .eq("tenant_id", tenantId)
    .gte("work_date", startDate)
    .lte("work_date", endDate)
    .order("work_date", { ascending: true });

  if (entryError) throw entryError;

  const entries = (entryData ?? []) as EntryRow[];
  if (entries.length === 0) {
    return emptyTimesheetList(options.page, options.limit);
  }

  const workerIds = [...new Set(entries.map((row) => row.worker_id))];
  const facilityIds = [...new Set(entries.map((row) => row.facility_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(entries.map((row) => row.department_id).filter(Boolean))] as string[];

  const [{ data: workerData, error: workerError }, { data: facilityData, error: facilityError }, { data: departmentData, error: departmentError }] =
    await Promise.all([
      supabase.from("workers").select("id, first_name, last_name, job_role").eq("tenant_id", tenantId).in("id", workerIds),
      facilityIds.length
        ? supabase.from("facility").select("id, name").eq("tenant_id", tenantId).in("id", facilityIds)
        : Promise.resolve({ data: [] as NamedRow[], error: null }),
      departmentIds.length
        ? supabase.from("departments").select("id, name").eq("tenant_id", tenantId).in("id", departmentIds)
        : Promise.resolve({ data: [] as NamedRow[], error: null }),
    ]);

  if (workerError) throw workerError;
  if (facilityError) throw facilityError;
  if (departmentError) throw departmentError;

  const workersById = new Map<string, WorkerRow>();
  for (const worker of (workerData ?? []) as WorkerRow[]) {
    workersById.set(worker.id, worker);
  }

  const facilityById = new Map<string, string>();
  for (const facility of (facilityData ?? []) as NamedRow[]) {
    facilityById.set(facility.id, facility.name?.trim() || "Facility");
  }

  const departmentById = new Map<string, string>();
  for (const department of (departmentData ?? []) as NamedRow[]) {
    if (department.name?.trim()) departmentById.set(department.id, department.name.trim());
  }

  const dates = isoDates(startDate, endDate);
  const byWorker = new Map<string, EntryRow[]>();
  for (const entry of entries) {
    const list = byWorker.get(entry.worker_id) ?? [];
    list.push(entry);
    byWorker.set(entry.worker_id, list);
  }

  const rows: TimesheetRow[] = [];
  for (const [workerId, workerEntries] of byWorker) {
    const worker = workersById.get(workerId);
    const jobRole = worker?.job_role?.trim() || "Employee";
    const facilityNames = workerEntries
      .map((entry) => (entry.facility_id ? facilityById.get(entry.facility_id) : null))
      .filter((name): name is string => Boolean(name));
    const departmentNames = workerEntries
      .map((entry) => (entry.department_id ? departmentById.get(entry.department_id) : null))
      .filter((name): name is string => Boolean(name));
    const facility = mostCommon(facilityNames) || "No facility";
    const facilityId = workerEntries.find((entry) => entry.facility_id && facilityById.get(entry.facility_id) === facility)?.facility_id ?? null;
    const department = mostCommon(departmentNames) || "—";

    const minutesByDay: Record<(typeof DAY_KEYS)[number], number> = {
      sun: 0,
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
    };
    const entryByDate = new Map<string, EntryRow>();
    let regularMinutes = 0;
    let overtimeMinutes = 0;
    let incomplete = false;

    for (const entry of workerEntries) {
      const worked = entry.regular_minutes + entry.overtime_minutes;
      const key = DAY_KEYS[weekdayIndex(entry.work_date)];
      minutesByDay[key] += worked;
      regularMinutes += entry.regular_minutes;
      overtimeMinutes += entry.overtime_minutes;
      if (entry.clock_in && !entry.clock_out) incomplete = true;
      entryByDate.set(entry.work_date, entry);
    }

    const status: TimesheetRow["status"] = incomplete
      ? "Incomplete"
      : overtimeMinutes > 0
        ? "With OT"
        : "Complete";

    const daysDetails: DayDetail[] = dates.map((isoDate) => {
      const entry = entryByDate.get(isoDate);
      const worked = entry ? entry.regular_minutes + entry.overtime_minutes : 0;
      const index = weekdayIndex(isoDate);
      return {
        day: DAY_LABELS[index],
        date: formatMonthDay(isoDate),
        hours: formatDayMinutes(worked),
        clockIn: formatClock(entry?.clock_in ?? null),
        clockOut: formatClock(entry?.clock_out ?? null),
        breaks: entry ? `${entry.break_minutes}m` : undefined,
        status: entry ? (entry.clock_in && !entry.clock_out ? "incomplete" : "complete") : undefined,
      };
    });

    rows.push({
      id: workerId,
      workerId,
      name: employeeName(worker, workerId),
      jobRole,
      facility,
      facilityId,
      department,
      dailyHours: {
        mon: formatDayMinutes(minutesByDay.mon),
        tue: formatDayMinutes(minutesByDay.tue),
        wed: formatDayMinutes(minutesByDay.wed),
        thu: formatDayMinutes(minutesByDay.thu),
        fri: formatDayMinutes(minutesByDay.fri),
        sat: formatDayMinutes(minutesByDay.sat),
        sun: formatDayMinutes(minutesByDay.sun),
      },
      totalHours: formatMinutes(regularMinutes + overtimeMinutes),
      otHours: formatMinutes(overtimeMinutes),
      status,
      daysWorked: daysDetails.filter((day) => day.hours !== "—").length,
      daysDetails,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const facilities = [...new Set(rows.map((row) => row.facility))].sort((a, b) => a.localeCompare(b));
  const departments = [...new Set(rows.map((row) => row.department).filter((name) => name !== "—"))].sort((a, b) =>
    a.localeCompare(b)
  );
  const jobTitles = [...new Set(rows.map((row) => row.jobRole))].sort((a, b) => a.localeCompare(b));

  const query = options.q?.trim().toLowerCase() ?? "";
  const facilityFilter = options.facility?.trim() ?? "";
  const departmentFilter = options.department?.trim() ?? "";
  const jobTitleFilter = options.jobTitle?.trim() ?? "";

  const filtered = rows.filter((row) => {
    if (
      query &&
      !row.name.toLowerCase().includes(query) &&
      !row.jobRole.toLowerCase().includes(query) &&
      !row.facility.toLowerCase().includes(query)
    ) {
      return false;
    }
    if (facilityFilter && facilityFilter !== "all" && row.facility !== facilityFilter && row.facilityId !== facilityFilter) {
      return false;
    }
    if (departmentFilter && departmentFilter !== "all" && row.department.toLowerCase() !== departmentFilter.toLowerCase()) {
      return false;
    }
    if (jobTitleFilter && jobTitleFilter !== "all" && row.jobRole.toLowerCase() !== jobTitleFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const totalMinutes = filtered.reduce((sum, row) => {
    const workerEntries = byWorker.get(row.workerId) ?? [];
    return sum + workerEntries.reduce((entrySum, entry) => entrySum + entry.regular_minutes + entry.overtime_minutes, 0);
  }, 0);

  const metrics: TimesheetMetrics = {
    totalHours: formatMinutes(totalMinutes),
    employees: filtered.length,
    withOvertime: filtered.filter((row) => {
      const workerEntries = byWorker.get(row.workerId) ?? [];
      return workerEntries.some((entry) => entry.overtime_minutes > 0);
    }).length,
    incomplete: filtered.filter((row) => row.status === "Incomplete").length,
  };

  const startIndex = (options.page - 1) * options.limit;
  const timesheets = filtered.slice(startIndex, startIndex + options.limit);

  return {
    timesheets,
    total: filtered.length,
    page: options.page,
    limit: options.limit,
    totalPages: Math.ceil(filtered.length / options.limit) || 1,
    metrics,
    filterOptions: {
      facilities,
      departments,
      jobTitles,
    },
  };
}
