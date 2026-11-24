import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), eq: vi.fn(), update: vi.fn(), result: { data: { id: "record" } as unknown, error: null } }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: mocks.auth }));
vi.mock("@/lib/jobs/tenant", () => ({ resolveStaffTenantId: async () => "tenant-a" }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => database() }));
vi.mock("@/lib/facilities/staff-tenant-access", () => ({ resolveStaffFacilityTenantContext: async () => {
  const auth = await mocks.auth();
  return auth instanceof NextResponse ? { error: auth } : { supabase: database(), tenantId: "tenant-a", staffUserId: "staff" };
} }));
function database() {
  return { from: () => {
    const query = { update: (patch: unknown) => { mocks.update(patch); return query; }, select: () => query, order: () => query,
      eq: (...args: unknown[]) => { mocks.eq(...args); return query; }, maybeSingle: async () => mocks.result,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.result).then(resolve) };
    return query;
  } };
}
import { PATCH as facilityPatch } from "@/app/api/admin/facilities/[facilityId]/route";
import { PATCH as workerPatch } from "@/app/api/admin/employment-workers/[workerId]/route";
import { PATCH as clientPatch, GET as clientGet } from "@/app/api/admin/clients/[clientId]/route";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: "staff", authUser: { id: "staff" } }); mocks.result = { data: { id }, error: null }; });
const targets = [
  { label: "facility", patch: (req: NextRequest, recordId = id) => facilityPatch(req, { params: Promise.resolve({ facilityId: recordId }) }) },
  { label: "worker", patch: (req: NextRequest, recordId = id) => workerPatch(req, { params: Promise.resolve({ workerId: recordId }) }) },
  { label: "client", patch: (req: NextRequest, recordId = id) => clientPatch(req, { params: Promise.resolve({ clientId: recordId }) }) },
];
const request = (body: unknown) => new NextRequest("https://app.test/api/admin/directory", { method: "PATCH", body: JSON.stringify(body) });
describe.each(targets)("$label directory management", ({ patch }) => {
  it("archives only the requested tenant record without changing employment or deleting history", async () => {
    expect((await patch(request({ action: "archive", tenantId: "other-tenant", status: "active" }))).status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(mocks.eq).toHaveBeenCalledWith("id", id);
    expect(mocks.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
  });
  it("restores only the archive timestamp", async () => {
    expect((await patch(request({ action: "restore" }))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ archived_at: null });
  });
  it("returns 404 when the tenant-scoped update finds no record", async () => {
    mocks.result.data = null;
    expect((await patch(request({ action: "archive" }))).status).toBe(404);
  });
  it("rejects unauthenticated requests before mutation", async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    expect((await patch(request({ action: "archive" }))).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects invalid IDs and unknown actions before mutation", async () => {
    expect((await patch(request({ action: "archive" }), "invalid")).status).toBe(400);
    expect((await patch(request({ action: "delete" }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
describe("directory edits", () => {
  it("validates facility names and phone numbers", async () => {
    expect((await targets[0].patch(request({ action: "edit", name: "", phone: "123" }))).status).toBe(400);
    expect((await targets[0].patch(request({ action: "edit", name: "Facility", phone: "123" }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("renames a client without overwriting its billing or location data", async () => {
    expect((await targets[2].patch(request({ action: "edit", companyName: " Updated ", address: "unvalidated" }))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ company_name: "Updated" });
  });
  it("scopes both client details and facility contacts to the selected tenant", async () => {
    expect((await clientGet(new NextRequest("https://app.test/api/admin/clients/" + id), { params: Promise.resolve({ clientId: id }) })).status).toBe(200);
    expect(mocks.eq.mock.calls.filter(([key]) => key === "tenant_id")).toHaveLength(2);
    expect(mocks.eq).toHaveBeenCalledWith("client_id", id);
  });
});
