import { NextRequest, NextResponse } from "next/server";
import {
  loadOwnerTrialPreparationStatus,
  resolveOwnerTrialPreparationUser,
} from "@/lib/auth/resolve-owner-trial-preparation-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * GET — poll owner trial preparation without requiring a live Supabase auth session.
 */
export async function GET(req: NextRequest) {
  const ctx = await resolveOwnerTrialPreparationUser(req);
  if (!ctx) {
    console.info("[signup/trial-status] unauthorized_no_context");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const status = await loadOwnerTrialPreparationStatus(svc, ctx.userId);
  console.info("[signup/trial-status]", {
    userId: ctx.userId,
    source: ctx.source,
    phase: status.phase,
    emailSent: status.emailSent,
  });

  return NextResponse.json({
    ok: true,
    ...status,
  });
}
