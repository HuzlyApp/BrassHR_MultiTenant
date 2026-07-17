import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import {
  normalizeTenantEmail,
  resolveOwnerSignupEmailAvailability,
} from "@/lib/tenant/tenant-email-uniqueness";

/**
 * Checks whether a work email can be used for new Braas HR owner signup.
 */
export async function GET(req: Request) {
  const email = normalizeTenantEmail(new URL(req.url).searchParams.get("email") ?? "");
  const limited = await enforceRateLimit(req, {
    namespace: "signup-check-email",
    key: `${getClientIp(req)}:${email || "missing"}`,
    limit: Number(process.env.RATE_LIMIT_EMAIL_CHECK_PER_HOUR ?? 30),
    windowMs: 60 * 60 * 1000,
    failClosed: false,
  });
  if (limited) return limited;

  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  try {
    const availability = await resolveOwnerSignupEmailAvailability(svc, email);
    if (!availability.available) {
      return NextResponse.json({
        available: false,
        reason: availability.reason === "invalid" ? ("invalid" as const) : ("taken" as const),
      });
    }

    return NextResponse.json({
      available: true,
      reason: availability.reason === "resume" ? ("resume" as const) : ("new" as const),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not validate email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
