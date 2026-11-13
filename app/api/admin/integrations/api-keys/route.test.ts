import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "./route";
import { DELETE } from "./[id]/route";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createTenantApiKey, listTenantApiKeys, revokeTenantApiKey } from "@/lib/integrations/api-keys";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: vi.fn() }));
vi.mock("@/lib/integrations/api-keys", () => ({ createTenantApiKey: vi.fn(), listTenantApiKeys: vi.fn(), revokeTenantApiKey: vi.fn() }));
vi.mock("@/lib/jobs/tenant", () => ({ resolveStaffTenantId: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/audit/activity-log", () => ({ writeActivityLog: vi.fn().mockResolvedValue(undefined) }));
const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id }) };
const created = { id, name: "test", keyPrefix: "bhr_in_abcde", scopes: ["inbound"], createdAt: "now", apiKey: "secret-value", keyHash: "private-hash", tenantId: "tenant-a", createdByUserId: "user-a", lastUsedAt: null, revokedAt: null };
const request = (body: unknown = { name: "test" }, headers: Record<string, string> = {}) => new NextRequest("https://example.com/api/admin/integrations/api-keys", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireStaffApiSession).mockResolvedValue({ userId: "user-a", devBypass: false } as never);
  vi.mocked(resolveStaffTenantId).mockResolvedValue("tenant-a");
  vi.mocked(createTenantApiKey).mockResolvedValue(created);
  vi.mocked(listTenantApiKeys).mockResolvedValue([created]);
  vi.mocked(revokeTenantApiKey).mockResolvedValue(created);
});
describe("API key management", () => {
  it.each([401, 403])("enforces the staff permission gate (%s) for every method", async (status) => {
    vi.mocked(requireStaffApiSession).mockResolvedValue(NextResponse.json({}, { status }));
    expect((await GET()).status).toBe(status);
    expect((await POST(request())).status).toBe(status);
    expect((await DELETE(request(), context)).status).toBe(status);
    expect(createTenantApiKey).not.toHaveBeenCalled();
    expect(listTenantApiKeys).not.toHaveBeenCalled();
    expect(revokeTenantApiKey).not.toHaveBeenCalled();
  });
  it("never lists plaintext secrets or hashes and disables caching", async () => {
    const result = await GET();
    expect(result.headers.get("Cache-Control")).toContain("no-store");
    const text = await result.text();
    expect(text).not.toContain(created.apiKey);
    expect(text).not.toContain(created.keyHash);
  });
  it("derives tenant, creator and scopes on the server", async () => {
    const result = await POST(request({ name: " test ", tenantId: "tenant-b", createdByUserId: "attacker", scopes: ["*"] }));
    expect(result.status).toBe(201);
    expect(createTenantApiKey).toHaveBeenCalledWith({}, { tenantId: "tenant-a", name: "test", createdByUserId: "user-a" });
    expect(result.headers.get("Cache-Control")).toContain("no-store");
    expect(await result.text()).not.toContain(created.keyHash);
  });
  it.each([null, [], 4, "name", {}, { name: {} }, { name: 123 }, { name: " " }, { name: "x".repeat(121) }])("rejects invalid JSON shapes/names: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(createTenantApiKey).not.toHaveBeenCalled();
  });
  it("rejects cross-origin creation", async () => {
    expect((await POST(request(undefined, { Origin: "https://attacker.example" }))).status).toBe(403);
    expect(createTenantApiKey).not.toHaveBeenCalled();
  });
  it("rejects simple form-compatible content types", async () => {
    expect((await POST(request(undefined, { "Content-Type": "text/plain" }))).status).toBe(415);
  });
  it("requires a selected tenant", async () => {
    vi.mocked(resolveStaffTenantId).mockResolvedValue(null);
    expect((await POST(request())).status).toBe(400);
    expect((await GET()).status).toBe(400);
    expect((await DELETE(request(), context)).status).toBe(400);
  });
  it("does not disclose database error messages", async () => {
    vi.mocked(createTenantApiKey).mockRejectedValueOnce(new Error("secret database detail"));
    const result = await POST(request());
    expect(result.status).toBe(500);
    expect(await result.text()).not.toContain("secret database detail");
  });
  it("revokes within the server-selected tenant", async () => {
    const response = await DELETE(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(revokeTenantApiKey).toHaveBeenCalledWith({}, { tenantId: "tenant-a", keyId: id });
  });
  it("rejects cross-site revocation", async () => {
    expect((await DELETE(request(undefined, { "sec-fetch-site": "cross-site" }), context)).status).toBe(403);
    expect(revokeTenantApiKey).not.toHaveBeenCalled();
  });
  it("rejects invalid key identifiers before querying", async () => {
    expect((await DELETE(request(), { params: Promise.resolve({ id: "not-a-uuid" }) })).status).toBe(400);
    expect(revokeTenantApiKey).not.toHaveBeenCalled();
  });
  it("uses the same response for missing, cross-tenant and already-revoked keys", async () => {
    vi.mocked(revokeTenantApiKey).mockResolvedValue(null);
    expect((await DELETE(request(), context)).status).toBe(404);
  });
});
