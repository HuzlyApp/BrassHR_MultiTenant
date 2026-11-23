import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { DELETE, PATCH } from "./route";
import { LibraryManagementError } from "@/lib/onboarding/onboarding-libraries";
const mocks = vi.hoisted(() => ({ manage: vi.fn(), denied: false }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: async () => ({ userId: "staff-a", authUser: { id: "staff-a" } }) }));
vi.mock("@/lib/auth/workflow-admin", () => ({ requireWorkflowAdmin: () => mocks.denied ? NextResponse.json({ error: "Forbidden" }, { status: 403 }) : null }));
vi.mock("@/lib/email-templates/resolve-effective-tenant", () => ({ resolveEffectiveAdminTenantId: async () => "tenant-a" }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/onboarding/onboarding-libraries", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/onboarding/onboarding-libraries")>(), manageOnboardingLibrary: mocks.manage }));
const id = "123e4567-e89b-42d3-a456-426614174000", context = { params: Promise.resolve({ id }) };
const request = (method: string, body: unknown = {}) => new NextRequest("http://localhost/api/admin/onboarding-libraries/" + id, { method, ...(method === "DELETE" ? {} : { body: JSON.stringify(body) }) });
beforeEach(() => { vi.clearAllMocks(); mocks.denied = false; mocks.manage.mockResolvedValue(undefined); });
describe("workflow folder routes", () => {
  it("uses authenticated tenant scope for rename", async () => {
    expect((await PATCH(request("PATCH", { name: "Renamed", tenantId: "foreign" }), context)).status).toBe(200);
    expect(mocks.manage).toHaveBeenCalledWith(expect.anything(), "tenant-a", id, { name: "Renamed" });
  });
  it("rejects invalid folder identifiers", async () => {
    expect((await DELETE(request("DELETE"), { params: Promise.resolve({ id: "invalid" }) })).status).toBe(400);
    expect(mocks.manage).not.toHaveBeenCalled();
  });
  it("returns protected-folder conflicts", async () => {
    mocks.manage.mockRejectedValue(new LibraryManagementError("Default folder", 409));
    expect((await DELETE(request("DELETE"), context)).status).toBe(409);
  });
  it("requires admin permissions", async () => {
    mocks.denied = true;
    expect((await DELETE(request("DELETE"), context)).status).toBe(403);
    expect(mocks.manage).not.toHaveBeenCalled();
  });
});
