import { resolveOnboardingWorker, readOnboardingTenantSlugFromRequest } from "@/lib/onboarding/resolve-onboarding-worker";
import { authorizeOnboardingRequest } from "@/lib/onboarding/request-access";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadWorkerNotesForWorkerId } from "@/lib/worker-notes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const accessDenied = await authorizeOnboardingRequest(req);
  if (accessDenied) return accessDenied;

  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || "";
    if (!applicantId) {
      return NextResponse.json({ notes: [] });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ notes: [] });
    }

    const ctx = await resolveOnboardingWorker(supabase, applicantId, readOnboardingTenantSlugFromRequest(req));
    if (!ctx?.workerId) {
      return NextResponse.json({ notes: [] });
    }

    const notes = await loadWorkerNotesForWorkerId(supabase, ctx.workerId, {
      authorFallback: "Manager",
      authorDisplay: "staff_role",
    });

    return NextResponse.json({ notes });
  } catch (err) {
    console.error("[onboarding/worker-notes]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
