import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendProfileSaveStatusLinkEmail } from "@/lib/onboarding/send-profile-save-status-link-email";
import { resolveOnboardingTenantId } from "@/lib/tenant/resolve-onboarding-tenant-id";
import { resolveApplicantEmailAppOrigin } from "@/lib/resolve-app-origin";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

const bodySchema = z.object({
  applicantId: z.string().trim().min(1),
  email: z.string().trim().min(3),
  workerId: z.string().trim().uuid().optional(),
  tenantSlug: z.string().trim().min(2).optional(),
});

/**
 * POST — sends the profile-save application status / continuation link email.
 * Used after profile details are saved (including browser fallback saves).
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.parse(await req.json());
    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const origin = resolveApplicantEmailAppOrigin(req);
    if (!origin) {
      return NextResponse.json({ error: "Could not resolve app origin" }, { status: 400 });
    }

    const supabase = createClient(url, key);
    const tenantRes = await resolveOnboardingTenantId(supabase, parsed.tenantSlug ?? null);
    if (!tenantRes.ok) {
      return NextResponse.json({ error: tenantRes.error, code: "MISSING_TENANT" }, { status: 503 });
    }

    let workerId = parsed.workerId ?? null;
    if (!workerId) {
      const { data: worker, error } = await supabase
        .from("worker")
        .select("id")
        .eq("user_id", parsed.applicantId)
        .eq("tenant_id", tenantRes.tenantId)
        .maybeSingle();
      if (error) throw error;
      workerId = worker?.id ? String(worker.id) : null;
    }

    if (!workerId) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const result = await sendProfileSaveStatusLinkEmail(supabase, {
      workerId,
      tenantId: tenantRes.tenantId,
      recipientEmail: parsed.email,
      origin,
      tenantSlug: parsed.tenantSlug ?? null,
      request: req,
    });

    return NextResponse.json({
      ok: true,
      outcome: result.outcome,
      reason: result.reason ?? null,
      messageId: result.messageId ?? null,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", code: "VALIDATION_ERROR" }, { status: 400 });
    }
    console.error("[onboarding/send-profile-status-link]", e);
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
