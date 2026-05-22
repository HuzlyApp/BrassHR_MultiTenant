import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendOnboardingApplicantEmail } from "@/lib/email/send-templated-email";
import { SendEmailError } from "@/lib/email/errors";
import { EMAIL_TEMPLATE_TYPE } from "@/lib/email-templates/template-keys";
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context";
import { resolveAppOrigin } from "@/lib/resolve-app-origin";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

const bodySchema = z.object({
  applicantId: z.string().trim().min(1),
  clientOrigin: z.string().trim().optional(),
});

function handleError(e: unknown): NextResponse {
  if (e instanceof SendEmailError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  console.error("[onboarding/send-application-emails]", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * POST — after onboarding submission, send tenant-specific application status link email.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.parse(await req.json());
    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const origin = resolveAppOrigin(req, parsed.clientOrigin);
    if (!origin) {
      return NextResponse.json({ error: "Could not resolve app origin" }, { status: 400 });
    }

    const supabase = createClient(url, key);
    const ctx = await resolveWorkerByApplicantId(supabase, parsed.applicantId);
    if (!ctx) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const result = await sendOnboardingApplicantEmail(supabase, {
      tenantId: ctx.tenantId,
      workerId: ctx.workerId,
      templateKey: EMAIL_TEMPLATE_TYPE.APPLICATION_STATUS,
      origin,
    });

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      skipped: result.skipped ?? false,
      messageId: result.messageId ?? null,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", code: "VALIDATION_ERROR" }, { status: 400 });
    }
    return handleError(e);
  }
}
