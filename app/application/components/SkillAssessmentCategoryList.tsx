"use client";

import {
  activeSkillCategories,
  findSkillCategoryBySlug,
} from "@/lib/skill-assessment/catalog";
import type { SkillAssessmentCatalog, SkillCategoryDraft } from "@/lib/skill-assessment/types";
import { Check, ChevronRight } from "lucide-react";

type Props = {
  catalog: SkillAssessmentCatalog;
  completedSlugs?: Set<string>;
  onSelectCategory: (category: SkillCategoryDraft) => void;
  allowSkip?: boolean;
  onSkip?: () => void;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  interactive?: boolean;
};

export default function SkillAssessmentCategoryList({
  catalog,
  completedSlugs,
  onSelectCategory,
  allowSkip = true,
  onSkip,
  onBack,
  onContinue,
  continueLabel = "Save & continue",
  interactive = true,
}: Props) {
  const categories = activeSkillCategories(catalog);

  return (
    <div className="flex flex-1 flex-col pt-6 sm:pt-8">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold leading-7 text-slate-800 sm:text-[24px] sm:leading-8">
          Skill Assessment Quiz
        </h2>
        {allowSkip && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 cursor-pointer text-[12px] font-medium leading-5 text-[color:var(--brand-primary)]"
          >
            Skip for Now →
          </button>
        ) : null}
      </div>
      <p className="mb-5 text-xs text-slate-500 sm:mb-6 sm:text-[13px]">Identify Strengths. Verify Readiness.</p>

      {categories.length === 0 ? (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
          No active skill assessment categories are published yet.
        </div>
      ) : null}

      <div className="space-y-2 sm:space-y-3">
        {categories.map((cat, index) => {
          const isCompleted = Boolean(completedSlugs?.has(cat.slug));
          return (
            <div
              key={cat.id}
              onClick={() => interactive && onSelectCategory(cat)}
              className={`flex items-center justify-between gap-2 rounded-xl border border-[color:var(--brand-primary)] px-3 py-3 transition max-[399px]:gap-2 max-[399px]:px-3 max-[399px]:py-3 sm:gap-3 sm:px-4 sm:py-4 ${
                interactive ? "cursor-pointer" : ""
              } ${
                isCompleted
                  ? "bg-[color:var(--brand-primary)]/10"
                  : interactive
                    ? "bg-white hover:bg-[color:var(--brand-primary)]/5"
                    : "bg-white"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-primary)] text-[13px] font-semibold max-[399px]:h-7 max-[399px]:w-7 max-[399px]:text-[12px] ${
                    isCompleted
                      ? "bg-[color:var(--brand-primary)] text-white"
                      : "text-[color:var(--brand-primary)]"
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate-800 max-[399px]:text-[13px]">{cat.name}</p>
                  {cat.description ? (
                    <p className="text-[12px] text-slate-500 max-[399px]:text-[11px]">{cat.description}</p>
                  ) : null}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--brand-primary)]" />
            </div>
          );
        })}
      </div>

      {onBack || onContinue ? (
        <div className="mt-auto grid grid-cols-2 gap-2 pt-6 max-[399px]:gap-2 sm:flex sm:items-center sm:justify-end sm:gap-3 sm:pt-8">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="w-full cursor-pointer rounded-md border border-[color:var(--brand-primary)] bg-white px-3 py-2.5 text-[11px] font-medium leading-5 text-[color:var(--brand-primary)] transition hover:bg-[color:var(--brand-primary)]/5 max-[399px]:px-3 max-[399px]:text-[11px] sm:w-auto sm:px-5 sm:py-2 sm:text-[12px]"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {onContinue ? (
            <button
              type="button"
              onClick={onContinue}
              className="w-full cursor-pointer rounded-md bg-[color:var(--brand-primary)] px-3 py-2.5 text-[11px] font-medium leading-5 text-white transition hover:brightness-90 max-[399px]:px-3 max-[399px]:text-[11px] sm:w-auto sm:px-6 sm:py-2 sm:text-[12px]"
            >
              {continueLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function categoryBySlugOrNull(catalog: SkillAssessmentCatalog, slug: string) {
  return findSkillCategoryBySlug(catalog, slug);
}
