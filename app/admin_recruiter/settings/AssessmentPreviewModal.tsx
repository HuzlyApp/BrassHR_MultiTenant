"use client";

import { useState } from "react";
import OnboardingStepper from "@/app/components/OnboardingStepper";
import SkillAssessmentCategoryList from "@/app/application/components/SkillAssessmentCategoryList";
import SkillQuizForm from "@/app/application/components/SkillQuizForm";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import type {
  SkillAssessmentCatalog,
  SkillCategoryDraft,
  SkillQuizAnswerValue,
  SkillQuizAnswers,
} from "@/lib/skill-assessment/types";
import {
  getSkillQuizPageQuestions,
  getSkillQuizTotalPages,
} from "@/lib/skill-quiz-pagination";
import { X } from "lucide-react";

type Props = {
  catalog: SkillAssessmentCatalog;
  onClose: () => void;
};

const PAGE_SIZE = 5;

export default function AssessmentPreviewModal({ catalog, onClose }: Props) {
  const branding = useTenantBranding();
  const [view, setView] = useState<"categories" | "quiz">("categories");
  const [category, setCategory] = useState<SkillCategoryDraft | null>(null);
  const [page, setPage] = useState(1);
  const [answers, setAnswers] = useState<SkillQuizAnswers>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const questions = category?.questions ?? [];
  const { pageQuestions, safePage, totalPages, start } = getSkillQuizPageQuestions(
    questions,
    page,
    PAGE_SIZE
  );

  function openCategory(next: SkillCategoryDraft) {
    setCategory(next);
    setPage(1);
    setView("quiz");
  }

  function answer(questionId: string, value: SkillQuizAnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function nextPage() {
    const pages = getSkillQuizTotalPages(questions.length, PAGE_SIZE);
    if (safePage >= pages) {
      if (category) setCompleted((prev) => new Set(prev).add(category.slug));
      setView("categories");
      setCategory(null);
      return;
    }
    setPage(safePage + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-[#012352]">Preview Applicant Experience</p>
            <p className="text-xs text-[#64748B]">Draft content, current branding. Answers are not saved.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9]"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8" style={brandingToCssVars(branding)}>
          {!catalog.enabled ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Skill Assessment is disabled. Applicants will not see this step after you publish.
            </p>
          ) : (
            <>
              <OnboardingStepper />
              {view === "categories" ? (
                <SkillAssessmentCategoryList
                  catalog={catalog}
                  completedSlugs={completed}
                  onSelectCategory={openCategory}
                  allowSkip={catalog.allowSkip}
                  onSkip={onClose}
                  onBack={onClose}
                  onContinue={onClose}
                  continueLabel="Save & continue"
                />
              ) : category ? (
                <SkillQuizForm
                  category={category}
                  pageQuestions={pageQuestions}
                  startIndex={start}
                  answers={answers}
                  onAnswer={answer}
                  pageLabel={questions.length === 0 ? "—" : `${safePage} of ${totalPages}`}
                  allowSkip={catalog.allowSkip}
                  onSkip={() => setView("categories")}
                  onBack={() => {
                    if (safePage > 1) setPage(safePage - 1);
                    else setView("categories");
                  }}
                  onNext={nextPage}
                  readOnly={false}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
