import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { parseAdminJobApplicationResume } from "@/lib/jobs/admin-job-application-resume-actions";
import { loadAdminJobApplicationResumeHistory } from "@/lib/jobs/admin-job-application-resume-history";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string; resumeId: string }> };

function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function POST(_req: NextRequest, context: RouteContext) {
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

    const { id, resumeId: resumeIdParam } = await context.params;
    const applicationId = id?.trim();
    const resumeId = resumeIdParam?.trim();
    if (!applicationId || !resumeId) {
      return NextResponse.json({ error: "Application and resume id are required." }, { status: 400 });
    }

    await parseAdminJobApplicationResume(supabase, tenantId, applicationId, resumeId);
    const history = await loadAdminJobApplicationResumeHistory(
      supabase,
      tenantId,
      applicationId
    );

    return NextResponse.json({
      ok: true,
      resumes: history?.resumes ?? [],
    });
  } catch (error) {
    console.error("[admin/job-applications/resumes:parse]", error);
    const message = formatApiError(error, "Could not parse resume.");
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
