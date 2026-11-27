import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ allowed: true, previous: null as null | { id: string; is_anonymous: boolean }, grant: vi.fn(), revoke: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ auth: { getUser: async (token: string) => ({ data: { user: token === "old-token" ? state.previous : { id: "fresh-user", is_anonymous: true } }, error: null }), admin: { signOut: state.signOut } }, from: (table: string) => {
 const q = { select: () => q, or: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: "tenant" }, error: null }), update: (value: unknown) => { state.revoke(value); return q; }, then: (resolve: (value: unknown) => void) => Promise.resolve({ error: null }).then(resolve) }; return q;
} }) }));
vi.mock("@/lib/onboarding/initial-application-session", () => ({ checkInitialApplicationSession: (...args: unknown[]) => { state.grant(...args); return Promise.resolve(state.allowed); } }));
import { POST, DELETE } from "./route";
const req = (method = "POST", old = false, origin = "https://example.test") => new NextRequest("https://example.test/api/onboarding/session", { method, headers: { origin, authorization: "Bearer new-token", "Content-Type": "application/json", ...(old ? { cookie: "brass_applicant_access=old-token" } : {}) }, ...(method === "POST" ? { body: JSON.stringify({ tenantSlug: "zippycorp", jobToken: "job" }) } : {}) });
describe("applicant session bridge", () => {
 beforeEach(() => { vi.clearAllMocks(); state.allowed = true; state.previous = null; });
 it("permits a new first application after binding its tenant and job", async () => { const response = await POST(req()); expect(response.status).toBe(200); expect(state.grant.mock.calls[0].slice(-3)).toEqual(["tenant", "job", true]); expect(response.cookies.get("brass_applicant_access")?.httpOnly).toBe(true); });
 it("requires sign-in for a subsequent or expired flow", async () => { state.allowed = false; expect((await POST(req())).status).toBe(401); });
 it("does not reuse device memory on reload and expires the prior anonymous grant", async () => { state.previous = { id: "previous-person", is_anonymous: true }; expect((await POST(req("POST", true))).status).toBe(401); expect(state.revoke).toHaveBeenCalled(); expect(state.signOut).toHaveBeenCalledWith("old-token", "local"); expect(state.grant).not.toHaveBeenCalled(); });
 it("explicit different-person reset clears the HTTP-only applicant cookie", async () => { state.previous = { id: "previous-person", is_anonymous: true }; const response = await DELETE(req("DELETE", true)); expect(response.status).toBe(200); expect(response.cookies.get("brass_applicant_access")?.value).toBe(""); expect(state.signOut).toHaveBeenCalledWith("old-token", "local"); });
 it("does not revoke a signed-in candidate or staff token when clearing applicant context", async () => { state.previous = { id: "candidate", is_anonymous: false }; expect((await DELETE(req("DELETE", true))).status).toBe(200); expect(state.signOut).not.toHaveBeenCalled(); });
 it("rejects cross-origin resets", async () => { expect((await DELETE(req("DELETE", true, "https://evil.test"))).status).toBe(403); expect(state.revoke).not.toHaveBeenCalled(); });
});
