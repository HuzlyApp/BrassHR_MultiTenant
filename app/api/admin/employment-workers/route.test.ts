import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ calls: [] as Array<[string, string, unknown]> }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: async () => ({ authUser: { id: "staff-a" } }) }));
vi.mock("@/lib/auth/staff-tenant-scope", () => ({ resolveStaffTenantScope: async () => ({ mode: "scoped", tenantId: "tenant-a" }) }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: (table: string) => {
  const query = { select: () => query, order: () => query, eq: (key: string, value: unknown) => { mocks.calls.push([table, key, value]); return query; },
    is: (key: string, value: unknown) => { mocks.calls.push([table, key, value]); return query; }, not: (key: string, op: string, value: unknown) => { mocks.calls.push([table, key, `${op}:${value}`]); return query; },
    in: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
  return query;
} }) }));
import { GET } from "./route";
beforeEach(() => { mocks.calls = []; });
describe("single-worker directory details", () => {
  it("filters the shared directory assignment projection by tenant and candidate", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect((await GET(new NextRequest(`https://example.test/api/admin/employment-workers?candidateId=${id}`))).status).toBe(200);
    expect(mocks.calls).toContainEqual(["workers", "tenant_id", "tenant-a"]);
    expect(mocks.calls).toContainEqual(["workers", "candidate_id", id]);
    expect(mocks.calls).toContainEqual(["workers", "archived_at", null]);
    expect(mocks.calls).toContainEqual(["workers", "directory_role", "worker"]);
  });
  it("filters managers directory by directory_role", async () => {
    expect(
      (await GET(new NextRequest("https://example.test/api/admin/employment-workers?directoryRole=manager"))).status
    ).toBe(200);
    expect(mocks.calls).toContainEqual(["workers", "directory_role", "manager"]);
  });
  it("rejects malformed candidate IDs", async () => {
    expect((await GET(new NextRequest("https://example.test/api/admin/employment-workers?candidateId=invalid"))).status).toBe(400);
    expect(mocks.calls).toEqual([]);
  });
  it("loads only archived records in the archive view", async () => {
    expect((await GET(new NextRequest("https://example.test/api/admin/employment-workers?archived=1"))).status).toBe(200);
    expect(mocks.calls).toContainEqual(["workers", "archived_at", "is:null"]);
  });
});
