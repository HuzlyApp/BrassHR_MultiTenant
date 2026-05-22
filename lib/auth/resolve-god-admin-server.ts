import type { User } from "@supabase/supabase-js";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Server: god admin from JWT app_metadata, then `users.god_admin`. */
export async function resolveGodAdminServer(
  user: Pick<User, "id" | "app_metadata"> | null | undefined
): Promise<boolean> {
  if (isGodAdminUser(user)) return true;
  if (!user?.id) return false;

  const sb = createServiceRoleClient();
  if (!sb) return false;

  const { data } = await sb.from("users").select("god_admin").eq("id", user.id).maybeSingle();
  return (data as { god_admin?: boolean } | null)?.god_admin === true;
}
