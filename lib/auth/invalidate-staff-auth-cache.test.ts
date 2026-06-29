import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidateUserCache = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/cache", () => ({
  invalidateUserCache,
}));

import { invalidateStaffAuthCaches } from "@/lib/auth/invalidate-staff-auth-cache";

describe("invalidateStaffAuthCaches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates staff scope, profile, effective-branding, and header-data caches", async () => {
    const userId = "user-abc";
    await invalidateStaffAuthCaches(userId);

    expect(invalidateUserCache).toHaveBeenCalledTimes(4);
    expect(invalidateUserCache).toHaveBeenCalledWith("staff_scope", userId);
    expect(invalidateUserCache).toHaveBeenCalledWith("staff_user_profile", userId);
    expect(invalidateUserCache).toHaveBeenCalledWith("admin_effective_branding", userId);
    expect(invalidateUserCache).toHaveBeenCalledWith("admin_header_data", userId);
  });
});
