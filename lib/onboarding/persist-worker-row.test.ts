import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistWorkerRow } from "./persist-worker-row";
vi.mock("@/lib/onboarding/ensure-worker-progress", () => ({ ensureWorkerOnboardingProgress: vi.fn() }));
vi.mock("@/lib/cache", () => ({ invalidateResourceCache: vi.fn(), invalidateTenantCache: vi.fn(), invalidateUserCache: vi.fn(), invalidateTableCache: vi.fn() }));
vi.mock("@/lib/workers/candidate-kpi-cache", () => ({ invalidateCandidateKpiCache: vi.fn() }));
const fields = { firstName: "Jane", lastName: "Doe", address1: "1 Main", address2: "", city: "Austin", state: "TX", zipCode: "78701", phone: "5555555555", email: "jane@example.test", jobRole: "RN" };
describe("profile persistence ownership", () => {
  const writes: Array<{ action: string; row: Record<string, unknown> }> = [];
  const filters: Array<[string, unknown]> = [];
  let existing: { id: string } | null;
  let error: { code: string } | null;
  const sb = { from: () => {
    const q = { select: () => q, eq: (k: string, v: unknown) => { filters.push([k,v]); return q; }, maybeSingle: async () => ({ data: existing, error: null }),
      update: (row: Record<string, unknown>) => { writes.push({action:"update",row}); return q; },
      insert: (row: Record<string, unknown>) => { writes.push({action:"insert",row}); return q; },
      single: async () => ({ data: {id:"worker-a"}, error }) };
    return q;
  }};
  beforeEach(() => { writes.length=0; filters.length=0; existing=null; error=null; });
  it("creates only a new candidate owned by the supplied verified identity", async () => {
    expect(await persistWorkerRow(sb as never, {applicantId:"owner",tenantId:"tenant-a",fields,status:"hired"})).toMatchObject({ok:true});
    expect(writes).toEqual([{action:"insert",row:expect.objectContaining({user_id:"owner",tenant_id:"tenant-a",status:"new"})}]);
  });
  it("updates profile fields without changing status or ownership", async () => {
    existing={id:"worker-a"};
    await persistWorkerRow(sb as never,{applicantId:"owner",tenantId:"tenant-a",fields,status:"hired"});
    expect(writes[0].row).not.toHaveProperty("status");
    expect(writes[0].row).not.toHaveProperty("user_id");
    expect(writes[0].row).not.toHaveProperty("tenant_id");
    expect(filters).toContainEqual(["tenant_id","tenant-a"]);
    expect(filters).toContainEqual(["user_id","owner"]);
  });
  it("rejects duplicate identity data without reclaiming an existing worker", async () => {
    error={code:"23505"};
    expect(await persistWorkerRow(sb as never,{applicantId:"owner",tenantId:"tenant-a",fields})).toMatchObject({ok:false,status:409});
    expect(writes).toHaveLength(1);
    expect(writes[0].action).toBe("insert");
    expect(filters.some(([k])=>k==="email" || k==="phone")).toBe(false);
  });
});
