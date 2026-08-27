import { describe, expect, it } from "vitest";
import {
  deriveInvitationStatus,
  deriveMemberStatus,
  sanitizeStaffAuditMetadata,
  toDirectoryMemberRow,
  validateInviteStaffInput,
} from "@/lib/admin/staff-directory-status";
import { buildStaffActivationUrl } from "@/lib/admin/send-staff-invite-email";

describe("staff invite validation", () => {
  it("normalizes email and defaults role to recruiter", () => {
    const result = validateInviteStaffInput({
      firstName: " Ada ",
      lastName: "Lovelace",
      email: "Ada@Example.COM",
    });
    expect(result).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      role: "recruiter",
      requirePasswordChange: true,
    });
  });

  it("rejects invalid email and blank names", () => {
    expect(validateInviteStaffInput({ firstName: "", lastName: "L", email: "a@b.com" })).toEqual({
      error: "First name is required.",
    });
    expect(validateInviteStaffInput({ firstName: "A", lastName: "L", email: "not-an-email" })).toEqual({
      error: "Enter a valid email address.",
    });
  });
});

describe("staff directory status", () => {
  it("marks expired pending invitations", () => {
    expect(
      deriveInvitationStatus({
        status: "pending",
        expiresAt: "2020-01-01T00:00:00.000Z",
        nowMs: Date.parse("2026-08-28T00:00:00.000Z"),
      })
    ).toBe("expired");
  });

  it("keeps members pending until password setup completes", () => {
    expect(
      deriveMemberStatus({
        membershipActive: true,
        mustChangePassword: true,
        invitationStatus: "pending",
      })
    ).toBe("pending");
    expect(
      deriveMemberStatus({
        membershipActive: true,
        mustChangePassword: false,
        invitationStatus: null,
      })
    ).toBe("active");
  });

  it("does not treat a pending member as Active", () => {
    const row = toDirectoryMemberRow({
      userId: "user-1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      dbRole: "client",
      membershipActive: true,
      mustChangePassword: true,
      invitationId: "inv-1",
      invitationStatus: "pending",
      invitationDate: "2026-08-28T00:00:00.000Z",
      lastLogin: null,
      createdByUserId: "admin-1",
      createdByName: "Owner",
      isSelf: false,
      isLastAdmin: false,
    });
    expect(row.status).toBe("pending");
    expect(row.statusLabel).toBe("Invitation Pending");
    expect(row.roleLabel).toBe("Recruiter");
  });
});

describe("staff audit sanitization", () => {
  it("strips passwords, tokens, and service keys", () => {
    const sanitized = sanitizeStaffAuditMetadata({
      email: "ada@example.com",
      role: "recruiter",
      password: "secret",
      hashed_token: "abc",
      action_link: "https://example.com/auth/v1/verify?token=abc",
      notes: "invited",
    });
    expect(sanitized).toEqual({ email: "ada@example.com", role: "recruiter", notes: "invited" });
  });
});

describe("staff activation URL", () => {
  it("uses the app-hosted reset page and never includes a password", () => {
    const url = buildStaffActivationUrl({
      appOrigin: "https://jobs.brasshr.com",
      hashedToken: "hashed-token-value",
      tenantSlug: "acme",
    });
    expect(url).toContain("/reset-password");
    expect(url).toContain("token_hash=hashed-token-value");
    expect(url).not.toMatch(/password=/i);
  });
});
