import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, POST } from "./route";
const mocks = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn(), sb: {} }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: async () => ({ authUser: { id: "staff" } }) }));
vi.mock("@/lib/auth/staff-tenant-scope", () => ({ resolveStaffTenantScope: async () => ({ mode: "scoped", tenantId: "tenant-a" }) }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => mocks.sb }));
vi.mock("@/lib/scheduling/employee-schedule-service", () => ({ createEmployeeScheduleShift: mocks.create, deleteEmployeeScheduleShift: mocks.remove, loadEmployeeScheduleWeek: vi.fn(), updateEmployeeScheduleShift: vi.fn() }));
const id = "123e4567-e89b-42d3-a456-426614174000";
function request(method: string, body: unknown) { return new NextRequest("http://localhost/api/admin/scheduling/week", { method, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ id }); mocks.remove.mockResolvedValue(true); });
describe("schedule mutations", () => {
  it("requires explicit confirmation before creating a past shift", async () => {
    const response = await POST(request("POST", { workDate: "2000-01-01" }));
    expect(response.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("accepts a confirmed past shift in the authenticated tenant", async () => {
    expect((await POST(request("POST", { workDate: "2000-01-01", confirmPastDate: true }))).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(mocks.sb, "tenant-a", expect.objectContaining({ confirmPastDate: true }));
  });
  it("deletes only through the authenticated tenant scope", async () => {
    expect((await DELETE(request("DELETE", { id, tenantId: "other" }))).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith(mocks.sb, "tenant-a", id);
  });
  it("rejects invalid deletion IDs without touching storage", async () => {
    expect((await DELETE(request("DELETE", { id: "invalid" }))).status).toBe(400);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("reports a missing shift", async () => {
    mocks.remove.mockResolvedValue(false);
    expect((await DELETE(request("DELETE", { id }))).status).toBe(404);
  });
});
