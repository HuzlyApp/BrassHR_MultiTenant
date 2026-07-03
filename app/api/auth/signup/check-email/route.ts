import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";
import {
  findPlatformOwnerEmailConflict,
  normalizeTenantEmail,
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

  if (!email.includes("@")) {
    return NextResponse.json({ available: false, reason: "invalid" as const });
  }

  const platformConflict = await findPlatformOwnerEmailConflict(svc, email);
  if (platformConflict) {
    return NextResponse.json({ available: false, reason: "taken" as const });
  }

  const { data: list, error: listErr } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const authUser = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
  if (!authUser) {
    return NextResponse.json({ available: true, reason: "new" as const });
  }

  return NextResponse.json({ available: true, reason: "resume" as const });
}
