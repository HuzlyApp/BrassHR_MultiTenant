import { describe, expect, it } from "vitest";
import { loadEmployeeScheduleWeek } from "./employee-schedule-service";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("schedule week read performance", () => {
  it("starts tenant-scoped workers and shifts together, retaining date/facility filters", async () => {
    const workers = deferred<{ data: never[]; error: null }>();
    const started: string[] = [];
    const filters: unknown[][] = [];
    const client = { from: (table: string) => {
      const query = {
        select: () => query, order: () => query,
        eq: (...args: unknown[]) => { filters.push([table, ...args]); return query; },
        gte: (...args: unknown[]) => { filters.push([table, "gte", ...args]); return query; },
        lte: (...args: unknown[]) => { filters.push([table, "lte", ...args]); return query; },
        then: (resolve: (value: unknown) => unknown) => {
          started.push(table);
          return (table === "workers" ? workers.promise : Promise.resolve({ data: [], error: null })).then(resolve);
        },
      };
      return query;
    } };
    const result = loadEmployeeScheduleWeek(client as never, "tenant-a", "2026-11-23", "2026-11-29", "facility-a");
    await Promise.resolve(); await Promise.resolve();
    const startedBeforeWorkersFinished = [...started];
    workers.resolve({ data: [], error: null });
    expect(await result).toMatchObject({ employees: [], shifts: [] });
    expect(startedBeforeWorkersFinished).toEqual(["workers", "employee_schedule_shifts"]);
    expect(filters).toContainEqual(["workers", "tenant_id", "tenant-a"]);
    expect(filters).toContainEqual(["employee_schedule_shifts", "tenant_id", "tenant-a"]);
    expect(filters).toContainEqual(["employee_schedule_shifts", "facility_id", "facility-a"]);
    expect(filters).toContainEqual(["employee_schedule_shifts", "gte", "work_date", "2026-11-23"]);
    expect(filters).toContainEqual(["employee_schedule_shifts", "lte", "work_date", "2026-11-29"]);
  });
});
