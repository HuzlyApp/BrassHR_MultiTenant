// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SecurityTab from "@/app/admin_recruiter/account/components/SecurityTab";
import { PASSWORD_UPDATE_SUCCESS_MESSAGE } from "@/lib/account/password-update";

const mockRefresh = vi.fn(async () => undefined);
const mockUpdateUser = vi.fn();
const mockFrom = vi.fn();

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
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/account/fetch-account-data", () => ({
  syncAccountChecklist: vi.fn(async () => ({ user_id: "auth-user-1", security_completed: true })),
}));

describe("SecurityTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ data: { user: authUser }, error: null });
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the authenticated Supabase Auth user email", () => {
    render(<SecurityTab />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("zipstaffcom@gmail.com")).toBeInTheDocument();
  });

  it("keeps submit disabled when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<SecurityTab />);

    const newPassword = screen.getByLabelText("New Password");
    const confirmPassword = screen.getByLabelText("Confirm Password");
    await user.type(newPassword, "BrassHRPass1!");
    await user.type(confirmPassword, "BrassHRPass2!");

    expect(screen.getByRole("button", { name: /update password/i })).toBeDisabled();
  });

  it("keeps submit disabled for weak passwords", async () => {
    const user = userEvent.setup();
    render(<SecurityTab />);

    const newPassword = screen.getByLabelText("New Password");
    const confirmPassword = screen.getByLabelText("Confirm Password");
    await user.type(newPassword, "weak");
    await user.type(confirmPassword, "weak");

    expect(screen.getByRole("button", { name: /update password/i })).toBeDisabled();
  });

  it("updates Supabase Auth password on successful submit", async () => {
    const user = userEvent.setup();
    render(<SecurityTab />);

    const newPassword = screen.getByLabelText("New Password");
    const confirmPassword = screen.getByLabelText("Confirm Password");
    await user.type(newPassword, "BrassHRPass1!");
    await user.type(confirmPassword, "BrassHRPass1!");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "BrassHRPass1!" });
    });

    expect(screen.getByRole("status")).toHaveTextContent(PASSWORD_UPDATE_SUCCESS_MESSAGE);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows Supabase Auth error messages on failure", async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "New password should be different from the old password." },
    });

    const user = userEvent.setup();
    render(<SecurityTab />);

    const newPassword = screen.getByLabelText("New Password");
    const confirmPassword = screen.getByLabelText("Confirm Password");
    await user.type(newPassword, "BrassHRPass1!");
    await user.type(confirmPassword, "BrassHRPass1!");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "New password should be different from the old password."
      );
    });
  });

  it("does not write passwords to public.users on submit", async () => {
    const user = userEvent.setup();
    render(<SecurityTab />);

    const newPassword = screen.getByLabelText("New Password");
    const confirmPassword = screen.getByLabelText("Confirm Password");
    await user.type(newPassword, "BrassHRPass1!");
    await user.type(confirmPassword, "BrassHRPass1!");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalled();
    });

    const usersUpdateCalls = mockFrom.mock.calls.filter(([table]) => table === "users");
    for (const [, chain] of usersUpdateCalls) {
      const updateArg = chain?.update?.mock?.calls?.[0]?.[0];
      if (updateArg) {
        expect(updateArg).not.toHaveProperty("password");
      }
    }
  });
});
