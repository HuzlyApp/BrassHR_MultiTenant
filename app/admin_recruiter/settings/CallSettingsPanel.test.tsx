// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CallSettingsPanel from "@/app/admin_recruiter/settings/CallSettingsPanel";
import { postDialpadCti } from "@/lib/dialpad/cti";

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/dialpad/cti", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dialpad/cti")>("@/lib/dialpad/cti");
  return { ...actual, postDialpadCti: vi.fn() };
});

describe("CallSettingsPanel", () => {
  it("opens a ringing screen and asks Dialpad to call the number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          configured: true,
          callers: [],
          defaultUserId: null,
          calls: [
            {
              id: "1",
              direction: "outbound",
              state: "hangup",
              startedAt: "2026-11-06T12:04:00.000Z",
              durationSeconds: 75,
              externalNumber: "+19194519662",
              contactName: "Jordan Lee",
              targetName: "ZipStaff Main Ops",
            },
          ],
          callsError: null,
        }),
      })
    );

    const user = userEvent.setup();
    render(<CallSettingsPanel />);

    const phone = await screen.findByLabelText("Phone number");
    await user.type(phone, "4155550199");
    await user.click(screen.getByRole("button", { name: "Call" }));

    expect(screen.getByRole("dialog", { name: "Calling +1 415 555 0199" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Sign in to Dialpad");
    expect(screen.getByRole("button", { name: "Mute" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Speaker" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "End call" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Call logs" })).toBeTruthy();
    expect(screen.getByText("Jordan Lee")).toBeTruthy();
    expect(screen.getByText("Outbound")).toBeTruthy();
    expect(postDialpadCti).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "initiate_call" })
    );

    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(screen.getByRole("button", { name: "Mute" }).getAttribute("aria-pressed")).toBe("true");
    expect(postDialpadCti).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "mute_call" })
    );
  });

  it("answers an inbound Dialpad ring on this page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ configured: true, callers: [], calls: [], callsError: null }),
      })
    );
    const user = userEvent.setup();
    render(<CallSettingsPanel />);
    await screen.findByLabelText("Phone number");

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://dialpad.com",
        data: {
          api: "opencti_dialpad",
          method: "call_ringing",
          payload: {
            state: "on",
            id: "5747322335264768",
            external_number: "+16043111111",
            contact: { name: "Jordan Lee", phone: "+16043111111" },
          },
        },
      })
    );

    expect(await screen.findByRole("dialog", { name: "Incoming call from Jordan Lee" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Incoming");
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(postDialpadCti).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "answer_call" })
    );
    expect(screen.getByRole("status").textContent).toMatch(/0:00/);
  });

  it("declines an inbound Dialpad ring", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ configured: true, callers: [], calls: [], callsError: null }),
      })
    );
    const user = userEvent.setup();
    render(<CallSettingsPanel />);
    await screen.findByLabelText("Phone number");

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://dialpad.com",
        data: {
          api: "opencti_dialpad",
          method: "call_ringing",
          payload: { state: "on", id: "88", external_number: "+14155550100" },
        },
      })
    );

    await user.click(await screen.findByRole("button", { name: "Decline" }));
    expect(postDialpadCti).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "decline_call", payload: { call_id: "88" } })
    );
  });
});
