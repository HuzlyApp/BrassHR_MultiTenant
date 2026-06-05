import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

export const LOGIN_OTP_LENGTH = 6;

export const MAGIC_LINK_OTP_SUBJECT = "Your Brass HR login code";

export const MAGIC_LINK_OTP_CONTENT = `<h2>Your Brass HR login code</h2>
<p>Enter this 6-digit code on the login screen:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:8px;margin:16px 0;">{{ .Token }}</p>
<p style="color:#64748b;font-size:14px;">This code expires soon. If you did not try to log in, ignore this email.</p>`;

export function getSupabaseProjectRef(): string | null {
  const url = getSupabaseUrl();
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0]?.trim();
    return ref || null;
  } catch {
    return null;
  }
}

export type ApplyOtpTemplateResult =
  | { ok: true; verified: true }
  | { ok: false; error: string; verified?: false };

type AuthConfigSlice = {
  mailer_templates_magic_link_content?: string;
};

async function fetchAuthConfig(ref: string, token: string): Promise<AuthConfigSlice | null> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as AuthConfigSlice;
}

export function isOtpTemplateConfigured(config: AuthConfigSlice | null): boolean {
  const body = config?.mailer_templates_magic_link_content ?? "";
  return body.includes("{{ .Token }}") && !body.includes("{{ .ConfirmationURL }}");
}

export async function applySupabaseMagicLinkOtpTemplate(): Promise<ApplyOtpTemplateResult> {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const ref = getSupabaseProjectRef();

  if (!token) {
    return {
      ok: false,
      error:
        "Missing SUPABASE_ACCESS_TOKEN. Add it to .env.local and run: npm run setup:supabase-otp-template",
    };
  }
  if (!ref) {
    return { ok: false, error: "Could not read project ref from NEXT_PUBLIC_SUPABASE_URL." };
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mailer_subjects_magic_link: MAGIC_LINK_OTP_SUBJECT,
      mailer_templates_magic_link_content: MAGIC_LINK_OTP_CONTENT,
      mailer_otp_length: LOGIN_OTP_LENGTH,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { ok: false, error: detail.slice(0, 600) || `HTTP ${res.status}` };
  }

  const config = await fetchAuthConfig(ref, token);
  if (!isOtpTemplateConfigured(config)) {
    return {
      ok: false,
      error:
        "Supabase still uses Magic Link template. Dashboard → Authentication → Email Templates → Magic Link → use {{ .Token }} only.",
      verified: false,
    };
  }

  return { ok: true, verified: true };
}

export async function postSupabaseEmailOtp(email: string): Promise<{ error: string | null }> {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return { error: "Supabase URL or anon key missing." };
  }

  const res = await fetch(`${url}/auth/v1/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      email,
      create_user: false,
    }),
  });

  if (res.ok) {
    return { error: null };
  }

  let message = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { msg?: string; error_description?: string; message?: string };
    message = body.msg ?? body.error_description ?? body.message ?? message;
  } catch {
    /* ignore */
  }
  return { error: message };
}
