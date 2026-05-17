import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context";

export const runtime = "nodejs";

type AnswerInput = {
  questionId: string;
  answer: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      applicantId?: string;
      assessmentId?: string;
      answers?: AnswerInput[];
    };

    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : "";
    const assessmentId = typeof body.assessmentId === "string" ? body.assessmentId.trim() : "";
    const answers = Array.isArray(body.answers) ? body.answers : [];

    if (!applicantId || !assessmentId || !answers.length) {
      return NextResponse.json({ error: "Missing applicantId, assessmentId, or answers" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const ctx = await resolveWorkerByApplicantId(supabase, applicantId);
    if (!ctx) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const { data: assessment, error: aErr } = await supabase
      .from("tenant_skill_assessments")
      .select("id, tenant_id")
      .eq("id", assessmentId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (aErr) throw aErr;
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    const questionIds = answers.map((a) => a.questionId);
    const { data: questions, error: qErr } = await supabase
      .from("tenant_skill_assessment_questions")
      .select("id, correct_answer, points")
      .eq("assessment_id", assessmentId)
      .in("id", questionIds);

    if (qErr) throw qErr;

    const qMap = new Map((questions ?? []).map((q) => [String(q.id), q]));
    const now = new Date().toISOString();

    for (const item of answers) {
      const q = qMap.get(item.questionId);
      if (!q) continue;

      let score: number | null = null;
      if (q.correct_answer != null) {
        score = JSON.stringify(q.correct_answer) === JSON.stringify(item.answer) ? Number(q.points) || 1 : 0;
      }

      const row = {
        worker_id: ctx.workerId,
        tenant_id: ctx.tenantId,
        assessment_id: assessmentId,
        question_id: item.questionId,
        answer: item.answer,
        score,
        submitted_at: now,
      };

      const { data: existing } = await supabase
        .from("worker_skill_assessment_answers")
        .select("id")
        .eq("worker_id", ctx.workerId)
        .eq("question_id", item.questionId)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase.from("worker_skill_assessment_answers").update(row).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("worker_skill_assessment_answers").insert(row);
        if (error) throw error;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[onboarding/skill-assessment/submit]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
