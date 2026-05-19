import type { User } from "@supabase/supabase-js";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { supabaseBrowser } from "@/lib/supabase-browser";

/** Client: god admin from JWT app_metadata, then optional API (users.god_admin). */
export async function resolveGodAdminClient(user: User | null | undefined): Promise<boolean> {
  if (isGodAdminUser(user)) return true;
  if (!user?.id) return false;

  try {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    const token = session?.access_token;
    if (!token) return false;

    const res = await fetch("/api/auth/god-admin", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const payload = (await res.json()) as { godAdmin?: boolean };
    return payload.godAdmin === true;
  } catch {
    return false;
  }
}
