import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { upsertApplicationScreeningAnswers } from "@/lib/jobs/screening-questions";
import {
  CALL_CONTEXT_QUESTION_KEY,
  CALL_CONTEXT_QUESTION_TEXT,
  normalizeAnalysisScreeningQuestions,
  resolveRecommendedScreeningAnswerUpsert,
} from "@/lib/jobs/match-analysis/workspace";
import type { MatchAnalysisResponse } from "@/lib/jobs/match-analysis/schema";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type RecommendedAnswerInput = {
  key?: string;
  question?: string;
  priority?: number;
  answer: string;
};

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
    recommendedAnswers?: RecommendedAnswerInput[];
    callContext?: string;
  };

  const analysis = (application.ai_analysis ?? null) as MatchAnalysisResponse | null;
  const analysisQuestions = normalizeAnalysisScreeningQuestions(analysis?.screening_questions);
  const savedRecommended: Array<{ key: string; question: string; answer: string }> = [];

  const recommendedInputs: RecommendedAnswerInput[] = Array.isArray(body.recommendedAnswers)
    ? [...body.recommendedAnswers]
    : [];

  // Always upsert call context into job_application_ai_screening_answers when provided
  // (either as a reserved recommendedAnswers row or top-level callContext).
  const hasCallContextRow = recommendedInputs.some(
    (item) =>
      String(item.key ?? "").trim() === CALL_CONTEXT_QUESTION_KEY ||
      String(item.question ?? "").trim() === CALL_CONTEXT_QUESTION_TEXT
  );
  if (!hasCallContextRow && typeof body.callContext === "string") {
    recommendedInputs.push({
      key: CALL_CONTEXT_QUESTION_KEY,
      question: CALL_CONTEXT_QUESTION_TEXT,
      answer: body.callContext,
    });
  }

  for (const item of recommendedInputs) {
    let resolved;
    try {
      resolved = resolveRecommendedScreeningAnswerUpsert(item, analysisQuestions);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to save screening notes" },
        { status: 400 }
      );
    }
    if (!resolved) continue;

    const { data: upserted, error } = await supabase
      .from("job_application_ai_screening_answers")
      .upsert(
        {
          tenant_id: tenantId,
          application_id: id,
          question_key: resolved.key,
          question_text: resolved.question,
          reason: resolved.reason,
          related_requirement: resolved.related_requirement,
          answer_text: resolved.answer_text ?? "",
        },
        { onConflict: "application_id,question_key" }
      )
      .select("question_key, question_text, answer_text")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to upsert screening answer in Supabase" },
        { status: 500 }
      );
    }
    if (!upserted) {
      return NextResponse.json(
        { error: "Screening answer was not persisted to Supabase" },
        { status: 500 }
      );
    }

    savedRecommended.push({
      key: String(upserted.question_key),
      question: String(upserted.question_text),
      answer: String(upserted.answer_text ?? ""),
    });
  }

  if (Array.isArray(body.jobAnswers) && body.jobAnswers.length) {
    try {
      await upsertApplicationScreeningAnswers(supabase, {
        tenantId,
        applicationId: id,
        jobId: String(application.job_requisition_id),
        answers: body.jobAnswers,
        skipEmptyRequired: true,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to save job screening answers" },
        { status: 500 }
      );
    }
  }

  void writeActivityLog({
    actorUserId: auth.devBypass ? null : auth.userId,
    action: "job_application.screening_answers_saved",
    entityType: "job_application",
    entityId: id,
    tenantId,
    request: req,
    metadata: {
      savedCount: savedRecommended.length,
      table: "job_application_ai_screening_answers",
    },
  });

  return NextResponse.json({
    ok: true,
    table: "job_application_ai_screening_answers",
    savedCount: savedRecommended.length,
    recommendedAnswers: savedRecommended,
  });
}
