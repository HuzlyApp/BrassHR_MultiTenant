import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import {
  FirmaOnboardingSigningError,
  shouldCompleteOnboardingStepFromFirmaStatus,
  syncFirmaSigningSessionStatus,
} from "@/lib/onboarding/firma-onboarding-signing";
import { mapFirmaStatusToOnboardingStatus } from "@/lib/onboarding/firma-step-settings";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { resolveFirmaOnboardingContext } from "@/lib/onboarding/resolve-firma-onboarding-context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || "";
    const stepKey = req.nextUrl.searchParams.get("stepKey")?.trim() || "";
    const stepId = req.nextUrl.searchParams.get("stepId")?.trim() || "";
    const tenantSlug = req.nextUrl.searchParams.get("tenantSlug")?.trim() || "";
    const preferDraftConfig = req.nextUrl.searchParams.get("preview") === "draft";
    if (!applicantId || !stepKey) {
      return NextResponse.json({ error: "Missing applicantId or stepKey" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const resolved = await resolveFirmaOnboardingContext({
      supabase,
      applicantId,
      stepKey,
      stepId: stepId || null,
      tenantSlug: tenantSlug || null,
      preferDraftConfig,
    });

    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, code: resolved.code },
        { status: resolved.status }
      );
    }

    const { data: worker } = await supabase
      .from("worker")
      .select("first_name, last_name, email")
      .eq("id", resolved.workerId)
      .maybeSingle();

    const session = await syncFirmaSigningSessionStatus({
      supabase,
      tenantId: resolved.tenantId,
      workerId: resolved.workerId,
      applicantEmail: worker?.email?.trim() || applicantId,
      applicantFirstName: worker?.first_name?.trim() || "Applicant",
      applicantLastName: worker?.last_name?.trim() || null,
      step: resolved.step,
    });

    const onboardingStatus = mapFirmaStatusToOnboardingStatus(session.firma_status);
    const completed = shouldCompleteOnboardingStepFromFirmaStatus(session.firma_status);

    const progressPayload = await ensureWorkerOnboardingProgress(
      supabase,
      resolved.workerId,
      resolved.tenantId
    );
    const progressStatus = completed ? "completed" : onboardingStatus === "in_progress" ? "in_progress" : "pending";

    if (progressStatus !== "pending") {
      const { error: upErr } = await supabase
        .from("worker_onboarding_step_progress")
        .update({
          status: progressStatus,
          completed_at: completed ? new Date().toISOString() : null,
          data: {
            signing_provider: "firma",
            signing_request_id: session.signing_request_id,
            firma_status: session.firma_status,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("worker_onboarding_progress_id", progressPayload.progressId)
        .eq("onboarding_step_id", resolved.step.id);

      if (upErr) throw upErr;
    }

    return NextResponse.json({
      session,
      onboarding_status: onboardingStatus,
      completed,
    });
  } catch (err: unknown) {
    if (err instanceof FirmaOnboardingSigningError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[onboarding/firma-sign/status]", err);
    const message = err instanceof Error ? err.message : "Failed to sync Firma signing status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
