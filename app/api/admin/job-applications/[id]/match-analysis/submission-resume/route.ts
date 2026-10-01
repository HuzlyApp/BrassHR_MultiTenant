import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  draftSubmissionResumePack,
  SubmissionResumeError,
} from "@/lib/jobs/match-analysis/draft-submission-resume";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Application id required" }, { status: 400 });
  }

  try {
    const result = await draftSubmissionResumePack({
      supabase,
      tenantId,
      applicationId: id.trim(),
      staffUserId: auth.devBypass ? null : auth.userId,
    });
    const bytes = Uint8Array.from(result.docx);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": DOCX_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${result.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
        "X-Resume-Id": result.resumeId,
        "X-Preview-Resume-Id": result.previewResumeId,
        "X-Match-Stage": result.stage,
        "X-Improvement-Summary": encodeURIComponent(JSON.stringify(result.improvementSummary)),
      },
    });
  } catch (error) {
    const status = error instanceof SubmissionResumeError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Could not draft the submission résumé.";
    console.error("[job-applications/submission-resume]", {
      tenantId,
      applicationId: id,
      message,
    });
    return NextResponse.json({ error: message }, { status });
  }
}
