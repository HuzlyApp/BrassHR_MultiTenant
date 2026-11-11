import { NextRequest, NextResponse } from "next/server";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { listApplicantFaqs } from "@/lib/faqs/faq-service";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, {
      namespace: "applicant-help-faqs",
      key: getClientIp(req),
      limit: Number(process.env.RATE_LIMIT_APPLICANT_HELP_PER_HOUR ?? 120),
      windowMs: 60 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const faqs = await listApplicantFaqs(auth.supabase, auth.applicant.tenant_id);
    return NextResponse.json({ faqs });
  } catch (err) {
    console.error("[applicant-portal/help/faqs:get]", err);
    return NextResponse.json({ error: "Could not load help articles." }, { status: 500 });
  }
}
