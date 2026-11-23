import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertApprovedFacilityWorker, createFacility, unassignWorkerFromFacility, validateFacilityFormInput } from "./facility-service";
import { FacilityValidationError } from "./errors";
import type { FacilityFormInput } from "./types";
vi.mock("@/lib/service-area/db", () => ({ assertTenantCanOperate: vi.fn(), evaluateServiceAreaWithDb: vi.fn(async () => ({ allowed: true })) }));
const tenantId = "a72061ab-3f3d-4f9c-9aaa-27af099b7f48";
const clientId = "69ac7187-6320-4ff8-8c17-46b68da46413";
const valid: FacilityFormInput = { clientId, name: "Facility", streetAddress: "123 Main Street", city: "Raleigh", state: "NC", zipCode: "27601" };
function database(responses: Record<string, unknown>) {
  const calls: Array<{ table: string; filters: Array<[string, unknown]>; inserted?: unknown }> = [];
  const db = { from: (table: string) => {
    const call = { table, filters: [] as Array<[string, unknown]>, inserted: undefined as unknown };
    calls.push(call);
    const q = {
      select: () => q, order: () => q, limit: () => q,
      eq: (key: string, value: unknown) => { call.filters.push([key, value]); return q; },
      insert: (value: unknown) => { call.inserted = value; return q; },
      maybeSingle: () => Promise.resolve({ data: responses[table] ?? null, error: null }),
      single: () => Promise.resolve({ data: { id: "facility-created" }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: responses[table] ?? [], error: null }).then(resolve),
    };
    return q;
  } } as unknown as SupabaseClient;
  return { db, calls };
}
describe("facility validation", () => {
  it.each(["12", "1234", "123456", "abcde"])("rejects invalid ZIP %s", (zipCode) => {
    expect(validateFacilityFormInput({ ...valid, zipCode })).toContain("5-digit ZIP");
  });
  it.each(["27601", "27601-1234"])("accepts ZIP %s", (zipCode) => {
    expect(validateFacilityFormInput({ ...valid, zipCode })).toBeNull();
  });
  it("requires an explicit valid client", () => {
    expect(validateFacilityFormInput({ ...valid, clientId: "" })).toBe("Choose a client organization.");
  });
  it("rejects a client not belonging to the scoped tenant", async () => {
    const { db, calls } = database({ facility: [] });
    await expect(createFacility(db, tenantId, valid)).rejects.toThrow("from this tenant");
    expect(calls.find((call) => call.table === "clients")?.filters).toEqual([["tenant_id", tenantId], ["id", clientId]]);
    expect(calls.some((call) => call.inserted)).toBe(false);
  });
  it("persists the explicitly selected tenant client", async () => {
    const { db, calls } = database({ clients: { id: clientId }, facility: [] });
    await createFacility(db, tenantId, valid);
    expect(calls.find((call) => call.inserted)?.inserted).toMatchObject({ tenant_id: tenantId, client_id: clientId });
  });
});
describe("facility worker approval", () => {
  it("rejects a candidate without a converted worker record", async () => {
    const { db, calls } = database({ worker: { id: "candidate" } });
    await expect(assertApprovedFacilityWorker(db, tenantId, "auth-user")).rejects.toBeInstanceOf(FacilityValidationError);
    expect(calls.find((call) => call.table === "workers")?.filters).toContainEqual(["conversion_status", "converted"]);
    expect(calls.every((call) => call.filters.some(([key, value]) => key === "tenant_id" && value === tenantId))).toBe(true);
  });
  it("allows a converted worker from the tenant", async () => {
    const { db } = database({ worker: { id: "candidate" }, workers: { id: "employment-worker" } });
    await expect(assertApprovedFacilityWorker(db, tenantId, "auth-user")).resolves.toBeUndefined();
  });
});

describe("facility unassignment", () => {
  function setup(assignment: { id: string; worker_id: string; shift_id: string } | null, shifts: Array<{ id: string }>) {
    const calls: Array<{ table: string; filters: Array<[string, unknown]>; update?: unknown }> = [];
    const db = { from: (table: string) => {
      const call: typeof calls[number] = { table, filters: [] }; calls.push(call);
      const q = { select: () => q,
        eq: (key: string, value: unknown) => { call.filters.push([key, value]); return q; },
        in: (key: string, value: unknown) => { call.filters.push([key, value]); return q; },
        neq: (key: string, value: unknown) => { call.filters.push([`not:${key}`, value]); return q; },
        update: (value: unknown) => { call.update = value; return q; },
        maybeSingle: async () => ({ data: assignment, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: call.update ? [{ id: "one" }, { id: "two" }] : shifts, error: null }).then(resolve),
      }; return q;
    } } as unknown as SupabaseClient;
    return { db, calls };
  }
  it("only cancels this worker's assignments in this tenant and facility", async () => {
    const { db, calls } = setup({ id: "assignment", worker_id: "worker-auth", shift_id: "shift-one" }, [{ id: "shift-one" }, { id: "shift-two" }]);
    expect(await unassignWorkerFromFacility(db, tenantId, "facility", "assignment")).toBe(2);
    const mutation = calls.find((call) => call.update);
    expect(mutation?.update).toEqual({ status: "cancelled" });
    expect(mutation?.filters).toEqual([["tenant_id", tenantId], ["worker_id", "worker-auth"], ["shift_id", ["shift-one", "shift-two"]], ["not:status", "cancelled"]]);
    expect(calls.find((call) => call.table === "shifts")?.filters).toContainEqual(["facility_id", "facility"]);
  });
  it("rejects an assignment belonging to another facility without updating it", async () => {
    const { db, calls } = setup({ id: "assignment", worker_id: "worker-auth", shift_id: "other-shift" }, [{ id: "shift-one" }]);
    await expect(unassignWorkerFromFacility(db, tenantId, "facility", "assignment")).rejects.toThrow("for this facility");
    expect(calls.some((call) => call.update)).toBe(false);
  });
  it("rejects an unknown assignment without updating it", async () => {
    const { db, calls } = setup(null, []);
    await expect(unassignWorkerFromFacility(db, tenantId, "facility", "assignment")).rejects.toThrow("Assignment not found");
    expect(calls.some((call) => call.update)).toBe(false);
  });
});
