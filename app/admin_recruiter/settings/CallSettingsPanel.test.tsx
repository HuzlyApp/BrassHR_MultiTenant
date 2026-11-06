// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CallSettingsPanel from "@/app/admin_recruiter/settings/CallSettingsPanel";

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe("CallSettingsPanel", () => {
  it("loads Dialpad users and places a call with the entered number", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            configured: true,
            defaultUserId: "22",
            callers: [
              { id: "22", name: "Alex Recruiter", emails: [], phones: ["+14155550100"], online: true },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          callId: "99",
          phoneNumber: "+14155550199",
          caller: { id: "22", name: "Alex Recruiter" },
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<CallSettingsPanel />);

    const phone = await screen.findByLabelText("Phone number");
    await user.type(phone, "4155550199");
    await user.click(screen.getByRole("button", { name: "Call" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("Alex Recruiter is being rung");
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/dialpad",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ phoneNumber: "4155550199", userId: "22" }),
      })
    );
  });
});
