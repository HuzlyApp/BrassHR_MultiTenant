import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import {
  FirmaOnboardingSigningError,
  ensureFirmaDraftPreviewSigningSession,
  ensureFirmaSigningSession,
} from "@/lib/onboarding/firma-onboarding-signing";
import { resolveFirmaOnboardingContext } from "@/lib/onboarding/resolve-firma-onboarding-context";

export const runtime = "nodejs";

async function resolveApplicantProfile(
  supabase: SupabaseClient,
  workerId: string,
  applicantId: string
) {
  const { data, error } = await supabase
    .from("worker")
    .select("first_name, last_name, email")
    .eq("id", workerId)
    .maybeSingle();

  if (error) throw error;

  const row = data as { first_name?: string | null; last_name?: string | null; email?: string | null } | null;

  return {
    firstName: row?.first_name?.trim() || "Applicant",
    lastName: row?.last_name?.trim() || null,
    email: row?.email?.trim() || applicantId,
  };
}

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

    if (resolved.draftPreview) {
      const session = await ensureFirmaDraftPreviewSigningSession({
        supabase,
        tenantId: resolved.tenantId,
        step: resolved.step,
      });
      return NextResponse.json({ session });
    }

    const profile = await resolveApplicantProfile(supabase, resolved.workerId!, applicantId);
    const session = await ensureFirmaSigningSession({
      supabase,
      tenantId: resolved.tenantId,
      workerId: resolved.workerId!,
      applicantEmail: profile.email,
      applicantFirstName: profile.firstName,
      applicantLastName: profile.lastName,
      step: resolved.step,
    });

    return NextResponse.json({ session });
  } catch (err: unknown) {
    if (err instanceof FirmaOnboardingSigningError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[onboarding/firma-sign/session GET]", err);
    const message = err instanceof Error ? err.message : "Failed to load Firma signing session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(
    new NextRequest(req.url, {
      method: "GET",
      headers: req.headers,
    })
  );
}
