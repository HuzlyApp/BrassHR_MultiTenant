"use client";

import { Check, GripVertical, Plus } from "lucide-react";
import BrandedDeleteIcon from "@/app/admin_recruiter/components/BrandedDeleteIcon";
import type { JobScreeningQuestionInput, JobScreeningQuestionType } from "@/lib/jobs/screening-questions";
import { JOB_SCREENING_QUESTION_TYPES } from "@/lib/jobs/screening-questions";
import {
  JOB_FORM_ICON_BUTTON_CLASS,
  JOB_FORM_INPUT_CLASS,
  JOB_FORM_LABEL_CLASS,
  JOB_FORM_SECTION_SUBTITLE_CLASS,
  JOB_FORM_SECTION_TITLE_CLASS,
  JOB_FORM_SELECT_CHEVRON,
  JOB_FORM_SELECT_CLASS,
  JOB_FORM_SURFACE_CLASS,
} from "./job-form-shared";

const QUESTION_TYPE_LABELS: Record<JobScreeningQuestionType, string> = {
  yes_no: "Yes / No",
  single_select: "Single select",
  multiple_select: "Multiple select",
  short_text: "Short text",
  long_text: "Long text",
  number: "Number",
};

const QUESTION_TEXTAREA_CLASS = `${JOB_FORM_SURFACE_CLASS} min-h-[7rem] w-full resize-y px-3 py-2 text-sm outline-none transition focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_12%,transparent)]`;

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
    <section className={`${JOB_FORM_SURFACE_CLASS} space-y-3 p-3 sm:p-4`}>
      <div className="min-w-0">
        <h3 className={JOB_FORM_SECTION_TITLE_CLASS}>Screening Questions</h3>
        <p className={`${JOB_FORM_SECTION_SUBTITLE_CLASS} w-full max-w-none`}>
          Use screening questions to collect job-specific information from applicants.
        </p>
      </div>

      {activeQuestions.length === 0 ? (
        <p className="text-sm text-[#64748B]">No screening questions added yet.</p>
      ) : (
        <ol className="space-y-2.5">
          {questions.map((item, index) => {
            if (item.isActive === false) return null;
            const showOptions =
              item.questionType === "single_select" || item.questionType === "multiple_select";
            return (
              <li
                key={item.id ?? `new-${index}`}
                className="min-w-0 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm font-medium text-[#64748B]">
                    Question {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className={JOB_FORM_ICON_BUTTON_CLASS}
                    aria-label="Remove question"
                  >
                    <BrandedDeleteIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-w-0 space-y-2.5">
                  <textarea
                    value={item.question}
                    onChange={(event) =>
                      updateQuestion(index, { question: event.target.value })
                    }
                    rows={2}
                    className={QUESTION_TEXTAREA_CLASS}
                    placeholder="Do you have at least 2 years of outpatient experience?"
                  />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                    <label className="block w-full min-w-0 space-y-1 sm:max-w-[240px]">
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
                        className={`${JOB_FORM_SELECT_CLASS} w-full`}
                        style={{ backgroundImage: JOB_FORM_SELECT_CHEVRON }}
                      >
                        {JOB_SCREENING_QUESTION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {QUESTION_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="inline-flex w-full shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap text-sm text-[#334155] sm:ml-auto sm:w-auto sm:pb-2">
                      <span className="relative inline-flex h-5 w-5 shrink-0">
                        <input
                          type="checkbox"
                          checked={item.isRequired !== false}
                          onChange={(event) =>
                            updateQuestion(index, { isRequired: event.target.checked })
                          }
                          className="peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border-2 border-[#CBD5E1] bg-white transition-colors checked:border-[color:var(--brand-secondary)] checked:bg-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_30%,transparent)]"
                        />
                        <Check
                          className="pointer-events-none absolute inset-0 m-auto hidden h-3 w-3 text-white peer-checked:block"
                          strokeWidth={3}
                          aria-hidden
                        />
                      </span>
                      Required
                    </label>
                  </div>

                  {showOptions ? (
                    <div className="min-w-0 space-y-2">
                      <p className={JOB_FORM_LABEL_CLASS}>Options</p>
                      {(item.options ?? []).map((option, optionIndex) => (
                        <div key={`${index}-${optionIndex}`} className="flex min-w-0 items-center gap-2">
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
                            className={`${JOB_FORM_INPUT_CLASS} min-w-0 flex-1`}
                            placeholder={`Option ${optionIndex + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(index, optionIndex)}
                            className={JOB_FORM_ICON_BUTTON_CLASS}
                            aria-label="Remove option"
                          >
                            <BrandedDeleteIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(index)}
                        className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
                      >
                        Add option
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={addQuestion}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC] sm:w-auto sm:justify-start"
      >
        <Plus className="h-4 w-4" />
        Add question
      </button>
    </section>
  );
}
