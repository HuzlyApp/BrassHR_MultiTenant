import { NextResponse } from "next/server";
import { applySupabaseMagicLinkOtpTemplate } from "@/lib/auth/supabase-magic-link-otp-template";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";

export const runtime = "nodejs";

/** POST /api/auth/setup-otp-template — patch Supabase Magic Link template for {{ .Token }}. */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;

  const result = await applySupabaseMagicLinkOtpTemplate();
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        hint: "Add SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens, restart npm run dev.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    verified: result.verified,
    message: "Supabase configured for 6-digit login codes. Try logging in again.",
  });
}
