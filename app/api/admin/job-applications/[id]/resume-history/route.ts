import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { loadAdminJobApplicationResumeHistory } from "@/lib/jobs/admin-job-application-resume-history";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    }

    const { id } = await context.params;
    const applicationId = id?.trim();
    if (!applicationId) {
      return NextResponse.json({ error: "Application id is required." }, { status: 400 });
    }

    const history = await loadAdminJobApplicationResumeHistory(
      supabase,
      tenantId,
      applicationId
    );
    if (!history) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    return NextResponse.json(history);
  } catch (error) {
    console.error("[admin/job-applications/resume-history]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load resume history." },
      { status: 500 }
    );
  }
}
