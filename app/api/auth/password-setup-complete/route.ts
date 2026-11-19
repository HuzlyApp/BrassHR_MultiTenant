import { NextRequest, NextResponse } from "next/server";
import { completeStaffPasswordSetup } from "@/lib/admin/complete-staff-password-setup";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * Called after a successful password update (invite activation or reset).
 * Clears must_change_password and accepts pending staff invitations.
 *
 * Uses the recovery/invite session directly — must NOT require OTP staff
 * verification (requireApiSession), or invite activation can never finish.
 */
export async function POST(req: NextRequest) {
  const userClient = await createClient();
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    await completeStaffPasswordSetup(supabase, {
      userId: user.id,
      email: typeof user.email === "string" ? user.email : null,
      request: req,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/password-setup-complete]", err);
    return NextResponse.json({ error: "Could not finish password setup." }, { status: 500 });
  }
}
