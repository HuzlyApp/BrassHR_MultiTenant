import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { resolveApplicantSigningProfile } from "@/lib/onboarding/resolve-applicant-signing-profile";
import { resolveOnboardingWorker } from "@/lib/onboarding/resolve-onboarding-worker";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || "";
    const tenantSlug = req.nextUrl.searchParams.get("tenantSlug")?.trim() || "";

    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const workerCtx = await resolveOnboardingWorker(supabase, applicantId, tenantSlug || null);
    if (!workerCtx) {
      return NextResponse.json(
        { error: "Worker not found", code: "WORKER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const profile = await resolveApplicantSigningProfile(
      supabase,
      workerCtx.workerId,
      applicantId
    );

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "A valid applicant email is required before signing. Complete the first onboarding step with your email address.",
          code: "INVALID_APPLICANT_EMAIL",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      profile: {
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
      },
    });
  } catch (err: unknown) {
    console.error("[onboarding/applicant-signing-profile GET]", err);
    const message = err instanceof Error ? err.message : "Failed to resolve applicant signing profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
