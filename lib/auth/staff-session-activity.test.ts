import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn(), signOut: vi.fn(), configured: true }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => state.configured ? { rpc: state.rpc, auth: { admin: { signOut: state.signOut } } } : null }));
import { checkStaffSessionActivity } from "./staff-session-activity";
describe("durable staff activity", () => {
  beforeEach(() => { vi.resetAllMocks(); state.configured = true; state.rpc.mockResolvedValue({ data: true, error: null }); });
  it("ordinary reads check without extending activity", async () => {
    expect(await checkStaffSessionActivity("user", "session")).toBe(true);
    expect(state.rpc).toHaveBeenCalledWith("check_staff_session_activity", { p_user_id: "user", p_session_id: "session", p_action: "check" });
    expect(state.signOut).not.toHaveBeenCalled();
  });
  it("revokes only the expired session's refresh tokens", async () => {
    state.rpc.mockResolvedValue({ data: false, error: null });
    expect(await checkStaffSessionActivity("user", "session", "touch", "verified-token")).toBe(false);
    expect(state.signOut).toHaveBeenCalledWith("verified-token", "local");
  });
  it("fails closed on database failure or missing configuration", async () => {
    state.rpc.mockResolvedValue({ data: null, error: new Error("unavailable") });
    expect(await checkStaffSessionActivity("user", "session")).toBe(false);
    state.configured = false;
    expect(await checkStaffSessionActivity("user", "session")).toBe(false);
  });
});
