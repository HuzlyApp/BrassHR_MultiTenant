import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStaffProfilePhotoUrl } from "@/lib/account/staff-profile-photo";
import { formatRoleLabel } from "@/lib/account/display-name";
import { loadStaffRoles, matchStaffRole } from "@/lib/admin/staff-roles";

export type StaffUserSummary = {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
  /** Raw role key from user_roles / users (e.g. recruiter, admin). */
  role: string | null;
  /** Display label from staff_roles catalog (e.g. Recruiter, Admin). */
  roleLabel: string | null;
};

export function staffDisplayName(
  first: string | null | undefined,
  last: string | null | undefined,
  email?: string | null
): string {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name || email?.trim() || "Team member";
}

/** "Jane Doe (Recruiter)" — role omitted when unknown. */
export function formatStaffNameWithRole(
  user: Pick<StaffUserSummary, "name" | "roleLabel"> | null | undefined
): string {
  const name = user?.name?.trim() || "";
  if (!name) return "";
  const role = user?.roleLabel?.trim() || "";
  return role ? `${name} (${role})` : name;
}

/** Batch-load tenant staff users with resolved profile photo URLs and role labels. */
export async function loadStaffUsersByIds(
  supabase: SupabaseClient,
  tenantId: string,
  userIds: string[]
): Promise<Map<string, StaffUserSummary>> {
  const unique = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
  const result = new Map<string, StaffUserSummary>();
  if (!unique.length) return result;

  const [{ data: users, error }, { data: memberships, error: membershipError }, catalog] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, first_name, last_name, email, profile_photo, role")
        .eq("tenant_id", tenantId)
        .in("id", unique),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("tenant_id", tenantId)
        .in("user_id", unique),
      loadStaffRoles(supabase).catch(() => []),
    ]);

  if (error) throw error;
  if (membershipError) throw membershipError;

  const membershipRoleById = new Map(
    ((memberships ?? []) as Array<{ user_id: string; role: string | null }>).map((row) => [
      String(row.user_id),
      typeof row.role === "string" ? row.role.trim().toLowerCase() : "",
    ])
  );

  await Promise.all(
    (users ?? []).map(async (user) => {
      const id = String(user.id);
      const profilePhotoUrl = await resolveStaffProfilePhotoUrl(supabase, user.profile_photo);
      const storedRole =
        membershipRoleById.get(id) ||
        (typeof user.role === "string" ? user.role.trim().toLowerCase() : "") ||
        null;
      const match = storedRole ? matchStaffRole(storedRole, catalog) : null;
      result.set(id, {
        id,
        name: staffDisplayName(user.first_name, user.last_name, user.email),
        profilePhotoUrl,
        role: match?.key ?? storedRole,
        roleLabel: match?.label ?? (storedRole ? formatRoleLabel(storedRole, catalog) : null),
      });
    })
  );

  return result;
}
