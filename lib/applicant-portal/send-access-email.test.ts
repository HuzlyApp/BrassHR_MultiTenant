import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendApplicantPortalAccessEmail } from "./send-access-email";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/communication/send-candidate-email", () => ({ sendCandidateEmail: mocks.send }));

function client(options: { existing?: boolean; role?: string; inactive?: boolean; sendFailure?: boolean } = {}) {
  const user = { id: "auth-1", email: "person@example.com", app_metadata: { role: "candidate" },
    email_confirmed_at: options.existing ? "2026-01-01" : null };
  const operations: Array<{ table: string; filters: unknown[][]; upsert?: unknown }> = [];
  const from = vi.fn((table: string) => {
    const op: typeof operations[number] = { table, filters: [] };
    operations.push(op);
    const result = { data: table === "tenants" ? { name: "Acme", slug: "acme", subdomain: "acme" }
      : table === "worker" ? { id: "worker-1", email: "Person@example.com", user_id: "anonymous-1", applicant_password_set_at: options.existing ? "2026-01-01" : null }
      : table === "user_roles" && options.role ? { role: options.role, is_active: !options.inactive } : null,
    error: null };
    const chain = { select: () => chain, eq: (...args: unknown[]) => { op.filters.push(args); return chain; },
      upsert: (value: unknown) => { op.upsert = value; return chain; },
      single: async () => result, maybeSingle: async () => result,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return chain;
  });
  const admin = { listUsers: vi.fn(async () => ({ data: { users: options.existing ? [user] : [] }, error: null })),
    generateLink: vi.fn(async (input: { type: string }) => ({ data: { user,
      properties: { hashed_token: "secret-token", verification_type: input.type } }, error: null })),
    updateUserById: vi.fn(async () => ({ error: null })) };
  return { sb: { from, auth: { admin } } as unknown as SupabaseClient, admin, operations };
}

describe("applicant portal access emails", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.send.mockResolvedValue({ ok: true }); });
  it("invites a new email, creates candidate membership, and keeps anonymous onboarding linked until redemption", async () => {
    const { sb, admin, operations } = client();
    expect(await sendApplicantPortalAccessEmail(sb, { tenantId: "tenant-a", workerId: "worker-1", origin: "http://localhost:3000" })).toEqual({ sent: true });
    expect(admin.generateLink).toHaveBeenCalledWith({ type: "invite", email: "person@example.com" });
    expect(operations.find((op) => op.table === "user_roles" && op.upsert)?.upsert).toMatchObject({ role: "candidate", tenant_id: "tenant-a" });
    expect(operations.find((op) => op.table === "worker")?.filters).toContainEqual(["tenant_id", "tenant-a"]);
    expect(mocks.send.mock.calls[0][0].body).toContain("/candidate-access?tenant=acme#token_hash=secret-token");
    expect(mocks.send.mock.calls[0][0].subject).toContain("Set up");
  });
  it("generates a fresh sign-in link on every application for an existing candidate", async () => {
    const { sb, admin } = client({ existing: true, role: "candidate" });
    for (let i = 0; i < 2; i++) await sendApplicantPortalAccessEmail(sb, { tenantId: "tenant-b", workerId: "worker-1", origin: "http://localhost:3000" });
    expect(admin.generateLink).toHaveBeenCalledTimes(2);
    expect(admin.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "person@example.com" });
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[0][0].subject).toContain("Sign in");
    expect(admin.updateUserById).not.toHaveBeenCalled();
  });
  it.each([{ role: "admin" }, { role: "candidate", inactive: true }])("does not overwrite staff or revoked memberships: %o", async (options) => {
    const { sb, admin } = client({ existing: true, ...options });
    expect((await sendApplicantPortalAccessEmail(sb, { tenantId: "tenant-a", workerId: "worker-1", origin: "http://localhost:3000" })).sent).toBe(false);
    expect(admin.generateLink).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("reports delivery failure without throwing away a saved application", async () => {
    mocks.send.mockResolvedValue({ ok: false, error: "Provider unavailable" });
    const { sb } = client();
    expect(await sendApplicantPortalAccessEmail(sb, { tenantId: "tenant-a", workerId: "worker-1", origin: "http://localhost:3000" }))
      .toEqual({ sent: false, error: "Provider unavailable" });
  });
  it("rejects an untrusted email origin before generating a bearer token", async () => {
    const { sb, admin } = client();
    expect((await sendApplicantPortalAccessEmail(sb, { tenantId: "tenant-a", workerId: "worker-1", origin: "https://phishing.example" })).sent).toBe(false);
    expect(admin.generateLink).not.toHaveBeenCalled();
  });
});
