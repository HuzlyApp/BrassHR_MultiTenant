import { describe, expect, it } from "vitest";
import { canManageStaffUsers, requireUserManagement } from "@/lib/auth/user-management";
import type { ApiAuthContext } from "@/lib/auth/api-session";

function auth(role: ApiAuthContext["role"], godAdmin = false): ApiAuthContext {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "staff@example.com",
    role,
    godAdmin,
    devBypass: false,
  };
}

describe("user management authorization", () => {
  it("blocks recruiters from the admin console", () => {
    expect(canManageStaffUsers(auth("recruiter"))).toBe(false);
    expect(requireUserManagement(auth("recruiter"))?.status).toBe(403);
  });

  it("allows tenant admins and platform admins", () => {
    expect(canManageStaffUsers(auth("admin"))).toBe(true);
    expect(requireUserManagement(auth("admin"))).toBeNull();
    expect(requireUserManagement(auth("recruiter", true))).toBeNull();
  });
});
