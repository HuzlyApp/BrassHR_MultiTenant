// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockReturnValue(window);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it("shows call controls immediately even when Dialpad never responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {}))
    );

    render(<CallSettingsPanel />);

    expect(await screen.findByLabelText("Phone number")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Call" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Call logs" })).toBeTruthy();
  });

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
    const dialpad = screen.getByTitle("Dialpad");
    expect(dialpad.getAttribute("allow")).toContain("microphone");
    expect(dialpad.getAttribute("allow")).toContain("camera");
    await user.type(phone, "4155550199");
    await user.click(screen.getByRole("button", { name: "Call" }));
    expect(screen.getByTitle("Dialpad").className).not.toContain("opacity-0");

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

it("ends a stalled call-log refresh with a retry state in six seconds", async () => {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), ms);
    return controller.signal;
  });
  vi.stubGlobal("fetch", vi.fn((_url: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason));
  })));
  render(<CallSettingsPanel />);
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(screen.getByText("Dialpad timed out. Try refreshing call logs.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
