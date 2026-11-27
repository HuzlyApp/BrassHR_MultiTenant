import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { checkInitialApplicationSession } from "./initial-application-session";
const token = (sub = "applicant", session_id = "session") => `header.${Buffer.from(JSON.stringify({ sub, session_id })).toString("base64url")}.signature`;
const user = { id: "applicant", is_anonymous: true } as User;
describe("first public application grant", () => {
  it("binds the verified identity, session, tenant and job without starting on reads", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    expect(await checkInitialApplicationSession({ rpc } as unknown as SupabaseClient, user, token(), "tenant", "job")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("check_initial_application_session", { p_user_id: "applicant", p_session_id: "session", p_tenant_id: "tenant", p_job_token: "job", p_start: false });
  });
  it.each([false, null])("rejects missing, expired or completed grants (%s)", async (data) => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    expect(await checkInitialApplicationSession({ rpc } as unknown as SupabaseClient, user, token(), "tenant", "second-job", true)).toBe(false);
  });
  it("rejects a mismatched subject before consulting the database", async () => {
    const rpc = vi.fn();
    expect(await checkInitialApplicationSession({ rpc } as unknown as SupabaseClient, user, token("victim"), "tenant", "job")).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not restrict a signed-in candidate to their first job", async () => {
    const rpc = vi.fn();
    expect(await checkInitialApplicationSession({ rpc } as unknown as SupabaseClient, { ...user, is_anonymous: false }, token(), "tenant", "second-job")).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
