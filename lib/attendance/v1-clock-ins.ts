import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildClockInRows,
  clockInMetrics,
  type ClockInAttendanceLog,
} from "./clock-ins";
import { easternDateString } from "@/lib/datetime/eastern";

type Employee = {
  id: string;
  candidate_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_role: string | null;
};
type Shift = {
  id: string;
  worker_id: string;
  facility_id: string | null;
  department_id: string | null;
  work_date: string;
  start_time: string;
  end_time: string;
};
type Log = {
  id: string;
  worker_id: string;
  attendance_date: string;
  status: "clocked_in" | "clocked_out";
  clock_in_at: string;
  clock_out_at: string | null;
  break_started_at: string | null;
  break_seconds: number | null;
  total_seconds: number | null;
  facility_id: string | null;
  department_id: string | null;
};
type Named = { id: string; name: string };
async function all<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await fetchPage(from, from + 999);
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) return rows;
  }
}
export async function loadClockIns(
  sb: SupabaseClient,
  tenantId: string,
  input: {
    date?: string;
    facility_id?: string;
    department_id?: string;
    worker_id?: string;
    status?: string;
    page: number;
    limit: number;
  },
) {
  const date = input.date ?? easternDateString(new Date());
  const [employees, shifts, logs, facilities, departments] = await Promise.all([
    all((from, to) =>
      sb
        .from("workers")
        .select("id,candidate_id,first_name,last_name,email,job_role")
        .eq("tenant_id", tenantId)
        .order("id")
        .range(from, to)
        .returns<Employee[]>(),
    ),
    all((from, to) =>
      sb
        .from("employee_schedule_shifts")
        .select(
          "id,worker_id,facility_id,department_id,work_date,start_time,end_time",
        )
        .eq("tenant_id", tenantId)
        .eq("work_date", date)
        .order("id")
        .range(from, to)
        .returns<Shift[]>(),
    ),
    all((from, to) => {
      let q = sb
        .from("applicant_attendance_logs")
        .select(
          "id,worker_id,attendance_date,status,clock_in_at,clock_out_at,break_started_at,break_seconds,total_seconds,facility_id,department_id",
        )
        .eq("tenant_id", tenantId);
      q =
        date === easternDateString(new Date())
          ? q.or(
              `attendance_date.eq.${date},and(status.eq.clocked_in,attendance_date.lt.${date})`,
            )
          : q.eq("attendance_date", date);
      return q.order("id").range(from, to).returns<Log[]>();
    }),
    all((from, to) =>
      sb
        .from("facility")
        .select("id,name")
        .eq("tenant_id", tenantId)
        .order("id")
        .range(from, to)
        .returns<Named[]>(),
    ),
    all((from, to) =>
      sb
        .from("departments")
        .select("id,name")
        .eq("tenant_id", tenantId)
        .order("id")
        .range(from, to)
        .returns<Named[]>(),
    ),
  ]);
  const byEmployee = new Map(employees.map((e) => [e.id, e]));
  const byCandidate = new Map(employees.map((e) => [e.candidate_id, e]));
  const f = new Map(facilities.map((r) => [r.id, r.name]));
  const d = new Map(departments.map((r) => [r.id, r.name]));
  const namedShifts = shifts
    .filter((s) => byEmployee.has(s.worker_id))
    .map((s) => {
      const e = byEmployee.get(s.worker_id)!;
      return {
        id: s.id,
        workerId: e.id,
        candidateId: e.candidate_id,
        workDate: s.work_date,
        startTime: s.start_time,
        endTime: s.end_time,
        facilityName: s.facility_id ? (f.get(s.facility_id) ?? null) : null,
        departmentName: s.department_id
          ? (d.get(s.department_id) ?? null)
          : null,
        employeeName: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
        email: e.email,
        jobRole: e.job_role,
      };
    });
  const mappedLogs: ClockInAttendanceLog[] = logs
    .filter((l) => byCandidate.has(l.worker_id))
    .map((l) => {
      const e = byCandidate.get(l.worker_id)!;
      return {
        id: l.id,
        workerId: l.worker_id,
        attendanceDate: l.attendance_date,
        status: l.status,
        clockInAt: l.clock_in_at,
        clockOutAt: l.clock_out_at,
        totalSeconds: l.total_seconds,
        breakStartedAt: l.break_started_at,
        breakSeconds: l.break_seconds,
        employeeName: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
        email: e.email,
        jobRole: e.job_role,
      };
    });
  const scope = new Map([
    ...shifts.map(
      (s) =>
        [
          s.id,
          {
            worker: s.worker_id,
            facility: s.facility_id,
            department: s.department_id,
          },
        ] as const,
    ),
    ...logs.map(
      (l) =>
        [
          l.id,
          {
            worker: byCandidate.get(l.worker_id)?.id,
            facility: l.facility_id,
            department: l.department_id,
          },
        ] as const,
    ),
  ]);
  const scoped = buildClockInRows(namedShifts, mappedLogs)
    .filter((row) => {
      const s = scope.get(row.id);
      return (
        s &&
        (!input.worker_id || s.worker === input.worker_id) &&
        (!input.facility_id || s.facility === input.facility_id) &&
        (!input.department_id || s.department === input.department_id)
      );
    })
    .map((row) => {
      const s = scope.get(row.id)!;
      return {
        ...row,
        candidate_id: row.worker_id,
        worker_id: s.worker ?? row.worker_id,
        facility_id: s.facility,
        department_id: s.department,
        facility_name: s.facility
          ? (f.get(s.facility) ?? row.facility_name)
          : row.facility_name,
        department_name: s.department
          ? (d.get(s.department) ?? row.department_name)
          : row.department_name,
      };
    });
  const records = scoped.filter(
    (row) => !input.status || row.computed_status === input.status,
  );
  return {
    records: records.slice(
      (input.page - 1) * input.limit,
      input.page * input.limit,
    ),
    summary: clockInMetrics(scoped),
    total: records.length,
    page: input.page,
    limit: input.limit,
    date,
  };
}
