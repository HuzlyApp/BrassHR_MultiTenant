import { describe, expect, it } from "vitest";
import { staffAccessDeniedMessage, type StaffAccessFlags } from "@/lib/admin/staff-access";

function flags(overrides: Partial<StaffAccessFlags> = {}): StaffAccessFlags {
  return {
    userActive: true,
    membershipActive: true,
    mustChangePassword: false,
    hasStaffMembership: true,
    ...overrides,
  };
}

describe("staff access flags", () => {
  it("blocks login until the invitation password is set", () => {
    expect(staffAccessDeniedMessage(flags({ mustChangePassword: true }))).toMatch(/invitation email/i);
  });

  it("blocks suspended accounts", () => {
    expect(staffAccessDeniedMessage(flags({ userActive: false, membershipActive: false }))).toMatch(
      /disabled/i
    );
  });

  it("allows active staff", () => {
    expect(staffAccessDeniedMessage(flags())).toBeNull();
  });
});
