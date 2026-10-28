// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminConsolePanel from "@/app/admin_recruiter/settings/AdminConsolePanel";
import type { StaffDirectoryRow } from "@/lib/admin/staff-directory-types";

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const pendingRecruiter: StaffDirectoryRow = {
  id: "invitation:inv-recruiter",
  kind: "invitation",
  userId: null,
  invitationId: "inv-recruiter",
  firstName: "Ada",
  lastName: "Lovelace",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "recruiter",
  roleLabel: "Recruiter",
  status: "pending",
  statusLabel: "Invitation Pending",
  invitationDate: "2026-08-28T00:00:00.000Z",
  lastLogin: null,
  createdByUserId: "admin-1",
  createdByName: "Owner",
  canResend: true,
  canChangeRole: false,
  canSuspend: false,
  canReactivate: false,
  canRemove: true,
};

const pendingAdmin: StaffDirectoryRow = {
  ...pendingRecruiter,
  id: "invitation:inv-admin",
  invitationId: "inv-admin",
  firstName: "Grace",
  lastName: "Hopper",
  name: "Grace Hopper",
  email: "grace@example.com",
  role: "admin",
  roleLabel: "Admin",
};

const activeMember: StaffDirectoryRow = {
  id: "member:user-1",
  kind: "member",
  userId: "user-1",
  invitationId: null,
  firstName: "Pat",
  lastName: "Lee",
  name: "Pat Lee",
  email: "pat@example.com",
  role: "recruiter",
  roleLabel: "Recruiter",
  status: "active",
  statusLabel: "Active",
  invitationDate: "2026-08-01T00:00:00.000Z",
  lastLogin: "2026-08-20T00:00:00.000Z",
  createdByUserId: "admin-1",
  createdByName: "Owner",
  canResend: false,
  canChangeRole: true,
  canSuspend: true,
  canReactivate: false,
  canRemove: true,
};

describe("AdminConsolePanel resend invitation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.endsWith("/api/admin/users") && method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              users: [pendingRecruiter, pendingAdmin, activeMember],
              roles: [
                { key: "admin", label: "Admin", isAdmin: true },
                { key: "recruiter", label: "Recruiter", isAdmin: false },
              ],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("splits admins and recruiters and keeps resend in the row menu", async () => {
    const user = userEvent.setup();
    render(<AdminConsolePanel />);

    await waitFor(() => {
      expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    });
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite User" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actions for Grace Hopper" }));
    expect(screen.getByRole("menuitem", { name: "Resend invitation" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Recruiters" }));
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Pat Lee")).toBeInTheDocument();
    expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actions for Ada Lovelace" }));
    expect(screen.getByRole("menuitem", { name: "Resend invitation" })).toBeInTheDocument();
  });

  it("posts the invitation id when resend is clicked", async () => {
    const user = userEvent.setup();
    render(<AdminConsolePanel />);

    await waitFor(() => {
      expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Recruiters" }));
    await user.click(screen.getByRole("button", { name: "Actions for Ada Lovelace" }));
    await user.click(screen.getByRole("menuitem", { name: "Resend invitation" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/users/invitations/inv-recruiter",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
