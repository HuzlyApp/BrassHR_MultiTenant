// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InviteStepPanel } from "./InviteStepPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup() {
  const onComplete = vi.fn();
  const onSkip = vi.fn();
  render(<InviteStepPanel onBack={vi.fn()} onSkip={onSkip} onComplete={onComplete} />);
  return { onComplete, onSkip };
}

describe("launch pad team invitations", () => {
  it("requires email before sending an invitation", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Email is required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires names before sending an invitation", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setup();
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "staff@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
    expect(screen.getByRole("alert")).toHaveTextContent("First name is required.");
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Last name is required.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the entered names with the invitation and completes after success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const { onComplete } = setup();
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: " Ana " } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: " Cruz " } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "staff@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          firstName: "Ana",
          lastName: "Cruz",
          email: "staff@example.com",
          role: "recruiter",
          requirePasswordChange: true,
          origin: window.location.origin,
        }),
      })
    );
  });

  it("keeps invitations optional through Skip when no email is entered", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { onComplete, onSkip } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a recoverable error on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { onComplete } = setup();
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: "Cruz" } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "staff@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not send invite. Please try again."
    );
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send Invite" })).toBeEnabled();
  });
});
