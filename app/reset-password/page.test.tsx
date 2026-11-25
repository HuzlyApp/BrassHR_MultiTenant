// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import SetPasswordPage from "@/app/set-password/page";
import ResetPasswordPage from "./page";

const mocks = vi.hoisted(() => ({
  current: null as Session | null,
  verified: null as Session | null,
  search: new URLSearchParams(),
  router: { push: vi.fn() },
  verify: vi.fn(), setSession: vi.fn(), update: vi.fn(), signOut: vi.fn(), fetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, useSearchParams: () => mocks.search }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/login/BraasLoginShell", () => ({ interStyle: {}, loginFieldLabelClass: "", loginInputTextClass: "", loginPrimaryButtonClass: "" }));
vi.mock("@/app/components/RedirectionProgressModal", () => ({
  default: ({ message }: { message: string }) => <p>{message.includes("set successfully") ? "Password set" : "Password updated"}</p>,
}));
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { auth: {
  getSession: async () => ({ data: { session: mocks.current } }),
  verifyOtp: (...args: unknown[]) => mocks.verify(...args),
  signOut: (...args: unknown[]) => mocks.signOut(...args),
} } }));
vi.mock("@/lib/supabase/ephemeral-auth-client", () => ({ createEphemeralAuthClient: () => ({ auth: {
  setSession: (...args: unknown[]) => mocks.setSession(...args),
  updateUser: (...args: unknown[]) => mocks.update(...args),
} }) }));

function session(id: string): Session {
  const payload = Buffer.from(JSON.stringify({ session_id: `${id}-session` })).toString("base64url");
  return { access_token: `header.${payload}.sig`, refresh_token: `${id}-refresh`, user: { id, email: `${id}@real-mail.test` } } as Session;
}
let sequence = 0;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = new URLSearchParams(`token_hash=link-${++sequence}&type=recovery`);
  mocks.current = session("admin");
  mocks.verified = session("hr");
  mocks.verify.mockImplementation(async () => {
    mocks.current = mocks.verified;
    return { data: { session: mocks.verified }, error: null };
  });
  mocks.setSession.mockResolvedValue({ data: { session: mocks.verified }, error: null });
  mocks.update.mockResolvedValue({ data: { user: mocks.verified!.user }, error: null });
  mocks.fetch.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", mocks.fetch);
});
async function readyInvite() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Set password" })).toBeEnabled());
  expect(screen.getByRole("heading", { name: "Set your password" })).toBeInTheDocument();
  expect(screen.getByText("hr@real-mail.test")).toBeInTheDocument();
}
function submitInvite() {
  fireEvent.change(screen.getByPlaceholderText("New password"), { target: { value: "Invited2026!Secure" } });
  fireEvent.change(screen.getByPlaceholderText("Confirm password"), { target: { value: "Invited2026!Secure" } });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
}
describe("invitation password identity", () => {
  it("uses rotated credentials only when they still belong to the verified recovery session", async () => {
    render(<SetPasswordPage />); await readyInvite();
    mocks.current = { ...mocks.verified!, refresh_token: "hr-rotated-refresh" };
    mocks.setSession.mockResolvedValue({ data: { session: mocks.current }, error: null });
    submitInvite();
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.setSession).toHaveBeenCalledWith(expect.objectContaining({ refresh_token: "hr-rotated-refresh" }));
  });
  it("verifies the invitee rather than updating the signed-in admin", async () => {
    render(<SetPasswordPage />); await readyInvite(); submitInvite();
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ password: "Invited2026!Secure" }));
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: mocks.verified!.access_token, refresh_token: "hr-refresh" });
    expect(mocks.fetch).toHaveBeenCalledWith("/api/auth/password-setup-complete", expect.objectContaining({ headers: { Authorization: `Bearer ${mocks.verified!.access_token}` } }));
  });
  it("rejects an admin account switch before submission", async () => {
    render(<SetPasswordPage />); await readyInvite(); mocks.current = session("admin"); submitInvite();
    await screen.findByRole("alert");
    expect(mocks.setSession).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("pins the mutation even if shared cookies change during the request", async () => {
    mocks.setSession.mockImplementation(async () => {
      mocks.current = session("admin");
      return { data: { session: mocks.verified }, error: null };
    });
    render(<SetPasswordPage />); await readyInvite(); submitInvite();
    await screen.findByText("Password set");
    expect(mocks.setSession).toHaveBeenCalledWith(expect.objectContaining({ refresh_token: "hr-refresh" }));
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("does not reuse an old consumed link for an unrelated current account", async () => {
    const first = render(<SetPasswordPage />); await readyInvite(); first.unmount();
    mocks.current = session("admin"); render(<SetPasswordPage />);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Set password" })).toBeDisabled();
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("forgot-password reset page", () => {
  it("keeps reset wording on /reset-password", async () => {
    render(<ResetPasswordPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled());
    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toBeInTheDocument();
  });
});
