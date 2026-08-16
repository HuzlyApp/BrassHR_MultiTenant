import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  deleteAdminJobApplicationResume,
  getAdminJobApplicationResumeViewUrl,
} from "@/lib/jobs/admin-job-application-resume-actions";
import { loadAdminJobApplicationResumeHistory } from "@/lib/jobs/admin-job-application-resume-history";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; resumeId: string }> };

function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function GET(_req: NextRequest, context: RouteContext) {
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

    const url = await getAdminJobApplicationResumeViewUrl(
      supabase,
      tenantId,
      applicationId,
      resumeId
    );
    if (!url) {
      return NextResponse.json({ error: "Resume file not found." }, { status: 404 });
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[admin/job-applications/resumes:get]", error);
    const message = formatApiError(error, "Could not open resume.");
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
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

    await deleteAdminJobApplicationResume(supabase, tenantId, applicationId, resumeId);
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
    console.error("[admin/job-applications/resumes:delete]", error);
    const message = formatApiError(error, "Could not delete resume.");
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
