// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

async function addInviteToList(values: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  fireEvent.click(screen.getByRole("button", { name: "Add another" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/First name/), {
    target: { value: values.firstName },
  });
  fireEvent.change(within(dialog).getByLabelText(/Last name/), {
    target: { value: values.lastName },
  });
  fireEvent.change(within(dialog).getByLabelText(/Email/), {
    target: { value: values.email },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add in list" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

describe("launch pad team invitations", () => {
  it("disables footer Send Invite until someone is on the list", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ roles: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    setup();
    expect(screen.getByRole("button", { name: "Send Invite" })).toBeDisabled();
  });

  it("adds a teammate through the modal and shows Send Invite on the row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ roles: [] }) })
    );
    setup();
    await addInviteToList({
      firstName: "Ana",
      lastName: "Cruz",
      email: "staff@example.com",
    });
    expect(screen.getByDisplayValue("staff@example.com")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Send Invite" }).length).toBeGreaterThan(0);
  });

  it("sends a row invite and shows Invite Sent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ roles: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const { onComplete } = setup();
    await addInviteToList({
      firstName: " Ana ",
      lastName: " Cruz ",
      email: "staff@example.com",
    });
    const rowSendButtons = screen.getAllByRole("button", { name: "Send Invite" });
    fireEvent.click(rowSendButtons[0]!);
    expect(await screen.findByRole("button", { name: "Invite Sent" })).toBeInTheDocument();
    expect(screen.getByText(/Invites sent to 1 person/i)).toBeInTheDocument();
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
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("keeps invitations optional through Skip when no email is entered", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ roles: [] }) })
    );
    const { onComplete, onSkip } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("shows a recoverable error on network failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ roles: [] }) })
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const { onComplete } = setup();
    await addInviteToList({
      firstName: "Ana",
      lastName: "Cruz",
      email: "staff@example.com",
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Send Invite" })[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not send invite. Please try again."
    );
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Send Invite" })[0]).toBeEnabled();
  });

  it("continues after invites are sent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ roles: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const { onComplete } = setup();
    await addInviteToList({
      firstName: "Ana",
      lastName: "Cruz",
      email: "staff@example.com",
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Send Invite" })[0]!);
    await screen.findByRole("button", { name: "Invite Sent" });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
