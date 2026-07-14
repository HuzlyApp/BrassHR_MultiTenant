import { NextResponse } from "next/server";
import { findAuthUserIdByEmail } from "@/lib/auth/find-auth-user-by-email";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { normalizeTenantEmail } from "@/lib/tenant/tenant-email-uniqueness";

/**
 * Lightweight existence check for forgot-password UI.
 * Does not send email and does not call generateLink(recovery).
 */
export async function POST(req: Request) {
  let body: { email?: unknown } = {};
  try {
    body = (await req.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = normalizeTenantEmail(typeof body.email === "string" ? body.email : "");
  const limited = await enforceRateLimit(req, {
    namespace: "forgot-password-check-email",
    key: `${getClientIp(req)}:${email || "missing"}`,
    limit: Number(process.env.RATE_LIMIT_EMAIL_CHECK_PER_HOUR ?? 30),
    windowMs: 60 * 60 * 1000,
    failClosed: false,
  });
  if (limited) return limited;

  if (!email.includes("@")) {
    return NextResponse.json({ exists: false, reason: "invalid" as const });
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  try {
    const userId = await findAuthUserIdByEmail(svc, email);
    if (!userId) {
      return NextResponse.json({ exists: false, reason: "not_found" as const });
    }
    return NextResponse.json({ exists: true, reason: "found" as const });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lookup failed";
    console.error("[forgot-password/check-email]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
