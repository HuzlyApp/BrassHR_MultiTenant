"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { JobScreeningQuestionInput, JobScreeningQuestionType } from "@/lib/jobs/screening-questions";
import { JOB_SCREENING_QUESTION_TYPES } from "@/lib/jobs/screening-questions";
import {
  JOB_FORM_INPUT_CLASS,
  JOB_FORM_LABEL_CLASS,
  JOB_FORM_SECTION_SUBTITLE_CLASS,
  JOB_FORM_SECTION_TITLE_CLASS,
  JOB_FORM_SELECT_CLASS,
  JOB_FORM_SURFACE_CLASS,
  JOB_FORM_TEXTAREA_CLASS,
} from "./job-form-shared";

const QUESTION_TYPE_LABELS: Record<JobScreeningQuestionType, string> = {
  yes_no: "Yes / No",
  single_select: "Single select",
  multiple_select: "Multiple select",
  short_text: "Short text",
  long_text: "Long text",
  number: "Number",
};

function emptyQuestion(sortOrder: number): JobScreeningQuestionInput {
  return {
    question: "",
    questionType: "yes_no",
    isRequired: true,
    sortOrder,
    isActive: true,
    options: null,
  };
}

type Props = {
  questions: JobScreeningQuestionInput[];
  onChange: (questions: JobScreeningQuestionInput[]) => void;
};

export function JobScreeningQuestionsEditor({ questions, onChange }: Props) {
  const activeQuestions = questions.filter((item) => item.isActive !== false);

  function updateQuestion(index: number, patch: Partial<JobScreeningQuestionInput>) {
    onChange(
      questions.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
  }

  function removeQuestion(index: number) {
    const target = questions[index];
    if (target?.id) {
      updateQuestion(index, { isActive: false });
      return;
    }
    onChange(questions.filter((_, itemIndex) => itemIndex !== index));
  }

  function addQuestion() {
    onChange([...questions, emptyQuestion(questions.length)]);
  }

  function addOption(index: number) {
    const current = questions[index];
    const options = [...(current.options ?? []), { label: "", value: "" }];
    updateQuestion(index, { options });
  }

  function updateOption(
    questionIndex: number,
    optionIndex: number,
    patch: Partial<{ label: string; value: string }>
  ) {
    const current = questions[questionIndex];
    const options = (current.options ?? []).map((option, idx) =>
      idx === optionIndex ? { ...option, ...patch } : option
    );
    updateQuestion(questionIndex, { options });
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    const current = questions[questionIndex];
    updateQuestion(questionIndex, {
      options: (current.options ?? []).filter((_, idx) => idx !== optionIndex),
    });
  }

  return (
    <section className={`${JOB_FORM_SURFACE_CLASS} space-y-4 p-4`}>
      <div>
        <h3 className={JOB_FORM_SECTION_TITLE_CLASS}>Screening Questions</h3>
        <p className={JOB_FORM_SECTION_SUBTITLE_CLASS}>
          Use screening questions to collect job-specific information from applicants.
        </p>
      </div>

      {activeQuestions.length === 0 ? (
        <p className="text-sm text-[#64748B]">No screening questions added yet.</p>
      ) : (
        <ol className="space-y-4">
          {questions.map((item, index) => {
            if (item.isActive === false) return null;
            const showOptions =
              item.questionType === "single_select" || item.questionType === "multiple_select";
            return (
              <li
                key={item.id ?? `new-${index}`}
                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
              >
                <div className="mb-3 flex items-start gap-2">
                  <GripVertical className="mt-2 h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-3">
                    <label className="block space-y-1.5">
                      <span className={JOB_FORM_LABEL_CLASS}>Question {index + 1}</span>
                      <textarea
                        value={item.question}
                        onChange={(event) =>
                          updateQuestion(index, { question: event.target.value })
                        }
                        rows={2}
                        className={JOB_FORM_TEXTAREA_CLASS}
                        placeholder="Do you have at least 2 years of outpatient experience?"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1.5">
                        <span className={JOB_FORM_LABEL_CLASS}>Type</span>
                        <select
                          value={item.questionType}
                          onChange={(event) => {
                            const questionType = event.target.value as JobScreeningQuestionType;
                            updateQuestion(index, {
                              questionType,
                              options:
                                questionType === "single_select" ||
                                questionType === "multiple_select"
                                  ? item.options?.length
                                    ? item.options
                                    : [{ label: "Option 1", value: "option_1" }]
                                  : null,
                            });
                          }}
                          className={JOB_FORM_SELECT_CLASS}
                        >
                          {JOB_SCREENING_QUESTION_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {QUESTION_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="inline-flex items-center gap-2 pt-7 text-sm text-[#334155]">
                        <input
                          type="checkbox"
                          checked={item.isRequired !== false}
                          onChange={(event) =>
                            updateQuestion(index, { isRequired: event.target.checked })
                          }
                          className="h-4 w-4 rounded border-[#CBD5E1]"
                        />
                        Required
                      </label>
                    </div>

                    {showOptions ? (
                      <div className="space-y-2">
                        <p className={JOB_FORM_LABEL_CLASS}>Options</p>
                        {(item.options ?? []).map((option, optionIndex) => (
                          <div key={`${index}-${optionIndex}`} className="flex items-center gap-2">
                            <input
                              value={option.label}
                              onChange={(event) =>
                                updateOption(index, optionIndex, {
                                  label: event.target.value,
                                  value:
                                    option.value ||
                                    event.target.value.toLowerCase().replace(/\s+/g, "_"),
                                })
                              }
                              className={JOB_FORM_INPUT_CLASS}
                              placeholder={`Option ${optionIndex + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(index, optionIndex)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                              aria-label="Remove option"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addOption(index)}
                          className="text-sm font-medium text-[#0F766E] hover:underline"
                        >
                          Add option
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                    aria-label="Remove question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={addQuestion}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
      >
        <Plus className="h-4 w-4" />
        Add question
      </button>
    </section>
  );
}
