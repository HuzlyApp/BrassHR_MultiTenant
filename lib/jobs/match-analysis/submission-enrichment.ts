import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchAnalysisResponse } from "./schema";
import {
  CALL_CONTEXT_QUESTION_KEY,
  aiScreeningQuestionKey,
  formatScreeningPackForAiNotes,
  isCallContextQuestionKey,
  matchSavedAiScreeningAnswer,
  normalizeAnalysisScreeningQuestions,
} from "./workspace";

const MAX_ENRICHMENT_CHARS = 8_000;

export function formatVerifiedInfoForSubmission(
  items: Array<{ category?: string | null; title?: string | null; details?: string | null }>
): string {
  const lines = items
    .map((item) => {
      const label = [item.category, item.title]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(" · ");
      const details = String(item.details ?? "").trim();
      if (!label && !details) return null;
      if (!label) return `- ${details}`;
      if (!details) return `- ${label}`;
      return `- ${label}: ${details}`;
    })
    .filter((line): line is string => Boolean(line));
  if (!lines.length) return "";
  return `Verified information:\n${lines.join("\n")}`;
}

/**
 * Load Step 2–3 recruiter enrichment (screening Q&A, call context, notes, verified info)
 * the same way Deep Match does, for Step 5 submission résumé drafting.
 */
export async function loadSubmissionEnrichmentNotes(args: {
  supabase: SupabaseClient;
  tenantId: string;
  applicationId: string;
  workerId?: string | null;
  analysis: MatchAnalysisResponse | null;
}): Promise<string> {
  const { supabase, tenantId, applicationId, analysis } = args;
  const blocks: string[] = [];

  const { data: screeningRows } = await supabase
    .from("job_application_ai_screening_answers")
    .select("question_key, question_text, answer_text")
    .eq("tenant_id", tenantId)
    .eq("application_id", applicationId);

  const byKey = new Map((screeningRows ?? []).map((row) => [String(row.question_key), row]));
  const callContext =
    String(byKey.get(CALL_CONTEXT_QUESTION_KEY)?.answer_text ?? "").trim() || "";
  const packQuestions = normalizeAnalysisScreeningQuestions(analysis?.screening_questions).map(
    (question) => {
      const key = aiScreeningQuestionKey(question.priority, question.question);
      const saved = matchSavedAiScreeningAnswer(byKey, key, question.question);
      return {
        question: question.question,
        answer: isCallContextQuestionKey(key) ? "" : saved?.answer_text ?? "",
      };
    }
  );
  const packNotes = formatScreeningPackForAiNotes({
    questions: packQuestions,
    callContext,
  });
  if (packNotes) blocks.push(packNotes);

  const { data: verifiedRows } = await supabase
    .from("job_application_verified_information")
    .select("category, title, details")
    .eq("tenant_id", tenantId)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(20);
  const verified = formatVerifiedInfoForSubmission(verifiedRows ?? []);
  if (verified) blocks.push(verified);

  if (args.workerId) {
    const { data: noteRows } = await supabase
      .from("worker_notes")
      .select("body")
      .eq("tenant_id", tenantId)
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(5);
    const notes = (noteRows ?? [])
      .map((n) => String(n.body ?? "").trim())
      .filter(Boolean)
      .join("\n---\n");
    if (notes) blocks.push(`Recruiter notes:\n${notes}`);
  }

  return blocks.join("\n\n").slice(0, MAX_ENRICHMENT_CHARS).trim();
}
