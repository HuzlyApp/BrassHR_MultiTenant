import { invalidateUserCache } from "@/lib/cache";

/** Clear short-TTL staff auth/profile/scope caches after tenant switch or profile writes. */
export async function invalidateStaffAuthCaches(userId: string): Promise<void> {
  await Promise.all([
    invalidateUserCache("staff_scope", userId),
    invalidateUserCache("staff_user_profile", userId),
    invalidateUserCache("admin_effective_branding", userId),
    invalidateUserCache("admin_header_data", userId),
  ]);
}
