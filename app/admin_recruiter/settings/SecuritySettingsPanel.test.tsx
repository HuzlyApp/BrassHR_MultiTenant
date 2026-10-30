// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SecuritySettingsPanel from "@/app/admin_recruiter/settings/SecuritySettingsPanel";

const listFactors = vi.fn();
const enroll = vi.fn();
const challengeAndVerify = vi.fn();
const unenroll = vi.fn();

vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({
  useAccountData: () => ({
    user: { email: "huzly@zippy.example" },
    organization: { name: "Zippy Corp" },
  }),
}));

vi.mock("@/lib/supabase-browser", () => ({
  supabaseBrowser: {
    auth: {
      mfa: {
        listFactors: (...args: unknown[]) => listFactors(...args),
        enroll: (...args: unknown[]) => enroll(...args),
        challengeAndVerify: (...args: unknown[]) => challengeAndVerify(...args),
        unenroll: (...args: unknown[]) => unenroll(...args),
        getAuthenticatorAssuranceLevel: vi.fn(),
      },
    },
  },
}));

const svgQr = "<svg xmlns='http://www.w3.org/2000/svg'><text>qr</text></svg>";

const emptyFactors = { data: { all: [], totp: [] }, error: null };
const verifiedFactors = {
  data: {
    all: [
      {
        id: "factor-1",
        factor_type: "totp",
        status: "verified",
        friendly_name: "Authenticator app",
        created_at: "2026-10-31T00:00:00Z",
      },
    ],
    totp: [
      {
        id: "factor-1",
        factor_type: "totp",
        status: "verified",
        friendly_name: "Authenticator app",
      },
    ],
  },
  error: null,
};

describe("SecuritySettingsPanel authenticator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listFactors
      .mockResolvedValueOnce(emptyFactors)
      .mockResolvedValueOnce(emptyFactors)
      .mockResolvedValue(verifiedFactors);
    unenroll.mockResolvedValue({ data: { id: "factor-1" }, error: null });
    enroll.mockResolvedValue({
      data: {
        id: "factor-1",
        type: "totp",
        totp: { qr_code: svgQr, secret: "ABCD1234EFGH5678", uri: "otpauth://totp/example" },
      },
      error: null,
    });
    challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  });

  it("enrolls from the Supabase QR code and turns the authenticator on after the code matches", async () => {
    const user = userEvent.setup();
    render(<SecuritySettingsPanel />);

    expect(await screen.findByRole("button", { name: "Set up authenticator" })).toBeTruthy();
    expect(screen.getByText("huzly@zippy.example")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Set up authenticator" }));

    const qr = await screen.findByRole("img", { name: "Authenticator QR code" });
    expect(qr.getAttribute("src")).toContain("data:image/svg+xml");
    expect(screen.getByText("ABCD 1234 EFGH 5678")).toBeTruthy();
    expect(enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Authenticator app",
      issuer: "Zippy Corp",
    });

    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Enable authenticator" }));

    await waitFor(() => {
      expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
    });

    expect(await screen.findByText("Authenticator app is on.")).toBeTruthy();
  });
});
