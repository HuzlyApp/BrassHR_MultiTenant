import type { AnalysisMode, MatchAnalysisResponse } from "./schema";
import {
  mergeStageQuestions,
  storedScreeningQuestions,
  type StageQuestionKey,
} from "./follow-up-questions";
import {
  formatScreeningPackForAiNotes,
  normalizeAnalysisScreeningQuestions,
  type AnalysisScreeningQuestion,
} from "./workspace";

export type QuestionInputChange = "candidate" | "resume" | "job" | "analysis";

/**
 * Which stored question sets a given input change should refresh.
 * Checklist questions (Steps 2–3) do not depend on the candidate email or résumé body.
 * Deep Match does. A job-description change touches every set. Checklist or note
 * changes refresh Follow-Up and Deep Match and leave the Verifications call pack.
 */
export function stagesAffectedByInputChange(change: QuestionInputChange): StageQuestionKey[] {
  if (change === "candidate" || change === "resume") return ["deep"];
  if (change === "analysis") return ["follow_up", "deep"];
  return ["call_pack", "follow_up", "deep"];
}

function readStale(analysis: Record<string, unknown>): Record<string, boolean> {
  const raw = analysis.question_sets_stale;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  return {
    call_pack: record.call_pack === true,
    follow_up: record.follow_up === true,
    deep: record.deep === true,
  };
}

/** Mark affected sets stale without deleting their questions or other stages. */
export function stampQuestionSetsStale(
  analysis: Record<string, unknown>,
  change: QuestionInputChange
): Record<string, unknown> {
  const previous = readStale(analysis);
  const affected = new Set(stagesAffectedByInputChange(change));
  return {
    ...analysis,
    question_sets_stale: {
      call_pack: affected.has("call_pack") ? true : previous.call_pack === true,
      follow_up: affected.has("follow_up") ? true : previous.follow_up === true,
      deep: affected.has("deep") ? true : previous.deep === true,
    },
  };
}

/**
 * Replace only the question sets that this input change owns.
 * A refresh payload for an unrelated stage is ignored.
 */
export function applyQuestionSetRefresh(args: {
  analysis: Record<string, unknown>;
  change: QuestionInputChange;
  refreshed: Partial<Record<StageQuestionKey, AnalysisScreeningQuestion[]>>;
}): Record<string, unknown> {
  const affected = new Set(stagesAffectedByInputChange(args.change));
  let next = { ...args.analysis };
  for (const stage of affected) {
    const questions = args.refreshed[stage];
    if (!questions) continue;
    next = mergeStageQuestions(next, stage, questions);
  }
  return next;
}

export function questionsForProgressionStep(
  step: StageQuestionKey,
  analysis: Record<string, unknown> | null | undefined
): AnalysisScreeningQuestion[] {
  if (!analysis) return [];
  if (step === "follow_up") return normalizeAnalysisScreeningQuestions(analysis.follow_up_questions);
  if (step === "deep") return normalizeAnalysisScreeningQuestions(analysis.deep_screening_questions);
  return normalizeAnalysisScreeningQuestions(analysis.screening_questions);
}

export function followUpEnrichmentFromVerifications(args: {
  callPackQuestions: Array<{ question: string; answer?: string | null }>;
  callContext?: string | null;
}): string {
  const asked = args.callPackQuestions
    .map((item) => String(item.question ?? "").trim())
    .filter(Boolean);
  const blocks: string[] = [];
  if (asked.length) {
    blocks.push(
      [
        "Questions already asked at Verifications (Step 2). Do not repeat them.",
        ...asked.map((question, index) => `${index + 1}. ${question}`),
      ].join("\n")
    );
  }
  const pack = formatScreeningPackForAiNotes({
    questions: args.callPackQuestions,
    callContext: args.callContext,
  });
  if (pack) blocks.push(pack);
  return blocks.join("\n\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/**
 * Deep Match's model `screening_questions` are Step 4 questions.
 * Keep Step 2 and Step 3 arrays from the saved analysis.
 * Quick Match keeps later sets so a checklist re-run does not drop them.
 */
export function retainQuestionSetsForAnalysisMode(
  previous: unknown,
  next: MatchAnalysisResponse,
  mode: AnalysisMode
): MatchAnalysisResponse {
  const prev = asRecord(previous);
  const priorFollowUp = storedScreeningQuestions(
    normalizeAnalysisScreeningQuestions(prev.follow_up_questions)
  );
  const priorDeep = storedScreeningQuestions(
    normalizeAnalysisScreeningQuestions(prev.deep_screening_questions)
  );
  const priorCallPack = storedScreeningQuestions(
    normalizeAnalysisScreeningQuestions(prev.screening_questions)
  );
  const stale = readStale(prev);

  if (mode === "deep") {
    return {
      ...next,
      screening_questions: priorCallPack.length ? priorCallPack : next.screening_questions,
      follow_up_questions: priorFollowUp,
      deep_screening_questions: next.screening_questions,
      question_sets_stale: { ...stale, deep: false },
    };
  }

  if (mode === "analyze") {
    return {
      ...next,
      follow_up_questions: priorFollowUp.length ? priorFollowUp : next.follow_up_questions,
      deep_screening_questions: priorDeep.length ? priorDeep : next.deep_screening_questions,
    };
  }

  return next;
}
