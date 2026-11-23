import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), scope: vi.fn(), filters: [] as Array<[string, unknown]>, note: { id: "22222222-2222-4222-8222-222222222222", body: "Updated" } as { id: string; body: string } | null }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: mocks.auth }));
vi.mock("@/lib/auth/worker-record-access", () => ({ canAccessWorkerRecord: mocks.access }));
vi.mock("@/lib/auth/staff-tenant-scope", () => ({ resolveStaffTenantScope: mocks.scope }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: (table: string) => {
  const query = { select: () => query, eq: (key: string, value: unknown) => { if (table === "worker_notes") mocks.filters.push([key, value]); return query; }, update: () => query, delete: () => query,
    maybeSingle: async () => ({ data: table === "worker" ? { id: "11111111-1111-4111-8111-111111111111", tenant_id: "tenant-a", user_id: "worker-user" } : mocks.note, error: null }) };
  return query;
} }) }));
import { PATCH, DELETE } from "./route";
const workerId = "11111111-1111-4111-8111-111111111111";
const noteId = "22222222-2222-4222-8222-222222222222";
const request = (method: string, extra = {}) => new NextRequest("https://example.test/api/admin/worker-notes", { method, body: JSON.stringify({ workerId, noteId, body: "Updated", ...extra }) });
beforeEach(() => { mocks.auth.mockResolvedValue({ authUser: { id: "staff-a" }, userId: "staff-a" }); mocks.access.mockResolvedValue(true); mocks.scope.mockResolvedValue({ mode: "scoped", tenantId: "tenant-a" }); mocks.filters = []; mocks.note = { id: noteId, body: "Updated" }; });
describe("tenant-scoped note mutations", () => {
  it.each([["PATCH", PATCH], ["DELETE", DELETE]] as const)("scopes %s by tenant, worker, and note", async (method, handler) => {
    expect((await handler(request(method))).status).toBe(200);
    expect(mocks.filters).toEqual([["tenant_id", "tenant-a"], ["worker_id", workerId], ["id", noteId]]);
  });
  it("rejects a worker in another tenant", async () => {
    mocks.scope.mockResolvedValue({ mode: "scoped", tenantId: "tenant-b" });
    expect((await DELETE(request("DELETE"))).status).toBe(403);
    expect(mocks.filters).toEqual([]);
  });
  it("preserves the auth denial", async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    expect((await PATCH(request("PATCH"))).status).toBe(403);
  });
  it("returns not found for a note outside the scoped worker", async () => {
    mocks.note = null;
    expect((await DELETE(request("DELETE"))).status).toBe(404);
  });
  it("rejects blank note edits", async () => {
    expect((await PATCH(request("PATCH", { body: "   " }))).status).toBe(400);
  });
});
