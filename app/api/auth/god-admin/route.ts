import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Whether the current session user is a platform god admin (JWT or users.god_admin). */
export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  let godAdmin = auth.godAdmin;
  if (!godAdmin) {
    const sb = createServiceRoleClient();
    if (sb) {
      const { data } = await sb.from("users").select("god_admin").eq("id", auth.userId).maybeSingle();
      godAdmin = (data as { god_admin?: boolean } | null)?.god_admin === true;
    }
  }

  return NextResponse.json({ godAdmin });
}
