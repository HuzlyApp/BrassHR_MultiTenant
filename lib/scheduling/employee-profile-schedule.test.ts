import { describe, expect, it, vi } from "vitest";
import { loadWorkerProfileSchedule } from "./employee-schedule-service";

describe("worker profile schedule", () => {
  it("resolves employment IDs from the tenant-scoped candidate and loads their shift history", async () => {
    const calls: Array<[string, string, unknown]> = [];
    const client = { from: (table: string) => {
      const query = { select: () => query, eq: (key: string, value: unknown) => { calls.push([table, key, value]); return query; },
        in: (key: string, value: unknown) => { calls.push([table, key, value]); return query; }, order: () => query, limit: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(table === "workers"
          ? { data: [{ id: "employment-a" }], error: null }
          : { data: [{ id: "shift-a", title: "Nurse shift", work_date: "2026-11-20", start_time: "08:00", end_time: "17:00" }], count: 4, error: null }).then(resolve) };
      return query;
    } };
    const result = await loadWorkerProfileSchedule(client as never, "tenant-a", "candidate-a");
    expect(calls).toContainEqual(["workers", "tenant_id", "tenant-a"]);
    expect(calls).toContainEqual(["workers", "candidate_id", "candidate-a"]);
    expect(calls).toContainEqual(["employee_schedule_shifts", "tenant_id", "tenant-a"]);
    expect(calls).toContainEqual(["employee_schedule_shifts", "worker_id", ["employment-a"]]);
    expect(result.total).toBe(4);
    expect(result.shifts).toEqual([{ id: "shift-a", title: "Nurse shift", workDate: "2026-11-20", startTime: "08:00", endTime: "17:00" }]);
  });
  it("does not read shifts when the candidate has no employment record in this tenant", async () => {
    const query = { select: () => query, eq: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
    const from = vi.fn(() => query);
    expect(await loadWorkerProfileSchedule({ from } as never, "tenant-a", "candidate-b")).toEqual({ total: 0, shifts: [] });
    expect(from).toHaveBeenCalledTimes(1);
  });
});
