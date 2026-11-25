import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(), update: vi.fn(), signOut: vi.fn(), from: vi.fn(),
  find: vi.fn(), tenant: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: {
  verifyOtp: mocks.verify, updateUser: mocks.update, signOut: mocks.signOut,
} }) }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/applicant-portal", () => ({ findApplicantByEmail: mocks.find, resolveTenantIdForApplicantPortal: mocks.tenant }));
import { POST } from "./route";

const records: Array<{ table: string; filters: unknown[][]; update?: unknown }> = [];
let membership: { role: string; is_active: boolean } | null;
function request(body: Record<string, unknown> = {}, origin = "https://acme.brasshr.com") {
  return new NextRequest("https://acme.brasshr.com/api/applicant-portal/access", {
    method: "POST", headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ tokenHash: "email-proof", type: "email", tenant: "acme", ...body }),
  });
}
describe("applicant email link redemption", () => {
  beforeEach(() => {
    vi.clearAllMocks(); records.length = 0;
    membership = { role: "candidate", is_active: true };
    mocks.tenant.mockResolvedValue("tenant-a");
    mocks.find.mockResolvedValue({ id: "worker-a", tenant_id: "tenant-a", applicant_password_set_at: null });
    mocks.verify.mockResolvedValue({ data: { user: { id: "auth-a", email: "person@example.com" }, session: {} }, error: null });
    mocks.update.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      const record: typeof records[number] = { table, filters: [] }; records.push(record);
      const chain = { select: () => chain,
        eq: (...args: unknown[]) => { record.filters.push(args); return chain; },
        update: (value: unknown) => { record.update = value; return chain; },
        maybeSingle: async () => ({ data: membership, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
      return chain;
    });
  });
  it("verifies the token, links only the recipient's tenant records, and opens candidate applications", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirectTo: "/application/candidate?tenant=acme" });
    expect(mocks.verify).toHaveBeenCalledWith({ token_hash: "email-proof", type: "email" });
    expect(mocks.find).toHaveBeenCalledWith(expect.anything(), "person@example.com", "tenant-a");
    for (const record of records) expect(record.filters).toContainEqual(["tenant_id", "tenant-a"]);
    expect(records.find((r) => r.table === "job_applications")?.update).toEqual({ applicant_auth_user_id: "auth-a" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("sets the invite recipient's password and marks password login as ready", async () => {
    const response = await POST(request({ type: "invite", password: "candidate-password" }));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ password: "candidate-password" });
    expect(records.filter((r) => r.table === "worker").some((r) =>
      Boolean((r.update as Record<string, unknown>)?.applicant_password_set_at))).toBe(true);
  });
  it("does not consume a token for an invalid signup password or foreign origin", async () => {
    expect((await POST(request({ type: "invite" }))).status).toBe(400);
    expect((await POST(request({}, "https://evil.example"))).status).toBe(403);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("does not link any records when a token expires", async () => {
    mocks.verify.mockResolvedValue({ data: {}, error: { message: "expired" } });
    expect((await POST(request())).status).toBe(400);
    expect(records).toHaveLength(0);
  });
  it.each([null, { role: "candidate", is_active: false }, { role: "admin", is_active: true }])(
    "rejects unavailable or staff tenant membership: %o", async (value) => {
      membership = value;
      expect((await POST(request())).status).toBe(403);
      expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
      expect(records.some((r) => r.update)).toBe(false);
    },
  );
  it("does not claim an application from another tenant", async () => {
    mocks.find.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(403);
    expect(records.some((r) => r.update)).toBe(false);
  });
});
