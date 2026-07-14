import { NextRequest, NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/auth/send-password-reset-email";
import { resolveAppOrigin } from "@/lib/resolve-app-origin";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { normalizeTenantEmail } from "@/lib/tenant/tenant-email-uniqueness";
import { getEffectiveRootDomain } from "@/lib/tenant/tenant-host-resolution";

export const runtime = "nodejs";

function isAllowedPasswordResetOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
    const root = getEffectiveRootDomain().toLowerCase();
    return host === root || host === `www.${root}` || host.endsWith(`.${root}`);
  } catch {
    return false;
  }
}

/**
 * Checks account exists, builds a recovery link, and emails it via Resend
 * (login OTP delivery path — avoids broken Supabase Auth SMTP for recovery).
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown; origin?: unknown; returnTo?: unknown } = {};
  try {
    body = (await req.json()) as { email?: unknown; origin?: unknown; returnTo?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = normalizeTenantEmail(typeof body.email === "string" ? body.email : "");
  const limited = await enforceRateLimit(req, {
    namespace: "forgot-password-send",
    key: `${getClientIp(req)}:${email || "missing"}`,
    limit: Number(process.env.RATE_LIMIT_EMAIL_CHECK_PER_HOUR ?? 30),
    windowMs: 60 * 60 * 1000,
    failClosed: false,
  });
  if (limited) return limited;

  if (!email.includes("@")) {
    return NextResponse.json(
      { error: "Enter a valid email address.", reason: "invalid" },
      { status: 400 }
    );
  }

  const clientOrigin =
    typeof body.origin === "string" && body.origin.trim() ? body.origin.trim() : null;
  const resolvedOrigin = resolveAppOrigin(req, clientOrigin);
  if (!resolvedOrigin || !isAllowedPasswordResetOrigin(resolvedOrigin)) {
    return NextResponse.json(
      { error: "Invalid redirect origin for password reset." },
      { status: 400 }
    );
  }

  const returnTo =
    typeof body.returnTo === "string" && body.returnTo.startsWith("/") && !body.returnTo.startsWith("//")
      ? body.returnTo
      : null;

  const result = await sendPasswordResetEmail({
    email,
    appOrigin: resolvedOrigin,
    returnTo,
  });

  if (!result.ok) {
    const status =
      result.reason === "not_found" || result.reason === "invalid"
        ? 404
        : result.reason === "rate_limit"
          ? 429
          : result.reason === "config"
            ? 503
            : 500;
    return NextResponse.json(
      { error: result.message, reason: result.reason ?? "send_failed" },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
