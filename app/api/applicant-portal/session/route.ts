import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatApiError } from "@/lib/api/format-api-error";
import {
  applicantDisplayName,
  applicantStatusLabel,
  findApplicantByUserId,
  normalizeApplicantStatus,
} from "@/lib/applicant-portal";
import { resolveApplicantPortalTenantId } from "@/lib/applicant-portal/request";

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

    const tenantId = await resolveApplicantPortalTenantId(supabase, req);
    const applicant = await findApplicantByUserId(supabase, data.user.id, tenantId);
    if (!applicant?.id) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });

    const status = normalizeApplicantStatus(applicant.status);

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
      message: "Your applicant portal session is ready.",
    });
  } catch (err) {
    console.error("[applicant-portal/session]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}
