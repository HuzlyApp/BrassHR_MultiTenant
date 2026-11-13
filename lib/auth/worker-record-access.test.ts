import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
const state = vi.hoisted(() => ({ tenant: "tenant-a" as string | null, exists: true, filters: [] as unknown[] }));
vi.mock("@/lib/email-templates/resolve-effective-tenant", () => ({ resolveEffectiveAdminTenantId: async () => state.tenant }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: () => {
  const q = { select: () => q, eq: (k: string, v: unknown) => { state.filters.push([k, v]); return q; }, maybeSingle: async () => ({ data: state.exists ? { id: "worker-a" } : null, error: null }) }; return q;
} }) }));
import { canAccessWorkerRecord } from "./worker-record-access";
const auth = { userId: "staff-a", role: "recruiter", godAdmin: false, devBypass: false, email: "staff@example.test", authUser: { id: "staff-a" } as User };
describe("worker record tenant authorization", () => {
  beforeEach(() => { state.tenant = "tenant-a"; state.exists = true; state.filters = []; });
  it("permits an owned tenant record and filters the database lookup", async () => {
    expect(await canAccessWorkerRecord(auth, { id: "worker-a" })).toBe(true);
    expect(state.filters).toEqual([["id", "worker-a"], ["tenant_id", "tenant-a"]]);
  });
  it("rejects another tenant's worker", async () => {
    state.exists = false; expect(await canAccessWorkerRecord(auth, { id: "worker-b" })).toBe(false);
  });
  it("never falls back to all tenants", async () => {
    state.tenant = null; expect(await canAccessWorkerRecord(auth, { id: "worker-a" })).toBe(false);
  });
  it("requires an explicit tenant for god-admin record access", async () => {
    state.tenant = null; expect(await canAccessWorkerRecord({ ...auth, godAdmin: true }, { id: "worker-a" })).toBe(false);
  });
  it("allows applicants only their own record", async () => {
    expect(await canAccessWorkerRecord({ ...auth, role: "worker" }, { id: "worker-a", user_id: "staff-a" })).toBe(true);
    expect(await canAccessWorkerRecord({ ...auth, role: "worker" }, { id: "worker-b", user_id: "other" })).toBe(false);
  });
});
