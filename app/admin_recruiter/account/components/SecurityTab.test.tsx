// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountPreferencesPanel from "./AccountPreferencesPanel";
import SecurityTab from "@/app/admin_recruiter/account/components/SecurityTab";
import { PASSWORD_UPDATE_SUCCESS_MESSAGE } from "@/lib/account/password-update";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/admin/hooks/use-staff-module-access", () => ({ useModulePermission: () => ({ canView: true, canEdit: true, canDelete: true }) }));

const mockRefresh = vi.fn(async () => undefined);
const mockUpdateUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockFrom = vi.fn();
const mockFetch = vi.fn();

const authUser = {
  id: "auth-user-1",
  email: "zipstaffcom@gmail.com",
  identities: [{ provider: "email" }],
};

vi.mock("@/app/admin_recruiter/hooks/useAccountData", () => ({
  useAccountData: () => ({
    user: authUser,
    profile: {
      id: "auth-user-1",
      first_name: "John",
      last_name: "Doe",
      full_name: "John Doe",
      email: "zipstaffcom@gmail.com",
      phone: null,
      avatar_url: null,
      role: "admin",
      job_title: null,
      organization_id: "tenant-1",
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      zip_code: null,
      created_at: null,
      updated_at: null,
    },
    organization: { id: "tenant-1", name: "Zip Staff" },
    settings: { user_id: "auth-user-1" },
    checklist: { user_id: "auth-user-1", security_completed: false },
    loading: false,
    error: null,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/supabase-browser", () => ({
  supabaseBrowser: {
    auth: {
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      mfa: {
        listFactors: vi.fn(async () => ({ data: { all: [], totp: [] }, error: null })),
        enroll: vi.fn(),
        challengeAndVerify: vi.fn(),
        unenroll: vi.fn(),
        getAuthenticatorAssuranceLevel: vi.fn(),
      },
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/account/fetch-account-data", () => ({
  syncAccountChecklist: vi.fn(async () => ({ user_id: "auth-user-1", security_completed: true })),
}));

vi.mock("@/app/components/tenant/TenantBrandingContext", () => ({
  useTenantBranding: () => ({ primaryHex: "#012352", companyName: "Zip Staff" }),
}));

async function fillValidPasswordForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Current Password"), "CurrentPass1!");
  await user.type(screen.getByLabelText("New Password"), "BrassHRPass1!");
  await user.type(screen.getByLabelText("Confirm Password"), "BrassHRPass1!");
}

describe("SecurityTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ data: { user: authUser }, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: { user: authUser }, error: null });
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: {}, error: null })),
        })),
      })),
    });
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/account/password-change/request")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            email: authUser.email,
            resendCount: 0,
            maxResends: 5,
            expiresInSeconds: 300,
            resendAvailableInSeconds: 30,
          }),
        };
      }
      if (url.includes("/api/account/password-change/confirm")) {
        return {
          ok: true,
          json: async () => ({ ok: true, email: authUser.email }),
        };
      }
      return { ok: false, json: async () => ({ error: "Unexpected fetch" }) };
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the authenticated Supabase Auth user email", () => {
    render(<SecurityTab />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("zipstaffcom@gmail.com")).toBeInTheDocument();
  });

  it("shows password and authenticator together on one security card", async () => {
    render(<SecurityTab />);

    expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Update Password" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Authenticator app" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Set up authenticator" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enable 2FA" })).toBeNull();
    expect(screen.getByRole("button", { name: "Deactivate Account" })).toBeInTheDocument();
  });

  it("starts Change Email blank and shows invalid email errors inline", async () => {
    const user = userEvent.setup();
    render(<AccountPreferencesPanel variant="preferences" />);
    await user.click(screen.getByRole("button", { name: "Change Email" }));
    const input = screen.getByLabelText("New email");
    expect(input).toHaveValue("");
    await user.type(input, "not-an-email");
    await user.tab();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("keeps submit disabled when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<SecurityTab />);

    await user.type(screen.getByLabelText("Current Password"), "CurrentPass1!");
    await user.type(screen.getByLabelText("New Password"), "BrassHRPass1!");
    await user.type(screen.getByLabelText("Confirm Password"), "BrassHRPass2!");

    expect(screen.getByRole("button", { name: /update password/i })).toBeDisabled();
  });

  it("keeps submit disabled for weak passwords", async () => {
    const user = userEvent.setup();
    render(<SecurityTab />);

    await user.type(screen.getByLabelText("Current Password"), "CurrentPass1!");
    await user.type(screen.getByLabelText("New Password"), "weak");
    await user.type(screen.getByLabelText("Confirm Password"), "weak");

    expect(screen.getByRole("button", { name: /update password/i })).toBeDisabled();
  });

  it("keeps submit disabled without current password", async () => {
    const user = userEvent.setup();
    render(<SecurityTab />);

    await user.type(screen.getByLabelText("New Password"), "BrassHRPass1!");
    await user.type(screen.getByLabelText("Confirm Password"), "BrassHRPass1!");

    expect(screen.getByRole("button", { name: /update password/i })).toBeDisabled();
  });

  it("opens OTP modal after validating current password via API (no browser re-login)", async () => {
    const user = userEvent.setup();
    render(<SecurityTab />);

    await fillValidPasswordForm(user);
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/account/password-change/request",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog", { name: /enter code/i })).toBeInTheDocument();
    expect(screen.getByText(/we've sent a verification code/i)).toBeInTheDocument();
  });

  it("shows an error when the current password is incorrect", async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/account/password-change/request")) {
        return {
          ok: false,
          json: async () => ({
            error: "Current password is incorrect.",
            code: "INVALID_CREDENTIALS",
            field: "password",
          }),
        };
      }
      return { ok: false, json: async () => ({ error: "Unexpected fetch" }) };
    });

    const user = userEvent.setup();
    render(<SecurityTab />);

    await fillValidPasswordForm(user);
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Current password is incorrect.");
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: /enter code/i })).not.toBeInTheDocument();
  });

  it("verifies OTP then updates password and shows success without browser sign-in", async () => {
    const user = userEvent.setup();
    render(<SecurityTab />);

    await fillValidPasswordForm(user);
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByRole("dialog", { name: /enter code/i })).toBeInTheDocument();

    const digitInputs = screen.getAllByLabelText(/digit \d/i);
    for (let i = 0; i < 6; i += 1) {
      await user.type(digitInputs[i]!, String(i + 1));
    }
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/account/password-change/confirm",
        expect.objectContaining({ method: "POST" })
      );
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "BrassHRPass1!" });
    });

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalled();
    expect(await screen.findByText("Password updated")).toBeInTheDocument();
    expect(screen.getByText(PASSWORD_UPDATE_SUCCESS_MESSAGE)).toBeInTheDocument();
  });

  it("shows Supabase Auth error messages on password update failure after OTP", async () => {
    mockUpdateUser.mockRejectedValue(
      new Error("New password should be different from the old password.")
    );

    const user = userEvent.setup();
    render(<SecurityTab />);

    await fillValidPasswordForm(user);
    await user.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByRole("dialog", { name: /enter code/i })).toBeInTheDocument();

    const digitInputs = screen.getAllByLabelText(/digit \d/i);
    for (let i = 0; i < 6; i += 1) {
      await user.type(digitInputs[i]!, "1");
    }
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "New password should be different from the old password."
      );
    });
  });

  it("does not write passwords to public.users on submit", async () => {
    const user = userEvent.setup();
    render(<SecurityTab />);

    await fillValidPasswordForm(user);
    await user.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByRole("dialog", { name: /enter code/i })).toBeInTheDocument();

    const digitInputs = screen.getAllByLabelText(/digit \d/i);
    for (let i = 0; i < 6; i += 1) {
      await user.type(digitInputs[i]!, "9");
    }
    await user.click(screen.getByRole("button", { name: /verify code/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled();
    });

    const usersUpdateCalls = mockFrom.mock.calls.filter(([table]) => table === "users");
    for (const call of usersUpdateCalls) {
      const chain = call[1] as { update?: { mock?: { calls?: unknown[][] } } } | undefined;
      const updateArg = chain?.update?.mock?.calls?.[0]?.[0] as Record<string, unknown> | undefined;
      if (updateArg) {
        expect(updateArg).not.toHaveProperty("password");
      }
    }
  });
});
