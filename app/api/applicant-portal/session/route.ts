import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  applicantDisplayName,
  applicantStatusLabel,
  findApplicantByUserId,
  normalizeApplicantStatus,
  UNAPPROVED_APPLICANT_MESSAGE,
} from "@/lib/applicant-portal";

export const runtime = "nodejs";

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function GET(req: NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applicant = await findApplicantByUserId(supabase, data.user.id);
    if (!applicant?.id) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });

    const status = normalizeApplicantStatus(applicant.status);
    if (status !== "approved") {
      return NextResponse.json(
        {
          error: UNAPPROVED_APPLICANT_MESSAGE,
          applicationStatus: status,
          statusLabel: applicantStatusLabel(applicant.status),
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      applicant: {
        id: applicant.id,
        tenantId: applicant.tenant_id,
        email: applicant.email,
        name: applicantDisplayName(applicant),
      },
      applicationStatus: status,
      statusLabel: applicantStatusLabel(applicant.status),
      message: "Your application has been approved.",
    });
  } catch (err) {
    console.error("[applicant-portal/session]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
