import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { pickResumeForApplication } from "@/lib/jobs/match-analysis/pick-resume-for-application";
import { normalizeResumeWhitespace } from "@/lib/jobs/match-analysis/sanitize-resume";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { extractedText?: string };
  const extractedText = normalizeResumeWhitespace(String(body.extractedText ?? ""));
  if (!extractedText) {
    return NextResponse.json({ error: "Extracted text cannot be empty." }, { status: 400 });
  }

  const { data: application } = await supabase
    .from("job_applications")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const { data: resumeRows } = await supabase
    .from("worker_resumes")
    .select("id, job_application_id")
    .eq("tenant_id", tenantId)
    .eq("job_application_id", id)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(5);
  const resume = pickResumeForApplication(resumeRows, id);
  if (!resume) {
    return NextResponse.json({ error: "No résumé file found for this application." }, { status: 404 });
  }

  const { error } = await supabase
    .from("worker_resumes")
    .update({ extracted_text: extractedText, text_length: extractedText.length })
    .eq("id", resume.id)
    .eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("job_applications")
    .update({
      ai_match_status: "NEEDS_REVIEW",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  void writeActivityLog({
    actorUserId: auth.devBypass ? null : auth.userId,
    action: "job_application.resume_text_corrected",
    entityType: "job_application",
    entityId: id,
    tenantId,
    request: req,
  });

  return NextResponse.json({ ok: true });
}
