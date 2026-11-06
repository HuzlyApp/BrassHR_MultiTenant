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
        json: async () => ({ configured: true, callers: [], defaultUserId: null }),
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
});
