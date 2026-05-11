import type { User } from "@supabase/supabase-js";

export function isGodAdminUser(user: Pick<User, "app_metadata"> | null | undefined): boolean {
  if (!user?.app_metadata || typeof user.app_metadata !== "object") return false;
  const md = user.app_metadata as Record<string, unknown>;
  if (md.god_admin === true) return true;
  if (typeof md.role === "string" && md.role.trim().toLowerCase() === "god_admin") return true;
  return false;
}
