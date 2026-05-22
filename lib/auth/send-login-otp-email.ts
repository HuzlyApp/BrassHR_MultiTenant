import { applySupabaseMagicLinkOtpTemplate } from "@/lib/auth/supabase-magic-link-otp-template";
import { createEphemeralAuthClient } from "@/lib/supabase/ephemeral-auth-client";

export type SendLoginOtpResult = { ok: true } | { ok: false; message: string };

/**
 * Sends a 6-digit login code via Supabase Auth (signInWithOtp).
 * Requires Magic Link email template to use {{ .Token }} (not {{ .ConfirmationURL }}).
 */
export async function sendSupabaseLoginOtp(email: string): Promise<SendLoginOtpResult> {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    const applied = await applySupabaseMagicLinkOtpTemplate();
    if (!applied.ok) {
      return { ok: false, message: applied.error };
    }
  }

  const auth = createEphemeralAuthClient();
  if (!auth) {
    return { ok: false, message: "Login is not configured. Contact support." };
  }

  const { error } = await auth.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
