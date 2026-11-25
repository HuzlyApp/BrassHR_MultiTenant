import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ filters: [] as unknown[][] }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: async () => ({ userId: "staff-a" }) }));
vi.mock("@/lib/jobs/tenant", () => ({ resolveStaffTenantId: async () => "tenant-a" }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: (table: string) => {
  const result = { data: table === "clients" ? { id: "client-a", company_name: "Client" } : [{ id: "facility-a", name: "Client facility" }], error: null };
  const query = { select: () => query, eq: (key: string, value: string) => { mocks.filters.push([table, key, value]); return query; }, order: () => query, maybeSingle: async () => result, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }; return query;
} }) }));
import { GET } from "./route";
beforeEach(() => { mocks.filters = []; });
describe("client detail facility links", () => {
  it("returns linked facilities using the same client and tenant as the client detail", async () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const response = await GET(new NextRequest("https://example.test/api/admin/clients/" + clientId), { params: Promise.resolve({ clientId }) });
    expect(response.status).toBe(200);
    expect((await response.json()).facilities).toEqual([{ id: "facility-a", name: "Client facility" }]);
    expect(mocks.filters).toContainEqual(["facility", "tenant_id", "tenant-a"]);
    expect(mocks.filters).toContainEqual(["facility", "client_id", clientId]);
  });
});
