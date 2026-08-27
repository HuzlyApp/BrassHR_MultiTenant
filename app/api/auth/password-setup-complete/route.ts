import { NextRequest, NextResponse } from "next/server";
import { completeStaffPasswordSetup } from "@/lib/admin/complete-staff-password-setup";
import { requireApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * Called after a successful password update (invite activation or reset).
 * Clears must_change_password and accepts pending staff invitations.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    await completeStaffPasswordSetup(supabase, { userId: auth.userId, request: req });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/password-setup-complete]", error);
    return NextResponse.json({ error: "Could not finish password setup." }, { status: 500 });
  }
}
