import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveWorkerContext } from "./worker-access";
const candidateId = "10000000-0000-4000-8000-000000000001";
const mocks = vi.hoisted(() => ({ eq: vi.fn(), allowed: true, worker: { id: "10000000-0000-4000-8000-000000000001", tenant_id: "20000000-0000-4000-8000-000000000001", user_id: null as string | null } }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: async () => ({ userId: "staff-a", authUser: { id: "staff-a" } }) }));
vi.mock("@/lib/auth/staff-tenant-scope", () => ({ resolveStaffTenantScope: async () => ({ mode: "scoped", tenantId: "20000000-0000-4000-8000-000000000001" }) }));
vi.mock("@/lib/auth/worker-record-access", () => ({ canAccessWorkerRecord: async () => mocks.allowed }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: () => { const query = { select: () => query, eq: mocks.eq.mockImplementation(() => query), maybeSingle: async () => ({ data: mocks.worker, error: null }) }; return query; } }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.allowed = true; mocks.worker.tenant_id = "20000000-0000-4000-8000-000000000001"; mocks.worker.user_id = null; });
describe("candidate facility context", () => {
  it("allows a scoped read for an imported candidate without a linked login", async () => {
    expect(await resolveWorkerContext(candidateId, { allowUnlinkedAccount: true })).toMatchObject({ workerId: candidateId, workerAuthId: "", tenantId: "20000000-0000-4000-8000-000000000001" });
    expect(mocks.eq).toHaveBeenCalledWith("tenant_id", "20000000-0000-4000-8000-000000000001");
  });
  it("awaits the worker-record access decision before returning context", async () => {
    mocks.allowed = false;
    expect((await resolveWorkerContext(candidateId, { allowUnlinkedAccount: true })).error?.status).toBe(403);
  });
  it("continues to reject assignment writes before account linking", async () => {
    const result = await resolveWorkerContext(candidateId);
    expect(result.error?.status).toBe(400);
  });
  it("rejects a foreign candidate even if a database mock ignores the tenant filter", async () => {
    mocks.worker.tenant_id = "20000000-0000-4000-8000-000000000002";
    const result = await resolveWorkerContext(candidateId, { allowUnlinkedAccount: true });
    expect(result.error?.status).toBe(403);
  });
});
