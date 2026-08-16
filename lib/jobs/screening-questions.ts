import type { SupabaseClient } from "@supabase/supabase-js";

export const JOB_SCREENING_QUESTION_TYPES = [
  "yes_no",
  "single_select",
  "multiple_select",
  "short_text",
  "long_text",
  "number",
] as const;

export type JobScreeningQuestionType = (typeof JOB_SCREENING_QUESTION_TYPES)[number];

export type JobScreeningQuestionOption = {
  label: string;
  value: string;
};

export type JobScreeningQuestionRow = {
  id: string;
  tenant_id: string;
  job_id: string;
  question: string;
  question_type: JobScreeningQuestionType;
  options: JobScreeningQuestionOption[] | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JobScreeningQuestionInput = {
  id?: string | null;
  question: string;
  questionType: JobScreeningQuestionType;
  options?: JobScreeningQuestionOption[] | null;
  isRequired?: boolean;
  sortOrder?: number;
  isActive?: boolean;
};

export type ApplicationScreeningAnswerRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  question_id: string;
  question_text: string;
  answer: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ApplicationScreeningAnswerInput = {
  questionId: string;
  answer: unknown;
};

export type ApplicationScreeningQuestionView = {
  id: string;
  question: string;
  questionType: JobScreeningQuestionType;
  options: JobScreeningQuestionOption[] | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  answer: unknown | null;
  answerDisplay: string;
  answered: boolean;
};

export type ScreeningAssessmentSummary = {
  answered: number;
  total: number;
  requiredAnswered: number;
  requiredTotal: number;
  summary: string;
};

function normalizeOptions(raw: unknown): JobScreeningQuestionOption[] | null {
  if (!Array.isArray(raw)) return null;
  const options = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = String(record.label ?? "").trim();
      const value = String(record.value ?? record.label ?? "").trim();
      if (!label) return null;
      return { label, value: value || label };
    })
    .filter((item): item is JobScreeningQuestionOption => Boolean(item));
  return options.length ? options : null;
}

function rowToQuestion(row: Record<string, unknown>): JobScreeningQuestionRow {
  const questionType = String(row.question_type ?? "short_text") as JobScreeningQuestionType;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    job_id: String(row.job_id),
    question: String(row.question ?? ""),
    question_type: JOB_SCREENING_QUESTION_TYPES.includes(questionType)
      ? questionType
      : "short_text",
    options: normalizeOptions(row.options),
    is_required: row.is_required !== false,
    sort_order: Number(row.sort_order ?? 0),
    is_active: row.is_active !== false,
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function normalizeJobScreeningQuestionInput(
  input: JobScreeningQuestionInput,
  index: number
): JobScreeningQuestionInput | null {
  const question = input.question.trim();
  if (!question) return null;
  const questionType = JOB_SCREENING_QUESTION_TYPES.includes(input.questionType)
    ? input.questionType
    : "short_text";
  const options =
    questionType === "single_select" || questionType === "multiple_select"
      ? normalizeOptions(input.options)
      : questionType === "yes_no"
        ? [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]
        : null;
  if (
    (questionType === "single_select" || questionType === "multiple_select") &&
    (!options || !options.length)
  ) {
    return null;
  }
  return {
    id: input.id?.trim() || null,
    question,
    questionType,
    options,
    isRequired: input.isRequired !== false,
    sortOrder: input.sortOrder ?? index,
    isActive: input.isActive !== false,
  };
}

export function formatScreeningAnswerDisplay(
  questionType: JobScreeningQuestionType,
  answer: unknown,
  options: JobScreeningQuestionOption[] | null
): string {
  if (answer == null || answer === "") return "Not answered";

  if (questionType === "yes_no") {
    if (typeof answer === "boolean") return answer ? "Yes" : "No";
    const normalized = String(answer).trim().toLowerCase();
    if (normalized === "yes" || normalized === "true") return "Yes";
    if (normalized === "no" || normalized === "false") return "No";
    return String(answer);
  }

  if (questionType === "number") {
    const num =
      typeof answer === "number"
        ? answer
        : Number(String(answer).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(num)) {
      return `${num}${String(answer).includes("year") ? " years" : ""}`.trim();
    }
    return String(answer);
  }

  if (questionType === "multiple_select") {
    const values = Array.isArray(answer) ? answer : [answer];
    const labels = values
      .map((value) => {
        const match = options?.find(
          (option) => option.value === String(value) || option.label === String(value)
        );
        return match?.label ?? String(value);
      })
      .filter(Boolean);
    return labels.length ? labels.join(", ") : "Not answered";
  }

  if (questionType === "single_select") {
    const match = options?.find(
      (option) =>
        option.value === String(answer) || option.label === String(answer)
    );
    return match?.label ?? String(answer);
  }

  const text = String(answer).trim();
  return text || "Not answered";
}

export function isScreeningAnswerEmpty(
  questionType: JobScreeningQuestionType,
  answer: unknown
): boolean {
  if (answer == null) return true;
  if (questionType === "multiple_select") {
    return !Array.isArray(answer) || answer.length === 0;
  }
  if (typeof answer === "string") return !answer.trim();
  if (typeof answer === "number") return Number.isNaN(answer);
  if (typeof answer === "boolean") return false;
  if (typeof answer === "object") return Object.keys(answer as object).length === 0;
  return !String(answer).trim();
}

export function normalizeScreeningAnswerValue(
  questionType: JobScreeningQuestionType,
  raw: unknown
): unknown {
  if (raw == null) return null;
  if (questionType === "yes_no") {
    if (typeof raw === "boolean") return raw;
    const normalized = String(raw).trim().toLowerCase();
    if (normalized === "yes" || normalized === "true") return true;
    if (normalized === "no" || normalized === "false") return false;
    return null;
  }
  if (questionType === "number") {
    const num = typeof raw === "number" ? raw : Number(String(raw).trim());
    return Number.isFinite(num) ? num : null;
  }
  if (questionType === "multiple_select") {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (questionType === "single_select") {
    const value = String(raw).trim();
    return value || null;
  }
  const text = String(raw).trim();
  return text || null;
}

export function buildScreeningAssessment(
  views: ApplicationScreeningQuestionView[]
): ScreeningAssessmentSummary {
  const active = views.filter((item) => item.isActive);
  const required = active.filter((item) => item.isRequired);
  const answered = active.filter((item) => item.answered);
  const requiredAnswered = required.filter((item) => item.answered);
  let summary = "No screening questions were configured for this job.";
  if (active.length) {
    if (required.length && requiredAnswered.length === required.length) {
      summary = "Candidate satisfies the required screening criteria.";
    } else if (requiredAnswered.length === 0 && required.length) {
      summary = "Required screening questions are unanswered.";
    } else if (answered.length === active.length) {
      summary = "All screening questions have been answered.";
    } else {
      summary = `${answered.length} of ${active.length} screening questions answered.`;
    }
  }
  return {
    answered: answered.length,
    total: active.length,
    requiredAnswered: requiredAnswered.length,
    requiredTotal: required.length,
    summary,
  };
}

export async function loadJobScreeningQuestions(
  supabase: SupabaseClient,
  tenantId: string,
  jobId: string,
  opts?: { activeOnly?: boolean }
): Promise<JobScreeningQuestionRow[]> {
  let query = supabase
    .from("job_screening_questions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true });
  if (opts?.activeOnly) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => rowToQuestion(row as Record<string, unknown>));
}

export async function syncJobScreeningQuestions(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    jobId: string;
    actorUserId: string;
    questions: JobScreeningQuestionInput[];
  }
): Promise<JobScreeningQuestionRow[]> {
  const normalized = args.questions
    .map((item, index) => normalizeJobScreeningQuestionInput(item, index))
    .filter((item): item is JobScreeningQuestionInput => Boolean(item));

  const existing = await loadJobScreeningQuestions(supabase, args.tenantId, args.jobId);
  const keepIds = new Set(
    normalized.map((item) => item.id).filter((id): id is string => Boolean(id))
  );

  for (const row of existing) {
    if (!keepIds.has(row.id)) {
      const { error } = await supabase
        .from("job_screening_questions")
        .update({ is_active: false })
        .eq("id", row.id)
        .eq("tenant_id", args.tenantId)
        .eq("job_id", args.jobId);
      if (error) throw error;
    }
  }

  for (const [index, item] of normalized.entries()) {
    const payload = {
      tenant_id: args.tenantId,
      job_id: args.jobId,
      question: item.question,
      question_type: item.questionType,
      options: item.options ?? null,
      is_required: item.isRequired !== false,
      sort_order: item.sortOrder ?? index,
      is_active: item.isActive !== false,
      created_by: args.actorUserId,
    };
    if (item.id) {
      const { error } = await supabase
        .from("job_screening_questions")
        .update(payload)
        .eq("id", item.id)
        .eq("tenant_id", args.tenantId)
        .eq("job_id", args.jobId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("job_screening_questions").insert(payload);
      if (error) throw error;
    }
  }

  return loadJobScreeningQuestions(supabase, args.tenantId, args.jobId);
}

export async function loadApplicationScreeningAnswers(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string
): Promise<ApplicationScreeningAnswerRow[]> {
  const { data, error } = await supabase
    .from("application_screening_answers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("application_id", applicationId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    application_id: String(row.application_id),
    question_id: String(row.question_id),
    question_text: String(row.question_text ?? ""),
    answer: (row.answer ?? {}) as Record<string, unknown>,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  }));
}

export function mergeApplicationScreeningViews(args: {
  questions: JobScreeningQuestionRow[];
  answers: ApplicationScreeningAnswerRow[];
  includeInactive?: boolean;
}): ApplicationScreeningQuestionView[] {
  const answersByQuestionId = new Map(
    args.answers.map((row) => [row.question_id, row])
  );
  const questionRows = args.includeInactive
    ? args.questions
    : args.questions.filter((row) => row.is_active);
  return questionRows
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((question) => {
      const answerRow = answersByQuestionId.get(question.id);
      const rawValue = answerRow?.answer?.value ?? null;
      const answered = !isScreeningAnswerEmpty(question.question_type, rawValue);
      return {
        id: question.id,
        question: answerRow?.question_text?.trim() || question.question,
        questionType: question.question_type,
        options: question.options,
        isRequired: question.is_required,
        sortOrder: question.sort_order,
        isActive: question.is_active,
        answer: rawValue,
        answerDisplay: formatScreeningAnswerDisplay(
          question.question_type,
          rawValue,
          question.options
        ),
        answered,
      };
    });
}

export async function loadApplicationScreeningContext(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  jobId: string
): Promise<{
  questions: ApplicationScreeningQuestionView[];
  assessment: ScreeningAssessmentSummary;
}> {
  const [questions, answers] = await Promise.all([
    loadJobScreeningQuestions(supabase, tenantId, jobId, { activeOnly: false }),
    loadApplicationScreeningAnswers(supabase, tenantId, applicationId),
  ]);
  const views = mergeApplicationScreeningViews({
    questions,
    answers,
    includeInactive: true,
  });
  return {
    questions: views.filter((item) => item.isActive),
    assessment: buildScreeningAssessment(views),
  };
}

export async function upsertApplicationScreeningAnswers(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    applicationId: string;
    jobId: string;
    answers: ApplicationScreeningAnswerInput[];
  }
): Promise<ApplicationScreeningQuestionView[]> {
  const questions = await loadJobScreeningQuestions(supabase, args.tenantId, args.jobId, {
    activeOnly: true,
  });
  const questionById = new Map(questions.map((row) => [row.id, row]));
  const answerByQuestionId = new Map(
    args.answers.map((item) => [item.questionId, item.answer])
  );

  for (const question of questions) {
    if (!answerByQuestionId.has(question.id)) continue;
    const normalized = normalizeScreeningAnswerValue(
      question.question_type,
      answerByQuestionId.get(question.id)
    );
    if (question.is_required && isScreeningAnswerEmpty(question.question_type, normalized)) {
      throw new Error(`Answer required for: ${question.question}`);
    }
    const payload = {
      tenant_id: args.tenantId,
      application_id: args.applicationId,
      question_id: question.id,
      question_text: question.question,
      answer: { value: normalized },
    };
    const { error } = await supabase
      .from("application_screening_answers")
      .upsert(payload, { onConflict: "application_id,question_id" });
    if (error) throw error;
  }

  const stored = await loadApplicationScreeningAnswers(
    supabase,
    args.tenantId,
    args.applicationId
  );
  return mergeApplicationScreeningViews({
    questions,
    answers: stored,
    includeInactive: false,
  });
}

export function jobScreeningQuestionToInput(row: JobScreeningQuestionRow): JobScreeningQuestionInput {
  return {
    id: row.id,
    question: row.question,
    questionType: row.question_type,
    options: row.options,
    isRequired: row.is_required,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export function parseScreeningQuestionsFromBody(raw: unknown): JobScreeningQuestionInput[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const questionType = String(record.questionType ?? record.question_type ?? "short_text");
      return normalizeJobScreeningQuestionInput(
        {
          id: typeof record.id === "string" ? record.id : null,
          question: String(record.question ?? ""),
          questionType: questionType as JobScreeningQuestionType,
          options: normalizeOptions(record.options),
          isRequired: record.isRequired !== false && record.is_required !== false,
          sortOrder:
            typeof record.sortOrder === "number"
              ? record.sortOrder
              : typeof record.sort_order === "number"
                ? record.sort_order
                : index,
          isActive: record.isActive !== false && record.is_active !== false,
        },
        index
      );
    })
    .filter((item): item is JobScreeningQuestionInput => Boolean(item));
}
