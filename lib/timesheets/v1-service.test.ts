import { describe, expect, it } from "vitest";
import {
  clockEventSchema,
  timesheetListSchema,
  timesheetReviewSchema,
} from "./v1-contract";
import {
  getPeriodTimesheet,
  listPeriodTimesheets,
  recordEmployeeClockEvent,
  transitionPeriodTimesheet,
} from "./v1-service";
import { loadClockIns } from "@/lib/attendance/v1-clock-ins";

const tenant = "10000000-0000-4000-8000-000000000001",
  employee = "10000000-0000-4000-8000-000000000002",
  actor = "10000000-0000-4000-8000-000000000003";
function db(results: Record<string, unknown> = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  return {
    calls,
    sb: {
      from: (table: string) => {
        const chain = new Proxy(
          {},
          {
            get: (_, method: string) =>
              method === "then"
                ? (resolve: (v: unknown) => unknown) =>
                    Promise.resolve(
                      results[table] ?? { data: [], error: null, count: 0 },
                    ).then(resolve)
                : (...args: unknown[]) => {
                    calls.push({ table, method, args });
                    return chain;
                  },
          },
        );
        return chain;
      },
      rpc: async (name: string, params: unknown) => {
        calls.push({ table: name, method: "rpc", args: [params] });
        return results[name] ?? { data: {}, error: null };
      },
    },
  } as { calls: typeof calls; sb: never };
}
describe("time contracts", () => {
  it("requires location permission for clock-in/out but not breaks", () => {
    expect(clockEventSchema.safeParse({ action: "clock_in" }).success).toBe(
      false,
    );
    expect(clockEventSchema.safeParse({ action: "break_start" }).success).toBe(
      true,
    );
    expect(
      clockEventSchema.safeParse({
        action: "clock_in",
        location: {
          latitude: 91,
          longitude: 1,
          permissionStatus: "granted",
          timestamp: new Date().toISOString(),
        },
      }).success,
    ).toBe(false);
  });
  it("rejects clock time/tenant injection and invalid period filters", () => {
    expect(
      clockEventSchema.safeParse({ action: "break_end", tenant_id: tenant })
        .success,
    ).toBe(false);
    expect(
      clockEventSchema.safeParse({
        action: "break_end",
        clock_in_at: "2026-01-01",
      }).success,
    ).toBe(false);
    expect(
      timesheetListSchema.safeParse({
        period_start: "2026-02-30",
        period_end: "2026-03-01",
      }).success,
    ).toBe(false);
    expect(
      timesheetListSchema.safeParse({
        period_start: "2026-11-30",
        period_end: "2026-11-01",
      }).success,
    ).toBe(false);
    expect(
      timesheetReviewSchema.safeParse({ notes: "OK", reviewed_by: actor })
        .success,
    ).toBe(false);
  });
});
describe("time service ownership and scope", () => {
  it("blocks clock impersonation before any database call", async () => {
    const { sb, calls } = db();
    await expect(
      recordEmployeeClockEvent(
        sb,
        tenant,
        actor,
        [employee],
        { action: "break_start", worker_id: actor },
        null,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });
  it("uses server tenant/actor and returns a limited clock projection", async () => {
    const { sb, calls } = db({
      record_clock_event: {
        data: {
          id: "log",
          status: "clocked_in",
          clock_in_ip: "private",
          clock_in_latitude: 10,
        },
        error: null,
      },
    });
    const result = await recordEmployeeClockEvent(
      sb,
      tenant,
      actor,
      [employee],
      { action: "break_start" },
      null,
    );
    expect(calls[0]).toMatchObject({
      table: "record_clock_event",
      args: [
        {
          p_tenant: tenant,
          p_employee: employee,
          p_actor: actor,
          p_action: "break_start",
        },
      ],
    });
    expect(result).not.toHaveProperty("clock_in_ip");
    expect(result).not.toHaveProperty("clock_in_latitude");
  });
  it("scopes detail and hides foreign/unowned records", async () => {
    const { sb, calls } = db({ timesheets: { data: null, error: null } });
    await expect(
      getPeriodTimesheet(sb, tenant, [employee], actor),
    ).rejects.toMatchObject({ status: 404 });
    expect(calls).toContainEqual({
      table: "timesheets",
      method: "eq",
      args: ["tenant_id", tenant],
    });
    expect(calls).toContainEqual({
      table: "timesheets",
      method: "in",
      args: ["worker_id", [employee]],
    });
    expect(calls).toContainEqual({
      table: "timesheets",
      method: "eq",
      args: ["entries.tenant_id", tenant],
    });
  });
  it("rejects list worker overrides outside self scope", async () => {
    const { sb, calls } = db();
    await expect(
      listPeriodTimesheets(
        sb,
        tenant,
        [employee],
        timesheetListSchema.parse({
          worker_id: actor,
          period_start: "2026-11-16",
          period_end: "2026-11-22",
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });
  it("uses overlap, tenant and date filters, and summarizes all matching rows", async () => {
    const { sb, calls } = db({
      timesheets: {
        data: [
          {
            id: actor,
            worker_id: employee,
            regular_minutes: 480,
            overtime_minutes: 60,
            entries: [
              { regular_minutes: 120, overtime_minutes: 0, break_minutes: 15 },
            ],
          },
        ],
        error: null,
        count: 1,
      },
      summarize_period_timesheets: {
        data: { regular_minutes: 120 },
        error: null,
      },
    });
    const result = await listPeriodTimesheets(
      sb,
      tenant,
      [employee],
      timesheetListSchema.parse({
        period_start: "2026-11-17",
        period_end: "2026-11-18",
        facility_id: tenant,
      }),
    );
    expect(result.timesheets[0]).toMatchObject({
      regular_minutes: 120,
      period_regular_minutes: 480,
    });
    expect(calls).toContainEqual({
      table: "timesheets",
      method: "lte",
      args: ["period_start", "2026-11-18"],
    });
    expect(calls).toContainEqual({
      table: "timesheets",
      method: "eq",
      args: ["entries.facility_id", tenant],
    });
    expect(
      calls.find((c) => c.table === "summarize_period_timesheets")?.args[0],
    ).toMatchObject({ p_tenant: tenant, p_owned: [employee] });
  });
  it("uses only server identity when transitioning a sheet", async () => {
    const { sb, calls } = db();
    await transitionPeriodTimesheet(
      sb,
      tenant,
      actor,
      employee,
      "reject",
      "Fix time",
    );
    expect(calls[0]).toMatchObject({
      table: "transition_timesheet",
      args: [
        {
          p_tenant: tenant,
          p_sheet: employee,
          p_actor: actor,
          p_action: "reject",
          p_notes: "Fix time",
        },
      ],
    });
  });
  it("keeps every clock-in source query tenant-scoped and reuses existing metrics", async () => {
    const { sb, calls } = db({
      workers: {
        data: [
          {
            id: employee,
            candidate_id: actor,
            first_name: "Pat",
            last_name: "Lee",
            email: null,
            job_role: null,
          },
        ],
        error: null,
      },
      employee_schedule_shifts: {
        data: [
          {
            id: tenant,
            worker_id: employee,
            facility_id: null,
            department_id: null,
            work_date: "2026-11-16",
            start_time: "08:00",
            end_time: "16:00",
          },
        ],
        error: null,
      },
    });
    const result = await loadClockIns(sb, tenant, {
      date: "2026-11-16",
      page: 1,
      limit: 25,
    });
    expect(result.summary).toMatchObject({
      notClockedIn: 1,
      totalScheduled: 1,
    });
    for (const table of [
      "workers",
      "employee_schedule_shifts",
      "applicant_attendance_logs",
      "facility",
      "departments",
    ]) {
      expect(calls).toContainEqual({
        table,
        method: "eq",
        args: ["tenant_id", tenant],
      });
    }
  });
});
