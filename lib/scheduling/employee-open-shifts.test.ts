import { describe, expect, it } from "vitest";
import { createEmployeeScheduleShift, updateEmployeeScheduleShift } from "./employee-schedule-service";
const input = { title: "Coverage", workDate: "2027-01-01", startTime: "08:00", endTime: "17:00" };
function database(overlap = false) {
  const calls: Array<[string, ...unknown[]]> = [];
  let mutation = false;
  const query = new Proxy({}, { get: (_, method: string) => method === "then" ? (resolve: (value: unknown) => unknown) => Promise.resolve({
    error: null,
    data: mutation ? { id: "shift-a", worker_id: null, facility_id: null, department_id: null, work_date: input.workDate, start_time: input.startTime, end_time: input.endTime, title: input.title, rate_per_hour: null, notes: null } : overlap ? [{ id: "conflict", title: "Booked", work_date: input.workDate, start_time: "09:00", end_time: "16:00" }] : [],
  }).then(resolve) : (...args: unknown[]) => { calls.push([method, ...args]); if (method === "insert" || method === "update") mutation = true; return query; } });
  return { client: { from: (table: string) => { calls.push(["from", table]); return query; } } as never, calls };
}
describe("open schedule shifts", () => {
  it("persists an unassigned shift without checking overlap against other open shifts", async () => {
    const { client, calls } = database(true);
    expect(await createEmployeeScheduleShift(client, "tenant-a", input)).toMatchObject({ workerId: "", title: "Coverage" });
    expect(calls.find(([method]) => method === "insert")?.[1]).toMatchObject({ tenant_id: "tenant-a", worker_id: null });
    expect(calls.some(([method, field]) => method === "eq" && field === "worker_id")).toBe(false);
  });
  it("can clear an assignment while retaining tenant and shift filters", async () => {
    const { client, calls } = database();
    await updateEmployeeScheduleShift(client, "tenant-a", "shift-a", { ...input, workerId: "" });
    expect(calls).toContainEqual(["eq", "tenant_id", "tenant-a"]);
    expect(calls).toContainEqual(["eq", "id", "shift-a"]);
    expect(calls.find(([method]) => method === "update")?.[1]).toMatchObject({ worker_id: null });
  });
  it("still rejects an overlapping assignment before writing", async () => {
    const { client, calls } = database(true);
    await expect(createEmployeeScheduleShift(client, "tenant-a", { ...input, workerId: "employee-a" })).rejects.toMatchObject({ code: "SHIFT_OVERLAP" });
    expect(calls).toContainEqual(["eq", "tenant_id", "tenant-a"]);
    expect(calls).toContainEqual(["eq", "worker_id", "employee-a"]);
    expect(calls.some(([method]) => method === "insert")).toBe(false);
  });
});
