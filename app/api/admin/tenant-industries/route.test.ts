import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { DELETE, PATCH, POST } from "./route";
import { IndustrySettingsError } from "@/lib/professions/industry-settings";
const mocks = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), bind: vi.fn(), denied: false }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: async () => ({ userId: "staff-a", authUser: { id: "staff-a" }, role: "admin" }) }));
vi.mock("@/lib/auth/workflow-admin", () => ({ requireWorkflowAdmin: () => mocks.denied ? NextResponse.json({ error: "Forbidden" }, { status: 403 }) : null }));
vi.mock("@/lib/email-templates/resolve-effective-tenant", () => ({ resolveEffectiveAdminTenantId: async () => "tenant-a" }));
vi.mock("@/lib/ai-catalog/bind-tenant", () => ({ bindTenantIndustries: mocks.bind }));
vi.mock("@/lib/professions/industry-settings", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/professions/industry-settings")>(), saveIndustryMetadata: mocks.save, removeTenantIndustry: mocks.remove }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { primary_industry_key: "healthcare" }, error: null }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ industry_key: "healthcare", is_primary: true }], error: null }).then(resolve) }; return query;
} }) }));
const request = (method: string, body: unknown) => new NextRequest("http://localhost/api/admin/tenant-industries", { method, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.denied = false; mocks.save.mockResolvedValue({ industry_key: "other", description: "Saved" }); mocks.remove.mockResolvedValue(undefined); });
describe("tenant industry routes", () => {
  it("persists metadata on create after binding the new industry", async () => {
    const body = { industryKey: "other", description: "Saved", iconId: "code" };
    expect((await POST(request("POST", body))).status).toBe(200);
    expect(mocks.bind).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tenantId: "tenant-a", industryKeys: ["healthcare", "other"] }));
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), "tenant-a", "other", body);
  });
  it("ignores client-provided tenant scope on edit", async () => {
    const body = { industryKey: "other", description: "Saved", tenantId: "foreign" };
    expect((await PATCH(request("PATCH", body))).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), "tenant-a", "other", body);
  });
  it("rejects invalid metadata before adding an industry", async () => {
    expect((await POST(request("POST", { industryKey: "other", description: "x".repeat(101) }))).status).toBe(400);
    expect(mocks.bind).not.toHaveBeenCalled();
  });
  it("rejects invalid industry keys", async () => {
    expect((await PATCH(request("PATCH", { industryKey: "made-up" }))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("returns a conflict when an industry is still in use", async () => {
    mocks.remove.mockRejectedValue(new IndustrySettingsError("Industry has professions", 409));
    expect((await DELETE(new NextRequest("http://localhost/api/admin/tenant-industries?industryKey=other", { method: "DELETE" }))).status).toBe(409);
    expect(mocks.remove).toHaveBeenCalledWith(expect.anything(), "tenant-a", "other");
  });
  it("blocks non-admin mutation before touching industry settings", async () => {
    mocks.denied = true;
    expect((await PATCH(request("PATCH", { industryKey: "other" }))).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
