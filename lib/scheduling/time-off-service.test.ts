import { describe, expect, it } from "vitest";
import { loadScheduledTimeOff, offTypeFromShiftTitle } from "./time-off-service";
describe("scheduled time off", () => {
  it("recognizes exact leave entries without treating normal coverage shifts as leave", () => {
    expect(offTypeFromShiftTitle("Vacation")).toBe("Vacation");
    expect(offTypeFromShiftTitle("Vacation (PTO)")).toBe("Vacation");
    expect(offTypeFromShiftTitle("PTO")).toBe("Personal Leave");
    expect(offTypeFromShiftTitle("Vacation Coverage Nurse")).toBeNull();
  });
  it("includes the scheduled Vacation day with the candidate profile identity and tenant filters", async () => {
    const filters: Array<[string, unknown]> = [];
    const query = { select: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      gte: () => query, lte: () => query, limit: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null, data: [
        { id: "leave-shift", worker_id: "employment-a", work_date: "2026-11-20", title: "Vacation", facility_id: null,
          worker: { first_name: "Carter", last_name: "Worker", job_role: "Nurse", candidate_id: "candidate-a" }, facility: null },
        { id: "work-shift", title: "Nurse shift", work_date: "2026-11-20" },
      ] }).then(resolve) };
    const result = await loadScheduledTimeOff({ from: () => query } as never, "tenant-a", "2026-11-15", "2026-11-21");
    expect(filters).toContainEqual(["tenant_id", "tenant-a"]);
    expect(filters).toContainEqual(["worker.tenant_id", "tenant-a"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ worker_id: "candidate-a", off_type: "Vacation", start_date: "2026-11-20", end_date: "2026-11-20", days: 1 });
  });
});
