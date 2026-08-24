import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStaffProfilePhotoUrl } from "@/lib/account/staff-profile-photo";

export type StaffUserSummary = {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
};

export function staffDisplayName(
  first: string | null | undefined,
  last: string | null | undefined,
  email?: string | null
): string {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name || email?.trim() || "Team member";
}

/** Batch-load tenant staff users with resolved profile photo URLs. */
export async function loadStaffUsersByIds(
  supabase: SupabaseClient,
  tenantId: string,
  userIds: string[]
): Promise<Map<string, StaffUserSummary>> {
  const unique = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
  const result = new Map<string, StaffUserSummary>();
  if (!unique.length) return result;

  const { data: users, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, email, profile_photo")
    .eq("tenant_id", tenantId)
    .in("id", unique);

  if (error) throw error;

  await Promise.all(
    (users ?? []).map(async (user) => {
      const id = String(user.id);
      const profilePhotoUrl = await resolveStaffProfilePhotoUrl(supabase, user.profile_photo);
      result.set(id, {
        id,
        name: staffDisplayName(user.first_name, user.last_name, user.email),
        profilePhotoUrl,
      });
    })
  );

  return result;
}
