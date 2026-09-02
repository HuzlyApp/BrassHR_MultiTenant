import { describe, expect, it } from "vitest";
import {
  homeStaffTenantId,
  staffHasTenantMembership,
} from "@/lib/auth/recruiter-onboarding-status.server";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("staffHasTenantMembership", () => {
  it("allows access when no tenant was requested", () => {
    expect(
      staffHasTenantMembership({
        requestedTenantId: null,
        profileTenantId: TENANT_A,
        roleRows: [],
      })
    ).toBe(true);
  });

  it("matches the home-tenant profile even when user_roles is empty", () => {
    expect(
      staffHasTenantMembership({
        requestedTenantId: TENANT_A.toUpperCase(),
        profileTenantId: TENANT_A,
        roleRows: [],
      })
    ).toBe(true);
  });

  it("matches a recruiter (client) membership on the requested tenant", () => {
    expect(
      staffHasTenantMembership({
        requestedTenantId: TENANT_A,
        profileTenantId: TENANT_B,
        roleRows: [{ tenant_id: TENANT_A, role: "client", is_active: true }],
      })
    ).toBe(true);
  });

  it("does not treat an admin membership on another tenant as access", () => {
    expect(
      staffHasTenantMembership({
        requestedTenantId: TENANT_A,
        profileTenantId: TENANT_B,
        roleRows: [{ tenant_id: TENANT_B, role: "admin", is_active: true }],
      })
    ).toBe(false);
  });

  it("allows access when no tenant id was resolved for a requested slug", () => {
    expect(
      staffHasTenantMembership({
        requestedTenantId: null,
        profileTenantId: TENANT_A,
        roleRows: [{ tenant_id: TENANT_A, role: "admin", is_active: true }],
      })
    ).toBe(true);
  });

  it("ignores suspended memberships", () => {
    expect(
      staffHasTenantMembership({
        requestedTenantId: TENANT_A,
        profileTenantId: null,
        roleRows: [{ tenant_id: TENANT_A, role: "client", is_active: false }],
      })
    ).toBe(false);
  });
});

describe("homeStaffTenantId", () => {
  it("uses the profile home tenant for an invited admin", () => {
    expect(
      homeStaffTenantId({
        profileTenantId: TENANT_A,
        profileRole: "admin",
        profileActive: true,
        roleRows: [{ tenant_id: TENANT_A, role: "admin", is_active: true }],
      })
    ).toBe(TENANT_A);
  });

  it("falls back to an active user_roles membership", () => {
    expect(
      homeStaffTenantId({
        profileTenantId: null,
        profileRole: null,
        roleRows: [{ tenant_id: TENANT_B, role: "client", is_active: true }],
      })
    ).toBe(TENANT_B);
  });
});
