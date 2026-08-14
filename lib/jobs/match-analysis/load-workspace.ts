import type { SupabaseClient } from "@supabase/supabase-js";
import { loadWorkerNotesForWorkerId } from "@/lib/worker-notes";
import { loadApplicationScreeningContext } from "@/lib/jobs/screening-questions";
import { pickResumeForApplication } from "./pick-resume-for-application";
import { getMatchAnalysisModelName } from "./service";
import { loadAnalysisHistory } from "./versions";
import { aiScreeningQuestionKey } from "./workspace";
import type { MatchAnalysisResponse } from "./schema";

function displayName(first: string | null | undefined, last: string | null | undefined, email?: string | null) {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name || email?.trim() || null;
}

export async function loadMatchAnalysisWorkspace(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string
) {
  const { data: application, error } = await supabase
    .from("job_applications")
    .select(
      "id, tenant_id, job_requisition_id, worker_id, status, status_id, created_at, updated_at, submitted_at, created_by_staff_user_id, assigned_recruiter_user_id, ai_match_status, ai_match_score, ai_match_category, ai_match_action, ai_match_readiness, ai_match_display_category, ai_analysis, ai_analyzed_at, ai_analyzed_by, ai_analysis_error, ai_analysis_progress, ai_analysis_version, ai_analysis_model, recruiter_decision, recruiter_decision_note, recruiter_decision_at, recruiter_decision_by"
    )
    .eq("id", applicationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!application) return null;

  const analysis = (application.ai_analysis ?? null) as MatchAnalysisResponse | null;

  const [
    requirementsResult,
    screening,
    verifiedResult,
    aiAnswersResult,
    history,
  ] = await Promise.all([
    supabase
      .from("job_application_match_requirements")
      .select(
        "id, requirement_text, requirement_type, status, requirement_outcome, candidate_evidence, evidence_source, impact, verification_required, confidence, sort_order, recruiter_verified, recruiter_note, recruiter_verified_at"
      )
      .eq("job_application_id", applicationId)
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true }),
    loadApplicationScreeningContext(
      supabase,
      tenantId,
      applicationId,
      String(application.job_requisition_id)
    ).catch(() => ({
      questions: [],
      assessment: {
        answered: 0,
        total: 0,
        requiredAnswered: 0,
        requiredTotal: 0,
        summary: "Could not load screening answers.",
      },
    })),
    supabase
      .from("job_application_verified_information")
      .select("id, category, title, details, verified_by, verified_at, created_at")
      .eq("tenant_id", tenantId)
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("job_application_ai_screening_answers")
      .select("id, question_key, question_text, reason, related_requirement, answer_text, updated_at")
      .eq("tenant_id", tenantId)
      .eq("application_id", applicationId),
    loadAnalysisHistory(supabase, tenantId, applicationId, false).catch(() => []),
  ]);

  const userIds = [
    application.created_by_staff_user_id,
    application.assigned_recruiter_user_id,
    application.ai_analyzed_by,
    application.recruiter_decision_by,
    ...(verifiedResult.data ?? []).map((row) => row.verified_by),
  ].filter((id): id is string => Boolean(id));

  const usersById = new Map<string, { id: string; name: string; email: string }>();
  if (userIds.length) {
    const { data: users } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("tenant_id", tenantId)
      .in("id", Array.from(new Set(userIds)));
    for (const user of users ?? []) {
      usersById.set(String(user.id), {
        id: String(user.id),
        name: displayName(user.first_name, user.last_name, user.email) || "Team member",
        email: String(user.email ?? ""),
      });
    }
  }

  const notes = application.worker_id
    ? await loadWorkerNotesForWorkerId(supabase, String(application.worker_id), {
        applicationId,
      }).catch(() => [])
    : [];

  const aiAnswersByKey = new Map(
    (aiAnswersResult.data ?? []).map((row) => [String(row.question_key), row])
  );
  const recommendedQuestions = (analysis?.screening_questions ?? []).map((question) => {
    const key = aiScreeningQuestionKey(question.priority, question.question);
    const saved = aiAnswersByKey.get(key);
    return {
      key,
      priority: question.priority,
      question: question.question,
      reason: question.reason,
      relatedRequirement: question.related_requirement,
      answer: saved?.answer_text ?? "",
    };
  });

  let extractedResume: { text: string; fileName: string | null } | null = null;
  const { data: resumeRow } = await supabase
    .from("worker_resumes")
    .select("extracted_text, file_name, original_file_name, job_application_id, uploaded_at")
    .eq("tenant_id", tenantId)
    .eq("job_application_id", applicationId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(5);
  const preferred = pickResumeForApplication(resumeRow, applicationId);
  if (preferred?.extracted_text) {
    extractedResume = {
      text: String(preferred.extracted_text),
      fileName: String(preferred.original_file_name || preferred.file_name || "Resume"),
    };
  }

  return {
    application: {
      ...application,
      ai_analysis_model: application.ai_analysis_model || getMatchAnalysisModelName(),
    },
    requirements: requirementsResult.data ?? [],
    screeningQuestions: screening.questions,
    screeningAssessment: screening.assessment,
    recommendedQuestions,
    verifiedInformation: (verifiedResult.data ?? []).map((row) => ({
      id: String(row.id),
      category: String(row.category),
      title: String(row.title),
      details: row.details ? String(row.details) : null,
      verifiedAt: String(row.verified_at),
      verifiedByName: row.verified_by ? usersById.get(String(row.verified_by))?.name ?? "Recruiter" : "Recruiter",
    })),
    notes,
    analysisHistory: history,
    extractedResume,
    assignedRecruiter: application.assigned_recruiter_user_id
      ? usersById.get(String(application.assigned_recruiter_user_id)) ?? null
      : null,
    analyzedByName: application.ai_analyzed_by
      ? usersById.get(String(application.ai_analyzed_by))?.name ?? null
      : null,
    createdByName: application.created_by_staff_user_id
      ? usersById.get(String(application.created_by_staff_user_id))?.name ?? null
      : null,
    decisionByName: application.recruiter_decision_by
      ? usersById.get(String(application.recruiter_decision_by))?.name ?? null
      : null,
    modelName: application.ai_analysis_model || getMatchAnalysisModelName(),
  };
}
