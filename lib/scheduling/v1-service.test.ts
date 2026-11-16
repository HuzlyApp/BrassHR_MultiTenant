import { describe, expect, it } from "vitest";
import { scheduleQuerySchema, whoIsOffQuerySchema, shiftSchema, shiftPatchSchema, holidaySchema, assignmentSchema } from "./v1-contract";
import { createScheduleShift, loadTenantSchedule, patchScheduleShift, validateShiftFeatures } from "./v1-service";
import { loadTenantTimeOff } from "./time-off-service";

const a = "10000000-0000-4000-8000-000000000001";
const input = { title: "Day", start_date: "2026-11-16", end_date: "2026-11-20", is_internal: true, number_of_people_needed: 1 };
function db(results: Record<string, unknown> = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const supabase = { from: (table: string) => {
    const chain = new Proxy({}, { get: (_, method: string) => method === "then"
      ? (resolve: (v: unknown) => unknown) => Promise.resolve(results[table] ?? { data: [], error: null, count: 0 }).then(resolve)
      : (...args: unknown[]) => { calls.push({ table, method, args }); return chain; } });
    return chain;
  } };
  return { supabase: supabase as never, calls };
}
const range = scheduleQuerySchema.parse({ date_from: "2026-11-16", date_to: "2026-11-30" });

describe("FSD scheduling contracts", () => {
  it("rejects invalid calendar dates, reversed and excessive ranges", () => {
    for (const q of [{ date_from: "2026-02-30", date_to: "2026-03-01" },
      { date_from: "2026-11-20", date_to: "2026-11-16" }, { date_from: "2026-01-01", date_to: "2028-01-01" }]) {
      expect(scheduleQuerySchema.safeParse(q).success).toBe(false);
    }
    expect(scheduleQuerySchema.safeParse({ ...range, limit: 101 }).success).toBe(false);
  });
  it("rejects tenant reassignment, unknown shift fields, duplicate workers and empty patches", () => {
    expect(shiftSchema.safeParse({ ...input, tenant_id: a }).success).toBe(false);
    expect(shiftPatchSchema.safeParse({}).success).toBe(false);
    expect(assignmentSchema.safeParse({ worker_ids: [a,a] }).success).toBe(false);
    expect(holidaySchema.safeParse({ name: "Holiday", holiday_date: "2026-11-26", is_paid: true, tenant_id: a }).success).toBe(false);
  });
  it("applies edition and effective feature rules", () => {
    expect(() => validateShiftFeatures(input, { internal_scheduling: true }, "smb")).not.toThrow();
    expect(() => validateShiftFeatures(input, {}, "smb")).toThrow("disabled");
    expect(() => validateShiftFeatures({ ...input, is_internal: false }, { manage_clients: true }, "staffing")).toThrow("client is required");
    expect(() => validateShiftFeatures({ ...input, client_id: a }, { internal_scheduling: true }, "smb")).toThrow("cannot specify");
    expect(() => validateShiftFeatures({ ...input, is_internal: false, client_id: a }, {}, "smb")).toThrow("disabled");
  });
});

describe("tenant-scoped scheduling services", () => {
  it("filters every schedule collection and embedded relation by tenant and uses overlap ranges", async () => {
    const { supabase, calls } = db();
    await loadTenantSchedule(supabase, a, { ...range, facility_id: a, department_id: a }, { internal_scheduling: true });
    for (const table of ["shifts", "employee_schedule_shifts", "tenant_holidays", "worker_time_off"]) {
      expect(calls).toContainEqual({ table, method: "eq", args: ["tenant_id", a] });
    }
    expect(calls).toContainEqual({ table: "shifts", method: "eq", args: ["is_internal", true] });
    expect(calls).toContainEqual({ table: "shifts", method: "lte", args: ["start_date", range.date_to] });
    expect(calls).toContainEqual({ table: "worker_time_off", method: "gte", args: ["end_date", range.date_from] });
    expect(calls).toContainEqual({ table: "worker_time_off", method: "eq", args: ["worker.tenant_id", a] });
  });
  it("omits client columns when client management is disabled", async () => {
    const { supabase } = db({ shifts: { data: [{ id: "shift", client_id: "secret-client", is_internal: true }], count: 1, error: null } });
    const result = await loadTenantSchedule(supabase, a, range, { internal_scheduling: true });
    expect(result.shifts).toEqual([{ id: "shift", is_internal: true }]);
  });
  it("creates clientless internal shifts through the existing service without choosing an arbitrary client", async () => {
    const { supabase, calls } = db({ shifts: { data: { id: "shift", client_id: null }, error: null } });
    await createScheduleShift(supabase, a, input, { internal_scheduling: true }, "smb");
    expect(calls.find((c) => c.method === "insert")?.args[0]).toMatchObject({ tenant_id: a, client_id: null, is_internal: true });
    expect(calls.some((c) => c.table === "clients")).toBe(false);
  });
  it("rejects foreign shift updates before any mutation", async () => {
    const { supabase, calls } = db({ shifts: { data: null, error: null } });
    await expect(patchScheduleShift(supabase, a, "foreign", { title: "New" }, {}, "smb")).rejects.toMatchObject({ status: 404 });
    expect(calls).toContainEqual({ table: "shifts", method: "eq", args: ["tenant_id", a] });
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });
  it("validates merged shift dates before scoped updates", async () => {
    const { supabase, calls } = db({ shifts: { data: { ...input, id: "shift" }, error: null } });
    await expect(patchScheduleShift(supabase, a, "shift", { end_date: "2026-11-01" }, { internal_scheduling: true }, "smb"))
      .rejects.toMatchObject({ status: 422 });
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });
  it("supports holiday-only who-is-off without treating everyone as a named leave record", async () => {
    const { supabase } = db();
    const result = await loadTenantTimeOff(supabase, a, whoIsOffQuerySchema.parse({ ...range, off_type: "Holiday" }));
    expect(result.records).toEqual([]);
  });
});
