import { describe, expect, it } from "vitest";
import { loadEmployeeTimesheets } from "./employee-timesheets";

function database(sheets: unknown[] = [{ id: "sheet-1", worker_id: "employee-1", status: "submitted" }], error: unknown = null) {
  const calls: Array<[string, string, ...unknown[]]> = [];
  const records: Record<string, unknown[]> = {
    employee_timesheet_entries: [{ id: "entry", worker_id: "employee-1", facility_id: "facility", department_id: "department", work_date: "2026-11-16", regular_minutes: 480, overtime_minutes: 0, break_minutes: 30, clock_in: "08:00", clock_out: "16:30" }],
    workers: [{ id: "employee-1", first_name: "Test", last_name: "Worker", job_role: "RN" }],
    facility: [{ id: "facility", name: "Clinic" }],
    departments: [{ id: "department", name: "Nursing" }],
    timesheets: sheets,
  };
  const supabase = { from(table: string) {
    const result = { data: records[table] ?? [], error: table === "timesheets" ? error : null };
    const chain: object = new Proxy({}, { get: (_, method: string) => method === "then"
      ? (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      : (...args: unknown[]) => { calls.push([table, method, ...args]); return chain; } });
    return chain;
  } };
  return { supabase: supabase as never, calls };
}

describe("weekly timesheet approval identity", () => {
  it("returns the weekly sheet ID separately from the employee and scopes every lookup", async () => {
    const { supabase, calls } = database();
    const result = await loadEmployeeTimesheets(supabase, "tenant-a", "2026-11-16", "2026-11-22", { page: 1, limit: 5 });
    expect(result.timesheets[0]).toMatchObject({ id: "employee-1", workerId: "employee-1", timesheetId: "sheet-1", approvalStatus: "submitted", totalHours: "8h" });
    for (const table of ["employee_timesheet_entries", "workers", "facility", "departments", "timesheets"]) {
      expect(calls).toContainEqual([table, "eq", "tenant_id", "tenant-a"]);
    }
    expect(calls).toContainEqual(["timesheets", "eq", "period_start", "2026-11-16"]);
    expect(calls).toContainEqual(["timesheets", "eq", "period_end", "2026-11-22"]);
    expect(calls).toContainEqual(["timesheets", "in", "worker_id", ["employee-1"]]);
  });
  it("never substitutes the employee ID when a period sheet is missing", async () => {
    const { supabase } = database([]);
    const result = await loadEmployeeTimesheets(supabase, "tenant-a", "2026-11-16", "2026-11-22", { page: 1, limit: 5 });
    expect(result.timesheets[0]).toMatchObject({ timesheetId: null, approvalStatus: null });
  });
  it("propagates a failed approval-status lookup rather than guessing", async () => {
    const { supabase } = database([], new Error("Database unavailable"));
    await expect(loadEmployeeTimesheets(supabase, "tenant-a", "2026-11-16", "2026-11-22", { page: 1, limit: 5 })).rejects.toThrow("Database unavailable");
  });
});
