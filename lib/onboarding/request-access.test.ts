import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ user: null as null | { id: string }, rows: {} as Record<string, unknown>, queries: [] as Array<[string, string, unknown]> }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({
  auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
  from: (table: string) => {
    const q = { select: () => q, eq: (key: string, value: unknown) => { state.queries.push([table, key, value]); return q; }, or: () => q,
      maybeSingle: async () => ({ data: state.rows[table] ?? null, error: null }) };
    return q;
  },
}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) }));
vi.mock("@/lib/onboarding/applicant-continuation-link", () => ({ hashContinuationToken: (v: string) => `hashed:${v}` }));
vi.mock("@/lib/auth/module-access.server", () => ({ authorizeStaffHttpAccess: vi.fn() }));
vi.mock("@/lib/email-templates/resolve-effective-tenant", () => ({ resolveEffectiveAdminTenantId: vi.fn() }));
import { authorizeOnboardingRequest } from "./request-access";
const request = (body: object, cookie = "brass_applicant_access=token") => new NextRequest("https://example.test/api/onboarding/direct-deposit", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });

describe("applicant request ownership", () => {
  beforeEach(() => { state.user = { id: "owner" }; state.rows = {}; state.queries = []; });
  it("rejects requests without any verified identity", async () => {
    expect((await authorizeOnboardingRequest(request({ applicantId: "victim" }, "")))?.status).toBe(401);
  });
  it("rejects an invalid access token", async () => {
    state.user = null;
    expect((await authorizeOnboardingRequest(request({ applicantId: "owner" })))?.status).toBe(401);
  });
  it("accepts an anonymous Supabase identity for its own initial onboarding", async () => {
    expect(await authorizeOnboardingRequest(request({ applicantId: "owner" }))).toBeNull();
  });
  it("rejects another applicant's identifier", async () => {
    expect((await authorizeOnboardingRequest(request({ applicantId: "victim" })))?.status).toBe(403);
  });
  it("rejects a worker that is not owned in the selected tenant", async () => {
    expect((await authorizeOnboardingRequest(request({ applicantId: "owner", workerId: "other", tenantId: "tenant-b" })))?.status).toBe(403);
    expect(state.queries).toContainEqual(["worker", "user_id", "owner"]);
    expect(state.queries).toContainEqual(["worker", "tenant_id", "tenant-b"]);
  });
  it("rejects a signing request even when an attacker supplies their own applicantId", async () => {
    state.rows.worker_firma_signing_sessions = { worker_id: "victim-worker", tenant_id: "tenant-b" };
    expect((await authorizeOnboardingRequest(request({ applicantId: "owner", signingRequestId: "victim-signing" })))?.status).toBe(403);
  });
  it("rejects a foreign application", async () => {
    state.rows.job_applications = { worker_id: "victim-worker", tenant_id: "tenant-b" };
    expect((await authorizeOnboardingRequest(request({ applicantId: "owner", applicationId: "victim-application" })))?.status).toBe(403);
  });
  it("accepts an owned application and scopes its worker lookup", async () => {
    state.rows.job_applications = { worker_id: "worker-a", tenant_id: "tenant-a" };
    state.rows.worker = { id: "worker-a", tenant_id: "tenant-a" };
    expect(await authorizeOnboardingRequest(request({ applicantId: "owner", applicationId: "application-a" }))).toBeNull();
    expect(state.queries).toContainEqual(["worker", "tenant_id", "tenant-a"]);
  });
  it("rejects cross-origin cookie writes", async () => {
    const req = request({ applicantId: "owner" }); req.headers.set("origin", "https://evil.test");
    expect((await authorizeOnboardingRequest(req))?.status).toBe(403);
  });
  it("rejects conflicting body and query identities", async () => {
    const req = new NextRequest("https://example.test/api/onboarding/save-worker?applicantId=victim", { method: "POST", headers: { "content-type": "application/json", cookie: "brass_applicant_access=token" }, body: JSON.stringify({ applicantId: "owner" }) });
    expect((await authorizeOnboardingRequest(req))?.status).toBe(403);
  });
  it("rejects conflicting snake-case and camel-case identity aliases", async () => {
    expect((await authorizeOnboardingRequest(request({applicantId:"owner",applicant_id:"victim"})))?.status).toBe(403);
  });
  it("rejects conflicting multipart identities", async () => {
    const body = new FormData(); body.append("applicantId","owner"); body.append("applicantId","victim");
    const req = new NextRequest("https://example.test/api/upload-resume", {method:"POST",headers:{cookie:"brass_applicant_access=token"},body});
    expect((await authorizeOnboardingRequest(req))?.status).toBe(403);
  });
  it("requires the continuation secret, not a link row ID", async () => {
    expect((await authorizeOnboardingRequest(request({ applicantId: "owner" }, "applicant_continuation_session=row-id")))?.status).toBe(403);
    expect(state.queries).toContainEqual(["applicant_continuation_links", "token_hash", "hashed:row-id"]);
  });
  it("accepts an active continuation token for its own worker", async () => {
    state.rows.applicant_continuation_links = { worker_id: "worker-a", tenant_id: "tenant-a", applicant_user_id: "owner", expires_at: "2099-01-01" };
    state.rows.worker = { id: "worker-a", user_id: "owner", tenant_id: "tenant-a" };
    expect(await authorizeOnboardingRequest(request({ applicantId: "owner", tenantId: "tenant-a" }, "applicant_continuation_session=secret"))).toBeNull();
  });
  it("rejects continuation access to a different tenant", async () => {
    state.rows.applicant_continuation_links = { worker_id: "worker-a", tenant_id: "tenant-a", applicant_user_id: "owner", expires_at: "2099-01-01" };
    expect((await authorizeOnboardingRequest(request({ applicantId: "owner", tenantId: "tenant-b" }, "applicant_continuation_session=secret")))?.status).toBe(403);
  });
  it.each(["revoked_at", "completed_at"])("rejects %s continuation links", async (field) => {
    state.rows.applicant_continuation_links = { worker_id: "worker-a", tenant_id: "tenant-a", expires_at: "2099-01-01", [field]: "2026-01-01" };
    expect((await authorizeOnboardingRequest(request({ applicantId: "owner" }, "applicant_continuation_session=secret")))?.status).toBe(403);
  });
});
