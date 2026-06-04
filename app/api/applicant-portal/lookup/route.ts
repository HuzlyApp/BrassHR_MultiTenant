import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  applicantStatusLabel,
  findApplicantByEmail,
  normalizeApplicantStatus,
  resolveTenantIdForApplicantPortal,
  UNAPPROVED_APPLICANT_MESSAGE,
} from "@/lib/applicant-portal";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      tenantSlug?: string | null;
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!email) {
      return NextResponse.json({ error: "Enter your registered email address." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const tenantId = await resolveTenantIdForApplicantPortal(supabase, body.tenantSlug);
    const applicant = await findApplicantByEmail(supabase, email, tenantId);
    if (!applicant?.id) {
      return NextResponse.json({ error: "No application was found for that email address." }, { status: 404 });
    }

    const status = normalizeApplicantStatus(applicant.status);
    const statusLabel = applicantStatusLabel(applicant.status);
    if (status !== "approved") {
      return NextResponse.json(
        {
          error: UNAPPROVED_APPLICANT_MESSAGE,
          applicationStatus: status,
          statusLabel,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      applicationStatus: status,
      statusLabel,
      message: "Your application has been approved.",
      requiresPasswordSetup: !applicant.applicant_password_set_at,
    });
  } catch (err) {
    console.error("[applicant-portal/lookup]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
