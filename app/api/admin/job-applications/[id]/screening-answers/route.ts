import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { upsertApplicationScreeningAnswers } from "@/lib/jobs/screening-questions";
import { aiScreeningQuestionKey } from "@/lib/jobs/match-analysis/workspace";
import type { MatchAnalysisResponse } from "@/lib/jobs/match-analysis/schema";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

  const { id } = await context.params;
  const { data: application, error: appError } = await supabase
    .from("job_applications")
    .select("id, job_requisition_id, ai_analysis")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (appError) return NextResponse.json({ error: appError.message }, { status: 500 });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    jobAnswers?: Array<{ questionId: string; answer: unknown }>;
    recommendedAnswers?: Array<{ key?: string; question?: string; priority?: number; answer: string }>;
  };

  if (Array.isArray(body.jobAnswers) && body.jobAnswers.length) {
    await upsertApplicationScreeningAnswers(supabase, {
      tenantId,
      applicationId: id,
      jobId: String(application.job_requisition_id),
      answers: body.jobAnswers,
    });
  }

  const analysis = (application.ai_analysis ?? null) as MatchAnalysisResponse | null;
  if (Array.isArray(body.recommendedAnswers)) {
    for (const item of body.recommendedAnswers) {
      const question =
        item.question?.trim() ||
        analysis?.screening_questions.find((q) => aiScreeningQuestionKey(q.priority, q.question) === item.key)
          ?.question ||
        "";
      if (!question) continue;
      const related = analysis?.screening_questions.find((q) => q.question === question);
      const key = item.key?.trim() || aiScreeningQuestionKey(related?.priority ?? item.priority ?? 1, question);
      const { error } = await supabase.from("job_application_ai_screening_answers").upsert(
        {
          tenant_id: tenantId,
          application_id: id,
          question_key: key,
          question_text: question,
          reason: related?.reason ?? null,
          related_requirement: related?.related_requirement ?? null,
          answer_text: String(item.answer ?? "").trim() || null,
        },
        { onConflict: "application_id,question_key" }
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  void writeActivityLog({
    actorUserId: auth.devBypass ? null : auth.userId,
    action: "job_application.screening_answers_saved",
    entityType: "job_application",
    entityId: id,
    tenantId,
    request: req,
  });

  return NextResponse.json({ ok: true });
}
